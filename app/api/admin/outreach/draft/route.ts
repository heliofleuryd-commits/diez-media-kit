export const maxDuration = 60;

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { isAuthenticated } from '@/lib/auth';
import { getBrands, updateBrand, DIEZ_PROFILE } from '@/lib/crm';

const client = new Anthropic();
const MODEL = 'claude-sonnet-4-6';

// POST { brandId, contactId? } — draft a personalised outreach email for a brand.
export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { brandId, contactId } = await req.json().catch(() => ({}));
  if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 });

  const brand = (await getBrands()).find(b => b.id === brandId);
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
  const contact = brand.contacts.find(c => c.id === contactId) || brand.contacts[0];

  const prompt = `${DIEZ_PROFILE}

Write a cold outreach email from Diez's team to pitch a paid brand partnership.

RECIPIENT BRAND: ${brand.name} (${brand.category}, ${brand.domain})
WHY THIS BRAND FITS DIEZ: ${brand.fit}
${contact ? `RECIPIENT: ${contact.name}${contact.title ? ` — ${contact.title}` : ''}` : 'RECIPIENT: brand partnerships team'}

Requirements:
- Subject line: short, specific, no clickbait. Reference Diez + the brand.
- Warm, confident, concise (120-170 words). Not desperate, not generic.
- Open with a specific hook tying Diez's Warzone/FPS audience to THIS brand's product.
- Include 2-3 hard proof points from the profile (audience size, monthly views, past brand work like Call of Duty / Razer / PlayStation) — pick the ones most relevant to this brand.
- Propose a concrete, low-friction next step (a quick call, or send the media kit).
- Sign off as "Diez — via the GLTCH Group team" with reply-to hello@diez.gg.
- Plain text, no markdown, no placeholders like [X] except the recipient's first name if unknown use a friendly generic greeting.

Output ONLY JSON: {"subject":"...","body":"..."}`;

  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = res.content[0]?.type === 'text' ? res.content[0].text : '';
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim();
    let obj: any = {};
    try { obj = JSON.parse(cleaned); } catch { const m = cleaned.match(/\{[\s\S]+\}/); if (m) obj = JSON.parse(m[0]); }

    const draft = {
      subject: String(obj.subject || `Diez x ${brand.name} — partnership`),
      body: String(obj.body || ''),
      contactId: contact?.id,
      updatedAt: Date.now(),
    };
    const nextStage = ['new', 'researching', 'contacts'].includes(brand.stage) ? 'drafted' : brand.stage;
    const updated = await updateBrand(brandId, { draft, stage: nextStage as any });
    return NextResponse.json({ brand: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message?.slice(0, 200) || 'Failed' }, { status: 500 });
  }
}
