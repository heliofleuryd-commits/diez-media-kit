export const maxDuration = 120;

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { calcCost } from '@/lib/football/costTracker';

const client = new Anthropic();
const MODEL = 'claude-sonnet-4-6';

function todayKey() { return new Date().toISOString().slice(0, 10); }
function cachePath() { return path.join('/tmp', `video-ideas-${todayKey()}.json`); }
function readCache(): any | null { try { const d = JSON.parse(fs.readFileSync(cachePath(), 'utf-8')); if (d._date === todayKey()) return d; } catch {} return null; }
function writeCache(data: any) { try { fs.writeFileSync(cachePath(), JSON.stringify({ ...data, _date: todayKey() })); } catch {} }

// Broad football news — the whole footballing world, not just the World Cup.
const NEWS_QUERIES = [
  'football', 'football transfer', 'champions league', 'premier league',
  'footballer injury', 'footballer death', 'football controversy', 'footballer comeback',
  'Messi', 'Ronaldo', 'football tribute',
];

async function fetchHeadlines(query: string, limit: number): Promise<string[]> {
  try {
    const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    const xml = await res.text();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, limit).map(m => {
      const t = m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').trim();
      return t || '';
    }).filter(Boolean);
  } catch { return []; }
}

export async function GET() {
  const cached = readCache();
  if (cached) return NextResponse.json({ ok: true, ideas: cached.ideas, date: cached.date, cost: 0, cached: true });
  return NextResponse.json({ ok: true, ideas: [], date: null, cached: false });
}

export async function POST() {
  try {
    const batches = await Promise.all(NEWS_QUERIES.map(q => fetchHeadlines(q, 5)));
    const seen = new Set<string>();
    const headlines: string[] = [];
    for (const b of batches) for (const h of b) { const k = h.toLowerCase(); if (!seen.has(k)) { seen.add(k); headlines.push(h); } }

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const prompt = `Today is ${today}. Here are current football headlines from across the whole footballing world:

${headlines.map(h => `- ${h}`).join('\n')}

Generate 10 EMOTIONAL FOOTBALL STORY VIDEO IDEAS for a short-form storytelling creator (David King / toqueymedio style — deep human stories, comebacks, tragedy, redemption, injustice, glory). Each idea must be a STORY (not a hot take).

Mix:
- ~6 driven by what's happening RIGHT NOW (from the headlines above or clearly current).
- ~4 all-time GREATEST football stories that would hit today (timeless legends, tragedies, miracles — not tied to this week).

For each idea give:
- title: short punchy working title
- subject: the player / team / match it's about
- hook: a David-King-style opening line ("As …") OR an emotional "Imagine …" hook — ready to say out loud
- angle: the emotional spine in one sentence (what makes it hit)
- source: "current" or "evergreen"
- relevance: "HOT" (tied to right now), "WARM" (topical), or "TIMELESS"

Output ONLY valid JSON array, no markdown:
[{"rank":1,"title":"...","subject":"...","hook":"...","angle":"...","source":"current","relevance":"HOT"}]`;

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: [{ type: 'text', text: 'You are a football story ideation engine for an emotional short-form storyteller. You surface both breaking-news story angles and timeless great football stories. Output only valid JSON.', cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = res.content[0].type === 'text' ? res.content[0].text : '';
    const cost = calcCost(MODEL, res.usage.input_tokens, res.usage.output_tokens);
    let ideas: any[] = [];
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    try { const p = JSON.parse(cleaned); ideas = Array.isArray(p) ? p : (p.ideas || []); }
    catch { const m = cleaned.match(/\[[\s\S]+\]/); if (m) { try { ideas = JSON.parse(m[0]); } catch {} } }

    if (!ideas.length) return NextResponse.json({ ok: false, error: 'Failed to generate ideas' });

    const payload = { ideas, date: today, cost };
    writeCache(payload);
    return NextResponse.json({ ok: true, ...payload, cached: false });
  } catch (e: any) {
    console.error('[video-ideas] Failed:', e.message);
    return NextResponse.json({ ok: false, error: e.message?.slice(0, 250) || 'Unknown error' }, { status: 500 });
  }
}
