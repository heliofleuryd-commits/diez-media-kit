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

const TOQUEYMEDIO_HOOK_FORMULA = `
TOQUEYMEDIO HOOK FORMULA — use when emotional style is active:
The hook is 2–3 sentences. Delivered slowly. It sets a scene first, then twists it.

TEMPLATE A — "Imagine" Immersion (most used):
  "Imagine [vivid scene at the moment of maximum tension, hope, or dread].
   [One sentence that makes it more impossible, more desperate, or more beautiful — the twist that deepens stakes].
   [A short fragment — a name, a question, or one devastating fact — that pivots to the story]."

TEMPLATE B — Paradox / Contradiction:
  "[What everyone believes to be true about this player or team].
   [Its devastating inversion — the hidden truth, the opposite reality].
   [One consequence that reframes everything]."

TEMPLATE C — Dramatic Irony / Foreshadowing:
  "[Date and place, stated gravely like a verdict].
   [The protagonists don't know what's about to happen].
   [What IS about to happen — the thing that makes this tragic, glorious, or impossible]."

FORBIDDEN in emotional hooks: "Did you know…", stats-first, stand-alone questions, hype openers ("This is INSANE").
END every emotional script with an aphoristic closer — one standalone sentence, a universal truth about football or life.
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
- 45–75 seconds read aloud at natural pace
- Clean spoken words only — no [CAM], no [BROLL], no direction notes whatsoever
- Build to a payoff — every script needs a reveal or a strong take
${hasEmotional ? TOQUEYMEDIO_HOOK_FORMULA : `HOOK: Strong hook in first 3 seconds — bold claim, stat reveal, contrarian angle, or rhetorical provocation. Never "Did you know…"`}
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
