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
  try { return JSON.parse(fs.readFileSync(BANK_PATH, 'utf-8')); }
  catch { return { personal: [], country: [] }; }
}

function loadToqueymedio(): string {
  const f = path.join(SKILLS_DIR, 'channel-toqueymedio-profile.md');
  try { return fs.readFileSync(f, 'utf-8').slice(0, 3000); } catch { return ''; }
}

// ---- DATA SOURCES ----

interface MatchDetail {
  home: string; away: string;
  homeScore: string; awayScore: string;
  status: string; completed: boolean;
  goals: string[]; cards: string[]; keyPlayers: string[];
}

async function fetchESPN(): Promise<{ today: MatchDetail[]; yesterday: MatchDetail[]; headlines: string[] }> {
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10).replace(/-/g, '');

  async function parseEvents(url: string): Promise<{ matches: MatchDetail[]; eventIds: string[] }> {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      const eventIds: string[] = [];
      const matches: MatchDetail[] = (data.events || []).map((ev: any) => {
        const comp = ev.competitions?.[0];
        const home = comp?.competitors?.find((c: any) => c.homeAway === 'home');
        const away = comp?.competitors?.find((c: any) => c.homeAway === 'away');
        const completed = comp?.status?.type?.completed || false;
        eventIds.push(ev.id);

        const goals: string[] = [];
        const cards: string[] = [];
        for (const d of comp?.details || []) {
          const athletes = (d.athletesInvolved || []).map((a: any) => a.displayName).filter(Boolean);
          const minute = d.clock?.displayValue || '';
          if (d.scoringPlay && athletes.length > 0) {
            const type = d.ownGoal ? 'OG' : d.penaltyKick ? 'PEN' : 'GOAL';
            goals.push(`${athletes[0]} ${minute} (${type}) [${d.team?.id === home?.team?.id ? 'HOME' : 'AWAY'}]`);
          }
          if (d.redCard && athletes.length > 0) {
            cards.push(`RED: ${athletes[0]} ${minute}`);
          }
        }

        return {
          home: home?.team?.displayName || '',
          away: away?.team?.displayName || '',
          homeScore: home?.score || '0',
          awayScore: away?.score || '0',
          status: comp?.status?.type?.description || '',
          completed,
          goals, cards, keyPlayers: [],
        };
      });
      return { matches, eventIds };
    } catch { return { matches: [], eventIds: [] }; }
  }

  async function fetchMatchDetails(eventIds: string[], matches: MatchDetail[]) {
    const completedIds = eventIds.filter((_, i) => matches[i]?.completed);
    await Promise.all(completedIds.slice(0, 6).map(async (id, idx) => {
      try {
        const res = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${id}`,
          { cache: 'no-store' },
        );
        const data = await res.json();
        const matchIdx = eventIds.indexOf(id);
        if (matchIdx < 0) return;

        const keyPlayers: string[] = [];
        for (const team of data.rosters || []) {
          const teamName = team.team?.displayName || '';
          for (const p of team.roster || []) {
            const a = p.athlete || {};
            const stats: Record<string, string> = {};
            for (const s of p.stats || []) {
              if (s.displayValue && s.displayValue !== '0') stats[s.name] = s.displayValue;
            }
            const g = parseInt(stats.totalGoals || '0');
            const ass = parseInt(stats.goalAssists || '0');
            const sot = parseInt(stats.shotsOnTarget || '0');
            if (g > 0 || ass > 0 || sot >= 2) {
              const parts = [];
              if (g > 0) parts.push(`${g} goal${g > 1 ? 's' : ''}`);
              if (ass > 0) parts.push(`${ass} assist${ass > 1 ? 's' : ''}`);
              if (sot >= 2 && g === 0) parts.push(`${sot} shots on target`);
              keyPlayers.push(`${a.displayName || ''} (${teamName}): ${parts.join(', ')}`);
            }
          }
        }
        matches[matchIdx].keyPlayers = keyPlayers;

        if (matches[matchIdx].goals.length === 0) {
          for (const ke of data.keyEvents || []) {
            if (ke.scoringPlay) {
              const athletes = (ke.athletesInvolved || []).map((a: any) => a.displayName).filter(Boolean);
              const minute = ke.clock?.displayValue || '';
              if (athletes.length > 0) {
                matches[matchIdx].goals.push(`${athletes[0]} ${minute}`);
              }
            }
          }
        }
      } catch { /* skip this match */ }
    }));
  }

  const [todayData, yesterdayData, newsRes] = await Promise.all([
    parseEvents(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${todayStr}`),
    parseEvents(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${yesterday}`),
    fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/news?limit=20', { cache: 'no-store' }).catch(() => null),
  ]);

  await Promise.all([
    fetchMatchDetails(todayData.eventIds, todayData.matches),
    fetchMatchDetails(yesterdayData.eventIds, yesterdayData.matches),
  ]);

  let headlines: string[] = [];
  if (newsRes) {
    try {
      const newsData = await newsRes.json();
      headlines = (newsData.articles || []).map((a: any) => a.headline || a.title).filter(Boolean);
    } catch { /* */ }
  }

  return { today: todayData.matches, yesterday: yesterdayData.matches, headlines };
}

async function fetchTrending(): Promise<string[]> {
  const queries = [
    'World Cup 2026', 'World Cup goal today', 'World Cup 2026 player story',
    'FIFA World Cup upset', 'football trending today',
  ];
  const items: string[] = [];
  const seen = new Map<string, boolean>();
  await Promise.all(queries.map(async (q) => {
    try {
      const res = await fetch(
        `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,
        { cache: 'no-store' },
      );
      const xml = await res.text();
      const matches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).slice(0, 5);
      for (const m of matches) {
        const t = m[1].match(/<title>([\s\S]*?)<\/title>/);
        const title = (t?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        if (title.length > 10 && !seen.has(title)) {
          seen.set(title, true);
          items.push(title);
        }
      }
    } catch { /* skip */ }
  }));
  return items.slice(0, 25);
}

