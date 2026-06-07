import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { CREATOR_BIAS } from '@/lib/football/creatorBias';
import { calcCost } from '@/lib/football/costTracker';

const client = new Anthropic();
const SKILLS_DIR = path.join(process.cwd(), 'content-plan', 'skills');
const YT_KEY = process.env.YOUTUBE_API_KEY || '';

// Server-side TikTok cache — prevents repeated RapidAPI calls within the same serverless instance
let _tiktokCache: { data: Awaited<ReturnType<typeof _fetchTikTokRaw>>; ts: number } | null = null;
const TIKTOK_SERVER_TTL = 60 * 60 * 1000; // 1 hour

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
// Only 3 hashtags (was 7) to conserve World Cup quota.
// Server-side 1-hour cache prevents repeated calls within the same serverless instance.
async function _fetchTikTokRaw() {
  const rapidKey = process.env.RAPIDAPI_KEY;
  if (!rapidKey) return { hashtags: [], videos: [], note: 'No RAPIDAPI_KEY set' };

  const HOST = 'tokapi-mobile-version.p.rapidapi.com';
  const headers = { 'x-rapidapi-key': rapidKey, 'x-rapidapi-host': HOST };

  const tags = ['WorldCup2026', 'FIFA2026', 'football'];
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

  return {
    hashtags,
    videos: [] as { desc: string; plays: number }[],
    note: hashtags.length === 0 ? 'Rate limited — refreshes shortly' : null,
  };
}

async function fetchTikTok() {
  if (_tiktokCache && Date.now() - _tiktokCache.ts < TIKTOK_SERVER_TTL) {
    return _tiktokCache.data;
  }
  const data = await _fetchTikTokRaw();
  _tiktokCache = { data, ts: Date.now() };
  return data;
}

// ── X (Twitter): football trends via trends24.in scrape (free, no API key) ───
// Pulls live trending topics from a handful of football-mad countries and
// keeps only the ones that look football-related — gives "what people are
// talking about right now on X" without needing any paid X/Twitter API.
let _xTrendsCache: { data: Awaited<ReturnType<typeof _fetchXTrendsRaw>>; ts: number } | null = null;
const X_TRENDS_TTL = 60 * 60 * 1000; // 1 hour

const TRENDS24_COUNTRIES = ['united-states', 'mexico', 'brazil', 'argentina', 'spain', 'united-kingdom', 'france'];

const FOOTBALL_TREND_KEYWORDS = /football|soccer|f[uú]tbol|world ?cup|mundial|fifa|copa|champions|uefa|concacaf|conmebol|messi|mbapp[ée]|ronaldo|neymar|haaland|vin[ií]cius|yamal|real madrid|barcelona|bar[çc]a|liverpool|manchester|\bpsg\b|bayern|juventus|chelsea|arsenal|selecc?[ãa]o|seleccion|selección|argentina|brasil|brazil|m[ée]xico|uruguay|colombia|portugal|espa[ñn]a|\bspain\b|inglaterra|\bengland\b|francia|\bfrance\b|alemania|germany|\bgol\b|\bgoal\b|penal|penalty|\bvar\b|tarjeta roja|red card/i;

async function _fetchXTrendsRaw() {
  const headers = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' };
  const found = new Map<string, string[]>();

  await Promise.all(TRENDS24_COUNTRIES.map(async (country) => {
    try {
      const res = await fetch(`https://trends24.in/${country}/`, { headers, next: { revalidate: 0 } } as any);
      if (!res.ok) return;
      const html = await res.text();
      const names = [...html.matchAll(/class=trend-link>([^<]+)<\/a>/g)].map(m => m[1].trim());
      names.forEach(name => {
        if (FOOTBALL_TREND_KEYWORDS.test(name)) {
          const list = found.get(name) || [];
          if (!list.includes(country)) list.push(country);
          found.set(name, list);
        }
      });
    } catch { /* skip */ }
  }));

  const trends = [...found.entries()]
    .map(([name, countries]) => ({ name, countries }))
    .sort((a, b) => b.countries.length - a.countries.length)
    .slice(0, 15);

  return { trends, note: trends.length === 0 ? 'No football-specific X trends detected right now' : null };
}

async function fetchXTrends() {
  if (_xTrendsCache && Date.now() - _xTrendsCache.ts < X_TRENDS_TTL) {
    return _xTrendsCache.data;
  }
  const data = await _fetchXTrendsRaw();
  _xTrendsCache = { data, ts: Date.now() };
  return data;
}

