import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { CREATOR_BIAS } from '@/lib/football/creatorBias';

const client = new Anthropic();
const YT_KEY = process.env.YOUTUBE_API_KEY || '';
const SKILLS_DIR = path.join(process.cwd(), 'content-plan', 'skills');

// ── ESPN: live scores, results, fixtures ──────────────────────────────────────
async function fetchESPN() {
  try {
    // Scoreboard: recent + live + upcoming matches
    const [scoreRes, newsRes] = await Promise.all([
      fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard', { next: { revalidate: 0 } }),
      fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/news?limit=15', { next: { revalidate: 0 } }),
    ]);

    const [scoreData, newsData] = await Promise.all([scoreRes.json(), newsRes.json()]);

    const matches = (scoreData.events || []).map((ev: any) => {
      const comp = ev.competitions?.[0];
      const home = comp?.competitors?.find((c: any) => c.homeAway === 'home');
      const away = comp?.competitors?.find((c: any) => c.homeAway === 'away');
      const status = comp?.status?.type?.description || '';
      const detail = comp?.status?.type?.detail || '';
      const completed = comp?.status?.type?.completed || false;

      // Extract scorers from leaders
      const scorers = (comp?.leaders || [])
        .flatMap((l: any) => l.leaders || [])
        .map((l: any) => l.athlete?.displayName).filter(Boolean);

      return {
        home: home?.team?.displayName || '',
        away: away?.team?.displayName || '',
        homeScore: home?.score || '0',
        awayScore: away?.score || '0',
        status,
        detail,
        completed,
        scorers,
        date: ev.date,
      };
    });

    const headlines = (newsData.articles || []).map((a: any) => ({
      title: a.headline || a.title,
      description: a.description?.slice(0, 120) || '',
    }));

    return { matches, headlines };
  } catch { return { matches: [], headlines: [] }; }
}

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

  const [newsItems, ytItems, espn] = await Promise.all([
    fetchNewsLast24h(),
    fetchYouTubeLast24h(),
    fetchESPN(),
  ]);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // Format ESPN matches clearly
  const matchLines = espn.matches.map((m: any) => {
    if (m.completed) {
      const scorers = m.scorers.length > 0 ? ` (scorers: ${m.scorers.join(', ')})` : '';
      return `RESULT: ${m.home} ${m.homeScore}–${m.awayScore} ${m.away}${scorers}`;
    }
    return `FIXTURE: ${m.home} vs ${m.away} — ${m.detail}`;
  });

  const rawData = [
    `## MATCH RESULTS & FIXTURES (ESPN Live Data)`,
    matchLines.length > 0 ? matchLines.join('\n') : 'No matches in last 24h — World Cup starts June 11',
    `\n## ESPN World Cup News`,
    espn.headlines.map((h: any) => `- ${h.title}${h.description ? ': ' + h.description : ''}`).join('\n'),
    `\n## Google News Headlines (last 24h)`,
    newsItems.map(n => `- [${n.source}] ${n.title}`).join('\n'),
    `\n## Most Watched YouTube WC Content (last 24h)`,
    ytItems.map((v: any) => `- [${v.channel}] ${v.title}`).join('\n'),
  ].join('\n');

  const bulletPrompt = `Today is ${today}.

Here is live data from the last 24 hours of the 2026 FIFA World Cup:

${rawData}

Produce exactly 20 bullet points ranked by importance and audience interest.
Rank them #1 (most important/viral) to #20 (least).
Cover: match scores and key moments, goal scorers, injuries, red cards, standout performances, group table implications, manager decisions, controversies, what fans are talking about, tomorrow's must-watch fixtures.
Each bullet: one punchy sentence, specific facts, no vague statements.
If Spain, Lamine Yamal, Barcelona players, or Argentina/Messi are involved — prioritise those higher.
Output ONLY a JSON array of 20 strings (ranked #1 first), no other text.`;

  const scriptPrompt = generateScript ? `\n\nAlso generate a "World Cup Flash News — ${today}" script.
60–90 seconds, straight to camera, start with: "World Cup Flash News — [day and date]"
Hit the top 6–8 stories fast and punchy. Bias toward Spain/Yamal/Barcelona/Argentina angles where relevant.
Clean script only — no brackets, no direction notes, just the spoken words.
Add as "flash_script" string in your JSON output.` : '';

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 3000,
    system: [
      {
        type: 'text',
        text: `You are a football news analyst for a TikTok creator covering the 2026 FIFA World Cup. Output only valid JSON. No markdown fences.\n${CREATOR_BIAS}`,
        cache_control: { type: 'ephemeral' },
      },
      generateScript ? {
        type: 'text' as const,
        text: `Creator style:\n${loadSkills().slice(0, 3000)}`,
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