// ---- PROMPT BUILDER ----

function buildMatchSection(label: string, matches: MatchDetail[]): string {
  if (matches.length === 0) return '';
  const lines = matches.map(m => {
    if (m.completed) {
      let line = `RESULT: ${m.home} ${m.homeScore}–${m.awayScore} ${m.away}`;
      if (m.goals.length > 0) line += `\n  Goals: ${m.goals.join('; ')}`;
      if (m.cards.length > 0) line += `\n  Cards: ${m.cards.join('; ')}`;
      if (m.keyPlayers.length > 0) line += `\n  Key players: ${m.keyPlayers.join('; ')}`;
      return line;
    }
    return `FIXTURE: ${m.home} vs ${m.away} — ${m.status}`;
  });
  return `### ${label}\n${lines.join('\n\n')}`;
}

function buildPrompt(
  today: string, espn: { today: MatchDetail[]; yesterday: MatchDetail[]; headlines: string[] },
  trending: string[], bank: { personal: any[]; country: any[] },
): string {
  const matchSection = [
    buildMatchSection("TODAY'S MATCHES", espn.today),
    buildMatchSection("YESTERDAY'S RESULTS (completed)", espn.yesterday),
  ].filter(Boolean).join('\n\n');

  const headlineSection = espn.headlines.length > 0
    ? `### ESPN Headlines\n${espn.headlines.map(h => `- ${h}`).join('\n')}`
    : '';

  const trendingSection = trending.length > 0
    ? `### Trending Now (Google News)\n${trending.map(t => `- ${t}`).join('\n')}`
    : '';

  const bankSummary = [
    `PERSONAL (${bank.personal.length}):`,
    ...bank.personal.map((s: any) => `- ${s.player} (${s.country}): ${s.headline}`),
    '', `COUNTRY (${bank.country.length}):`,
    ...bank.country.map((s: any) => `- ${s.teams} ${s.year}: ${s.headline}`),
  ].join('\n');

  return `Today is ${today}.

## LIVE FOOTBALL DATA
${matchSection || 'No live match data available — use your knowledge of the current World Cup 2026 schedule.'}

${headlineSection}

${trendingSection}

## STORY BANK (pre-researched)
${bankSummary}

## YOUR TASK

Generate exactly 10 stories I should make today — a mix of PERSONAL stories (player adversity, comeback, emotional narrative) and COUNTRY stories (historic matches, upsets, underdog narratives, rivalries, revenge arcs).

RULES:
1. **PRIORITISE PLAYERS WHO SCORED OR ASSISTED TODAY/YESTERDAY** — if someone scored a goal, find their emotional backstory. A player who just scored is a HOT story.
2. If two countries played today/yesterday, check their historic rivalry, previous upsets, or revenge narrative — that's a country story.
3. For personal stories: real human adversity — injury comebacks, family tragedy, poverty, refugee backgrounds, personal loss, racism, rejection. The more specific the facts, the better.
4. For country stories: upsets, revenge arcs, colonial/political subtext, tiny nations beating giants, underdog runs, controversial refereeing history.
5. Use stories from the bank BUT ALSO surface new ones based on today's actual match data and trending topics.
6. Each story needs enough factual detail for a 2-minute video script.
7. Relevance: "HOT" = directly tied to today/yesterday's events. "WARM" = this week's schedule. "EVERGREEN" = always works.
8. At least 4 stories must be HOT (tied to actual match results or today's fixtures).

${CREATOR_BIAS}

Output valid JSON only (no markdown fences) in this exact format:
{
  "stories": [
    {
      "rank": 1,
      "type": "personal" or "country",
      "title": "Short punchy title",
      "player": "Player name (personal) or null",
      "teams": "Team A vs Team B (country) or null",
      "relevance": "HOT" or "WARM" or "EVERGREEN",
      "why_today": "One sentence on why this story matters right now",
      "headline": "One-line emotional hook that opens the video",
      "key_facts": ["Fact 1", "Fact 2", "Fact 3", "Fact 4", "Fact 5"],
      "emotional_arc": "Tragedy → Struggle → Triumph/Redemption",
      "script_angle": "The specific angle for this video — what makes it unique"
    }
  ]
}`;
}

