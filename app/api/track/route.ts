import { NextRequest, NextResponse } from 'next/server';
import { isBot, parseDevice, pushEvent } from '@/lib/analytics';

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get('user-agent') || '';
    if (isBot(ua)) return NextResponse.json({ ok: true });

    const body = await req.json();
    const { type, referrer, ctaName } = body;

    if (!['pageview', 'cta_click'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    const country =
      req.headers.get('x-vercel-ip-country') ||
      req.headers.get('cf-ipcountry') ||
      'Unknown';

    await pushEvent({
      type,
      timestamp: Date.now(),
      referrer: referrer ? new URL(referrer).hostname : '',
      userAgent: ua,
      country,
      device: parseDevice(ua),
      ctaName,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // always return 200 to client
  }
}
