export const maxDuration = 120;

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { calcCost } from '@/lib/football/costTracker';

const client = new Anthropic();
const MODEL = 'claude-sonnet-4-6';
const YT_KEY = process.env.YOUTUBE_API_KEY || '';

function todayKey() { return new Date().toISOString().slice(0, 10); }
function cachePath() { return path.join('/tmp', `shorts-titles-${todayKey()}.json`); }

function readCache(): any | null {
  try {
    const d = JSON.parse(fs.readFileSync(cachePath(), 'utf-8'));
    if (d._date === todayKey()) return d;
  } catch {}
  return null;
}

function writeCache(data: any) {
  try { fs.writeFileSync(cachePath(), JSON.stringify({ ...data, _date: todayKey() })); } catch {}
}

// The whole footballing world — current + evergreen great stories, not just the World Cup.
const QUERIES = [
  'football story', 'soccer story', 'football history', 'greatest football moment',
  'world cup', 'champions league', 'premier league', 'football transfer',
  'messi', 'ronaldo', 'football legend', 'football tragedy', 'football comeback',
];

function decodeHtml(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

interface ShortVideo {
  id: string;
  title: string;
  channel: string;
  views: number;
  likes: number;
  published: string;
  duration: number;
}

async function searchShorts(query: string, publishedAfter: string): Promise<{ id: string; title: string; channel: string; published: string }[]> {
  if (!YT_KEY) return [];
  try {
    const params = new URLSearchParams({
      part: 'snippet', q: query, type: 'video',
      videoDuration: 'short', order: 'viewCount',
      maxResults: '50', publishedAfter, key: YT_KEY,
    });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.items || []).map((item: any) => ({
      id: item.id?.videoId,
      title: decodeHtml(item.snippet?.title || ''),
      channel: item.snippet?.channelTitle || '',
      published: item.snippet?.publishedAt || '',
    })).filter((v: any) => v.id);
  } catch { return []; }
}

async function getStats(ids: string[]): Promise<Map<string, { views: number; likes: number; duration: number }>> {
  const map = new Map();
  if (!YT_KEY) return map;
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${batch.join(',')}&key=${YT_KEY}`,
        { cache: 'no-store' }
      );
      if (!res.ok) continue;
      const json = await res.json();
      for (const item of json.items || []) {
        const dur = item.contentDetails?.duration || 'PT0S';
        const m = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        const secs = (parseInt(m?.[1] || '0') * 3600) + (parseInt(m?.[2] || '0') * 60) + parseInt(m?.[3] || '0');
        if (secs <= 180) {
          map.set(item.id, {
            views: parseInt(item.statistics?.viewCount || '0'),
            likes: parseInt(item.statistics?.likeCount || '0'),
            duration: secs,
          });
        }
      }
    } catch {}
  }
  return map;
}

// David King is the benchmark storyteller — pull his own channel's top shorts.
async function fetchDavidKing(): Promise<{ id: string; title: string; channel: string; published: string }[]> {
  if (!YT_KEY) return [];
  try {
    const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=DavidKingStories&key=${YT_KEY}`, { cache: 'no-store' });
    const channelId = (await chRes.json())?.items?.[0]?.id;
    if (!channelId) return [];
    const params = new URLSearchParams({ part: 'snippet', channelId, type: 'video', order: 'viewCount', maxResults: '50', key: YT_KEY });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { cache: 'no-store' });
    const json = await res.json();
    return (json.items || []).map((item: any) => ({
      id: item.id?.videoId,
      title: decodeHtml(item.snippet?.title || ''),
      channel: 'David King Stories',
      published: item.snippet?.publishedAt || '',
    })).filter((v: any) => v.id);
  } catch { return []; }
}

export async function GET() {
  const cached = readCache();
  if (cached) {
    return NextResponse.json({ ok: true, shorts: cached.shorts, analysis: cached.analysis, date: cached.date, cost: 0, cached: true });
  }
  return NextResponse.json({ ok: true, shorts: [], analysis: null, date: null, cached: false });
}