// ---- HANDLERS ----

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
  const body = await req.json().catch(() => ({}));

  // Allow cron access via secret, otherwise require admin auth
  const isCron = body.cron_secret === process.env.CRON_SECRET && process.env.CRON_SECRET;
  if (!isCron && !(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
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

    const prompt = buildPrompt(today, espn, trending, bank);

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: [
        {
          type: 'text',
          text: `You are an elite football story researcher for a TikTok/YouTube creator who makes emotional, cinematic football stories. You deeply research player backstories, historic matches, and emotional narratives. Your job is to find the most powerful, specific, true stories that will make viewers cry, share, and follow.\n\nWhen you see match results with goal scorers, ALWAYS research those players' backstories — every goal scorer has a story.\n\nStyle reference:\n${toqueymedio}\n\nOutput only valid JSON. No markdown fences. No extra text.`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = res.content[0].type === 'text' ? res.content[0].text : '';
    let stories: any[] = [];

    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    try {
      stories = JSON.parse(cleaned).stories || [];
    } catch {
      const m = cleaned.match(/\{[\s\S]+\}/);
      if (m) {
        try { stories = JSON.parse(m[0]).stories || []; } catch { /* */ }
      }
    }

    if (stories.length === 0 && raw.length > 0) {
      return NextResponse.json({
        ok: false,
        error: 'AI returned content but it could not be parsed. Try refreshing.',
        stories: [],
        date: today,
        cost: calcCost(MODEL, res.usage.input_tokens, res.usage.output_tokens),
      });
    }

    const cost = calcCost(MODEL, res.usage.input_tokens, res.usage.output_tokens);
    const payload = { stories, date: today, cost };
    writeCache(payload);

    return NextResponse.json({ ok: true, ...payload, cached: false });
  } catch (e: any) {
    const msg = e?.message || e?.toString() || 'Unknown error';
    console.error('[stories] Generation failed:', msg);
    return NextResponse.json({
      ok: false,
      error: `Story generation failed: ${msg.slice(0, 200)}`,
      stories: [],
      date: null,
      cost: 0,
    });
  }
}