// ── Skill loader — filters to selected channel styles ────────────────────────
function loadSkills(styles: string[] = []): string {
  if (!fs.existsSync(SKILLS_DIR)) return 'No skills extracted yet.';
  return fs.readdirSync(SKILLS_DIR)
    .filter(f => f.endsWith('.md'))
    .filter(f => {
      if (!f.startsWith('channel-')) return true; // always include format/hook/viral files
      if (styles.length === 0) return true;
      return styles.some(s => f.includes(s));
    })
    .map(f => {
      const content = fs.readFileSync(path.join(SKILLS_DIR, f), 'utf-8');
      // Give selected channel profiles more space; format/hook files stay full
      const limit = f.startsWith('channel-') ? 1200 : 1200;
      return `### ${f}\n${content.slice(0, limit)}`;
    })
    .join('\n---\n\n');
}

// Full toqueymedio script structure derived from deep analysis of his top 50 videos.
// Injected into system prompt whenever emotional style is selected.
const TOQUEYMEDIO_SCRIPT_STRUCTURE = `
═══════════════════════════════════════════
TOQUEYMEDIO EMOTIONAL STORYTELLING SYSTEM
═══════════════════════════════════════════

FUNDAMENTAL RULE: The emotional style is the DELIVERY. The CONTENT is always a specific, accurate, factual play-by-play of a real game or moment. You cannot fake specificity. Facts + emotion woven together = the formula. Facts alone = Wikipedia. Emotion alone = empty poetry.

━━━ BEAT 1: THE HOOK (0:00–0:08) — Pure emotional ante. No facts yet. ━━━

Choose ONE template:

TEMPLATE A — "Imagine" Immersion (most used):
  "Imagine [vivid scene: the viewer at the exact moment of maximum tension/hope/dread].
   [One sentence that makes it more impossible or more beautiful — deepens the stakes].
   [A short fragment — a name, a question, one devastating fact — that opens the story]."
  → Use for: underdogs, comebacks, World Cup finals, sacred moments.
  Shape: "Imagine being one minute away from winning the World Cup. Imagine giving your body, your country, your soul for 119 minutes. And then the penalty."

TEMPLATE B — Paradox / Contradiction:
  "[What everyone believes about this team or player].
   [Its devastating inversion — the hidden truth, the opposite reality].
   [The consequence that reframes everything]."
  → Use for: fallen heroes, misremembered history, overlooked greatness.
  Shape: "Everyone said they were the best team in the world. Nobody remembers them. Because in football, second place is just the first loser."

TEMPLATE C — Dramatic Irony:
  "[Date and place, stated gravely — like a verdict].
   [The protagonists don't know what's about to happen].
   [What IS about to happen]."
  → Use for: historic matches, endings nobody saw coming, last moments of an era.

FORBIDDEN hooks: "Did you know…" / stats-first / stand-alone rhetorical question / hype openers ("This is INSANE") / analytical setups.

━━━ BEAT 2: THE SACRED GROUND (0:08–0:20) — Facts enter here. ━━━

Date. Place. The stakes, in one sentence. State like a verdict being read.
"July 9th, 2006. Berlin. The World Cup final between France and Italy."

━━━ BEAT 3: THE GAME NARRATIVE (0:20–1:10) — LONGEST SECTION. The factual backbone. ━━━

This is where most writers fail. MANDATORY elements:

✓ MINUTE MARKERS as drumbeats: "Minute 7." "Minute 55." "Minute 90+3." Non-negotiable — they ratchet tension and make the viewer feel time passing inside the match.
✓ SPECIFIC PLAYER NAMES at every key moment — the actual person, not their position. "Luis García" not "the striker". "Jerzy Dudek" not "the goalkeeper".
✓ EXACT SCORE PROGRESSION: The viewer tracks every goal as it happens. "1-0. Then 2-0. Then, impossibly, 2-1."
✓ SPECIFIC PLAYS described cinematically: Not "they scored" — "the cross comes in, the header meets it, and the net is trembling before the goalkeeper can react."
✓ THE SPECIFIC CONTROVERSY: The exact handball (Suárez, Minute 120, Ghana). The exact red card (Zidane, Minute 110, headbutt on Materazzi's chest). The exact disallowed goal. These are the pivots the story turns on.
✓ PENALTY SEQUENCES with individual detail: Who stepped up. Their body language. What happened. "Pirlo chips it Panenka-style. The goalkeeper dives right. The ball floats down the centre. Nobody believes what they just saw."
✓ EMOTIONAL SENTENCES woven through the facts: After each key fact — one emotional consequence. Then back to facts. This alternation is the heartbeat.

WRONG: "The game was dramatic and the pressure was immense."
RIGHT: "Minute 45. Uruguay score. The stadium goes silent. For the next 82 minutes, Ghana attacks like their lives depend on it. Minute 82 — Gyan equalises. Then comes Minute 120. Suárez on the goal-line. The ball is going in. He raises his hand. He stops it. He is sent off. Asamoah Gyan steps up to the spot. He hits the crossbar. And in that single moment, an entire continent's dream shatters."

━━━ BEAT 4: THE TURN (~1:00) ━━━
"And then…" — one fragment. The pivot. Introduced with a short sentence or single word.

━━━ BEAT 5: THE CLIMAX (1:10–1:30) — SLOW DOWN ━━━
Sentence length halves. One word. A fragment. Let it breathe.
Deploy the CEREMONIAL FULL NAME: the player referred to casually now receives their full birth name.
Add religious/cosmic imagery. The moment breathes. The viewer's throat tightens.

━━━ BEAT 6: THE TWO FACES ━━━
One sentence: the winner's euphoria.
One sentence: the loser's desolation.
Hold both simultaneously.

━━━ BEAT 7: THE APHORISTIC CLOSER (final 5–10s) ━━━
One standalone sentence. A universal truth about football or life. Slightly paradoxical. Quotable in isolation.
No qualifier. No hedge. Let it stand alone in silence.
`;

