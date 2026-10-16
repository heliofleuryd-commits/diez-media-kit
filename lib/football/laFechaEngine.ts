// Engine for the La Fecha Storyteller — writes English TikTok scripts in the voice
// of @lafechadeportes (Colombian football storytelling), from the skill profile
// rebuilt from his Whisper transcripts. Mirrors the Emotional Storyteller pipeline
// (research → draft → polish) but is lafechadeportes-only and English-first.
//
// Generic stages (live research, factual research, intent routing) are REUSED from
// emotionalEngine so the two tools stay consistent. Nothing here mutates that file.

import type Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { calcCost } from './costTracker';
import { OPUS, SONNET, HAIKU, stripDividers, liveResearch, runResearch, runClassify } from './emotionalEngine';
import type { StageResult } from './emotionalEngine';

export { OPUS, SONNET, HAIKU, liveResearch, runResearch, runClassify };
export type { StageResult };

const SKILLS_DIR  = path.join(process.cwd(), 'content-plan', 'skills');
const PROFILE_FILE = path.join(SKILLS_DIR, 'channel-lafechadeportes-profile.md');
const GAP_FILE     = path.join(SKILLS_DIR, 'lafechadeportes-gap-analysis.md');

function loadProfile(): string {
  try { return fs.readFileSync(PROFILE_FILE, 'utf-8'); } catch { return ''; }
}
function loadGap(): string {
  try { return fs.readFileSync(GAP_FILE, 'utf-8'); } catch { return ''; }
}

function extractText(res: any): string {
  return res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
}

const ENGLISH_RULE = `ABSOLUTE RULE — OUTPUT LANGUAGE IS ENGLISH. @lafechadeportes narrates in Spanish; you write for a US/UK TikTok audience. Every script is in natural, native-sounding ENGLISH. Adapt his Spanish devices into English that carries the same emotional punch — never leave Spanish in, never translate word-for-word into stiff English.`;

function buildLaFechaSystem(): string {
  return `You are an elite TikTok football script writer who writes in the exact voice of the Colombian storytelling creator @lafechadeportes — but in ENGLISH, for a US/UK audience.

${ENGLISH_RULE}

His style, in one line: the redemption storyteller — part witness, part preacher, part defense attorney for the misunderstood. Facts are the content; emotion is the delivery. He re-stages the human wound behind a famous name, then redeems it.

FORMAT (non-negotiable):
- ~105–140 seconds read aloud (emotional stories need room to build)
- Clean spoken words only — NO [CAM]/[BROLL]/direction notes, NO markdown headers in the body, NO "---" dividers, NO bold in the script body
- Open on the wound or the paradox, not on stats. Build to a redemption/reveal. Close on one aphoristic line, then silence.

THE SKILL PROFILE BELOW IS YOUR STYLE BIBLE — follow its voice, devices, beats and pacing exactly:

${loadProfile()}

AFTER the script, on new lines, always add:
**Hook:** (the opening lines as one block)
**Caption:** (under 150 chars)
**Hashtags:** (6–8 relevant tags)

Be direct. Make the creative decision and write — don't ask clarifying questions unless essential.`;
}

export async function runDraft(client: Anthropic, topic: string, context: string, model = OPUS): Promise<StageResult> {
  const res = await client.messages.create({
    model, max_tokens: 4000,
    system: [{ type: 'text', text: buildLaFechaSystem(), cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: `Write me a complete @lafechadeportes-style script, IN ENGLISH, about:

"${topic}"

Researched facts — weave these real facts in, and use the origin / early-life / wound facts to open the story:
${context || '(no extra context — rely on verified knowledge, do not invent recent events)'}`,
    }],
  });
  return { text: stripDividers(extractText(res)), cost: calcCost(model, res.usage.input_tokens, res.usage.output_tokens), model };
}

