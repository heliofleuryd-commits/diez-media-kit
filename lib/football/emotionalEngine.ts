// Shared engine for the Emotional Storyteller AND the Story Research script writer.
// Both run: (research →) Studio-toqueymedio draft → viral elevation, in the
// creator's perfected viral voice. Keeping this in one place stops the two
// features from drifting apart.

import type Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { CREATOR_BIAS } from './creatorBias';
import { calcUsageCost } from './costTracker';

export const OPUS = 'claude-opus-5-5';
export const SONNET = 'claude-sonnet-5-5';
export const HAIKU = 'claude-haiku-4-5-20251001';

// Opus/Sonnet 5.5 always think, and thinking is billed as output and counts
// toward max_tokens. Spend effort where the recorded script is shaped (viral)
// and keep the other stages lean.
const PARAMS = {
  research: { max_tokens: 16000, output_config: { effort: 'medium' as const } },
  draft: { max_tokens: 16000, output_config: { effort: 'medium' as const } },
  viral: { max_tokens: 16000, output_config: { effort: 'high' as const } },
  check: { max_tokens: 16000, output_config: { effort: 'medium' as const } },
  edit: { max_tokens: 16000, output_config: { effort: 'medium' as const } },
};

// Style guides are reused across drafts, viral passes and every amendment —
// keep them cached for an hour rather than 5 minutes.
const CACHE_1H = { type: 'ephemeral' as const, ttl: '1h' as const };

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
  return `You are an elite TikTok football script writer and content strategist for a creator covering football (leagues, transfers, and the human stories across the game).

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

// Cost of one response (tokens, cache and searches), logged per stage so real
// per-script spend shows up in the server logs.
function bill(stage: string, model: string, res: Anthropic.Messages.Message): number {
  const searches = res.usage.server_tool_use?.web_search_requests ?? 0;
  const cost = calcUsageCost(model, res.usage) + searches * WEB_SEARCH_COST;
  console.log(`[storyteller-usage] ${JSON.stringify({
    stage, model, in: res.usage.input_tokens, out: res.usage.output_tokens,
    cacheRead: res.usage.cache_read_input_tokens ?? 0, cacheWrite: res.usage.cache_creation_input_tokens ?? 0,
    searches, cost: Number(cost.toFixed(4)),
  })}`);
  return cost;
}

// ── Word limit ("max 300 words", "under 250 words", "300 words max"…) ──────────

export function parseWordLimit(text: string): number | undefined {
  const t = String(text || '').toLowerCase();
  const m = t.match(/(?:max(?:imum)?|under|below|no more than|less than|fewer than|up to|at most|limit(?: of)?|within)\s*:?\s*(\d{2,4})\s*-?\s*words?/)
    || t.match(/(\d{2,4})\s*-?\s*words?\s*(?:max(?:imum)?|or less|or fewer|tops|limit)/)
    || t.match(/\b(\d{2,4})\s*-?\s*words?\b/);
  const n = m ? parseInt(m[1], 10) : NaN;
  return n >= 50 && n <= 1500 ? n : undefined;
}

// Latest limit the creator gave in the conversation — it sticks to amendments.
export function wordLimitFromMessages(messages: any[]): number | undefined {
  for (const m of [...(messages || [])].reverse()) {
    if (m?.role !== 'user') continue;
    const n = parseWordLimit(typeof m.content === 'string' ? m.content : '');
    if (n) return n;
  }
  return undefined;
}

function lengthRule(limit?: number): string {
  return limit
    ? `LENGTH — the creator asked for MAX ${limit} words. The spoken script body (everything before **Hook:**) must be ${limit} words or fewer. This overrides every length rule in the style guide: compress the beats, keep the hook, the wound, the climax and the closer, and cut everything else.`
    : `LENGTH — HARD limit: ~480–540 words, NEVER above 600 (the longest reference script). Cut sprawl to fit.`;
}

// Words in the spoken body only — the Hook/Caption/Hashtags/Fact check tail doesn't count.
function bodyWordCount(text: string): number {
  const cut = text.search(/^\s*\*\*(Hook|Caption|Hashtags|Fact check):?\*\*/im);
  const body = cut >= 0 ? text.slice(0, cut) : text;
  return (body.match(/\S+/g) || []).length;
}

// Models overshoot word counts, so check in code and trim only when over.
async function enforceWordLimit(client: Anthropic, text: string, limit: number | undefined, model = OPUS): Promise<{ text: string; cost: number }> {
  if (!limit) return { text, cost: 0 };
  const words = bodyWordCount(text);
  if (words <= limit) return { text, cost: 0 };
  const res = await client.messages.create({
    model,
    ...PARAMS.edit,
    messages: [{
      role: 'user',
      content: `This script body is ${words} words. The creator's hard maximum is ${limit} words. Cut it to ${limit} words or fewer (aim for ~${Math.round(limit * 0.95)}).

