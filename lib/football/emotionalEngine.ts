// Shared engine for the Emotional Storyteller AND the Story Research script writer.
// Both run: (research →) Studio-toqueymedio draft → viral elevation, in the
// creator's perfected viral voice. Keeping this in one place stops the two
// features from drifting apart.

import type Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { CREATOR_BIAS } from './creatorBias';
import { calcCost } from './costTracker';

export const OPUS = 'claude-opus-4-8';
export const SONNET = 'claude-sonnet-4-6';

const SKILLS_DIR = path.join(process.cwd(), 'content-plan', 'skills');
const VIRAL_SKILL_PATH = path.join(process.cwd(), 'content-plan', 'emotional-storyteller', 'viral-style-skill.md');
const DIEZ_SKILL_PATH = path.join(process.cwd(), 'content-plan', 'emotional-storyteller', 'diez-format-skill.md');

// ── Studio toqueymedio base (faithful copy of Content Studio › Studio) ──────────

function loadSkills(styles: string[] = []): string {
  if (!fs.existsSync(SKILLS_DIR)) return '';
  return fs.readdirSync(SKILLS_DIR)
    .filter(f => f.endsWith('.md'))
    .filter(f => {
      if (!f.startsWith('channel-')) return true;
      if (styles.length === 0) return true;
      return styles.some(s => f.includes(s));
    })
    .map(f => {
      const content = fs.readFileSync(path.join(SKILLS_DIR, f), 'utf-8');
      return `### ${f}\n${content.slice(0, f.startsWith('channel-') ? 1200 : 1400)}`;
    })
    .join('\n---\n');
}

const TOQUEYMEDIO_SCRIPT_STRUCTURE = `
═══════════════════════════════════════════
TOQUEYMEDIO EMOTIONAL STORYTELLING SYSTEM
═══════════════════════════════════════════

FUNDAMENTAL RULE: Emotion is the DELIVERY. The CONTENT is always a specific, factual, accurate play-by-play of a real game or moment. Facts + emotion woven together = the formula. Facts alone = Wikipedia. Emotion alone = empty poetry.

━━━ BEAT 1: THE HOOK (0:00–0:08) — Pure emotional ante. No facts yet. ━━━

TEMPLATE A — "Imagine" Immersion (most used):
  "Imagine [vivid scene: viewer at the exact moment of maximum tension/hope/dread].
   [Sentence that makes it more impossible or beautiful — deepens the stakes].
   [A fragment — a name, a question, one devastating fact — that opens the story]."

TEMPLATE B — Paradox / Contradiction:
  "[What everyone believes]. [Its devastating inversion]. [The consequence that reframes everything]."

TEMPLATE C — Dramatic Irony:
  "[Date and place, stated gravely]. [They don't know what's coming]. [What is coming]."

FORBIDDEN hooks: "Did you know…" / stats-first / stand-alone question / hype openers / analytical setups.

━━━ BEAT 2: THE SACRED GROUND (0:08–0:20) ━━━
Date. Place. Stakes — one sentence. Stated gravely, like a verdict.

━━━ BEAT 3: THE GAME NARRATIVE (0:20–1:10) — LONGEST & MOST CRITICAL SECTION ━━━
MANDATORY: minute markers, specific player names at every moment, exact score progression, specific plays described cinematically, the specific controversy if there is one, an emotional sentence after each fact.

━━━ BEAT 4: THE TURN — "And then…" — one fragment. The pivot. ━━━
━━━ BEAT 5: THE CLIMAX — SLOW DOWN — ceremonial full name — cosmic imagery ━━━
━━━ BEAT 6: TWO FACES — winner's euphoria / loser's desolation — one sentence each ━━━
━━━ BEAT 7: APHORISTIC CLOSER — one universal truth — standalone — silence follows ━━━
`;

function buildStudioToqueymedioPrompt(): string {
  return `You are an elite TikTok football script writer and content strategist for a creator covering the 2026 FIFA World Cup.

You have studied 120 top-performing football videos from 16 creators and know exactly what makes football content go viral.

STYLE — write in the voice of: @toqueymedio
Emotional, cinematic, poetic storytelling. Present-tense narration, religious/cosmic imagery, ceremonial full names at climaxes, aphoristic final line. Deep feeling over hot takes.

CAPABILITIES:
- Write complete, ready-to-record TikTok scripts on any football topic
- Research angles, find the hot take, identify the narrative hook
- Rewrite, improve, or expand anything the creator sends
- Suggest formats, hooks, captions, hashtags
- Give direct, opinionated creative direction

FORMAT (non-negotiable):
- 105–135 seconds read aloud at natural pace (2–2.5 min target — emotional stories need length to build properly through all 7 beats)
- Clean spoken words only — no [CAM], no [BROLL], no direction notes whatsoever
- Build to a payoff — every script needs a reveal or a strong take
${TOQUEYMEDIO_SCRIPT_STRUCTURE}
${CREATOR_BIAS}

WHEN WRITING A SCRIPT:
After the script, always add:
**Hook:** (the opening line alone)
**Caption:** (under 150 chars)
**Hashtags:** (6–8 relevant tags)

Be direct. Don't ask clarifying questions unless essential — make a creative decision and write the script.`;
}

