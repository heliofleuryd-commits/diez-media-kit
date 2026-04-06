import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getEvents, AnalyticsEvent } from '@/lib/analytics';

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const events = await getEvents();
  const now = Date.now();

  const inWindow = (e: AnalyticsEvent, days: number) =>
    e.timestamp > now - days * 24 * 60 * 60 * 1000;

  const pageviews = events.filter(e => e.type === 'pageview');
  const clicks = events.filter(e => e.type === 'cta_click');

  // Unique visitors = unique (day + userAgent) combos — simple approximation
  const uniqueVisitors = (days: number) => {
    const seen = new Set<string>();
    pageviews.filter(e => inWindow(e, days)).forEach(e => {
      const day = new Date(e.timestamp).toDateString();
      seen.add(`${day}:${e.userAgent}`);
    });
    return seen.size;
  };

  // Views per day for last 30 days
  const dailyViews: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    dailyViews[d.toISOString().slice(0, 10)] = 0;
  }
  pageviews.filter(e => inWindow(e, 30)).forEach(e => {
    const day = new Date(e.timestamp).toISOString().slice(0, 10);
    if (day in dailyViews) dailyViews[day]++;
  });

  // Top referrers
  const referrerCounts: Record<string, number> = {};
  pageviews.filter(e => inWindow(e, 30)).forEach(e => {
    const ref = e.referrer || 'Direct';
    referrerCounts[ref] = (referrerCounts[ref] || 0) + 1;
  });
  const topReferrers = Object.entries(referrerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([referrer, count]) => ({ referrer, count }));

  // Device breakdown
  const deviceCounts: Record<string, number> = {};
  pageviews.filter(e => inWindow(e, 30)).forEach(e => {
    deviceCounts[e.device] = (deviceCounts[e.device] || 0) + 1;
  });

  // CTA breakdown
  const ctaCounts: Record<string, number> = {};
  clicks.filter(e => inWindow(e, 30)).forEach(e => {
    const name = e.ctaName || 'unknown';
    ctaCounts[name] = (ctaCounts[name] || 0) + 1;
  });

  // Country breakdown
  const countryCounts: Record<string, number> = {};
  pageviews.filter(e => inWindow(e, 30)).forEach(e => {
    const c = e.country || 'Unknown';
    countryCounts[c] = (countryCounts[c] || 0) + 1;
  });
  const topCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([country, count]) => ({ country, count }));

  // Recent visitors
  const recentVisitors = pageviews.slice(0, 20).map(e => ({
    timestamp: e.timestamp,
    country: e.country || 'Unknown',
    device: e.device,
    referrer: e.referrer || 'Direct',
  }));

  return NextResponse.json({
    summary: {
      views7d: pageviews.filter(e => inWindow(e, 7)).length,
      views30d: pageviews.filter(e => inWindow(e, 30)).length,
      unique7d: uniqueVisitors(7),
      unique30d: uniqueVisitors(30),
      ctaClicks7d: clicks.filter(e => inWindow(e, 7)).length,
      ctaClicks30d: clicks.filter(e => inWindow(e, 30)).length,
    },
    dailyViews,
    topReferrers,
    topCountries,
    deviceCounts,
    ctaCounts,
    recentVisitors,
  });
}