Keep the hook, the key facts, the climax and the closer. Cut sprawl, never add. Keep the voice, line breaks and formatting. Leave any **Hook:** / **Caption:** / **Hashtags:** / **Fact check:** sections after the body exactly as they are. Reply with the full result only, no preamble.

"""
${text}
"""`,
    }],
  });
  return { text: stripDividers(extractText(res)), cost: bill('trim', model, res) };
}

// ── Web search (research + fact check) ──────────────────────────────────────────

const WEB_SEARCH_COST = 0.01; // $10 per 1,000 searches

function webSearch(maxUses: number): Anthropic.Messages.WebSearchTool20260209 {
  return { type: 'web_search_20260209', name: 'web_search', max_uses: maxUses };
}

// Only the text after the last search result is the answer; anything earlier
// is the model talking between searches.
function finalText(res: Anthropic.Messages.Message): string {
  const lastResult = res.content.map(b => b.type).lastIndexOf('web_search_tool_result');
  const tail = res.content.slice(lastResult + 1)
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map(b => b.text).join('').trim();
  return tail || extractText(res).trim();
}

// Long search turns can come back as pause_turn — send the partial turn back
// and let the model carry on until it finishes.
async function runWithSearch(client: Anthropic, stage: string, params: Anthropic.Messages.MessageCreateParamsNonStreaming): Promise<{ text: string; cost: number }> {
  const messages = [...params.messages];
  let cost = 0;
  for (let i = 0; i < 4; i++) {
    const res = await client.messages.create({ ...params, messages });
    cost += bill(stage, params.model, res);
    if (res.stop_reason !== 'pause_turn') return { text: finalText(res), cost };
    messages.push({ role: 'assistant', content: res.content });
  }
  throw new Error('Search took too many rounds — try again');
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
  const { text, cost } = await runWithSearch(client, 'research', {
    model,
    ...PARAMS.research,
    tools: [webSearch(5)],
    system: [{
      type: 'text',
      text: `You are a football story researcher who digs out the deep, emotional human spine behind a player or a nation: where they came from, childhood and early life, poverty, migration, family, loss, injury, rejection, comeback arcs, underdog journeys. You are ruthlessly factual — real names, real dates, no invention. You never present an old event as if it were recent.

Use web search to confirm every year, date, club, transfer, fee and score before you write it down — especially anything from the last two seasons, where your memory is least reliable. A year that only "feels right" is not confirmed.`,
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

Player-tied or country-tied are both fine. Each bullet is one specific, checkable fact with names and dates where possible, ending with the site that confirms it in brackets, e.g. "(source: bbc.co.uk)". The fact-checker relies on these to avoid searching again.

Output ONLY the 10 bullets, one per line, each starting with "- ". No preamble.`,
    }],
  });
  return { text, cost, model };
}

