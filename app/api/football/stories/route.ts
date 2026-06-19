export const maxDuration = 60;

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { CREATOR_BIAS } from '@/lib/football/creatorBias';
import { calcCost } from '@/lib/football/costTracker';

const client = new Anthropic();
const M_FAST = 'claude-haiku-4-5-20251001';
const YT_KEY = process.env.YOUTUBE_API_KEY || '';
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

function loadBankCompact(): string {
  try {
    const bank = JSON.parse(fs.readFileSync(BANK_PATH, 'utf-8'));
    const personal = (bank.personal || []).map((s: any) => `${s.player} (${s.country}): ${s.tags?.join(', ') || ''}`).join('\n');
    const country = (bank.country || []).map((s: any) => `${s.teams} ${s.year}: ${s.tags?.join(', ') || ''}`).join('\n');
    return `Players: ${personal}\n\nMatches: ${country}`;
  } catch { return ''; }
}

function loadToqueymedio(): string {
  const f = path.join(SKILLS_DIR, 'channel-toqueymedio-profile.md');
  try { return fs.readFileSync(f, 'utf-8').slice(0, 1500); } catch { return ''; }
}

// ---- DATA (same as flash news) ----

function parseMatches(data: any): string[] {
  return (data.events || []).map((ev: any) => {
    const comp = ev.competitions?.[0];
    const home = comp?.competitors?.find((c: any) => c.homeAway === 'home');
    const away = comp?.competitors?.find((c: any) => c.homeAway === 'away');
    if (!comp?.status?.type?.completed) {
      return `FIXTURE: ${home?.team?.displayName || '?'} vs ${away?.team?.displayName || '?'} — ${comp?.status?.type?.detail || 'Scheduled'}`;
    }
    const goals: string[] = [];
    const cards: string[] = [];
    for (const d of comp?.details || []) {
      const athletes = (d.athletesInvolved || []).map((a: any) => a.displayName).filter(Boolean);
      const minute = d.clock?.displayValue || '';
      if (d.scoringPlay && athletes.length > 0) goals.push(`${athletes[0]} ${minute}${d.penaltyKick ? ' (PEN)' : ''}${d.ownGoal ? ' (OG)' : ''}`);
      if (d.redCard && athletes.length > 0) cards.push(`RED: ${athletes[0]} ${minute}`);
    }
    let line = `RESULT: ${home?.team?.displayName} ${home?.score}–${away?.score} ${away?.team?.displayName}`;
    if (goals.length > 0) line += ` | Goals: ${goals.join(', ')}`;
    if (cards.length > 0) line += ` | ${cards.join(', ')}`;
    return line;
  });
}

async function fetchESPN() {
  try {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10).replace(/-/g, '');
    const [todayRes, yesterdayRes, newsRes] = await Promise.all([
      fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${todayStr}`, { cache: 'no-store' }),
      fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${yesterdayStr}`, { cache: 'no-store' }),
      fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/news?limit=15', { cache: 'no-store' }),
    ]);
    const [todayData, yesterdayData, newsData] = await Promise.all([todayRes.json(), yesterdayRes.json(), newsRes.json()]);
    return {
      todayMatches: parseMatches(todayData),
      yesterdayMatches: parseMatches(yesterdayData),
      headlines: (newsData.articles || []).map((a: any) => (a.headline || a.title) as string).filter(Boolean).slice(0, 10),
    };
  } catch { return { todayMatches: [] as string[], yesterdayMatches: [] as string[], headlines: [] as string[] }; }
}

