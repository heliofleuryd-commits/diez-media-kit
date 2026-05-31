import { NextRequest, NextResponse } from 'next/server';
import { isBot, parseDevice, pushEvent } from '@/lib/analytics';

// In-memory rate limit: max 10 events per IP per 60s window
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= 10) return true;
  entry.count++;
  return false;
}

// Clean up old entries every 5 minutes to avoid memory bloat
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 300_000);

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get('user-agent') || '';
    if (isBot(ua)) return NextResponse.json({ ok: true });

    const ip =
      req.headers.get('x-vercel-forwarded-for') ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown';

    if (isRateLimited(ip)) return NextResponse.json({ ok: true });

    const body = await req.json();
    const { type, referrer, ctaName, path, visitorId, sessionId, duration } = body;

    if (!['pageview', 'cta_click', 'duration'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    const country =
      req.headers.get('x-vercel-ip-country') ||
      req.headers.get('cf-ipcountry') ||
      'Unknown';

    await pushEvent({
      type,
      timestamp: Date.now(),
      referrer: referrer ? (() => { try { return new URL(referrer).hostname; } catch { return referrer; } })() : '',
      userAgent: ua,
      country,
      device: parseDevice(ua),
      path: path || '/',
      visitorId: visitorId || 'unknown',
      sessionId: sessionId || 'unknown',
      ctaName,
      duration,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
