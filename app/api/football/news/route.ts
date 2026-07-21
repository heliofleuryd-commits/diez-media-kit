import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { CREATOR_BIAS } from '@/lib/football/creatorBias';
import { calcCost } from '@/lib/football/costTracker';
import { LEAGUES } from '@/lib/football/footballData';

const client = new Anthropic();
const YT_KEY = process.env.YOUTUBE_API_KEY || '';
const M_FAST   = 'claude-haiku-4-5-20251001'; // bullets
const M_SCRIPT = 'claude-sonnet-4-6';          // flash news script
const SKILLS_DIR = path.join(process.cwd(), 'content-plan', 'skills');

// ── ESPN: live scores, results, fixtures across the tracked competitions ──────
async function fetchESPN() {
  try {
    const base = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
    const jobs = LEAGUES.flatMap(l => [
      fetch(`${base}/${l.code}/scoreboard`, { next: { revalidate: 0 } }).then(r => r.json()).then(d => ({ kind: 'score', d })).catch(() => ({ kind: 'score', d: {} })),
      fetch(`${base}/${l.code}/news?limit=5`, { next: { revalidate: 0 } }).then(r => r.json()).then(d => ({ kind: 'news', d })).catch(() => ({ kind: 'news', d: {} })),
    ]);
    const results = await Promise.all(jobs);

    const matches: any[] = [];
    const headlines: { title: string; description: string }[] = [];
    for (const r of results) {
      if (r.kind === 'score') {
        for (const ev of (r.d.events || [])) {
          const comp = ev.competitions?.[0];
          const home = comp?.competitors?.find((c: any) => c.homeAway === 'home');
          const away = comp?.competitors?.find((c: any) => c.homeAway === 'away');
          const scorers = (comp?.leaders || []).flatMap((l: any) => l.leaders || []).map((l: any) => l.athlete?.displayName).filter(Boolean);
          matches.push({
            home: home?.team?.displayName || '', away: away?.team?.displayName || '',
            homeScore: home?.score || '0', awayScore: away?.score || '0',
            status: comp?.status?.type?.description || '', detail: comp?.status?.type?.detail || '',
            completed: comp?.status?.type?.completed || false, scorers, date: ev.date,
          });
        }
      } else {
        for (const a of (r.d.articles || []).slice(0, 4)) headlines.push({ title: a.headline || a.title, description: a.description?.slice(0, 120) || '' });
      }
    }
    return { matches: matches.slice(0, 40), headlines: headlines.slice(0, 20) };
  } catch { return { matches: [], headlines: [] }; }
}

