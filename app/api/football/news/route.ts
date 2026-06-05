import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const client = new Anthropic();
const YT_KEY = process.env.YOUTUBE_API_KEY || '';
const SKILLS_DIR = path.join(process.cwd(), 'content-plan', 'skills');

async function fetchNewsLast24h() {
  const queries = [
    'World Cup 2026 result score',
    'World Cup 2026 injury',
    'World Cup 2026 group stage',
    'FIFA 2026 news today',
    'World Cup 2026 player',
  ];
  const seen = new Set<string>();
  const items: { title: string; source: string }[] = [];
  await Promise.all(queries.map(async (q) => {
    try {
      const res = await fetch(
        `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,
        { next: { revalidate: 0 } }
      );
      const xml = await res.text();
      const matches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      for (const m of matches.slice(0, 6)) {
        const titleM = m[1].match(/<title>([\s\S]*?)<\/title>/);
        const sourceM = m[1].match(/<source[^>]*>([\s\S]*?)<\/source>/);
        const title = (titleM?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
        const source = (sourceM?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
        if (title.length > 10 && !seen.has(title)) {
          seen.add(title);
          items.push({ title, source });
        }
      }
    } catch { /* skip */ }
  }));
  return items;
}

async function fetchYouTubeLast24h() {
  if (!YT_KEY) return [];
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent('World Cup 2026')}&type=video&order=viewCount&publishedAfter=${since}&maxResults=12&key=${YT_KEY}`,
      { next: { revalidate: 0 } }
    );
    const json = await res.json();
    return (json.items || []).map((v: any) => ({
      title: v.snippet.title,
      channel: v.snippet.channelTitle,
    }));
  } catch { return []; }
}

function loadSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return '';
  return fs.readdirSync(SKILLS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => fs.readFileSync(path.join(SKILLS_DIR, f), 'utf-8').slice(0, 800))
    .join('\n\n');
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const generateScript = body.generateScript === true;

  const [newsItems, ytItems] = await Promise.all([fetchNewsLast24h(), fetchYouTubeLast24h()]);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const rawData = [
    `## News Headlines (last 24h)`,
    newsItems.map(n => `- [${n.source}] ${n.title}`).join('\n'),
    `\n## Most Viewed YouTube WC Content (last 24h)`,
    ytItems.map((v: any) => `- [${v.channel}] ${v.title}`).join('\n'),
  ].join('\n');

  const bulletPrompt = `Today is ${today}.

Here is the raw data from the last 24 hours:

${rawData}

Produce exactly 20 bullet points covering the most important things that happened.
Include: match results and scores, injuries, standout performances, group standings implications, manager news, controversial moments, what fans are talking about, what's coming up next.
Each bullet must be factual, specific, and punchy — one sentence max.
Prioritise the things a football TikTok creator's audience would care most about.
Output ONLY the 20 bullets as a JSON array of strings, no other text.`;

  const scriptPrompt = generateScript ? `\n\nAlso generate a "World Cup Flash News — ${today}" script.
This is a 60-90 second on-camera script the creator reads straight to camera.
Start with: "World Cup Flash News — [day and date]"
Cover the 5-7 most important bullets in a fast, punchy delivery.
No direction notes, no brackets, no music cues — clean script text only, exactly as spoken.
Add the script as a "flash_script" string field in your JSON.` : '';

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 3000,
    system: [
      {
        type: 'text',
        text: 'You are a football news analyst for a TikTok creator. Output only valid JSON. No markdown fences.',
        cache_control: { type: 'ephemeral' },
      },
      generateScript ? {
        type: 'text' as const,
        text: `Creator style context:\n${loadSkills().slice(0, 3000)}`,
        cache_control: { type: 'ephemeral' },
      } : null,
    ].filter(Boolean) as any,
    messages: [{ role: 'user', content: bulletPrompt + scriptPrompt }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '[]';
  let bullets: string[] = [];
  let flash_script: string | null = null;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      bullets = parsed;
    } else {
      bullets = parsed.bullets || parsed.items || [];
      flash_script = parsed.flash_script || null;
    }
  } catch {
    const arr = raw.match(/\[[\s\S]+\]/);
    if (arr) { try { bullets = JSON.parse(arr[0]); } catch { /* ignore */ } }
  }

  return NextResponse.json({ ok: true, bullets, flash_script, date: today, rawCount: newsItems.length + ytItems.length });
}
