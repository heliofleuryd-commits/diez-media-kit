import { NextRequest, NextResponse } from 'next/server';
import { triggerRun } from '@/lib/apify';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runs = await Promise.all([
    triggerRun('clockworks~tiktok-profile-scraper', {
      profiles: [
        'https://www.tiktok.com/@diez.gg',
        'https://www.tiktok.com/@diez.ball',
      ],
    }),
    triggerRun('streamers~youtube-scraper', {
      startUrls: [{ url: 'https://www.youtube.com/@imDiez' }],
      maxResults: 20,
    }),
    triggerRun('apify~instagram-scraper', {
      directUrls: [
        'https://www.instagram.com/diez.gg/',
        'https://www.instagram.com/diezball10/',
      ],
      resultsType: 'posts',
      resultsLimit: 20,
    }),
  ]);

  return NextResponse.json({ success: true, runs });
}