function buildSystemPrompt(styles: string[]): string {
  const hasEmotional = styles.includes('toqueymedio');
  const analytical = styles.filter(s => s !== 'toqueymedio');

  const refs = styles.length > 0
    ? styles.map(s => `@${s}`).join(', ')
    : '@pechefootball, @fiagoball, @5.at.the.back';

  const tone = hasEmotional && analytical.length > 0
    ? 'Blend analytical insight with emotional, cinematic storytelling — confident takes delivered with poetic weight and aphoristic closers.'
    : hasEmotional
    ? 'Emotional, cinematic, poetic storytelling in the @toqueymedio style. Present-tense narration, religious/cosmic imagery, ceremonial full names at climaxes, aphoristic final line. Deep feeling over hot takes.'
    : 'Analytical, confident, strong POV — hot takes, contrarian angles, bold claims. Never neutral.';

  const hookInstructions = hasEmotional
    ? TOQUEYMEDIO_SCRIPT_STRUCTURE
    : `HOOK (non-negotiable):
- Strong analytical hook in first 3 seconds — must stop the scroll
- Bold claim, stat reveal, contrarian angle, or rhetorical provocation
- Never start with "Did you know" or a generic question`;

  return `You are a viral TikTok football content strategist for a creator making 2026 FIFA World Cup videos.

STYLE — write in the voice of: ${refs}
${tone}

FORMAT (non-negotiable):
- ${hasEmotional ? '120 seconds read aloud at natural pace (2–2.5 min target — emotional stories need room to breathe)' : '60–75 seconds read aloud at natural pace (never under 60)'}
- Clean spoken words only — no [CAM], no [BROLL], no direction notes whatsoever
- Every script builds to a clear payoff
${hookInstructions}
${CREATOR_BIAS}`;
}

