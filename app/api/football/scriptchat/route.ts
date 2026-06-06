import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { CREATOR_BIAS } from '@/lib/football/creatorBias';
import { calcCost } from '@/lib/football/costTracker';

const client = new Anthropic();
const SKILLS_DIR = path.join(process.cwd(), 'content-plan', 'skills');

function loadSkills(): string {
  if (!fs.existsSync(SKILLS_DIR)) return '';
  return fs.readdirSync(SKILLS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const content = fs.readFileSync(path.join(SKILLS_DIR, f), 'utf-8');
      return `### ${f}\n${content.slice(0, f.startsWith('channel-') ? 500 : 1400)}`;
    })
    .join('\n---\n');
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
    const { messages, useThinking = false } = body;

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
        text: `You are an elite TikTok football script writer and content strategist for a creator covering the 2026 FIFA World Cup.

You have studied 120 top-performing football videos from 16 creators and know exactly what makes football content go viral.

CAPABILITIES:
- Write complete, ready-to-record TikTok scripts on any football topic
- Research angles, find the hot take, identify the narrative hook
- Rewrite, improve, or expand anything the creator sends
- Suggest formats, hooks, captions, hashtags
- Give direct, opinionated creative direction

SCRIPT STYLE (always apply unless asked otherwise):
- Reference style: @pechefootball, @fiagoball, @5.at.the.back
- 45–75 seconds read aloud at natural pace
- Strong hook in first 3 seconds — must stop the scroll
- Confident POV — never neutral, always an angle
- Clean spoken words only — no [CAM], no [BROLL], no direction notes whatsoever
- Build to a payoff — every script needs a reveal or a strong take
${CREATOR_BIAS}

WHEN WRITING A SCRIPT:
After the script, always add:
**Hook:** (the opening line alone)
**Caption:** (under 150 chars)
**Hashtags:** (6–8 relevant tags)

Be direct. Don't ask clarifying questions unless essential — make a creative decision and write the script.`,
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text: `## YOUR SKILL LIBRARY (120 viral football videos analysed)\n\n${loadSkills()}`,
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