async function fetchGoogleNews(): Promise<string[]> {
  const queries = ['World Cup 2026', 'World Cup goal today', 'World Cup 2026 player'];
  const items: string[] = [];
  const seen = new Map<string, boolean>();
  await Promise.all(queries.map(async (q) => {
    try {
      const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`, { cache: 'no-store' });
      const xml = await res.text();
      for (const m of Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).slice(0, 4)) {
        const t = m[1].match(/<title>([\s\S]*?)<\/title>/);
        const title = (t?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').trim();
        if (title.length > 10 && !seen.has(title)) { seen.set(title, true); items.push(title); }
      }
    } catch { /* */ }
  }));
  return items.slice(0, 12);
}

async function fetchYouTube(): Promise<string[]> {
  if (!YT_KEY) return [];
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent('World Cup 2026')}&type=video&order=viewCount&publishedAfter=${since}&maxResults=6&key=${YT_KEY}`, { cache: 'no-store' });
    const json = await res.json();
    return (json.items || []).map((v: any) => `[${v.snippet.channelTitle}] ${v.snippet.title}`);
  } catch { return []; }
}

// ---- HANDLERS ----

export async function GET() {
  const cached = readCache();
  if (cached) {
    return NextResponse.json({ ok: true, stories: cached.stories, date: cached.date, cost: 0, cached: true });
  }
  return NextResponse.json({ ok: true, stories: [], date: null, cached: false });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  try {
    if (!body.refresh) {
      const cached = readCache();
      if (cached) {
        return NextResponse.json({ ok: true, stories: cached.stories, date: cached.date, cost: 0, cached: true });
      }
    }

    const [espn, news, ytItems] = await Promise.all([fetchESPN(), fetchGoogleNews(), fetchYouTube()]);
    const bankCompact = loadBankCompact();

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const rawData = [
      '## TODAY', espn.todayMatches.join('\n') || 'No matches today.',
      '\n## YESTERDAY', espn.yesterdayMatches.join('\n') || 'No results.',
      '\n## Headlines', espn.headlines.map((h: string) => `- ${h}`).join('\n') || 'None',
      '\n## Trending', news.map((n: string) => `- ${n}`).join('\n') || 'None',
      ytItems.length > 0 ? `\n## YouTube\n${ytItems.map((y: string) => `- ${y}`).join('\n')}` : '',
    ].join('\n');

    const prompt = `Today is ${today}.

${rawData}

## PRE-RESEARCHED STORY BANK
${bankCompact}

Generate 10 emotional story ideas ranked by today's relevance. Mix of PERSONAL (player adversity) and COUNTRY (historic matches/upsets). Prioritise goal scorers from today/yesterday. At least 5 HOT.

${CREATOR_BIAS}

Output ONLY valid JSON array, no other text:
[{"rank":1,"type":"personal","title":"Short title","player":"Name","teams":null,"relevance":"HOT","why_today":"Why now","headline":"Hook line","key_facts":["F1","F2","F3","F4","F5"],"emotional_arc":"Arc","script_angle":"Angle"}]`;

    const res = await client.messages.create({
      model: M_FAST,
      max_tokens: 4000,
      system: [{
        type: 'text',
        text: `You are a football story researcher who finds emotional backstories behind today's matches. Goal scorers, assists, red cards — every player has a story. Focus on real adversity: injury comebacks, poverty, family tragedy, refugee backgrounds, racism, rejection. For country stories: upsets, revenge arcs, colonial subtext. Be specific with facts. Output only valid JSON array. No markdown.`,
        cache_control: { type: 'ephemeral' },
      }],
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = res.content[0].type === 'text' ? res.content[0].text : '';
    let stories: any[] = [];
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      stories = Array.isArray(parsed) ? parsed : (parsed.stories || []);
    } catch {
      const m = cleaned.match(/\[[\s\S]+\]/);
      if (m) { try { stories = JSON.parse(m[0]); } catch { /* */ } }
      if (stories.length === 0) {
        const m2 = cleaned.match(/\{[\s\S]+\}/);
        if (m2) { try { stories = JSON.parse(m2[0]).stories || []; } catch { /* */ } }
      }
    }

    const cost = calcCost(M_FAST, res.usage.input_tokens, res.usage.output_tokens);
    const payload = { stories, date: today, cost };
    if (stories.length > 0) writeCache(payload);

    return NextResponse.json({ ok: true, ...payload, cached: false });
  } catch (e: any) {
    const msg = e?.message || e?.toString() || 'Unknown error';
    console.error('[stories] Failed:', msg);
    return NextResponse.json({ ok: false, error: msg.slice(0, 200), stories: [], date: null, cost: 0 });
  }
}
