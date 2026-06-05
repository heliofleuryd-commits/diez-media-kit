import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { CREATOR_BIAS } from '@/lib/football/creatorBias';
import { calcCost } from '@/lib/football/costTracker';

const client = new Anthropic();
const SKILLS_DIR = path.join(process.cwd(), 'content-plan', 'skills');
const YT_KEY = process.env.YOUTUBE_API_KEY || '';

// Model tiers
const M_FAST   = 'claude-haiku-4-5-20251001';  // topics + news bullets ($0.80/$4 per MTok)
const M_SCRIPT = 'claude-opus-4-8';             // scripts only — quality non-negotiable

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
    .map(f => {
      const content = fs.readFileSync(path.join(SKILLS_DIR, f), 'utf-8');
      // Channel profiles: abbreviated (less useful for daily scripts)
      // Format/hook/viral files: kept fuller (directly used in writing)
      const limit = f.startsWith('channel-') ? 400 : 1200;
      return `### ${f}\n${content.slice(0, limit)}`;
    })
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

function buildTrendsText(ytSearch: any, ytContent: any, googleTrends: any, news: any, tiktok: any) {
  return [
    '## YouTube: What people are SEARCHING right now',
    ytSearch.map((s: any) => `"${s.query}" → also searching: ${s.suggestions.join(', ')}`).join('\n'),
    '',
    '## YouTube: Trending sports (most popular right now)',
    ytContent.trending.slice(0, 6).map((v: any) => `- [${v.views} views] ${v.title} (${v.channel})`).join('\n'),
    '',
    '## YouTube: World Cup content (most viewed last 48h)',
    ytContent.recent.slice(0, 8).map((v: any) => `- ${v.title} (${v.channel})`).join('\n'),
    '',
    '## Google Trends: Trending searches in US right now',
    googleTrends.slice(0, 12).map((t: any) => `- ${t.title}${t.traffic ? ` (${t.traffic})` : ''}`).join('\n'),
    '',
    '## World Cup News',
    news.slice(0, 10).map((n: any) => `- [${n.source}] ${n.title}`).join('\n'),
    '',
    '## TikTok: Trending Hashtags',
    tiktok.hashtags?.length > 0 ? tiktok.hashtags.map((h: any) => `- ${h.tag} ${h.views}`).join('\n') : 'Unavailable',
    tiktok.videos?.length > 0 ? '\n## TikTok: Top World Cup Videos\n' + tiktok.videos.map((v: any) => `- ${v.desc}`).join('\n') : '',
  ].join('\n');
}

const SYSTEM_STRATEGIST = `You are a viral TikTok football content strategist for a creator making daily 2026 FIFA World Cup videos.

CREATOR STYLE (non-negotiable):
- Reference channels: @pechefootball, @fiagoball, @5.at.the.back
- 50% on-camera presenter / 50% b-roll or match footage
- Confident, passionate, strong POV — never neutral
- Structure: bold hook (0–3s) → setup (3–15s) → payoff (15–45s) → CTA (45–60s)
- Every script needs a hot take or contrarian angle
- Scripts are clean spoken words only — no brackets, no direction notes whatsoever
${CREATOR_BIAS}`;