// Final gate before the creator sees a script: verify every tangible fact
// against live sources and fix only what's wrong, leaving the voice untouched.
// Runs once per new script — never on amendments. Sonnet: checking a year or a
// score is a lookup, not writing. Claims the research already sourced are
// trusted, so searches go only to facts the writing stages added.
export async function runFactCheck(client: Anthropic, script: string, todayStr: string, research = '', wordLimit?: number, model = SONNET): Promise<StageResult> {
  const { text, cost } = await runWithSearch(client, 'factcheck', {
    model,
    ...PARAMS.check,
    tools: [webSearch(4)],
    system: [{
      type: 'text',
      text: `You are the fact-checker for an emotional football storytelling channel. The scripts are lyrical, but every tangible fact in them must be true — one wrong year or score in a comment section undoes the whole video. You change facts, never style.`,
    }],
    messages: [{
      role: 'user',
      content: `Fact-check this script before it is published. Today is ${todayStr}.

VERIFIED RESEARCH — already confirmed with web search, with sources. Trust these; do not search them again:
${research || '(none provided)'}

SCRIPT:
"""
${script}
"""

1. Find every tangible, checkable claim: years and dates, transfer windows and fees, clubs, ages, match minutes, scores, goal and appearance counts, trophies, records, stadiums, opponents and quotes.
2. A claim that matches the verified research is confirmed. Use web search only for claims the research doesn't cover or that contradict it — most recent first, because memory of recent events is the least reliable and a year that "feels right" is not verified.
3. For each claim that is wrong, give the smallest fix, keeping the voice and rhythm. If a claim can't be confirmed, soften it to something true (for example drop the exact minute) rather than leave a guess.${wordLimit ? ` Fixes must not make the script longer — the creator's hard maximum is ${wordLimit} words.` : ''}

Do NOT rewrite or return the script. When you're done, end your reply with exactly this:
<corrections>
[{"old": "exact text from the script", "new": "corrected text", "source": "site.com"}]
</corrections>
<verified>N</verified>

"old" must be copied character-for-character from the script — the shortest phrase that is unique in it (e.g. "in 2015 Tottenham paid five million pounds"). Use [] if nothing needs changing. N is how many claims you checked.`,
    }],
  });
  const checked = applyCorrections(script, text);
  const trimmed = await enforceWordLimit(client, checked, wordLimit);
  return { text: trimmed.text, cost: cost + trimmed.cost, model };
}

// The fact checker only returns a list of fixes; the code swaps them in, so
// the script's structure, opening and formatting can't be disturbed.
function applyCorrections(script: string, reply: string): string {
  const block = [...reply.matchAll(/<corrections>([\s\S]*?)<\/corrections>/g)].pop()?.[1];
  let fixes: { old?: string; new?: string; source?: string }[];
  try { fixes = JSON.parse(block ?? ''); if (!Array.isArray(fixes)) throw new Error(); }
  catch {
    return `${script}\n\n**Fact check:**\n- ⚠️ Couldn't read the fact-check result — verify dates and stats before recording.`;
  }
  const verified = reply.match(/<verified>\s*(\d+)\s*<\/verified>/)?.[1];
  let out = script;
  const notes: string[] = [];
  for (const f of fixes) {
    if (!f.old || typeof f.new !== 'string' || f.old === f.new) continue;
    const src = f.source ? ` (${f.source})` : '';
    if (out.includes(f.old)) {
      out = out.replace(f.old, f.new);
      notes.push(`- ${f.old} → ${f.new}${src}`);
    } else {
      notes.push(`- ⚠️ Not applied, fix by hand: ${f.old} → ${f.new}${src}`);
    }
  }
  if (!notes.length) notes.push('- No corrections needed.');
  if (verified) notes.push(`- Verified: ${verified} claims`);
  return `${out}\n\n**Fact check:**\n${notes.join('\n')}`;
}

export async function runDraft(client: Anthropic, topic: string, context: string, model = OPUS, wordLimit?: number): Promise<StageResult> {
  const systemBlocks: any[] = [
    { type: 'text', text: buildStudioToqueymedioPrompt() },
    { type: 'text', text: `## YOUR SKILL LIBRARY (120 viral football videos analysed)\n\n${loadSkills(['toqueymedio'])}`, cache_control: CACHE_1H },
  ];
  const userMsg = `Write me a complete emotional toqueymedio script about:

"${topic}"

Researched context — weave these real facts in (ignore the "(source: …)" tags), and use the origin/early-life facts to open the story:
${context || '(no extra context)'}${wordLimit ? `\n\nThe creator wants the final script at MAX ${wordLimit} words — write about that length, not the usual 2-minute length.` : ''}`;
  const res = await client.messages.create({ model, ...PARAMS.draft, system: systemBlocks, messages: [{ role: 'user', content: userMsg }] });
  return { text: extractText(res), cost: bill('draft', model, res), model };
}

// Viral and chat share the same cached style-guide block (first in the system
// prompt), so every amendment after a script reads it from cache.
function styleSystem(mode: StyleMode, instructions: string): Anthropic.Messages.TextBlockParam[] {
  return [
    { type: 'text', text: blendedStyle(mode), cache_control: CACHE_1H },
    { type: 'text', text: instructions },
  ];
}

export async function runViral(client: Anthropic, draft: string, model = OPUS, mode: StyleMode = 'new', wordLimit?: number): Promise<StageResult> {
  const res = await client.messages.create({
    model,
    ...PARAMS.viral,
    system: styleSystem(mode, `You are the final editor. You take a toqueymedio script that is ~75% there and elevate it to the perfected style guide above. That style guide OVERRIDES everything else.`),
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

3. ${lengthRule(wordLimit)}

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
  const cost = bill('viral', model, res);
  const trimmed = await enforceWordLimit(client, stripDividers(extractText(res)), wordLimit, model);
  return { text: trimmed.text, cost: cost + trimmed.cost, model };
}

// Fast, cheap intent router: does the user want a brand-new full script researched
// from scratch ("create"), or to edit/analyse existing text / answer a narrow ask
// like hook alternatives or one section ("edit")? Used so a pasted script or a
// "give me 5 hooks" request never triggers the full research→draft→viral pipeline.
export async function runClassify(client: Anthropic, text: string): Promise<{ intent: 'create' | 'edit'; cost: number }> {
  const res = await client.messages.create({
    model: HAIKU,
    max_tokens: 8,
    system: [{ type: 'text', text: `You route requests for an emotional football-script tool. Reply with EXACTLY one word: "create" or "edit".

"create" = the user names a topic/story and wants a brand-new FULL script researched and written from scratch (e.g. "Luis Díaz father kidnapping", "Raúl Jiménez fractured skull comeback").

"edit" = the user wants you to work on existing text or answer a narrow request. This includes: they pasted a script; or they asked for only PART of a script (a hook or hook alternatives, one section or line, a caption, a title, hashtags); or they asked to shorten / lengthen / rewrite / rephrase / punch up / critique / analyse / give feedback / give options or variations.

If the message contains a pasted script, OR asks for anything less than a whole new script, answer "edit". Otherwise "create". One word only.` }],
    messages: [{ role: 'user', content: String(text).slice(0, 4000) }],
  });
  const out = extractText(res).toLowerCase();
  const intent: 'create' | 'edit' = out.includes('edit') ? 'edit' : 'create';
  return { intent, cost: bill('classify', HAIKU, res) };
}

// Amendments: one call, no research, no redraft, no fact check.
export async function runChat(client: Anthropic, messages: any[], model = OPUS, mode: StyleMode = 'new', wordLimit?: number): Promise<StageResult> {
  const history = (messages || []).slice(-20);
  // Put the creator's word limit on the latest message so it beats the
  // ~500-word default without touching the cached system prompt.
  const last = history[history.length - 1];
  if (wordLimit && last?.role === 'user' && typeof last.content === 'string') {
    history[history.length - 1] = { ...last, content: `${last.content}\n\n(If you write or rewrite a script: ${lengthRule(wordLimit)})` };
  }
  const res = await client.messages.create({
    model,
    ...PARAMS.edit,
    system: styleSystem(mode, `You are the Emotional Storyteller editor. Do EXACTLY what the latest message asks — and nothing more. Match the SCOPE of the request precisely:

- If they ask for only hooks (e.g. "give me 5 hook alternatives"), return ONLY that many hooks — each 2–3 punchy lines — and nothing else. Do NOT append the full script, a caption, or hashtags.
- If they ask to rewrite, critique or analyse ONE section or line, return only that part.
- If they ask for a caption, a title, or hashtags, return only that.
- Write or rewrite a WHOLE script only when they explicitly ask for a full script or a full rewrite.
- If they pasted a script, work FROM their script (analyse or transform it) — never swap in a different story.
Never dump the entire script when a smaller answer was requested.

STYLE — apply only to the content you actually produce:
- Hooks: 2–3 short punchy lines, each a single breath (max ~14 words); the final line is the turn and starts with "And" or "But".
- Full script body (only when writing one): complete, flowing full sentences (not choppy fragments), a blank line between beats, ~500 words and never above 600, clean spoken lines, no "---", no bold in the body.
- VARIETY: never write "they say it is hard to hear silence" (banned); never use "[Country] explodes"/"millions of souls erupt" unless literally describing a goal or a trophy; invent fresh imagery every time.

Apply the style guide above to anything you write.`),
    messages: history,
  });
  const cost = bill('edit', model, res);
  const text = stripDividers(extractText(res));
  // Only trim replies that are actually a script (hooks or notes stay as-is).
  if (wordLimit && /\*\*Hook:?\*\*/i.test(text)) {
    const trimmed = await enforceWordLimit(client, text, wordLimit, model);
    return { text: trimmed.text, cost: cost + trimmed.cost, model };
  }
  return { text, cost, model };
}
