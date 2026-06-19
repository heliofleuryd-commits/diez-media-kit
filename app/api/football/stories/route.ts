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

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const bank = loadStoryBank();
  const toqueymedio = loadToqueymedio();
  const espn = await fetchESPN();

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

  const prompt = `Today is ${today}.

## TODAY'S WORLD CUP MATCHES & NEWS
${matchLines.length > 0 ? matchLines.join('\n') : 'Check the current World Cup 2026 schedule — matches are ongoing.'}

ESPN Headlines:
${espn.headlines.map((h: any) => `- ${h.title}`).join('\n') || 'No headlines available'}

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

  return NextResponse.json({ ok: true, stories, date: today, cost });
}
