export const maxDuration = 60;

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { CREATOR_BIAS } from '@/lib/football/creatorBias';
import { calcCost } from '@/lib/football/costTracker';
import { fetchTrendSignals } from '@/lib/football/footballData';

const client = new Anthropic();
const M_FAST = 'claude-haiku-4-5-20251001';
const YT_KEY = process.env.YOUTUBE_API_KEY || '';
const CACHE_DIR = '/tmp';

function todayKey() { return new Date().toISOString().slice(0, 10); }
function cachePath() { return path.join(CACHE_DIR, `trending-players-${todayKey()}.json`); }

function readCache(): any | null {
  try { const data = JSON.parse(fs.readFileSync(cachePath(), 'utf-8')); if (data._date === todayKey()) return data; } catch {}
  return null;
}
function writeCache(payload: any) { try { fs.writeFileSync(cachePath(), JSON.stringify({ ...payload, _date: todayKey() })); } catch {} }

// ---- HANDLERS ----

// GET is free — only loads today's cached scan (no scrape, no model call).
export async function GET() {
  const cached = readCache();
  if (cached) return NextResponse.json({ ok: true, players: cached.players, date: cached.date, cost: 0, cached: true });
  return NextResponse.json({ ok: true, players: [], date: null, cached: false });
}

// POST scrapes + ranks — only when the creator hits Refresh (body.refresh).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  try {
    if (!body.refresh) {
      const cached = readCache();
      if (cached) return NextResponse.json({ ok: true, players: cached.players, date: cached.date, cost: 0, cached: true });
    }

    const { news, reddit, youtube } = await fetchTrendSignals(YT_KEY);
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const rawData = [
      '## GOOGLE NEWS (football — transfers, controversy, injuries, personal/family stories, tragedies)',
      news.map(n => `- ${n}`).join('\n') || 'None',
      '\n## REDDIT r/soccer + r/football (hot right now — what fans are talking about)',
      reddit.map(r => `- ${r}`).join('\n') || 'None',
      youtube.length ? `\n## YOUTUBE (most-viewed football, last 48h)\n${youtube.map(y => `- ${y}`).join('\n')}` : '',
    ].join('\n');

    const prompt = `Today is ${today}. Below are today's live football signals scraped from Google News, Reddit (r/soccer + r/football hot), and YouTube.

${rawData}

Your job: identify the TOP TRENDING FOOTBALL PLAYERS right now — the individual people the football world is searching for and talking about TODAY — so the creator can make a short personal-story video about them while they're hot.

A player is "trending" if there's a live trigger: a transfer/signing, a controversy or scandal, an injury, a personal or family story (birth, loss, illness, marriage, a story about their child), a tragedy, a return/comeback, or a standout performance. Cross-reference the signals — a name appearing across News + Reddit + YouTube is hotter than one mentioned once.

Rank the players by how strong a SHORT-FORM PERSONAL STORY they'd make right now — not just raw fame.

STRONGLY PRIORITISE emotional and controversial PERSONAL stories — grief, a child's illness, a scandal, injustice, a family tragedy, a dramatic personal turn. These are the creator's best performers, so they should rank highest and have "emotional": true. A routine transfer with no human angle should rank lower.

Only use real people and real triggers from the signals above (or clearly, currently true). Never invent a death, illness, or tragedy. If a name's trigger is unclear from the signals, infer conservatively from the headline and say so in why_trending.

${CREATOR_BIAS}

Return the TOP 12 trending players. Output ONLY a valid JSON array, no other text:
[{"rank":1,"player":"Full name","club":"Club/country or null","category":"personal","heat":"HOT","emotional":true,"why_trending":"The live trigger + where it's surfacing (e.g. 'Reddit + BBC: his son's story broke today')","angle":"The short-form story angle to tell","sources":["News","Reddit"]}]

category ∈ personal | controversy | transfer | injury | tragedy | comeback | performance | other
heat ∈ HOT (breaking / peaking today) | RISING (building)
emotional = true when it's an emotional or controversial PERSONAL/human story (these do best).`;

    const res = await client.messages.create({
      model: M_FAST,
      max_tokens: 4000,
      system: [{
        type: 'text',
        text: 'You are a football trend scout for a short-form storyteller. From live news/social signals you surface the individual players who are trending TODAY and rank them by how strong an emotional personal story they would make right now, prioritising controversial and emotional human stories. Be specific and factual — never invent a tragedy. Output only a valid JSON array, no markdown.',
        cache_control: { type: 'ephemeral' },
      }],
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = res.content[0].type === 'text' ? res.content[0].text : '';
    let players: any[] = [];
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    try { const p = JSON.parse(cleaned); players = Array.isArray(p) ? p : (p.players || []); }
    catch {
      const m = cleaned.match(/\[[\s\S]+\]/);
      if (m) { try { players = JSON.parse(m[0]); } catch {} }
      if (!players.length) { const m2 = cleaned.match(/\{[\s\S]+\}/); if (m2) { try { players = JSON.parse(m2[0]).players || []; } catch {} } }
    }

    const cost = calcCost(M_FAST, res.usage.input_tokens, res.usage.output_tokens);
    const payload = { players, date: today, cost };
    if (players.length > 0) writeCache(payload);
    return NextResponse.json({ ok: true, ...payload, cached: false });
  } catch (e: any) {
    const msg = e?.message || e?.toString() || 'Unknown error';
    console.error('[trending-players] Failed:', msg);
    return NextResponse.json({ ok: false, error: msg.slice(0, 200), players: [], date: null, cost: 0 });
  }
}