// ── GET — return all trends ───────────────────────────────────────────────────
export async function GET() {
  try {
    const [ytSearch, ytContent, googleTrends, news, tiktok, xTrends] = await Promise.all([
      fetchYouTubeSearchTrends(),
      fetchYouTubeTrending(),
      fetchGoogleTrends(),
      fetchGoogleNews(),
      fetchTikTok(),
      fetchXTrends(),
    ]);
    return NextResponse.json({ ok: true, ytSearch, ytContent, googleTrends, news, tiktok, xTrends });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

function buildTrendsText(ytSearch: any, ytContent: any, googleTrends: any, news: any, tiktok: any, xTrends: any) {
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
    '',
    '## X (Twitter): What people are talking about — football trends right now',
    xTrends?.trends?.length > 0
      ? xTrends.trends.map((t: any) => `- "${t.name}" — trending in ${t.countries.join(', ')}`).join('\n')
      : 'No football-specific X trends detected right now',
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
    const styles: string[] = body.styles?.length > 0
      ? body.styles
      : ['pechefootball', 'fiagoball', '5.at.the.back'];

    // Fetch trends — TikTok skipped in POST to preserve RapidAPI quota (GET has server-cached TikTok)
    const [ytSearch, ytContent, googleTrends, news, xTrends] = await Promise.all([
      fetchYouTubeSearchTrends(),
      fetchYouTubeTrending(),
      fetchGoogleTrends(),
      fetchGoogleNews(),
      fetchXTrends(),
    ]);
    const tiktok = { hashtags: [], videos: [], note: 'Skipped in POST to preserve quota' };
    const trendsText = buildTrendsText(ytSearch, ytContent, googleTrends, news, tiktok, xTrends);
    const trends = { ytSearch, ytContent, googleTrends, news, tiktok, xTrends };

    const hasEmotional = styles.includes('toqueymedio');

    // ── STEP 1: generate 10 topic ideas ──────────────────────────────────────
    if (mode === 'topics') {
      const hookIdeaInstruction = hasEmotional
        ? `"hook_idea": "A 2–3 sentence toqueymedio-style hook using Template A (Imagine...), B (Paradox), or C (Dramatic Irony). Must be slow, cinematic, emotional — NOT analytical. Spoken words only."`
        : `"hook_idea": "The bold opening line that stops the scroll (1 sentence, spoken words — hot take or provocation)"`;

      const topicsStyleNote = hasEmotional
        ? `Style note: prioritise emotional, cinematic stories — fallen heroes, impossible miracles, coronation of greatness. Think @toqueymedio: narrative arcs, not hot takes.`
        : `Mix formats: hot takes, contrarian angles, stat reveals, reaction hooks, narratives, predictions.`;

      const response = await client.messages.create({
        model: M_FAST,
        max_tokens: 3000,
        system: [
          { type: 'text', text: buildSystemPrompt(styles), cache_control: { type: 'ephemeral' } },
          { type: 'text', text: `## SKILL FILES\n\n${loadSkills(styles)}`, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{
          role: 'user',
          content: `Based on today's signals, generate exactly 10 video topic ideas ranked #1 (highest virality) to #10.

These are NOT full scripts — they are strategic topic ideas the creator will choose from.
Think hard: what are the 10 best angles today that will get the most views?
${topicsStyleNote}
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
      ${hookIdeaInstruction},
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

      const systemBlocks: any[] = [
        { type: 'text', text: buildSystemPrompt(styles), cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `## SKILL FILES\n\n${loadSkills(styles)}`, cache_control: { type: 'ephemeral' } },
      ];

      // One call per topic — eliminates truncation, same wall-clock time
      const scriptResults = await Promise.all(
        selectedTopics.map(async (topic: any) => {
          const hookRequirement = hasEmotional
            ? `HOOK REQUIREMENT: Use the TOQUEYMEDIO hook formula from your system prompt.
Start with Template A ("Imagine..."), B (Paradox), or C (Dramatic Irony) — whichever fits this story.
The hook must be 2–3 sentences. Slow. Cinematic. It sets a scene and then twists it.
The hook_idea below is a starting point — make it the best version of that template.`
            : `HOOK REQUIREMENT: Use the hook idea as a starting point but make it the strongest possible version.`;

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
- ${hasEmotional ? '105–135 seconds read aloud naturally (target: 2–2.5 minutes — emotional storytelling needs this length to build, breathe, and land)' : 'at least 60 seconds — aim for 60–75 seconds read aloud naturally, never shorter than 60'}
- ${hookRequirement}
- Strong payoff that earns the full watch
- Clean spoken words only — absolutely no brackets, no [CAM], no [BROLL], no direction notes
${hasEmotional ? `- FACTUAL BACKBONE (mandatory): The game narrative section MUST include specific minute markers ("Minute 7.", "Minute 82."), specific player names at every key moment, exact score progression, and at least one specific play described cinematically. The emotion runs THROUGH the facts — not instead of them.
- End with an aphoristic closer — one standalone sentence, a universal truth, let it stand in silence` : ''}

OUTPUT valid JSON only, no fences:
{
  "topic_id": ${topic.id},
  "title": "${topic.title}",
  "virality_score": ${topic.virality_score},
  "hook": "exact opening 2–3 sentences of the hook",
  "script": "full clean script, spoken words only",
  "caption": "TikTok caption under 150 chars",
  "hashtags": ["#tag1", "#tag2", "#tag3"],
  "on_screen_text": ["overlay 1", "overlay 2"]
}`;

          try {
            const res = await client.messages.create({
              model: M_SCRIPT,
              max_tokens: hasEmotional ? 4000 : 2000,
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
