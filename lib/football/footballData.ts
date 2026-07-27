// Shared general-football data layer (post-World-Cup).
// Match data: top-5 leagues + UCL/Europa via ESPN. News: broad Google News +
// trusted outlets + transfer specialists, weighted to emotional/trending stories.

export const LEAGUES = [
  { code: 'eng.1', name: 'Premier League' },
  { code: 'esp.1', name: 'La Liga' },
  { code: 'ita.1', name: 'Serie A' },
  { code: 'ger.1', name: 'Bundesliga' },
  { code: 'fra.1', name: 'Ligue 1' },
  { code: 'uefa.champions', name: 'Champions League' },
  { code: 'uefa.europa', name: 'Europa League' },
];

function parseMatches(data: any, league: string): string[] {
  return (data.events || []).map((ev: any) => {
    const comp = ev.competitions?.[0];
    const home = comp?.competitors?.find((c: any) => c.homeAway === 'home');
    const away = comp?.competitors?.find((c: any) => c.homeAway === 'away');
    if (!comp?.status?.type?.completed) {
      return `[${league}] FIXTURE: ${home?.team?.displayName || '?'} vs ${away?.team?.displayName || '?'} — ${comp?.status?.type?.detail || 'Scheduled'}`;
    }
    const goals: string[] = [];
    const cards: string[] = [];
    for (const d of comp?.details || []) {
      const athletes = (d.athletesInvolved || []).map((a: any) => a.displayName).filter(Boolean);
      const minute = d.clock?.displayValue || '';
      if (d.scoringPlay && athletes.length > 0) goals.push(`${athletes[0]} ${minute}${d.penaltyKick ? ' (PEN)' : ''}${d.ownGoal ? ' (OG)' : ''}`);
      if (d.redCard && athletes.length > 0) cards.push(`RED: ${athletes[0]} ${minute}`);
    }
    let line = `[${league}] RESULT: ${home?.team?.displayName} ${home?.score}–${away?.score} ${away?.team?.displayName}`;
    if (goals.length) line += ` | Goals: ${goals.join(', ')}`;
    if (cards.length) line += ` | ${cards.join(', ')}`;
    return line;
  });
}

async function espn(url: string): Promise<any> {
  try { const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(6000) }); return await r.json(); }
  catch { return {}; }
}

// Today + yesterday results/fixtures + headlines across all tracked competitions.
export async function fetchScoreboards(): Promise<{ today: string[]; yesterday: string[]; headlines: string[] }> {
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const yestStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  const base = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

  const jobs = LEAGUES.flatMap(l => [
    espn(`${base}/${l.code}/scoreboard?dates=${todayStr}`).then(d => ({ when: 'today', name: l.name, d })),
    espn(`${base}/${l.code}/scoreboard?dates=${yestStr}`).then(d => ({ when: 'yesterday', name: l.name, d })),
    espn(`${base}/${l.code}/news?limit=6`).then(d => ({ when: 'news', name: l.name, d })),
  ]);
  const results = await Promise.all(jobs);

  const today: string[] = [], yesterday: string[] = [], headlines: string[] = [];
  for (const r of results) {
    if (r.when === 'today') today.push(...parseMatches(r.d, r.name));
    else if (r.when === 'yesterday') yesterday.push(...parseMatches(r.d, r.name));
    else headlines.push(...(r.d.articles || []).map((a: any) => (a.headline || a.title) as string).filter(Boolean).slice(0, 4));
  }
  return { today: today.slice(0, 40), yesterday: yesterday.slice(0, 40), headlines: headlines.slice(0, 25) };
}

// Broad + trusted + transfer + emotionally-weighted football news (last 48h).
const NEWS_QUERIES = [
  // emotional / trending human-story angles (the priority)
  'footballer death', 'footballer tragedy', 'footballer injury', 'football controversy',
  'footballer comeback', 'football emotional', 'footballer illness', 'footballer retires',
  // the wider footballing world
  'football transfer', 'football news today', 'Premier League', 'Champions League', 'La Liga',
];
// Trusted outlets + a transfer specialist, via Google News site: filters.
const TRUSTED_QUERIES = [
  'football when:2d site:bbc.co.uk', 'football when:2d site:skysports.com',
  'football when:2d site:theguardian.com', 'transfer when:2d site:fabrizioromano.com',
];

