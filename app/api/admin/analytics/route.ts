import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getEvents, getUniqueVisitorCount, AnalyticsEvent } from '@/lib/analytics';

export const revalidate = 86400; // cache for 24 hours

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const events = await getEvents();
  const now = Date.now();

  const inWindow = (e: AnalyticsEvent, days: number) =>
    e.timestamp > now - days * 24 * 60 * 60 * 1000;

  const pageviews = events.filter(e => e.type === 'pageview');
  const clicks    = events.filter(e => e.type === 'cta_click');
  const durations = events.filter(e => e.type === 'duration' && e.duration);

  // ── Unique visitors (accurate, from KV sets) ──────────────────────────────
  const [
    uniqueAll,
    uniqueHome,
    uniqueLoadouts,
  ] = await Promise.all([
    getUniqueVisitorCount(),
    getUniqueVisitorCount('/'),
    getUniqueVisitorCount('/loadouts'),
  ]);

  // ── Unique visitors in time window (from events, visitorId-based) ─────────
  const uniqueInWindow = (days: number, path?: string) => {
    const seen = new Set<string>();
    pageviews
      .filter(e => inWindow(e, days) && (path === undefined || e.path === path))
      .forEach(e => seen.add(e.visitorId));
    return seen.size;
  };

  // ── New vs returning (seen before the current 30d window) ─────────────────
  const thirtyDayVisitors  = new Set(pageviews.filter(e => inWindow(e, 30)).map(e => e.visitorId));
  const olderVisitors      = new Set(pageviews.filter(e => !inWindow(e, 30)).map(e => e.visitorId));
  const returningVisitors  = [...thirtyDayVisitors].filter(id => olderVisitors.has(id)).length;
  const newVisitors        = thirtyDayVisitors.size - returningVisitors;

  // ── Avg session duration ───────────────────────────────────────────────────
  const avgDuration = (path?: string) => {
    const relevant = durations.filter(e => inWindow(e, 30) && (path === undefined || e.path === path));
    if (relevant.length === 0) return 0;
    return Math.round(relevant.reduce((s, e) => s + (e.duration ?? 0), 0) / relevant.length);
  };

  // ── Total views ────────────────────────────────────────────────────────────
  const totalViews = (days: number, path?: string) =>
    pageviews.filter(e => inWindow(e, days) && (path === undefined || e.path === path)).length;

  // ── Daily views last 30 days ───────────────────────────────────────────────
  const buildDailyViews = (path?: string) => {
    const map: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      map[new Date(now - i * 86400000).toISOString().slice(0, 10)] = 0;
    }
    pageviews
      .filter(e => inWindow(e, 30) && (path === undefined || e.path === path))
      .forEach(e => {
        const day = new Date(e.timestamp).toISOString().slice(0, 10);
        if (day in map) map[day]++;
      });
    return map;
  };

  // ── Daily unique visitors last 30 days ────────────────────────────────────
  const buildDailyUniques = (path?: string) => {
    const map: Record<string, Set<string>> = {};
    for (let i = 29; i >= 0; i--) {
      map[new Date(now - i * 86400000).toISOString().slice(0, 10)] = new Set();
    }
    pageviews
      .filter(e => inWindow(e, 30) && (path === undefined || e.path === path))
      .forEach(e => {
        const day = new Date(e.timestamp).toISOString().slice(0, 10);
        if (day in map) map[day].add(e.visitorId);
      });
    return Object.fromEntries(Object.entries(map).map(([d, s]) => [d, s.size]));
  };

  // ── Top referrers ──────────────────────────────────────────────────────────
  const referrerCounts: Record<string, number> = {};
  pageviews.filter(e => inWindow(e, 30)).forEach(e => {
    const ref = e.referrer || 'Direct';
    referrerCounts[ref] = (referrerCounts[ref] || 0) + 1;
  });
  const topReferrers = Object.entries(referrerCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([referrer, count]) => ({ referrer, count }));

  // ── Top countries ──────────────────────────────────────────────────────────
  const countryCounts: Record<string, number> = {};
  pageviews.filter(e => inWindow(e, 30)).forEach(e => {
    const c = e.country || 'Unknown';
    countryCounts[c] = (countryCounts[c] || 0) + 1;
  });
  const topCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([country, count]) => ({ country, count }));

  // ── Devices ────────────────────────────────────────────────────────────────
  const deviceCounts: Record<string, number> = {};
  pageviews.filter(e => inWindow(e, 30)).forEach(e => {
    deviceCounts[e.device] = (deviceCounts[e.device] || 0) + 1;
  });

  // ── CTA clicks ─────────────────────────────────────────────────────────────
  const ctaCounts: Record<string, number> = {};
  clicks.filter(e => inWindow(e, 30)).forEach(e => {
    const name = e.ctaName || 'unknown';
    ctaCounts[name] = (ctaCounts[name] || 0) + 1;
  });

  // ── Recent visitors ────────────────────────────────────────────────────────
  const recentVisitors = pageviews.slice(0, 50).map(e => ({
    timestamp: e.timestamp,
    country:   e.country || 'Unknown',
    device:    e.device,
    referrer:  e.referrer || 'Direct',
    path:      e.path || '/',
    isNew:     !olderVisitors.has(e.visitorId),
  }));

  return NextResponse.json({
    summary: {
      // All-time unique (from KV sets — most accurate)
      uniqueAllTime:         uniqueAll,
      uniqueHomeAllTime:     uniqueHome,
      uniqueLoadoutsAllTime: uniqueLoadouts,
      // Windowed
      unique7d:  uniqueInWindow(7),
      unique30d: uniqueInWindow(30),
      homeUnique7d:     uniqueInWindow(7,  '/'),
      homeUnique30d:    uniqueInWindow(30, '/'),
      loadoutsUnique7d: uniqueInWindow(7,  '/loadouts'),
      loadoutsUnique30d:uniqueInWindow(30, '/loadouts'),
      // Views
      views7d:  totalViews(7),
      views30d: totalViews(30),
      homeViews7d:      totalViews(7,  '/'),
      homeViews30d:     totalViews(30, '/'),
      loadoutsViews7d:  totalViews(7,  '/loadouts'),
      loadoutsViews30d: totalViews(30, '/loadouts'),
      // New vs returning
      newVisitors30d:       newVisitors,
      returningVisitors30d: returningVisitors,
      // Avg session duration (seconds)
      avgDurationAll:      avgDuration(),
      avgDurationHome:     avgDuration('/'),
      avgDurationLoadouts: avgDuration('/loadouts'),
      // CTA
      ctaClicks7d:  clicks.filter(e => inWindow(e, 7)).length,
      ctaClicks30d: clicks.filter(e => inWindow(e, 30)).length,
    },
    dailyViews:          buildDailyViews(),
    dailyViewsHome:      buildDailyViews('/'),
    dailyViewsLoadouts:  buildDailyViews('/loadouts'),
    dailyUniques:        buildDailyUniques(),
    dailyUniquesHome:    buildDailyUniques('/'),
    dailyUniquesLoadouts:buildDailyUniques('/loadouts'),
    topReferrers,
    topCountries,
    deviceCounts,
    ctaCounts,
    recentVisitors,
  });
}
