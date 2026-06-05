import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const SKILLS_DIR = path.join(process.cwd(), 'content-plan', 'skills');

// ── Source: Reddit r/soccer ───────────────────────────────────────────────────
async function fetchReddit() {
  try {
    const res = await fetch('https://www.reddit.com/r/soccer/hot.json?limit=25&t=day', {
      headers: { 'User-Agent': 'diez-content-agent/1.0' },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data?.children || []).map((c: any) => ({
      title: c.data.title,
      score: c.data.score,
      comments: c.data.num_comments,
    }));
  } catch { return []; }
}

// ── Source: Google News RSS ───────────────────────────────────────────────────
async function fetchGoogleNews() {
  const queries = ['World Cup 2026', 'FIFA World Cup 2026', 'football World Cup'];
  const seen = new Set<string>();
  const results: { title: string; source: string }[] = [];
  for (const q of queries) {
    try {
      const res = await fetch(
        `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,
        { next: { revalidate: 0 } }
      );
      const xml = await res.text();
      const titles = [...xml.matchAll(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/g)].slice(1, 10);
      const sources = [...xml.matchAll(/<source[^>]*>([^<]+)<\/source>/g)];
      titles.forEach((m, i) => {
        if (!seen.has(m[1])) {
          seen.add(m[1]);
          results.push({ title: m[1], source: sources[i]?.[1] || 'Google News' });
        }
      });
    } catch { /* skip */ }
  }
  return results;
}

// ── Source: Google Trends (RSS) ───────────────────────────────────────────────
async function fetchGoogleTrends() {
  try {
    const res = await fetch(
      'https://trends.google.com/trends/trendingsearches/daily/rss?geo=US',
      { next: { revalidate: 0 } }
    );
    const xml = await res.text();
    const titles = [...xml.matchAll(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/g)].slice(1);
    const traffic = [...xml.matchAll(/<ht:approx_traffic>([^<]+)<\/ht:approx_traffic>/g)];
    return titles.slice(0, 20).map((m, i) => ({
      title: m[1],
      traffic: traffic[i]?.[1] || '',
    }));
  } catch { return []; }
}

// ── Source: YouTube (Data API v3) ─────────────────────────────────────────────
async function fetchYouTube() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { items: [], note: 'Add YOUTUBE_API_KEY to .env.local to enable' };
  try {
    const queries = ['World Cup 2026', 'FIFA 2026', 'football World Cup 2026'];
    const seen = new Set<string>();
    const items: { title: string; channel: string; views: string; videoId: string }[] = [];
    for (const q of queries.slice(0, 2)) {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&order=viewCount&videoDuration=short&publishedAfter=${new Date(Date.now() - 48 * 3600 * 1000).toISOString()}&maxResults=8&key=${key}`;
      const res = await fetch(url, { next: { revalidate: 0 } });
      const json = await res.json();
      for (const item of json.items || []) {
        const id = item.id?.videoId;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        items.push({
          title: item.snippet.title,
          channel: item.snippet.channelTitle,
          views: '',
          videoId: id,
        });
      }
    }
    return { items, note: null };
  } catch (e: any) { return { items: [], note: e.message }; }
}

// ── Source: TikTok trending (Creative Center via Apify) ───────────────────────
async function fetchTikTok() {
  const apifyToken = process.env.APIFY_TOKEN;

  // Try TikTok Creative Center undocumented endpoint first (no auth)
  try {
    const res = await fetch(
      'https://ads.tiktok.com/creative_radar_api/v1/popular_trend/hashtag/list?period=7&page=1&limit=20&country_code=US',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': 'https://ads.tiktok.com/business/creativecenter/trending-hashtags/pc/en',
        },
        next: { revalidate: 0 },
      }
    );
    if (res.ok) {
      const json = await res.json();
      const tags = (json?.data?.list || []).map((item: any) => ({
        tag: `#${item.hashtag_name}`,
        posts: item.publish_cnt ? `${(item.publish_cnt / 1000).toFixed(0)}K posts` : '',
        views: item.video_views ? `${(item.video_views / 1000000).toFixed(1)}M views` : '',
      }));
      if (tags.length > 0) return { tags, note: null };
    }
  } catch { /* fall through */ }

  // Fallback: Apify TikTok trending hashtags actor
  if (apifyToken) {
    try {
      const runRes = await fetch(
        'https://api.apify.com/v2/acts/clockworks~tiktok-hashtag-scraper/run-sync-get-dataset-items?token=' + apifyToken,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hashtags: ['WorldCup2026', 'FIFA2026', 'football'], resultsPerPage: 5 }),
          signal: AbortSignal.timeout(25000),
        }
      );
      if (runRes.ok) {
        const items = await runRes.json();
        const tags = (items || []).slice(0, 10).map((item: any) => ({
          tag: `#${item.name || item.hashtagName || ''}`,
          posts: item.videoCount ? `${item.videoCount} videos` : '',
          views: item.viewCount ? `${(item.viewCount / 1000000).toFixed(1)}M views` : '',
        })).filter((t: any) => t.tag !== '#');
        return { tags, note: null };
      }
    } catch { /* fall through */ }
  }

  return { tags: [], note: 'TikTok Creative Center temporarily unavailable' };
}

