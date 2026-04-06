// Bot detection — common scrapers, crawlers, headless browsers
const BOT_PATTERNS = [
  /bot|crawl|spider|slurp|bingbot|googlebot|duckduckbot|baiduspider|yandex/i,
  /python-requests|curl|wget|axios|node-fetch|got\//i,
  /headlesschrome|phantomjs|selenium|puppeteer/i,
  /facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegram/i,
  /vercel|netlify|aws|uptimerobot|pingdom|statuspage/i,
];

export function isBot(userAgent: string): boolean {
  if (!userAgent || userAgent.length < 10) return true;
  return BOT_PATTERNS.some(p => p.test(userAgent));
}

export function parseDevice(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  if (/mobile|android|iphone/i.test(ua)) return 'mobile';
  return 'desktop';
}

// ── KV helpers (graceful no-op if KV not configured) ──────────────────────────

async function getKV() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  const { kv } = await import('@vercel/kv');
  return kv;
}

export interface AnalyticsEvent {
  type: 'pageview' | 'cta_click';
  timestamp: number;
  referrer: string;
  userAgent: string;
  country: string;
  device: string;
  ctaName?: string;
}

export async function pushEvent(event: AnalyticsEvent) {
  const kv = await getKV();
  if (!kv) return;
  // Keep last 5000 events, 90-day TTL handled at read time
  await kv.lpush('analytics:events', JSON.stringify(event));
  await kv.ltrim('analytics:events', 0, 4999);
}

export async function getEvents(): Promise<AnalyticsEvent[]> {
  const kv = await getKV();
  if (!kv) return [];
  const raw = await kv.lrange<string>('analytics:events', 0, 4999);
  const now = Date.now();
  const cutoff = now - 90 * 24 * 60 * 60 * 1000;
  return raw
    .map(r => (typeof r === 'string' ? JSON.parse(r) : r) as AnalyticsEvent)
    .filter(e => e.timestamp > cutoff);
}
