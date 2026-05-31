import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { scene, actions, duration, name } = await req.json();
    const slug = (name || 'tactics').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    const payload = { scene, actions, duration, name, exportedAt: new Date().toISOString() };
    const json = JSON.stringify(payload, null, 2);

    return new NextResponse(json, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${slug}_${Date.now()}.json"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