async function fetchNewsLast24h() {
  const queries = [
    'football result today', 'footballer injury', 'footballer death', 'football controversy',
    'football transfer', 'footballer illness', 'Premier League', 'Champions League',
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
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent('football')}&type=video&order=viewCount&publishedAfter=${since}&maxResults=12&key=${YT_KEY}`,
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
    matchLines.length > 0 ? matchLines.join('\n') : 'No matches in the last 24h.',
    `\n## ESPN Football News`,
    espn.headlines.map((h: any) => `- ${h.title}${h.description ? ': ' + h.description : ''}`).join('\n'),
    `\n## Google News Headlines (last 24h)`,
    newsItems.map(n => `- [${n.source}] ${n.title}`).join('\n'),
    `\n## Most Watched Football YouTube (last 24h)`,
    ytItems.map((v: any) => `- [${v.channel}] ${v.title}`).join('\n'),
  ].join('\n');

  const bulletPrompt = `Today is ${today}.

Here is live data from the last 24 hours across the footballing world (top-5 leagues + UCL/Europa, plus news):

${rawData}

Produce exactly 20 bullet points ranked by importance and audience interest.
Rank them #1 (most important/viral) to #20 (least).
Cover: match scores and key moments, goal scorers, injuries, red cards, standout performances, title/relegation/qualification implications, manager decisions, transfers, controversies, deaths or tragedies, what fans are talking about, tomorrow's must-watch fixtures.
Each bullet: one punchy sentence, specific facts, no vague statements.
Prioritise the big emotional or controversial stories (a death, a serious injury, a scandal, a comeback) and the biggest clubs/players.
Output ONLY a JSON array of 20 strings (ranked #1 first), no other text.`;

  const selectedBullets: string[] = body.selectedBullets || [];
  const scriptDate = body.date || today;

  // Format date as "Monday, July 11th"
  const scriptDateFormatted = (() => {
    try {
      const d = new Date(scriptDate + 'T12:00:00');
      const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
      const month = d.toLocaleDateString('en-US', { month: 'long' });
      const day = d.getDate();
      const ord = day === 1||day===21||day===31?'st':day===2||day===22?'nd':day===3||day===23?'rd':'th';
      return `${weekday}, ${month} ${day}${ord}`;
    } catch { return today; }
  })();

  const bulletListForScript = selectedBullets.length > 0
    ? selectedBullets.map((b, i) => `${i+1}. ${b}`).join('\n')
    : null;

  const scriptPrompt = (generateScript && bulletListForScript) ? `Generate a "Football Flash News — ${scriptDateFormatted}" script from these selected stories:

${bulletListForScript}

RULES:
- Start with exactly: "Football Flash News — ${scriptDateFormatted}"
- Read every story fast and factual — no padding, no waffle, no transitions like "meanwhile" or "in other news"
- One punchy sentence per story, straight into the next
- Facts only: scores, names, numbers — nothing vague
- No sign-off, no outro — just end after the last story
- Spoken words only, no brackets or notes

Output JSON with only a "flash_script" string field.` : '';

  // Bullets: Haiku (fast + cheap — just summarising facts)
  const bulletRes = await client.messages.create({
    model: M_FAST,
    max_tokens: 2000,
    system: [{
      type: 'text',
      text: `You are a football news analyst. Output only valid JSON. No markdown fences.\n${CREATOR_BIAS}`,
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{ role: 'user', content: bulletPrompt }],
  });

  // Flash script (only if requested): Sonnet — good creative writing, not as expensive as Opus
  let scriptRes: any = null;
  if (generateScript) {
    scriptRes = await client.messages.create({
      model: M_SCRIPT,
      max_tokens: 1500,
      system: [
        {
          type: 'text',
          text: `You are a TikTok football creator writing a Flash News script. Output only valid JSON with a "flash_script" string field. No markdown fences.\n${CREATOR_BIAS}`,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: `Creator style reference:\n${loadSkills().slice(0, 2000)}`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: `Today is ${today}. Raw data:\n${rawData}\n\n${scriptPrompt}` }],
    });
  }

  const response = bulletRes;

  // Parse bullets
  const raw = response.content[0].type === 'text' ? response.content[0].text : '[]';
  let bullets: string[] = [];
  try {
    const parsed = JSON.parse(raw);
    bullets = Array.isArray(parsed) ? parsed : (parsed.bullets || parsed.items || []);
  } catch {
    const arr = raw.match(/\[[\s\S]+\]/);
    if (arr) { try { bullets = JSON.parse(arr[0]); } catch { /* ignore */ } }
  }

  // Parse flash script from separate call
  let flash_script: string | null = null;
  if (scriptRes) {
    const sraw = scriptRes.content[0].type === 'text' ? scriptRes.content[0].text : '{}';
    try {
      const sp = JSON.parse(sraw);
      flash_script = sp.flash_script || null;
    } catch {
      const m = sraw.match(/"flash_script"\s*:\s*"([\s\S]+?)(?:"\s*\}|"$)/);
      flash_script = m ? m[1].replace(/\\n/g, '\n') : null;
    }
  }

  const cost = calcCost(M_FAST, bulletRes.usage.input_tokens, bulletRes.usage.output_tokens)
    + (scriptRes ? calcCost(M_SCRIPT, scriptRes.usage.input_tokens, scriptRes.usage.output_tokens) : 0);

  return NextResponse.json({ ok: true, bullets, flash_script, date: today, rawCount: newsItems.length + ytItems.length, cost });
}
