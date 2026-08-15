'use client';
import { useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Summary {
  uniqueAllTime: number; uniqueHomeAllTime: number; uniqueLoadoutsAllTime: number;
  unique7d: number; unique30d: number;
  homeUnique7d: number; homeUnique30d: number;
  loadoutsUnique7d: number; loadoutsUnique30d: number;
  views7d: number; views30d: number;
  homeViews7d: number; homeViews30d: number;
  loadoutsViews7d: number; loadoutsViews30d: number;
  newVisitors30d: number; returningVisitors30d: number;
  avgDurationAll: number; avgDurationHome: number; avgDurationLoadouts: number;
  ctaClicks7d: number; ctaClicks30d: number;
}
interface AnalyticsData {
  summary: Summary;
  dailyViews: Record<string, number>;
  dailyViewsHome: Record<string, number>;
  dailyViewsLoadouts: Record<string, number>;
  dailyUniques: Record<string, number>;
  dailyUniquesHome: Record<string, number>;
  dailyUniquesLoadouts: Record<string, number>;
  topReferrers: { referrer: string; count: number }[];
  topCountries: { country: string; count: number }[];
  deviceCounts: Record<string, number>;
  ctaCounts: Record<string, number>;
  recentVisitors: { timestamp: number; country: string; device: string; referrer: string; path: string; isNew: boolean }[];
}

type Win = '7d' | '30d';
type PageTab = 'all' | 'home' | 'loadouts';
type Metric = 'views' | 'uniques';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(s: number) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function flag(code: string) {
  if (!code || code === 'Unknown' || code.length !== 2) return '🌍';
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

function BarChart({ data, color = '#7c3aed' }: { data: Record<string, number>; color?: string }) {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="w-full">
      <div className="flex items-end gap-px h-20">
        {entries.map(([date, count], i) => {
          const pct = count / max;
          const isToday = i === entries.length - 1;
          return (
            <div
              key={date}
              className="flex-1 rounded-t-sm group relative cursor-default"
              style={{ height: `${Math.max(pct * 80, count > 0 ? 3 : 1)}px`, background: isToday ? color : `${color}55` }}
            >
              {count > 0 && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {date.slice(5)}: {count}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-gray-300 text-[10px] mt-1.5">
        <span>{entries[0]?.[0]?.slice(5)}</span>
        <span>{entries[Math.floor(entries.length / 2)]?.[0]?.slice(5)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

// ─── Pill ─────────────────────────────────────────────────────────────────────

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
      style={active ? { background: '#7c3aed', color: '#fff' } : { background: '#F4F4F5', color: '#71717A' }}
    >
      {children}
    </button>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, highlight }: { label: string; value: string | number; sub?: string; highlight?: boolean }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
      <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-3">{label}</div>
      <div className={`text-3xl font-black tabular-nums ${highlight ? 'text-violet-600' : 'text-gray-900'}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {sub && <div className="text-gray-300 text-xs mt-1.5">{sub}</div>}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [data, setData]     = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noKV, setNoKV]     = useState(false);
  const [win, setWin]       = useState<Win>('30d');
  const [page, setPage]     = useState<PageTab>('all');
  const [metric, setMetric] = useState<Metric>('uniques');

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then(r => {
        if (r.status === 401) { window.location.href = '/admin/login'; return null; }
        return r.json();
      })
      .then(d => {
        if (!d) return;
        if (d.error) { setNoKV(true); setLoading(false); return; }
        setData(d);
        setLoading(false);
      });
  }, []);

  // Derived numbers based on filters
  const s = data?.summary;
  const unique = s ? (
    win === '7d'
      ? (page === 'all' ? s.unique7d : page === 'home' ? s.homeUnique7d : s.loadoutsUnique7d)
      : (page === 'all' ? s.unique30d : page === 'home' ? s.homeUnique30d : s.loadoutsUnique30d)
  ) : 0;

  const views = s ? (
    win === '7d'
      ? (page === 'all' ? s.views7d : page === 'home' ? s.homeViews7d : s.loadoutsViews7d)
      : (page === 'all' ? s.views30d : page === 'home' ? s.homeViews30d : s.loadoutsViews30d)
  ) : 0;

  const avgDur = s
    ? (page === 'all' ? s.avgDurationAll : page === 'home' ? s.avgDurationHome : s.avgDurationLoadouts)
    : 0;

  const chartData = data
    ? (metric === 'uniques'
        ? (page === 'all' ? data.dailyUniques : page === 'home' ? data.dailyUniquesHome : data.dailyUniquesLoadouts)
        : (page === 'all' ? data.dailyViews   : page === 'home' ? data.dailyViewsHome   : data.dailyViewsLoadouts))
    : {};

  const newPct = s && (s.newVisitors30d + s.returningVisitors30d) > 0
    ? Math.round(s.newVisitors30d / (s.newVisitors30d + s.returningVisitors30d) * 100)
    : 0;

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">Analytics</h1>
          <p className="text-gray-400 text-xs mt-0.5">diez.gg visitor insights</p>
        </div>
        <div className="flex gap-1.5">
          <Pill active={win === '7d'}  onClick={() => setWin('7d')}>7 days</Pill>
          <Pill active={win === '30d'} onClick={() => setWin('30d')}>30 days</Pill>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-4 gap-4">
          {[0,1,2,3].map(i => <div key={i} className="bg-gray-50 border border-gray-200 rounded-2xl h-28 animate-pulse" />)}
        </div>
      )}

      {noKV && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-3">
          <p className="font-bold text-gray-900 text-sm">⚠️ Storage not connected</p>
          <ol className="text-gray-500 text-sm space-y-1 list-decimal list-inside">
            <li>Vercel dashboard → your project → <strong className="text-gray-900">Storage</strong></li>
            <li><strong className="text-gray-900">Connect</strong> your Upstash KV database</li>
            <li>Redeploy — done</li>
          </ol>
        </div>
      )}

      {data && s && (
        <>
          {/* All-time totals */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="All-time unique visitors" value={s.uniqueAllTime} sub="Every device ever" highlight />
            <StatCard label="diez.gg unique visitors" value={s.uniqueHomeAllTime} sub="All-time" />
            <StatCard label="/loadouts unique visitors" value={s.uniqueLoadoutsAllTime} sub="All-time" />
          </div>

          {/* Page filter */}
          <div className="flex gap-2">
            <Pill active={page === 'all'}      onClick={() => setPage('all')}>All Pages</Pill>
            <Pill active={page === 'home'}     onClick={() => setPage('home')}>diez.gg</Pill>
            <Pill active={page === 'loadouts'} onClick={() => setPage('loadouts')}>/loadouts</Pill>
          </div>

          {/* Windowed stats */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard label={`Unique visitors (${win})`} value={unique} highlight />
            <StatCard label={`Page views (${win})`} value={views} />
            <StatCard label="Avg time on page" value={avgDur > 0 ? fmtDuration(avgDur) : '—'} sub="last 30 days" />
            <StatCard label={`CTA clicks (${win})`} value={win === '7d' ? s.ctaClicks7d : s.ctaClicks30d} />
          </div>

          {/* New vs Returning */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">New vs Returning (30d)</h2>
              <span className="text-gray-400 text-xs">{s.newVisitors30d + s.returningVisitors30d} total unique visitors</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">🆕 New</span>
                  <span className="text-gray-900 font-bold">{s.newVisitors30d.toLocaleString()} ({newPct}%)</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${newPct}%`, background: 'linear-gradient(90deg,#7c3aed,#4f46e5)' }} />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">🔁 Returning</span>
                  <span className="text-gray-900 font-bold">{s.returningVisitors30d.toLocaleString()} ({100 - newPct}%)</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${100 - newPct}%`, background: '#E4E4E7', border: '1px solid #7c3aed' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                {page === 'all' ? 'All pages' : page === 'home' ? 'diez.gg' : '/loadouts'} — last 30 days
              </h2>
              <div className="flex gap-1.5">
                <Pill active={metric === 'uniques'} onClick={() => setMetric('uniques')}>Unique</Pill>
                <Pill active={metric === 'views'}   onClick={() => setMetric('views')}>Views</Pill>
              </div>
            </div>
            <BarChart data={chartData} color="#7c3aed" />
          </div>

          {/* Referrers + Countries */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Top Referrers (30d)</h2>
              <div className="space-y-3">
                {data.topReferrers.length === 0
                  ? <p className="text-gray-300 text-sm">No data yet</p>
                  : data.topReferrers.map(({ referrer, count }) => (
                    <div key={referrer}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600 truncate">{referrer}</span>
                        <span className="text-gray-900 font-mono ml-2">{count}</span>
                      </div>
                      <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[#7c3aed] rounded-full" style={{ width: `${(count / data.topReferrers[0].count) * 100}%` }} />
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Top Countries (30d)</h2>
              <div className="space-y-3">
                {data.topCountries.length === 0
                  ? <p className="text-gray-300 text-sm">No data yet</p>
                  : data.topCountries.map(({ country, count }) => (
                    <div key={country}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-600">{flag(country)} {country}</span>
                        <span className="text-gray-900 font-mono">{count}</span>
                      </div>
                      <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[#7c3aed] rounded-full" style={{ width: `${(count / data.topCountries[0].count) * 100}%` }} />
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>

          {/* Devices + CTA */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Devices (30d)</h2>
              <div className="space-y-3">
                {Object.entries(data.deviceCounts).length === 0
                  ? <p className="text-gray-300 text-sm">No data yet</p>
                  : (() => {
                    const total = Object.values(data.deviceCounts).reduce((a, b) => a + b, 0);
                    const icons: Record<string, string> = { mobile: '📱', tablet: '📟', desktop: '🖥️' };
                    return Object.entries(data.deviceCounts).sort((a,b)=>b[1]-a[1]).map(([device, count]) => (
                      <div key={device}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600">{icons[device] ?? '💻'} {device}</span>
                          <span className="text-gray-900">{Math.round(count/total*100)}% <span className="text-gray-400">({count})</span></span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${count/total*100}%`, background: 'linear-gradient(90deg,#7c3aed,#4f46e5)' }} />
                        </div>
                      </div>
                    ));
                  })()
                }
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">CTA Clicks (30d)</h2>
              <p className="text-[10px] text-gray-400 mb-4">Total clicks — not unique</p>
              <div className="space-y-3">
                {Object.entries(data.ctaCounts).length === 0
                  ? <p className="text-gray-300 text-sm">No clicks yet</p>
                  : (() => {
                    const max = Math.max(...Object.values(data.ctaCounts));
                    const labels: Record<string, string> = { 'thunderpick': '⚡ Thunderpick Loadouts', 'lets-talk': '📩 Let\'s Talk', 'loadouts': '📝 All My Loadouts' };
                    return Object.entries(data.ctaCounts).sort((a,b)=>b[1]-a[1]).map(([name, count]) => (
                      <div key={name}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600">{labels[name] ?? name}</span>
                          <span className="text-gray-900 font-mono">{count}</span>
                        </div>
                        <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-[#7c3aed] rounded-full" style={{ width: `${(count/max)*100}%` }} />
                        </div>
                      </div>
                    ));
                  })()
                }
              </div>
            </div>
          </div>

          {/* Recent visitors */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Recent Visitors</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-300 uppercase tracking-wider border-b border-gray-200">
                    <th className="text-left pb-2 pr-4">Time</th>
                    <th className="text-left pb-2 pr-3">Type</th>
                    <th className="text-left pb-2 pr-3">Page</th>
                    <th className="text-left pb-2 pr-3">Country</th>
                    <th className="text-left pb-2 pr-3">Device</th>
                    <th className="text-left pb-2">Referrer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/40">
                  {data.recentVisitors.length === 0
                    ? <tr><td colSpan={6} className="py-4 text-gray-300">No visitors yet</td></tr>
                    : data.recentVisitors.map((v, i) => (
                      <tr key={i} className="text-gray-500">
                        <td className="py-2 pr-4 whitespace-nowrap text-gray-400">
                          {new Date(v.timestamp).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                        </td>
                        <td className="py-2 pr-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${v.isNew ? 'bg-[#7c3aed]/20 text-[#4f46e5]' : 'bg-gray-200 text-gray-500'}`}>
                            {v.isNew ? 'NEW' : 'RET'}
                          </span>
                        </td>
                        <td className="py-2 pr-3"><span className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-600">{v.path || '/'}</span></td>
                        <td className="py-2 pr-3">{flag(v.country)} {v.country}</td>
                        <td className="py-2 pr-3 capitalize">{v.device}</td>
                        <td className="py-2 truncate max-w-[140px] text-gray-400">{v.referrer || 'Direct'}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
