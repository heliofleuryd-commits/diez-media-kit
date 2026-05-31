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

// ── KV helpers ────────────────────────────────────────────────────────────────

async function getKV() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  const { kv } = await import('@vercel/kv');
  return kv;
}

export interface AnalyticsEvent {
  type: 'pageview' | 'cta_click' | 'duration';
  timestamp: number;
  referrer: string;
  userAgent: string;
  country: string;
  device: string;
  path: string;
  visitorId: string;   // persistent per-browser UUID
  sessionId: string;   // per-tab session UUID
  ctaName?: string;
  duration?: number;   // seconds on page (from duration events)
}

export async function pushEvent(event: AnalyticsEvent) {
  const kv = await getKV();
  if (!kv) return;

  // Track all visitor IDs in a set for reliable unique counting
  if (event.visitorId && event.type === 'pageview') {
    await kv.sadd('analytics:visitors:all', event.visitorId);
    await kv.sadd(`analytics:visitors:path:${event.path}`, event.visitorId);
    // Daily set for new vs returning
    const day = new Date(event.timestamp).toISOString().slice(0, 10);
    await kv.sadd(`analytics:visitors:day:${day}`, event.visitorId);
  }

  await kv.lpush('analytics:events', JSON.stringify(event));
  await kv.ltrim('analytics:events', 0, 9999);
}

export async function getEvents(): Promise<AnalyticsEvent[]> {
  const kv = await getKV();
  if (!kv) return [];
  const raw = await kv.lrange<string>('analytics:events', 0, 9999);
  const now = Date.now();
  const cutoff = now - 90 * 24 * 60 * 60 * 1000;
  return raw
    .map(r => (typeof r === 'string' ? JSON.parse(r) : r) as AnalyticsEvent)
    .filter(e => e.timestamp > cutoff);
}

// True unique visitor counts from KV sets (accurate, not estimated)
export async function getUniqueVisitorCount(path?: string): Promise<number> {
  const kv = await getKV();
  if (!kv) return 0;
  const key = path ? `analytics:visitors:path:${path}` : 'analytics:visitors:all';
  return kv.scard(key);
}
