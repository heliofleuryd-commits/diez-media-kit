import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { CREATOR_BIAS } from '@/lib/football/creatorBias';

const client = new Anthropic();
const SKILLS_DIR = path.join(process.cwd(), 'content-plan', 'skills');
const YT_KEY = process.env.YOUTUBE_API_KEY || '';

// ── YouTube: what people are SEARCHING ───────────────────────────────────────
async function fetchYouTubeSearchTrends() {
  const seedQueries = [
    'world cup 2026', 'fifa world cup 2026', 'world cup squad 2026',
    'world cup predictions', 'world cup group stage', 'world cup host city',
    'best player world cup', 'world cup upset',
  ];
  const seen = new Set<string>();
  const results: { query: string; suggestions: string[] }[] = [];
  await Promise.all(seedQueries.map(async (q) => {
    try {
      const res = await fetch(
        `https://suggestqueries-clients6.youtube.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(q)}&hl=en`,
        { next: { revalidate: 0 } }
      );
      const text = await res.text();
      const match = text.match(/\[[\s\S]+\]/);
      if (!match) return;
      const data = JSON.parse(match[0]);
      const suggestions = (data[1] || [])
        .map((s: any) => (Array.isArray(s) ? s[0] : s) as string)
        .filter((s: string) => s !== q && !seen.has(s))
        .slice(0, 5);
      suggestions.forEach((s: string) => seen.add(s));
      results.push({ query: q, suggestions });
    } catch { /* skip */ }
  }));
  return results;
}

// ── YouTube: trending + recent WC content ────────────────────────────────────
async function fetchYouTubeTrending() {
  if (!YT_KEY) return { trending: [], recent: [] };
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

  const [trendingRes, recentRes] = await Promise.all([
    // Most popular sports videos right now
    fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&videoCategoryId=17&regionCode=US&maxResults=8&key=${YT_KEY}`, { next: { revalidate: 0 } }),
    // World Cup content most viewed in last 48h
    fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent('World Cup 2026')}&type=video&order=viewCount&publishedAfter=${since}&maxResults=10&key=${YT_KEY}`, { next: { revalidate: 0 } }),
  ]);

  const [trendingJson, recentJson] = await Promise.all([trendingRes.json(), recentRes.json()]);

  return {
    trending: (trendingJson.items || []).map((v: any) => ({
      title: v.snippet.title,
      channel: v.snippet.channelTitle,
      views: parseInt(v.statistics?.viewCount || '0').toLocaleString(),
    })),
    recent: (recentJson.items || []).map((v: any) => ({
      title: v.snippet.title,
      channel: v.snippet.channelTitle,
      videoId: v.id.videoId,
    })),
  };
}

// ── Google Trends: football-specific + general trending ──────────────────────
async function fetchGoogleTrends() {
  const results: { title: string; traffic: string; type: string }[] = [];

  // 1. World Cup / football specific news volume from Google News as a proxy for trending searches
  const footballQueries = ['World Cup 2026', 'FIFA 2026', 'Lamine Yamal', 'Spain football', 'Messi 2026'];
  for (const q of footballQueries) {
    try {
      const res = await fetch(
        `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en&as_drrb=q&as_qdr=d`,
        { next: { revalidate: 0 } }
      );
      const xml = await res.text();
      const count = (xml.match(/<item>/g) || []).length;
      if (count > 0) results.push({ title: q, traffic: `${count} stories today`, type: 'football' });
    } catch { /* skip */ }
  }

  // 2. General US trending — filter for sport/football relevance
  try {
    const res = await fetch('https://trends.google.com/trending/rss?geo=US', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      next: { revalidate: 0 },
    });
    const xml = await res.text();
    const titles = [...xml.matchAll(/<title>([^<]{3,})<\/title>/g)].map(m => m[1].trim()).filter(t => !t.includes('Trending') && !t.includes('Google'));
    const traffic = [...xml.matchAll(/<ht:approx_traffic>([^<]+)<\/ht:approx_traffic>/g)].map(m => m[1]);
    const footballKeywords = /football|soccer|world cup|fifa|goal|match|player|messi|ronaldo|yamal|spain|barcel|argentin|england|france|brazil|germany|portugal/i;
    titles.slice(0, 20).forEach((title, i) => {
      if (footballKeywords.test(title)) {
        results.push({ title, traffic: traffic[i] || '', type: 'trending' });
      }
    });
    // Also include top 5 general trends as context
    titles.slice(0, 5).forEach((title, i) => {
      if (!results.find(r => r.title === title)) {
        results.push({ title, traffic: traffic[i] || '', type: 'general' });
      }
    });
  } catch { /* skip */ }

  return results;
}