export async function runViral(client: Anthropic, draft: string, model = OPUS): Promise<StageResult> {
  const res = await client.messages.create({
    model, max_tokens: 4000,
    system: [{ type: 'text', text: `You are the final editor for La Fecha. You take a draft that is ~75% there and elevate it into a finished @lafechadeportes-style script that reads like his own viral videos — but in ENGLISH. The profile below OVERRIDES everything else.\n\n${ENGLISH_RULE}\n\n${loadProfile()}`, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: `Here is the draft to elevate:
"""
${draft}
"""

Rewrite it into a finished English script in his voice. Non-negotiables:

0. STRUCTURE — follow his arc: the wound/paradox hook, the humble origin, the rise, the dated wound (state the date plainly), the darkness/doubt, the redemption setup, the ceremonial full name at the threshold of the climax, the climax, the reaction, the dedication, and a short aphoristic two-line closer. This shape is what makes it feel like his videos.

1. THE HOOK — 2 or 3 short punchy lines, each a single breath (max ~14 words). The final line is the turn and starts with "And" or "But". Open on the wound or the paradox — never on stats.

2. FLOW — after the hook, write in COMPLETE, FLOWING sentences with connectors (and, because, until, while), not choppy fragments. Reserve a standalone fragment only for a single hammer-blow (the turn, the goal, the silence).

3. VARIETY — invent FRESH imagery specific to THIS person. Do not reuse stock lines. Only use crowd-eruption imagery if literally describing a goal or trophy.

4. LENGTH — ~480–560 words, never above 600.

5. ENGLISH ONLY — natural, native English. Keep his warmth and his "defense of the wronged" stance, adapted to English idiom.

FORMATTING — clean spoken lines, blank line between beats, NO "---", NO bold in the body, NO headers.

After the script, on new lines:
**Hook:** (the opening lines as one block)
**Caption:** (under 150 chars)
**Hashtags:** (6–8 tags)`,
    }],
  });
  return { text: stripDividers(extractText(res)), cost: calcCost(model, res.usage.input_tokens, res.usage.output_tokens), model };
}

export async function runChat(client: Anthropic, messages: any[], model = OPUS): Promise<StageResult> {
  const res = await client.messages.create({
    model, max_tokens: 4000,
    system: [{ type: 'text', text: `You are the La Fecha editor. Do EXACTLY what the latest message asks — and nothing more. Match the SCOPE precisely:
- Only hooks asked for → return only that many hooks (2–3 punchy lines each), nothing else.
- Rewrite/critique ONE section or line → return only that part.
- A caption / title / hashtags → return only that.
- A WHOLE script only when they explicitly ask for one or a full rewrite.
- If they pasted a script, work FROM it — never swap in a different story.

${ENGLISH_RULE}

Apply his voice (from the profile below) only to what you actually produce. Hooks: 2–3 short lines, last one starts with "And"/"But". Full script body (only when writing one): flowing full sentences, blank line between beats, ~500 words max 600, clean spoken lines, no "---", no bold in the body. Invent fresh imagery every time.

${loadProfile()}`, cache_control: { type: 'ephemeral' } }],
    messages: (messages || []).slice(-20),
  });
  return { text: stripDividers(extractText(res)), cost: calcCost(model, res.usage.input_tokens, res.usage.output_tokens), model };
}

// ── Idea sourcing ────────────────────────────────────────────────────────────
// 'videos'  → mine his own catalog / the gap analysis for stories in his lane.
// 'trending' → pull football stories doing well right now and surface the best fits.

export async function runIdeas(client: Anthropic, source: 'videos' | 'trending', model = SONNET): Promise<StageResult> {
  let contextBlock = '';
  let instruction = '';

  if (source === 'trending') {
    const live = await liveResearch('football emotional story player comeback transfer');
    const extra = await liveResearch('football world cup 2026 player story');
    contextBlock = `LIVE FOOTBALL HEADLINES (right now):\n${live}\n\n${extra}`;
    instruction = `From the live headlines above, surface the 6 football stories RIGHT NOW with the strongest emotional / redemption pull for an English @lafechadeportes-style video. Prefer stories with a human wound, an underdog arc, injustice, or a comeback.`;
  } else {
    contextBlock = `HIS UNTAPPED STORY BANK (gap analysis of stories in his lane he hasn't done):\n${loadGap().slice(0, 6000)}`;
    instruction = `From his untapped story bank above, surface the 6 strongest stories to make next in his style for an English audience. Favour the ones with the deepest human wound and clearest redemption arc.`;
  }

  const res = await client.messages.create({
    model, max_tokens: 900,
    system: [{ type: 'text', text: `You suggest story ideas for an English-language football creator writing in @lafechadeportes's redemption-storytelling style. Output ONLY a numbered list of 6 ideas. Each item: the subject + a one-line emotional hook. No preamble, no closing. English only.` }],
    messages: [{ role: 'user', content: `${contextBlock}\n\n${instruction}\n\nReturn exactly 6 numbered ideas. After each, tell me to reply with its number or a topic of my own to write it.` }],
  });
  return { text: extractText(res), cost: calcCost(model, res.usage.input_tokens, res.usage.output_tokens), model };
}