function loadViralSkill(): string {
  try { return fs.readFileSync(VIRAL_SKILL_PATH, 'utf-8'); } catch { return ''; }
}

function loadDiezFormat(): string {
  try { return fs.readFileSync(DIEZ_SKILL_PATH, 'utf-8'); } catch { return ''; }
}

// Emotional Storyteller style modes:
//  'old' = the base viral style only (pre-Diez-merge).
//  'new' = base viral style blended 50/50 with Diez's own Notion Story format.
export type StyleMode = 'old' | 'new';

function blendedStyle(mode: StyleMode = 'new'): string {
  const viral = loadViralSkill();
  if (mode === 'old') return viral;
  const diez = loadDiezFormat();
  if (!diez) return viral;
  return `Blend the TWO style guides below roughly 50/50. Guide A is the base viral style; Guide B is DIEZ'S OWN format, reverse-engineered from his real posted scripts. Where they differ, FOLLOW GUIDE B (Diez's own hooks, closers, structure and motifs win — they are his proven voice).

=== GUIDE A — BASE VIRAL STYLE ===
${viral}

=== GUIDE B — DIEZ'S OWN FORMAT (wins on any conflict) ===
${diez}`;
}

export function stripDividers(s: string): string {
  return s.split('\n')
    .filter(l => !/^\s*-{3,}\s*$/.test(l) && !/^\s*={3,}\s*$/.test(l))
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function extractText(res: any): string {
  return res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
}

// ── Live research (recency-aware) ───────────────────────────────────────────────

async function fetchHeadlines(query: string, limit: number): Promise<string[]> {
  try {
    const res = await fetch(
      `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`,
      { signal: AbortSignal.timeout(5000), cache: 'no-store' }
    );
    const xml = await res.text();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, limit).map(m => {
      const t = m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').trim();
      return t || '';
    }).filter(Boolean);
  } catch { return []; }
}

export async function liveResearch(topic: string): Promise<string> {
  const t = String(topic).slice(0, 90);
  const [recent, general, bio] = await Promise.all([
    fetchHeadlines(`${t} when:4d`, 8),
    fetchHeadlines(`${t} football`, 6),
    fetchHeadlines(`${t} career story`, 5),
  ]);
  const blocks: string[] = [];
  if (recent.length) blocks.push(`RECENT (last 4 days — use for any "yesterday/this week" facts):\n${recent.map(h => `- ${h}`).join('\n')}`);
  if (general.length) blocks.push(`GENERAL:\n${general.map(h => `- ${h}`).join('\n')}`);
  if (bio.length) blocks.push(`BACKGROUND:\n${bio.map(h => `- ${h}`).join('\n')}`);
  return blocks.length ? blocks.join('\n\n') : '(no live headlines found — rely on verified knowledge, do not invent recent events)';
}

// ── Stages ──────────────────────────────────────────────────────────────────────

export interface StageResult { text: string; cost: number; model: string; }

export async function runResearch(client: Anthropic, topic: string, todayStr: string, live: string, model = SONNET): Promise<StageResult> {
  const res = await client.messages.create({
    model,
    max_tokens: 1500,
    system: [{
      type: 'text',
      text: `You are a football story researcher who digs out the deep, emotional human spine behind a player or a nation: where they came from, childhood and early life, poverty, migration, family, loss, injury, rejection, comeback arcs, underdog journeys. You are ruthlessly factual — real names, real dates, no invention. You never present an old event as if it were recent.`,
    }],
    messages: [{
      role: 'user',
      content: `Today is ${todayStr}.

STORY REQUEST: "${topic}"

LIVE HEADLINES:
${live}

Produce EXACTLY 10 factual bullet points that will feed an emotional football script. Weight them toward the emotional spine that makes these videos work:
- where they came from, childhood, early life, the place that raised them
- poverty / migration / leaving home young / adversity
- family — a parent, a sibling, loss, sacrifice
- the wound: a death, an injury, a rejection, a tragedy (with the date)
- the comeback arc / underdog journey / what they overcame
- IF the request mentions a recent match or performance, the ACCURATE specifics of that recent moment (date, opponent, what happened) — take these from the RECENT headlines above, NOT from an unrelated old match. If unsure of a recent detail, say so rather than inventing or substituting an old event.

Player-tied or country-tied are both fine. Each bullet is one specific, checkable fact with names and dates where possible.

Output ONLY the 10 bullets, one per line, each starting with "- ". No preamble.`,
    }],
  });
  return { text: extractText(res), cost: calcCost(model, res.usage.input_tokens, res.usage.output_tokens), model };
}

