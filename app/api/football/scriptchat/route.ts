import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { CREATOR_BIAS } from '@/lib/football/creatorBias';
import { calcCost } from '@/lib/football/costTracker';

const client = new Anthropic();
const SKILLS_DIR = path.join(process.cwd(), 'content-plan', 'skills');

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
  → Underdogs, comebacks, World Cup finals.

TEMPLATE B — Paradox / Contradiction:
  "[What everyone believes]. [Its devastating inversion]. [The consequence that reframes everything]."
  → Fallen heroes, misremembered history.

TEMPLATE C — Dramatic Irony:
  "[Date and place, stated gravely]. [They don't know what's coming]. [What is coming]."
  → Historic matches, known endings with dread.

FORBIDDEN hooks: "Did you know…" / stats-first / stand-alone question / hype openers / analytical setups.

━━━ BEAT 2: THE SACRED GROUND (0:08–0:20) ━━━
Date. Place. Stakes — one sentence. Stated gravely, like a verdict.

━━━ BEAT 3: THE GAME NARRATIVE (0:20–1:10) — LONGEST & MOST CRITICAL SECTION ━━━

MANDATORY — the script will fail without these:
✓ MINUTE MARKERS: "Minute 7." "Minute 55." "Minute 90+3." — non-negotiable drumbeats.
✓ SPECIFIC PLAYER NAMES at every key moment. Never "the striker" — use their actual name.
✓ EXACT SCORE PROGRESSION: every goal tracked as it happens.
✓ SPECIFIC PLAYS described cinematically — not "they scored" but the exact movement, the exact moment.
✓ THE SPECIFIC CONTROVERSY if there is one: exact handball, red card, disallowed goal, described with precision.
✓ PENALTY SEQUENCES with individual detail: who stepped up, what happened, their body language.
✓ EMOTIONAL SENTENCE after each fact: state the fact, then one emotional consequence, then back to facts.

WRONG: "The game was dramatic and emotional."
RIGHT: "Minute 45 — Uruguay score. Silence. For 82 more minutes, Ghana attacks like their lives depend on it. Minute 82 — Gyan equalises. Then comes Minute 120. Suárez on the goal-line. The ball is going in. He raises his hand. He stops it. He is sent off. Asamoah Gyan steps up. He hits the crossbar. And an entire continent's dream shatters."

━━━ BEAT 4: THE TURN — "And then…" — one fragment. The pivot. ━━━

━━━ BEAT 5: THE CLIMAX — SLOW DOWN — ceremonial full name — cosmic imagery ━━━

━━━ BEAT 6: TWO FACES — winner's euphoria / loser's desolation — one sentence each ━━━

━━━ BEAT 7: APHORISTIC CLOSER — one universal truth — standalone — silence follows ━━━
`;

function buildStudioSystemPrompt(styles: string[]): string {
  const hasEmotional = styles.some(s => ['toqueymedio', 'elefutbol'].includes(s));
  const refs = styles.length > 0 ? styles.map(s => `@${s}`).join(', ') : '@pechefootball, @fiagoball, @5.at.the.back';

  const tone = hasEmotional && styles.some(s => !['toqueymedio','elefutbol'].includes(s))
    ? 'Blend analytical insight with emotional, cinematic storytelling — confident takes delivered with poetic weight and aphoristic closers.'
    : hasEmotional
    ? 'Emotional, cinematic, poetic storytelling. Present-tense narration, religious/cosmic imagery, ceremonial full names at climaxes, aphoristic final line. Deep feeling over hot takes.'
    : 'Analytical, confident, strong POV — hot takes, contrarian angles, bold claims. Never neutral.';

  return `You are an elite TikTok football script writer and content strategist for a creator covering the 2026 FIFA World Cup.

You have studied 120 top-performing football videos from 16 creators and know exactly what makes football content go viral.

STYLE — write in the voice of: ${refs}
${tone}

CAPABILITIES:
- Write complete, ready-to-record TikTok scripts on any football topic
- Research angles, find the hot take, identify the narrative hook
- Rewrite, improve, or expand anything the creator sends
- Suggest formats, hooks, captions, hashtags
- Give direct, opinionated creative direction

FORMAT (non-negotiable):
- ${hasEmotional ? '105–135 seconds read aloud at natural pace (2–2.5 min target — emotional stories need length to build properly through all 7 beats)' : '60–75 seconds read aloud at natural pace (never under 60)'}
- Clean spoken words only — no [CAM], no [BROLL], no direction notes whatsoever
- Build to a payoff — every script needs a reveal or a strong take
${hasEmotional ? TOQUEYMEDIO_SCRIPT_STRUCTURE : `HOOK: Strong hook in first 3 seconds — bold claim, stat reveal, contrarian angle, or rhetorical provocation. Never "Did you know…"`}
${CREATOR_BIAS}