// ── POST — two modes: 'topics' (step 1) and 'scripts' (step 2) ───────────────
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'topics';

    // Always fetch fresh signals
    const [ytSearch, ytContent, googleTrends, news, tiktok] = await Promise.all([
      fetchYouTubeSearchTrends(),
      fetchYouTubeTrending(),
      fetchGoogleTrends(),
      fetchGoogleNews(),
      fetchTikTok(),
    ]);
    const trendsText = buildTrendsText(ytSearch, ytContent, googleTrends, news, tiktok);
    const trends = { ytSearch, ytContent, googleTrends, news, tiktok };

    // ── STEP 1: generate 10 topic ideas ──────────────────────────────────────
    if (mode === 'topics') {
      const response = await client.messages.create({
        model: M_FAST,
        max_tokens: 3000,
        system: [
          { type: 'text', text: SYSTEM_STRATEGIST, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: `## SKILL FILES\n\n${loadSkills()}`, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{
          role: 'user',
          content: `Based on today's signals, generate exactly 10 video topic ideas ranked #1 (highest virality) to #10.

These are NOT full scripts — they are strategic topic ideas the creator will choose from.
Think hard: what are the 10 best angles today that will get the most views?
Mix formats: hot takes, contrarian angles, stat reveals, reaction hooks, narratives, predictions.
${CREATOR_BIAS}

TODAY'S SIGNALS:
${trendsText}

OUTPUT valid JSON only, no fences:
{
  "trends_summary": "2-sentence summary of the single biggest story today",
  "topics": [
    {
      "id": 1,
      "title": "Short punchy title (max 8 words)",
      "angle": "The specific narrative angle or hot take (1 sentence)",
      "hook_idea": "The opening line that would stop the scroll (1 sentence, spoken words)",
      "platform_signal": "Where this is trending and why now",
      "virality_score": 94,
      "virality_reason": "Why this will perform — specific and honest",
      "format": "passionate-hot-take | contrarian-narrative-reveal | hypothetical-explainer | guess-quiz-debate | comedy-lineup-skit",
      "Spain_Yamal_angle": "How to connect this to Spain/Yamal/Barcelona/Argentina if relevant, or null"
    }
  ]
}`,
        }],
      });

      const raw = response.content[0].type === 'text' ? response.content[0].text : '';
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Try to extract JSON object even from truncated response
        const m = raw.match(/\{[\s\S]+/);
        if (m) {
          try {
            // Attempt to close truncated JSON by finding last complete topic
            const partial = m[0];
            const lastComplete = partial.lastIndexOf('},');
            if (lastComplete > 0) {
              const fixed = partial.slice(0, lastComplete + 1) + ']}';
              parsed = JSON.parse(fixed);
            } else {
              parsed = { error: 'Parse failed', raw: raw.slice(0, 200) };
            }
          } catch { parsed = { error: 'Parse failed', raw: raw.slice(0, 200) }; }
        } else {
          parsed = { error: 'Parse failed', raw: raw.slice(0, 200) };
        }
      }

      const cost = calcCost(M_FAST, response.usage.input_tokens, response.usage.output_tokens);
      return NextResponse.json({ ok: true, mode: 'topics', data: parsed, trends, cost });
    }

    // ── STEP 2: generate scripts — one API call per topic, in parallel ───────
    if (mode === 'scripts') {
      const selectedTopics: any[] = body.topics || [];
      if (selectedTopics.length === 0) {
        return NextResponse.json({ ok: false, error: 'No topics selected' }, { status: 400 });
      }

      const skillsBlock = `## SKILL FILES\n\n${loadSkills()}`;
      const systemBlocks: any[] = [
        { type: 'text', text: SYSTEM_STRATEGIST, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: skillsBlock, cache_control: { type: 'ephemeral' } },
      ];

      // One call per topic — eliminates truncation, same wall-clock time
      const scriptResults = await Promise.all(
        selectedTopics.map(async (topic: any) => {
          const prompt = `Write one complete TikTok script for this topic.

TOPIC: "${topic.title}"
ANGLE: ${topic.angle}
HOOK IDEA: ${topic.hook_idea}
FORMAT: ${topic.format}
SIGNAL: ${topic.platform_signal}
${topic.Spain_Yamal_angle ? `SPAIN/YAMAL ANGLE: ${topic.Spain_Yamal_angle}` : ''}

TODAY'S CONTEXT (use for accuracy):
${trendsText.slice(0, 1500)}

REQUIREMENTS:
- 45–65 seconds read aloud naturally
- Use the hook idea as a starting point but make it the best possible version
- Strong payoff that earns the full watch
- Clean spoken words only — absolutely no brackets, no [CAM], no [BROLL], no direction notes

OUTPUT valid JSON only, no fences:
{
  "topic_id": ${topic.id},
  "title": "${topic.title}",
  "virality_score": ${topic.virality_score},
  "hook": "exact opening line",
  "script": "full clean script, spoken words only",
  "caption": "TikTok caption under 150 chars",
  "hashtags": ["#tag1", "#tag2", "#tag3"],
  "on_screen_text": ["overlay 1", "overlay 2"]
}`;

          try {
            const res = await client.messages.create({
              model: M_SCRIPT,
              max_tokens: 2000,
              system: systemBlocks,
              messages: [{ role: 'user', content: prompt }],
            });
            const raw = res.content[0].type === 'text' ? res.content[0].text : '';
            const scriptCost = calcCost(M_SCRIPT, res.usage.input_tokens, res.usage.output_tokens);
            let parsed: any;
            try { parsed = JSON.parse(raw); }
            catch {
              const m = raw.match(/\{[\s\S]+\}/);
              parsed = m ? JSON.parse(m[0]) : { topic_id: topic.id, title: topic.title, error: 'Parse failed' };
            }
            return { ...parsed, _cost: scriptCost };
          } catch (e: any) {
            return { topic_id: topic.id, title: topic.title, error: e.message, _cost: 0 };
          }
        })
      );

      const cost = scriptResults.reduce((sum: number, s: any) => sum + (s._cost || 0), 0);
      scriptResults.forEach((s: any) => delete s._cost);
      return NextResponse.json({ ok: true, mode: 'scripts', data: { scripts: scriptResults }, trends, cost });
    }

    return NextResponse.json({ ok: false, error: 'Invalid mode' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
