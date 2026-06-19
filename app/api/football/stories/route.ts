export const maxDuration = 60;

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { isAuthenticated } from '@/lib/auth';
import { CREATOR_BIAS } from '@/lib/football/creatorBias';
import { calcCost } from '@/lib/football/costTracker';

const client = new Anthropic();
const MODEL = 'claude-sonnet-4-6';
const BANK_PATH = path.join(process.cwd(), 'content-plan', 'story-bank.json');
const SKILLS_DIR = path.join(process.cwd(), 'content-plan', 'skills');
const CACHE_DIR = '/tmp';

function todayKey() { return new Date().toISOString().slice(0, 10); }
function cachePath() { return path.join(CACHE_DIR, `stories-${todayKey()}.json`); }

function readCache(): any | null {
  try {
    const data = JSON.parse(fs.readFileSync(cachePath(), 'utf-8'));
    if (data._date === todayKey()) return data;
  } catch { /* miss */ }
  return null;
}

function writeCache(payload: any) {
  try { fs.writeFileSync(cachePath(), JSON.stringify({ ...payload, _date: todayKey() })); } catch { /* */ }
}

function loadStoryBank(): { personal: any[]; country: any[] } {
  try {
    return JSON.parse(fs.readFileSync(BANK_PATH, 'utf-8'));
  } catch {
    return { personal: [], country: [] };
  }
}

function loadToqueymedio(): string {
  const f = path.join(SKILLS_DIR, 'channel-toqueymedio-profile.md');
  try { return fs.readFileSync(f, 'utf-8').slice(0, 3000); } catch { return ''; }
}

async function fetchESPN() {
  try {
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
      const completed = comp?.status?.type?.completed || false;
      const scorers = (comp?.leaders || [])
        .flatMap((l: any) => l.leaders || [])
        .map((l: any) => l.athlete?.displayName).filter(Boolean);
      return {
        home: home?.team?.displayName || '',
        away: away?.team?.displayName || '',
        homeScore: home?.score || '0',
        awayScore: away?.score || '0',
        status, completed, scorers, date: ev.date,
      };
    });

    const headlines = (newsData.articles || []).map((a: any) => ({
      title: a.headline || a.title,
      description: a.description?.slice(0, 120) || '',
    }));

    return { matches, headlines };
  } catch { return { matches: [], headlines: [] }; }
}

