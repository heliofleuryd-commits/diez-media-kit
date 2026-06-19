export const maxDuration = 60;

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { CREATOR_BIAS } from '@/lib/football/creatorBias';
import { calcCost } from '@/lib/football/costTracker';

const client = new Anthropic();
const MODEL = 'claude-sonnet-4-6';
const BANK_PATH = path.join(process.cwd(), 'content-plan', 'story-bank.json');
const SKILLS_DIR = path.join(process.cwd(), 'content-plan', 'skills');
const CACHE_DIR = '/tmp';

function todayKey() { return new Date().toISOString().slice(0, 10); }
function cachePath() { return path.join(CACHE_DIR, `stories-${todayKey()}.json`); }

function writeCache(payload: any) {
  try { fs.writeFileSync(cachePath(), JSON.stringify({ ...payload, _date: todayKey() })); } catch { /* */ }
}

function loadStoryBank() {
  try { return JSON.parse(fs.readFileSync(BANK_PATH, 'utf-8')); }
  catch { return { personal: [], country: [] }; }
}

function loadToqueymedio() {
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
      return {
        home: home?.team?.displayName || '', away: away?.team?.displayName || '',
        homeScore: home?.score || '0', awayScore: away?.score || '0',
        status: comp?.status?.type?.description || '',
        completed: comp?.status?.type?.completed || false,
        scorers: (comp?.leaders || []).flatMap((l: any) => l.leaders || []).map((l: any) => l.athlete?.displayName).filter(Boolean),
      };
    });
    const headlines = (newsData.articles || []).map((a: any) => ({ title: a.headline || a.title }));
    return { matches, headlines };
  } catch { return { matches: [], headlines: [] }; }
}

async function fetchTrending(): Promise<string[]> {
  const queries = ['World Cup 2026', 'FIFA World Cup player', 'World Cup goal today'];
  const items: string[] = [];
  const seen = new Map<string, boolean>();
  await Promise.all(queries.map(async (q) => {
    try {
      const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`, { next: { revalidate: 0 } });
      const xml = await res.text();
      const matches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).slice(0, 5);
      for (const m of matches) {
        const t = m[1].match(/<title>([\s\S]*?)<\/title>/);
        const title = (t?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
        if (title.length > 10 && !seen.has(title)) { seen.set(title, true); items.push(title); }
      }
    } catch { /* */ }
  }));
  return items.slice(0, 20);
}

// Cron endpoint — called daily by Vercel cron or external scheduler
// Protected by CRON_SECRET to prevent unauthorized use
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  const trendingSection = trending.length > 0
    ? `\n## TRENDING NOW\n${trending.map(t => `- ${t}`).join('\n')}\n` : '';

  const bankSummary = [
    `PERSONAL (${bank.personal.length}):`,
    ...bank.personal.map((s: any) => `- ${s.player} (${s.country}): ${s.headline}`),
    '', `COUNTRY (${bank.country.length}):`,
    ...bank.country.map((s: any) => `- ${s.teams} ${s.year}: ${s.headline}`),
  ].join('\n');

  const prompt = `Today is ${today}.

## TODAY'S WORLD CUP MATCHES & NEWS
${matchLines.length > 0 ? matchLines.join('\n') : 'Check the current World Cup 2026 schedule.'}

ESPN Headlines:
${espn.headlines.map((h: any) => `- ${h.title}`).join('\n') || 'No headlines'}
${trendingSection}
## STORY BANK
${bankSummary}

## TASK
Generate exactly 10 stories — mix of PERSONAL (player adversity) and COUNTRY (historic matches, upsets) stories.

RULES:
1. Prioritise stories RELEVANT TODAY.
2. If two countries play today, find their historic rivalry.
3. Personal stories: real adversity — injury, tragedy, poverty, racism, rejection.
4. Country stories: upsets, revenge arcs, colonial subtext, underdog runs.
5. Use bank stories AND add new ones.
6. Each story needs enough factual detail for a 2-minute video.
7. Relevance: "HOT" (today's events), "WARM" (this week), "EVERGREEN" (always works).

${CREATOR_BIAS}

Output valid JSON only (no markdown fences):
{
  "stories": [{
    "rank": 1, "type": "personal" or "country",
    "title": "Short punchy title", "player": "Name or null", "teams": "A vs B or null",
    "relevance": "HOT/WARM/EVERGREEN", "why_today": "One sentence",
    "headline": "Emotional hook", "key_facts": ["Fact 1","Fact 2","Fact 3","Fact 4","Fact 5"],
    "emotional_arc": "Tragedy → Struggle → Triumph", "script_angle": "Specific angle"
  }]
}`;

  const res = await client.messages.create({
    model: MODEL, max_tokens: 8000,
    system: [{ type: 'text', text: `You are an elite football story researcher. Find the most powerful emotional stories.\n\nStyle reference:\n${toqueymedio}\n\nOutput only valid JSON.`, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = res.content[0].type === 'text' ? res.content[0].text : '{}';
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  let stories: any[] = [];
  try { stories = JSON.parse(cleaned).stories || []; }
  catch { const m = cleaned.match(/\{[\s\S]+\}/); if (m) try { stories = JSON.parse(m[0]).stories || []; } catch { /* */ } }

  const cost = calcCost(MODEL, res.usage.input_tokens, res.usage.output_tokens);
  const payload = { stories, date: today, cost };
  writeCache(payload);

  return NextResponse.json({ ok: true, generated: stories.length, date: today, cost });
}
