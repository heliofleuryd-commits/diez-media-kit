export const maxDuration = 60;

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { CREATOR_BIAS } from '@/lib/football/creatorBias';
import { calcCost } from '@/lib/football/costTracker';

const client = new Anthropic();
const MODEL = 'claude-sonnet-4-6';
const SKILLS_DIR = path.join(process.cwd(), 'content-plan', 'skills');

function loadProfile(name: string): string {
  const f = path.join(SKILLS_DIR, `channel-${name}-profile.md`);
  try { return fs.readFileSync(f, 'utf-8'); } catch { return ''; }
}

const SCRIPT_STRUCTURE = `
TOQUEYMEDIO EMOTIONAL STORYTELLING STRUCTURE (7 BEATS):

BEAT 1 — HOOK (0:00–0:08): Pure emotion. No facts yet. Use one of:
  A) "Imagine" immersion — place viewer inside the moment of maximum dread/hope
  B) Paradox — "[What everyone believes]. [Its devastating inversion]."
  C) Dramatic irony — "[Date/place]. [They don't know what's coming]. [What is coming]."
FORBIDDEN: "Did you know…", stats-first, stand-alone question, hype openers.

BEAT 2 — SACRED GROUND (0:08–0:20): Date. Place. Stakes — one sentence. Stated gravely.

BEAT 3 — GAME/LIFE NARRATIVE (0:20–1:10): THE LONGEST SECTION.
  MANDATORY: minute markers ("Minute 7." "Minute 55."), specific player names at every moment, exact score progression, specific plays described cinematically, emotional sentence after each fact.
  WRONG: "The game was dramatic." RIGHT: "Minute 82 — Gyan equalises. Then comes Minute 120..."

BEAT 4 — THE TURN: "And then…" — one fragment. The pivot. Everything changes.

BEAT 5 — CLIMAX: SLOW DOWN. Ceremonial full name. Cosmic imagery. The moment.

BEAT 6 — TWO FACES: Winner's euphoria / loser's desolation — one sentence each.

BEAT 7 — APHORISTIC CLOSER: One universal truth. Standalone. Silence follows.

ELEFUTBOL METAPHOR LAYER (weave throughout):
- The Third Element in Heaven — a dead parent/friend "pushing from above"
- Body vs Soul Antithesis — physical decline vs spiritual indomitability
- Sacred Contrast — glory beside grief, trophy beside absent loved one
- The Letter — address the subject as "you" at the emotional peak
- Personification — the ball, silence, fear all have consciousness and will
- Ceremonial Naming — full birth name reserved for the climax moment only
`;

function buildSystemPrompt(toqueymedio: string, elefutbol: string): string {
  return `You are an elite emotional football scriptwriter. You write in the style of @toqueymedio with metaphors and emotional depth from @elefutbol.

STYLE PROFILE — @toqueymedio:
${toqueymedio.slice(0, 3000)}

METAPHOR REFERENCE — @elefutbol:
${elefutbol.slice(0, 2000)}

${SCRIPT_STRUCTURE}

FORMAT RULES:
- 105–135 seconds read aloud (2–2.5 min)
- Clean spoken words ONLY — no [CAM], no [BROLL], no direction notes
- Present-tense narration for immediacy
- Anaphora, triadic repetition, personification of objects
- Full ceremonial name ONLY at the climax
- Every sentence either states a fact or delivers emotion — never padding

AFTER EVERY SCRIPT, add:
**Hook:** (the opening line)
**Caption:** (under 150 chars)
**Hashtags:** (6–8 tags)

${CREATOR_BIAS}

When the user asks you to adjust, rewrite, or refine — do it immediately without asking clarifying questions. Make bold creative decisions.`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, story } = body;

    if (!messages?.length) {
      return NextResponse.json({ ok: false, error: 'No messages' }, { status: 400 });
    }

    const toqueymedio = loadProfile('toqueymedio');
    const elefutbol = loadProfile('elefutbol');

    const systemBlocks: any[] = [
      {
        type: 'text',
        text: buildSystemPrompt(toqueymedio, elefutbol),
        cache_control: { type: 'ephemeral' },
      },
    ];

    if (story) {
      systemBlocks.push({
        type: 'text',
        text: `STORY CONTEXT:\nTitle: ${story.title}\nType: ${story.type}\nPlayer: ${story.player || 'N/A'}\nTeams: ${story.teams || 'N/A'}\nRelevance: ${story.relevance}\nWhy today: ${story.why_today}\nHeadline hook: ${story.headline}\nKey facts:\n${(story.key_facts || []).map((f: string, i: number) => `${i + 1}. ${f}`).join('\n')}\nEmotional arc: ${story.emotional_arc}\nScript angle: ${story.script_angle}`,
        cache_control: { type: 'ephemeral' },
      });
    }

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: systemBlocks,
      messages: messages.slice(-20),
    });

    const text = res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const cost = calcCost(MODEL, res.usage.input_tokens, res.usage.output_tokens);

    return NextResponse.json({ ok: true, message: text, cost });
  } catch (e: any) {
    console.error('[stories/script] Failed:', e.message);
    return NextResponse.json({ ok: false, error: e.message?.slice(0, 200) || 'Unknown error' }, { status: 500 });
  }
}