async function fetchTrending(): Promise<string[]> {
  const queries = [
    'World Cup 2026', 'FIFA World Cup player', 'World Cup goal today',
    'World Cup 2026 upset', 'World Cup 2026 story',
  ];
  const items: string[] = [];
  const seen = new Map<string, boolean>();
  await Promise.all(queries.map(async (q) => {
    try {
      const res = await fetch(
        `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,
        { next: { revalidate: 0 } },
      );
      const xml = await res.text();
      const matches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).slice(0, 5);
      for (const m of matches) {
        const t = m[1].match(/<title>([\s\S]*?)<\/title>/);
        const title = (t?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
        if (title.length > 10 && !seen.has(title)) {
          seen.set(title, true);
          items.push(title);
        }
      }
    } catch { /* skip */ }
  }));
  return items.slice(0, 20);
}

// GET: return cached stories (instant) or empty if none for today
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const cached = readCache();
  if (cached) {
    return NextResponse.json({ ok: true, stories: cached.stories, date: cached.date, cost: 0, cached: true });
  }
  return NextResponse.json({ ok: true, stories: [], date: null, cached: false });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Check server cache first (skip if force refresh requested)
  const body = await req.json().catch(() => ({}));
  if (!body.refresh) {
    const cached = readCache();
    if (cached) {
      return NextResponse.json({ ok: true, stories: cached.stories, date: cached.date, cost: 0, cached: true });
    }
  }

  const bank = loadStoryBank();
  const toqueymedio = loadToqueymedio();
  const [espn, trending] = await Promise.all([fetchESPN(), fetchTrending()]);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const matchLines = espn.matches.map((m: any) => {
    if (m.completed) {
      const scorers = m.scorers.length > 0 ? ` (scorers: ${m.scorers.join(', ')})` : '';
      return `RESULT: ${m.home} ${m.homeScore}–${m.awayScore} ${m.away}${scorers}`;
    }
    return `FIXTURE: ${m.home} vs ${m.away} — ${m.status}`;
  });

  const bankSummary = [
    `PERSONAL STORIES IN BANK (${bank.personal.length} total):`,
    ...bank.personal.map((s: any) => `- ${s.player} (${s.country}): ${s.headline}`),
    '',
    `COUNTRY/MATCH STORIES IN BANK (${bank.country.length} total):`,
    ...bank.country.map((s: any) => `- ${s.teams} ${s.year}: ${s.headline}`),
  ].join('\n');

  const trendingSection = trending.length > 0
    ? `\n## TRENDING NOW (Google News)\n${trending.map(t => `- ${t}`).join('\n')}\n`
    : '';

  const prompt = `Today is ${today}.

## TODAY'S WORLD CUP MATCHES & NEWS
${matchLines.length > 0 ? matchLines.join('\n') : 'Check the current World Cup 2026 schedule — matches are ongoing.'}

ESPN Headlines:
${espn.headlines.map((h: any) => `- ${h.title}`).join('\n') || 'No headlines available'}
${trendingSection}
## STORY BANK (pre-researched stories)
${bankSummary}

## YOUR TASK

Generate exactly 10 stories I should tell today — a mix of PERSONAL stories (player adversity, comeback, emotional narrative) and COUNTRY stories (historic matches, upsets, underdog narratives, rivalries, revenge arcs).

RULES:
1. Prioritise stories that are RELEVANT TODAY — if a player scored today, played today, or a specific matchup happened today, find the emotional backstory behind it.
2. If two countries play today, check if they have a historic rivalry, a previous upset, or a revenge narrative — that's a country story.
3. For personal stories: focus on real human adversity — injury comebacks, family tragedy, poverty, refugee backgrounds, personal loss, racism overcome, rejection. The more specific the facts, the better.
4. For country stories: focus on upsets, revenge arcs, colonial/political subtext, tiny nations beating giants, underdog runs.
5. You can use stories from the bank above, but ALSO research and add new ones you know about that aren't in the bank.
6. Each story must have enough factual detail that a scriptwriter can turn it into a 2-minute video.
7. Mark each story's relevance: "HOT" (directly tied to today's events), "WARM" (tied to this week's schedule), or "EVERGREEN" (great story, always works).

${CREATOR_BIAS}

Output valid JSON only (no markdown fences) in this exact format:
{
  "stories": [
    {
      "rank": 1,
      "type": "personal" or "country",
      "title": "Short punchy title (e.g. 'The Boy From the Refugee Camp')",
      "player": "Player name (for personal) or null",
      "teams": "Team A vs Team B (for country) or null",
      "relevance": "HOT" or "WARM" or "EVERGREEN",
      "why_today": "One sentence on why this story matters today",
      "headline": "One-line emotional hook that could open the video",
      "key_facts": ["Fact 1", "Fact 2", "Fact 3", "Fact 4", "Fact 5"],
      "emotional_arc": "Tragedy → Struggle → [what happens] → Triumph/Redemption",
      "script_angle": "The specific angle to take when scripting this — what makes it unique"
    }
  ]
}`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: [
      {
        type: 'text',
        text: `You are an elite football story researcher for a TikTok creator who makes emotional, cinematic football stories. You deeply research player backstories, historic matches, and emotional narratives. Your job is to find the most powerful, specific, true stories that will make viewers cry, share, and follow.\n\nHere is the creator's storytelling style reference:\n${toqueymedio}\n\nOutput only valid JSON. No markdown fences.`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = res.content[0].type === 'text' ? res.content[0].text : '{}';
  let stories: any[] = [];

  // Strip markdown fences if present
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    stories = parsed.stories || [];
  } catch {
    const m = cleaned.match(/\{[\s\S]+\}/);
    if (m) { try { stories = JSON.parse(m[0]).stories || []; } catch { /* */ } }
  }

  const cost = calcCost(MODEL, res.usage.input_tokens, res.usage.output_tokens);

  const payload = { stories, date: today, cost };
  writeCache(payload);

  return NextResponse.json({ ok: true, ...payload, cached: false });
}
