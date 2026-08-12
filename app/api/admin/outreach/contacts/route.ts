export const maxDuration = 60;

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { isAuthenticated } from '@/lib/auth';
import { getBrands, updateBrand, DIEZ_PROFILE, type Contact } from '@/lib/crm';

const client = new Anthropic();
const MODEL = 'claude-sonnet-4-6';

// POST { brandId } — surface 2-3 likely outreach contacts for a brand.
// Free sourcing: named partnership/influencer people the model knows of + standard
// role inboxes. Guessed named-emails are flagged unverified (no paid enrichment yet).
export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { brandId } = await req.json().catch(() => ({}));
  if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 });

  const brand = (await getBrands()).find(b => b.id === brandId);
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

  const prompt = `${DIEZ_PROFILE}

I'm doing brand-partnership outreach for Diez and need the best 2-3 CONTACT POINTS at this brand:
BRAND: ${brand.name}
WEBSITE: ${brand.domain}
CATEGORY: ${brand.category}
TARGET MARKET: ${brand.region}

Return the people/inboxes most likely to own creator/influencer partnerships, in the ${brand.region} market where possible. Prioritise, in order:
1. Named people you are reasonably confident actually work (or recently worked) in influencer marketing, creator partnerships, brand partnerships, or gaming/community marketing at this brand. Give their real title. If you know or can infer the email pattern (e.g. first.last@${brand.domain}), include it and set kind="named".
2. Standard role inboxes that fit this brand (e.g. partnerships@${brand.domain}, influencers@${brand.domain}, marketing@${brand.domain}, press@${brand.domain}, creators@${brand.domain}). set kind="role".

Rules:
- Never invent a specific person you have no basis for. If unsure of a name, prefer a role inbox.
- For any guessed (unverified) email, add note "email pattern guessed — verify before sending".
- 2 to 3 contacts total, best first.

Output ONLY a JSON array, no prose:
[{"name":"Full name or role","title":"Job title or 'Role inbox'","email":"...@${brand.domain}","kind":"named|role","region":"US|UK|EU","linkedin":"profile url or null","note":"short note or null"}]`;

  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = res.content[0]?.type === 'text' ? res.content[0].text : '';
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim();
    let arr: any[] = [];
    try { arr = JSON.parse(cleaned); } catch { const m = cleaned.match(/\[[\s\S]+\]/); if (m) arr = JSON.parse(m[0]); }

    const contacts: Contact[] = (arr || []).slice(0, 3).map((c, i) => ({
      id: `${brandId}-c${i}-${Date.now().toString(36)}`,
      name: String(c.name || 'Partnerships'),
      title: String(c.title || 'Role inbox'),
      email: String(c.email || `partnerships@${brand.domain}`),
      kind: c.kind === 'named' ? 'named' : 'role',
      verified: false,
      region: c.region || brand.region,
      linkedin: c.linkedin && c.linkedin !== 'null' ? c.linkedin : undefined,
      note: c.note && c.note !== 'null' ? c.note : undefined,
    }));

    const nextStage = brand.stage === 'new' || brand.stage === 'researching' ? 'contacts' : brand.stage;
    const updated = await updateBrand(brandId, { contacts, stage: nextStage });
    return NextResponse.json({ brand: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message?.slice(0, 200) || 'Failed' }, { status: 500 });
  }
}