async function googleNews(query: string, limit: number): Promise<string[]> {
  try {
    const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    const xml = await res.text();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, limit).map(m => {
      const t = m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').trim();
      return t || '';
    }).filter(Boolean);
  } catch { return []; }
}

export async function fetchFootballNews(): Promise<string[]> {
  const all = await Promise.all([
    ...NEWS_QUERIES.map(q => googleNews(q, 4)),
    ...TRUSTED_QUERIES.map(q => googleNews(q, 4)),
  ]);
  const seen = new Set<string>(); const out: string[] = [];
  for (const batch of all) for (const h of batch) { const k = h.toLowerCase(); if (h.length > 12 && !seen.has(k)) { seen.add(k); out.push(h); } }
  return out.slice(0, 30);
}

export async function fetchTrendingYouTube(key: string): Promise<string[]> {
  if (!key) return [];
  const since = new Date(Date.now() - 2 * 86400000).toISOString();
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent('football')}&type=video&order=viewCount&publishedAfter=${since}&maxResults=8&key=${key}`, { cache: 'no-store' });
    const json = await res.json();
    return (json.items || []).map((v: any) => `[${v.snippet.channelTitle}] ${v.snippet.title}`);
  } catch { return []; }
}

// ─── Trending-players signal layer (free sources: News + Reddit + YouTube) ─────

// Queries tuned to surface WHO is trending and WHY — transfers, but above all the
// emotional/personal/controversial angles that perform best.
const TREND_QUERIES = [
  'footballer trending', 'footballer news today', 'football transfer today', 'footballer signs',
  'footballer controversy', 'footballer scandal', 'footballer injury', 'footballer death',
  'footballer tragedy', 'footballer wife', 'footballer son', 'footballer family', 'footballer statement',
];

// Reddit hot posts (free, no auth) — strong signal for what the football world is talking about now.
async function fetchReddit(sub: string, limit: number): Promise<string[]> {
  try {
    const r = await fetch(`https://www.reddit.com/r/${sub}/hot/.rss?limit=${limit}`, {
      cache: 'no-store',
      headers: { 'User-Agent': 'diez-studio/1.0 (trending-players)' },
      signal: AbortSignal.timeout(6000),
    });
    const xml = await r.text();
    return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, limit).map(m => {
      const t = m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').trim();
      return t || '';
    }).filter(Boolean);
  } catch { return []; }
}

// X/Twitter trending topics (free) via getdaytrends — corroborates who is spiking on
// X right now (a name/club appearing here = genuinely trending, not just in the news).
async function fetchXTrends(geo: string): Promise<string[]> {
  try {
    const r = await fetch(`https://getdaytrends.com/${geo}/`, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' },
      signal: AbortSignal.timeout(6000),
    });
    const html = await r.text();
    return [...html.matchAll(/<a class="string" href="[^"]*">([^<]+)<\/a>/g)]
      .map(m => m[1].trim().replace(/&amp;/g, '&')).filter(Boolean);
  } catch { return []; }
}

// Every free signal the trending-players scan needs, gathered in parallel.
export async function fetchTrendSignals(key: string): Promise<{ news: string[]; reddit: string[]; youtube: string[]; xTrends: string[] }> {
  const [newsBatches, reddit1, reddit2, youtube, xUk, xUs] = await Promise.all([
    // when:2d = only articles from the last 48h, so stale players don't leak into the scan.
    Promise.all(TREND_QUERIES.map(q => googleNews(`${q} when:2d`, 5))),
    fetchReddit('soccer', 25),
    fetchReddit('football', 15),
    fetchTrendingYouTube(key),
    fetchXTrends('united-kingdom'),
    fetchXTrends('united-states'),
  ]);
  const seen = new Set<string>(); const news: string[] = [];
  for (const batch of newsBatches) for (const h of batch) {
    const k = h.toLowerCase();
    if (h.length > 12 && !seen.has(k)) { seen.add(k); news.push(h); }
  }
  const reddit = [...reddit1, ...reddit2].filter((v, i, a) => a.indexOf(v) === i);
  const xTrends = [...xUk, ...xUs].filter((v, i, a) => a.indexOf(v) === i);
  return { news: news.slice(0, 45), reddit: reddit.slice(0, 35), youtube, xTrends: xTrends.slice(0, 60) };
}