export async function runDraft(client: Anthropic, topic: string, context: string, model = OPUS): Promise<StageResult> {
  const systemBlocks: any[] = [
    { type: 'text', text: buildStudioToqueymedioPrompt(), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: `## YOUR SKILL LIBRARY (120 viral football videos analysed)\n\n${loadSkills(['toqueymedio'])}`, cache_control: { type: 'ephemeral' } },
  ];
  const userMsg = `Write me a complete emotional toqueymedio script about:

"${topic}"

Researched context — weave these real facts in, and use the origin/early-life facts to open the story:
${context || '(no extra context)'}`;
  const res = await client.messages.create({ model, max_tokens: 4000, system: systemBlocks, messages: [{ role: 'user', content: userMsg }] });
  return { text: extractText(res), cost: calcCost(model, res.usage.input_tokens, res.usage.output_tokens), model };
}

export async function runViral(client: Anthropic, draft: string, model = OPUS, mode: StyleMode = 'new'): Promise<StageResult> {
  const style = blendedStyle(mode);
  const res = await client.messages.create({
    model,
    max_tokens: 4000,
    system: [{ type: 'text', text: `You are the final editor. You take a toqueymedio script that is ~75% there and elevate it to the perfected style below. This style guide OVERRIDES everything else.\n\n${style}`, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: `Here is the toqueymedio draft to elevate:
"""
${draft}
"""

Rewrite it into a finished script that reads like the creator's own viral scripts. Non-negotiables:

0. STRUCTURE — follow the reference arc beat-for-beat: the bold-feeling 3-line hook, then the humble origin (where he came from), the rise, the dated wound (state the date plainly), the darkness/doubt, the World Cup resurrection setup (date, stadium, a nation holding its breath), the ceremonial FULL birth name at the threshold of the climax, the slow-motion climax, the crowd/nation reaction, the sky-point dedication, and a two-line aphoristic closer ("Some… / Very few…"). This shape is what makes it resemble the reference scripts — do not drift from it.

VARIETY — CRITICAL: do NOT reuse stock lines. NEVER write "they say it is hard to hear silence" — that line is banned. NEVER write "[Country] explodes" or "millions of souls erupt" UNLESS the script is literally describing a goal being scored or a trophy being lifted; if there is no goal/celebration, do not use crowd-eruption imagery at all. For the climax and the crowd reaction, invent FRESH imagery every time, specific to this person's story — no two scripts should share the same climax sentence or celebration line.

1. THE HOOK — EXACTLY 2 or 3 short punchy lines, each a single breath (max ~14 words), plain text. The final line is the turn and MUST start with "And" or "But". No long sprawling multi-clause hook. Reference rhythm: "Imagine watching men take your father away into the jungle / You don't know if he is alive or if he is ever coming back / And years later, you score in your country's World Cup opener — for the man they tried to take from you."

2. FLOW & FULL SENTENCES — after the hook, write in COMPLETE, FLOWING SENTENCES, exactly like the reference scripts. Each sentence is a full thought that breathes — use connectors (and, because, until, while) and commas WITHIN a sentence to carry the listener forward. Do NOT chop the script into many short staccato lines or fragments. Reserve a standalone short fragment only for a single deliberate hammer-blow (the turn, the goal, the silence). The body should feel like flowing narration, not a bullet list.

3. LENGTH — HARD limit: ~480–540 words, NEVER above 600 (the longest reference script). Cut sprawl to fit.

4. Keep every real fact, the emotional spine, the ceremonial full name at the climax, the sky-point dedication, and the earned aphoristic closer — but express each in FRESH words for this specific story, never a recycled template line.

FORMATTING — match the reference scripts exactly:
- Each line is ONE complete, flowing sentence (not a fragment). Put a blank line between beats so it breathes. Keep the TOTAL number of lines modest — never shatter a single thought across multiple short lines.
- NO "---" dividers, NO horizontal rules, NO bold anywhere in the script body, NO markdown headers.

After the script, on new lines:
**Hook:** (the opening lines as one block)
**Caption:** (under 150 chars)
**Hashtags:** (6–8 tags)`,
    }],
  });
  return { text: stripDividers(extractText(res)), cost: calcCost(model, res.usage.input_tokens, res.usage.output_tokens), model };
}

export async function runChat(client: Anthropic, messages: any[], model = OPUS, mode: StyleMode = 'new'): Promise<StageResult> {
  const style = blendedStyle(mode);
  const res = await client.messages.create({
    model,
    max_tokens: 4000,
    system: [{ type: 'text', text: `You are the Emotional Storyteller editor. Keep the blended style below. Always: 2–3 line punchy "Imagine…" hook (final line starts And/But); the body in complete, flowing full sentences (not choppy fragments, modest number of lines, blank line between beats); ~500 words and never above 600; clean spoken lines; no "---"; no bold in the script body. VARIETY: never write "they say it is hard to hear silence" (banned); never use "[Country] explodes"/"millions of souls erupt" unless literally describing a goal or a trophy; invent fresh climax and celebration imagery every time.\n\n${style}`, cache_control: { type: 'ephemeral' } }],
    messages: (messages || []).slice(-20),
  });
  return { text: stripDividers(extractText(res)), cost: calcCost(model, res.usage.input_tokens, res.usage.output_tokens), model };
}