WHEN WRITING A SCRIPT:
After the script, always add:
**Hook:** (the opening line alone)
**Caption:** (under 150 chars)
**Hashtags:** (6–8 relevant tags)

Be direct. Don't ask clarifying questions unless essential — make a creative decision and write the script.`;
}

// Quick research: fetch YouTube suggestions + headlines for a topic
async function quickResearch(topic: string): Promise<string> {
  const results: string[] = [];
  try {
    const ytRes = await fetch(
      `https://suggestqueries-clients6.youtube.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(topic)}&hl=en`,
      { signal: AbortSignal.timeout(4000) }
    );
    const ytText = await ytRes.text();
    const match = ytText.match(/\[[\s\S]+\]/);
    if (match) {
      const suggestions = JSON.parse(match[0])[1]?.slice(0, 6).map((s: any) => Array.isArray(s) ? s[0] : s) || [];
      if (suggestions.length) results.push(`YouTube searches: ${suggestions.join(', ')}`);
    }
  } catch { /* skip */ }

  try {
    const newsRes = await fetch(
      `https://news.google.com/rss/search?q=${encodeURIComponent(topic + ' football')}&hl=en-US&gl=US&ceid=US:en`,
      { signal: AbortSignal.timeout(4000) }
    );
    const xml = await newsRes.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 5);
    const headlines = items.map(m => {
      const t = m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g,'').trim();
      return t ? `- ${t}` : '';
    }).filter(Boolean);
    if (headlines.length) results.push(`Recent news:\n${headlines.join('\n')}`);
  } catch { /* skip */ }

  return results.length ? `\n\n[Research on "${topic}"]\n${results.join('\n\n')}` : '';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, useThinking = false, styles = ['pechefootball', 'fiagoball', '5.at.the.back'] } = body;

    if (!messages?.length) {
      return NextResponse.json({ ok: false, error: 'No messages' }, { status: 400 });
    }

    // Extract the latest user message text to do quick research
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    const lastText = Array.isArray(lastUserMsg?.content)
      ? lastUserMsg.content.find((c: any) => c.type === 'text')?.text || ''
      : lastUserMsg?.content || '';

    // Do quick research if message sounds like a script request
    const isScriptRequest = /\b(make|write|create|script|video|about|vid|dark horse|story|angle)\b/i.test(lastText);
    const research = isScriptRequest ? await quickResearch(lastText.slice(0, 80)) : '';

    const systemBlocks: any[] = [
      {
        type: 'text',
        text: buildStudioSystemPrompt(styles),
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text: `## YOUR SKILL LIBRARY (120 viral football videos analysed)\n\n${loadSkills(styles)}`,
        cache_control: { type: 'ephemeral' },
      },
    ];

    // Append research to the last user message if available
    let apiMessages = messages.map((m: any) => ({ ...m }));
    if (research && apiMessages.length > 0) {
      const last = apiMessages[apiMessages.length - 1];
      if (last.role === 'user') {
        const currentText = Array.isArray(last.content)
          ? last.content.find((c: any) => c.type === 'text')?.text || ''
          : last.content || '';
        const newText = currentText + research;
        if (Array.isArray(last.content)) {
          apiMessages[apiMessages.length - 1] = {
            ...last,
            content: last.content.map((c: any) => c.type === 'text' ? { ...c, text: newText } : c),
          };
        } else {
          apiMessages[apiMessages.length - 1] = { ...last, content: newText };
        }
      }
    }

    const createParams: any = {
      model: 'claude-opus-4-8',
      max_tokens: useThinking ? 16000 : 4000,
      system: systemBlocks,
      messages: apiMessages.slice(-20),
    };

    if (useThinking) {
      createParams.thinking = { type: 'enabled', budget_tokens: 8000 };
    }

    const response = await client.messages.create(createParams);
    const cost = calcCost('claude-opus-4-8', response.usage.input_tokens, response.usage.output_tokens);

    // Separate thinking blocks from text
    let thinkingText = '';
    let textContent = '';
    for (const block of response.content) {
      if (block.type === 'thinking') thinkingText = (block as any).thinking || '';
      if (block.type === 'text') textContent += (block as any).text || '';
    }

    return NextResponse.json({ ok: true, message: textContent, thinking: thinkingText || null, cost });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