// ── Google News: World Cup stories ───────────────────────────────────────────
async function fetchGoogleNews() {
  try {
    const res = await fetch(
      'https://news.google.com/rss/search?q=World+Cup+2026+football&hl=en-US&gl=US&ceid=US:en',
      { next: { revalidate: 0 } }
    );
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 15);
    return items.map(item => {
      const titleMatch = item[1].match(/<title>([\s\S]*?)<\/title>/);
      const sourceMatch = item[1].match(/<source[^>]*>([\s\S]*?)<\/source>/);
      const title = (titleMatch?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      const source = (sourceMatch?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      return { title, source };
    }).filter(i => i.title.length > 10);
  } catch { return []; }
}

// ── TikTok: Tokapi via RapidAPI ───────────────────────────────────────────────
async function fetchTikTok() {
  const rapidKey = process.env.RAPIDAPI_KEY;
  if (!rapidKey) return { hashtags: [], videos: [], note: 'No RAPIDAPI_KEY set' };

  const HOST = 'tokapi-mobile-version.p.rapidapi.com';
  const headers = { 'x-rapidapi-key': rapidKey, 'x-rapidapi-host': HOST };

  const tags = ['WorldCup2026', 'FIFA2026', 'LamineYamal', 'football', 'Messi', 'WorldCup', 'Spain2026'];
  const hashtags: { tag: string; views: string }[] = [];

  await Promise.all(tags.map(async (tag) => {
    try {
      const res = await fetch(
        `https://${HOST}/v1/hashtag/posts?hashtag_name=${tag}&count=5&offset=0`,
        { headers, next: { revalidate: 0 } } as any
      );
      if (!res.ok) return;
      const json = await res.json();
      const viewCount = json.ch_info?.view_count || 0;
      hashtags.push({
        tag: `#${tag}`,
        views: viewCount > 0 ? `${(viewCount / 1_000_000_000).toFixed(1)}B views` : '',
      });
    } catch { /* skip */ }
  }));

  // Search for trending WC videos
  let videos: { desc: string; plays: number }[] = [];
  try {
    const res = await fetch(
      `https://${HOST}/v1/search/keyword?keyword=world+cup+2026&count=10&offset=0`,
      { headers, next: { revalidate: 0 } } as any
    );
    if (res.ok) {
      const json = await res.json();
      videos = (json.item_list || json.data || []).slice(0, 8).map((v: any) => ({
        desc: (v.desc || '').slice(0, 90),
        plays: v.statistics?.play_count || 0,
      })).filter((v: any) => v.desc);
    }
  } catch { /* skip */ }

  return {
    hashtags,
    videos,
    note: hashtags.length === 0 ? 'Rate limited — refreshes shortly' : null,
  };
}

// ── Skill loader ──────────────────────────────────────────────────────────────
function loadSkills(): string {
  if (!fs.existsSync(SKILLS_DIR)) return 'No skills extracted yet.';
  return fs.readdirSync(SKILLS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => `### ${f}\n${fs.readFileSync(path.join(SKILLS_DIR, f), 'utf-8').slice(0, 1500)}`)
    .join('\n---\n\n');
}

// ── GET — return all trends ───────────────────────────────────────────────────
export async function GET() {
  try {
    const [ytSearch, ytContent, googleTrends, news, tiktok] = await Promise.all([
      fetchYouTubeSearchTrends(),
      fetchYouTubeTrending(),
      fetchGoogleTrends(),
      fetchGoogleNews(),
      fetchTikTok(),
    ]);
    return NextResponse.json({ ok: true, ytSearch, ytContent, googleTrends, news, tiktok });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// ── POST — generate 3 scripts ─────────────────────────────────────────────────
export async function POST() {
  try {
    const [ytSearch, ytContent, googleTrends, news, tiktok] = await Promise.all([
      fetchYouTubeSearchTrends(),
      fetchYouTubeTrending(),
      fetchGoogleTrends(),
      fetchGoogleNews(),
      fetchTikTok(),
    ]);

    const trendsText = [
      '## YouTube: What people are SEARCHING right now',
      ytSearch.map(s => `"${s.query}" → also searching: ${s.suggestions.join(', ')}`).join('\n'),
      '',
      '## YouTube: Trending sports videos (most popular)',
      ytContent.trending.slice(0, 6).map((v: any) => `- [${v.views} views] ${v.title} (${v.channel})`).join('\n'),
      '',
      '## YouTube: World Cup content (most viewed last 48h)',
      ytContent.recent.slice(0, 8).map((v: any) => `- ${v.title} (${v.channel})`).join('\n'),
      '',
      '## Google Trends: Trending searches in US right now',
      googleTrends.slice(0, 12).map((t: any) => `- ${t.title}${t.traffic ? ` (${t.traffic} searches)` : ''}`).join('\n'),
      '',
      '## World Cup News: What journalists are covering',
      news.slice(0, 10).map((n: any) => `- [${n.source}] ${n.title}`).join('\n'),
      '',
      '## TikTok: Trending Hashtags',
      tiktok.hashtags?.length > 0
        ? tiktok.hashtags.map((h: any) => `- ${h.tag} ${h.views}`).join('\n')
        : tiktok.note || 'Unavailable',
      tiktok.videos?.length > 0
        ? '\n## TikTok: Top World Cup Videos\n' + tiktok.videos.map((v: any) => `- ${v.desc}`).join('\n')
        : '',
    ].join('\n');

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 8000,
      system: [
        {
          type: 'text',
          text: `You are a viral TikTok football content strategist for a creator making daily 2026 FIFA World Cup videos.

STYLE (non-negotiable):
- Reference channels: @pechefootball, @fiagoball, @5.at.the.back
- 50% on-camera presenter / 50% b-roll or match footage
- Confident, passionate, strong POV — never neutral
- 45–60 seconds read aloud at natural pace
- Structure: bold hook (0–3s) → setup (3–15s) → payoff (15–45s) → CTA (45–60s)
- Every script needs a hot take or contrarian angle
- Prioritise topics with cross-platform signal: trending on BOTH YouTube search AND Google Trends
- Scripts must be clean spoken words only — no [CAM], no [BROLL], no direction notes, no brackets of any kind. Just the words the creator says out loud.
${CREATOR_BIAS}

OUTPUT: valid JSON only, no fences:
{
  "generated_at": "ISO timestamp",
  "trends_summary": "2-sentence summary of the single biggest story today",
  "scripts": [
    {
      "rank": 1,
      "title": "Short internal title",
      "topic": "Trending topic exploited",
      "search_signal": "Which platform/query this was trending on",
      "virality_score": 85,
      "virality_reason": "One sentence: why this will perform",
      "hook": "Exact opening line (0–3s)",
      "script": "Full clean script — spoken words only, no brackets, no direction notes",
      "shot_list": ["Shot 1 description", "Shot 2 description"],
      "on_screen_text": ["Text overlay 1"],
      "suggested_sound": "Sound direction",
      "caption": "TikTok caption under 150 chars",
      "hashtags": ["#tag1"]
    }
  ]
}`,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: `## SKILL FILES\n\n${loadSkills()}`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: `Generate 3 scripts.\n\n${trendsText}` }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { const m = raw.match(/\{[\s\S]+\}/); parsed = m ? JSON.parse(m[0]) : { error: 'Parse failed' }; }

    return NextResponse.json({ ok: true, data: parsed, trends: { ytSearch, ytContent, googleTrends, news, tiktok } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