// ── Skill loader ──────────────────────────────────────────────────────────────
function loadSkills(): string {
  if (!fs.existsSync(SKILLS_DIR)) return 'No skills extracted yet.';
  const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));
  return files.map(f => {
    const content = fs.readFileSync(path.join(SKILLS_DIR, f), 'utf-8');
    return `### ${f}\n${content.slice(0, 1500)}\n`;
  }).join('\n---\n\n');
}

// ── GET — trends only ─────────────────────────────────────────────────────────
export async function GET() {
  try {
    const [reddit, news, trends, youtube, tiktok] = await Promise.all([
      fetchReddit(), fetchGoogleNews(), fetchGoogleTrends(), fetchYouTube(), fetchTikTok(),
    ]);
    return NextResponse.json({ ok: true, reddit, news, trends, youtube, tiktok });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// ── POST — generate scripts ───────────────────────────────────────────────────
export async function POST() {
  try {
    const [reddit, news, googleTrends, youtube, tiktok] = await Promise.all([
      fetchReddit(), fetchGoogleNews(), fetchGoogleTrends(), fetchYouTube(), fetchTikTok(),
    ]);

    const trendsText = [
      '## Reddit r/soccer (hot today)',
      reddit.slice(0, 12).map((r: any) => `- [${r.score} upvotes] ${r.title}`).join('\n'),
      '',
      '## Google News — World Cup 2026',
      news.slice(0, 10).map((n: any) => `- [${n.source}] ${n.title}`).join('\n'),
      '',
      '## Google Trends — Trending Searches (US)',
      googleTrends.slice(0, 10).map((t: any) => `- ${t.title} (${t.traffic})`).join('\n'),
      '',
      '## YouTube — Most Viewed (last 48h)',
      youtube.items.length > 0
        ? youtube.items.slice(0, 8).map((v: any) => `- [${v.channel}] ${v.title}`).join('\n')
        : '(Add YOUTUBE_API_KEY to enable)',
      '',
      '## TikTok — Trending Hashtags',
      tiktok.tags.length > 0
        ? tiktok.tags.slice(0, 10).map((t: any) => `- ${t.tag} ${t.views}`).join('\n')
        : tiktok.note || '(Unavailable)',
    ].join('\n');

    const skills = loadSkills();

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 8000,
      system: [
        {
          type: 'text',
          text: `You are a viral TikTok football content strategist for a creator preparing daily videos during the 2026 FIFA World Cup.

You have access to skill files extracted from 120 top-performing videos across 16 football creators, plus today's trending data from Reddit, Google News, Google Trends, YouTube, and TikTok.

STYLE RULES (non-negotiable):
- Primary reference style: @pechefootball, @fiagoball, @5.at.the.back
- Format: ~50% on-camera presenter delivery / 50% b-roll or match footage
- Tone: confident, passionate, strong POV — never neutral
- Length: 45–60 seconds when read aloud at natural pace
- Structure: bold hook (0–3s) → setup (3–15s) → payoff/reveal (15–45s) → CTA (45–60s)
- Every script needs a hot take or contrarian angle — facts alone don't go viral
- Prioritise topics trending on BOTH YouTube AND TikTok — cross-platform signal = biggest opportunity

Generate exactly 3 scripts. Score them 1–100 for predicted virality. Rank #1 = strongest.

OUTPUT: valid JSON only, no markdown fences:
{
  "generated_at": "ISO timestamp",
  "trends_summary": "2-sentence summary of the biggest story today",
  "scripts": [
    {
      "rank": 1,
      "title": "Short internal title",
      "topic": "The trending topic this exploits",
      "platforms": ["YouTube", "TikTok"],
      "virality_score": 85,
      "virality_reason": "Why this will perform",
      "hook": "Exact opening line (0–3s)",
      "script": "Full script with [CAM] and [BROLL: description] markers",
      "shot_list": ["Shot 1", "Shot 2"],
      "on_screen_text": ["Text overlay 1", "Text overlay 2"],
      "suggested_sound": "Sound/music direction",
      "caption": "TikTok caption under 150 chars",
      "hashtags": ["#tag1", "#tag2"]
    }
  ]
}`,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: `## SKILL FILES\n\n${skills}`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: `Generate 3 scripts for today.\n\n${trendsText}` }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]+\}/);
      parsed = match ? JSON.parse(match[0]) : { error: 'Parse failed', raw };
    }

    return NextResponse.json({
      ok: true,
      data: parsed,
      trends: { reddit, news, googleTrends, youtube, tiktok },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