export async function POST() {
  try {
    const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString();
    const [batches, davidKing] = await Promise.all([
      Promise.all(QUERIES.map(q => searchShorts(q, oneYearAgo))),
      fetchDavidKing(),
    ]);

    const seen = new Map<string, { id: string; title: string; channel: string; published: string }>();
    for (const v of davidKing) if (!seen.has(v.id)) seen.set(v.id, v); // benchmark creator first
    for (const batch of batches) {
      for (const v of batch) {
        if (!seen.has(v.id)) seen.set(v.id, v);
      }
    }

    if (seen.size === 0) {
      return NextResponse.json({ ok: false, error: 'YouTube API returned no results — check API key quota' });
    }

    const stats = await getStats(Array.from(seen.keys()));

    const shorts: ShortVideo[] = [];
    for (const [id, info] of seen) {
      const s = stats.get(id);
      if (s && s.views >= 5000) {
        shorts.push({ id, title: info.title, channel: info.channel, views: s.views, likes: s.likes, published: info.published, duration: s.duration });
      }
    }

    shorts.sort((a, b) => b.views - a.views);
    const top = shorts.slice(0, 250);

    if (top.length < 10) {
      return NextResponse.json({ ok: false, error: `Only found ${top.length} shorts — YouTube API may be rate-limited` });
    }

    const titlesText = top.map((s, i) =>
      `${i + 1}. "${s.title}" — ${formatViews(s.views)} views — @${s.channel}`
    ).join('\n');

    const analysisPrompt = `Analyze these ${top.length} YouTube Shorts titles from football/soccer creators. Each shows view count and creator name.

NOTE: "@David King Stories" is the BENCHMARK football storyteller — pay special attention to how his titles are built, and call him out specifically in your insights.

TITLES:
${titlesText}

YOUR TASK — deep analysis of what makes football Shorts titles perform:

1. CATEGORIZE every title into 6-8 categories you identify from the data (e.g., Emotional Story, Curiosity Gap, Hot Take, Stat/Fact, Player Mythologizing, Match Moment, Comparison, etc.). Name categories based on what you ACTUALLY see — don't force predefined categories.

2. For each category: name, emoji, description, why it works psychologically, a reusable template formula, and how many titles belong to it.

3. Assign every title (by its number) to exactly one category.

4. Identify the TOP 5 specific title patterns/formulas that consistently get the most views. Give concrete examples.

5. List "power words" that appear frequently in top-performing titles.

6. Analyze title LENGTH — what's the sweet spot?

7. Write 3-4 paragraphs of DEEP, actionable insight. Reference specific titles by quoting them. Explain WHAT specifically makes football Shorts titles work differently from other niches. Give concrete advice on how to write better titles.

Ignore any non-football titles that crept in.

Output ONLY valid JSON — no markdown, no backticks:
{
  "categories": [
    {
      "name": "Category Name",
      "emoji": "🔥",
      "description": "What defines this category (1 sentence)",
      "why_it_works": "Psychology behind why viewers click (2-3 sentences)",
      "template": "Reusable title formula with [BRACKETS] for variables",
      "count": 0
    }
  ],
  "assignments": {"1": "Category Name", "2": "Category Name"},
  "top_patterns": [
    {
      "name": "Pattern Name",
      "description": "What the pattern is and why it works (2-3 sentences)",
      "examples": ["Exact title 1", "Exact title 2", "Exact title 3"]
    }
  ],
  "power_words": ["word1", "word2"],
  "title_length": "2-3 sentence analysis of optimal title length with specific numbers",
  "deep_insights": "3-4 paragraph deep analysis with specific title references and actionable advice"
}`;

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: [{ type: 'text', text: 'You are an expert YouTube Shorts title analyst specializing in football/soccer content. You understand packaging psychology, click triggers, and viral title patterns. Analyze deeply — give insights a creator can act on TODAY. Output only valid JSON.', cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: analysisPrompt }],
    });

    const raw = res.content[0].type === 'text' ? res.content[0].text : '';
    const cost = calcCost(MODEL, res.usage.input_tokens, res.usage.output_tokens);

    let analysis: any = null;
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    try { analysis = JSON.parse(cleaned); } catch {
      const m = cleaned.match(/\{[\s\S]+\}/);
      if (m) try { analysis = JSON.parse(m[0]); } catch {}
    }

    if (!analysis) {
      return NextResponse.json({ ok: false, error: 'Failed to parse analysis' });
    }

    const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const payload = { shorts: top, analysis, date, cost };
    writeCache(payload);

    return NextResponse.json({ ok: true, ...payload, cached: false });
  } catch (e: any) {
    console.error('[shorts-analysis] Failed:', e.message);
    return NextResponse.json({ ok: false, error: e.message?.slice(0, 300) || 'Unknown error' }, { status: 500 });
  }
}
