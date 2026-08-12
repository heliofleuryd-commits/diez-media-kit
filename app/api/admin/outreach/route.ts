import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getBrands, seedBrands, updateBrand, type Stage } from '@/lib/crm';

export const dynamic = 'force-dynamic';

// GET — full brand list. Auto-seeds the curated shortlist on first load.
export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let brands = await getBrands();
  if (!brands.length) brands = await seedBrands('merge');
  return NextResponse.json({ brands });
}

// POST — actions: { action: 'seed' | 'reseed' | 'updateStage' | 'updateNotes' }
export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  if (body.action === 'seed')   return NextResponse.json({ brands: await seedBrands('merge') });
  if (body.action === 'reseed') return NextResponse.json({ brands: await seedBrands('replace') });

  if (body.action === 'updateStage' && body.id) {
    const brand = await updateBrand(body.id, { stage: body.stage as Stage });
    return NextResponse.json({ brand });
  }
  if (body.action === 'updateNotes' && body.id) {
    const brand = await updateBrand(body.id, { notes: String(body.notes || '') });
    return NextResponse.json({ brand });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
