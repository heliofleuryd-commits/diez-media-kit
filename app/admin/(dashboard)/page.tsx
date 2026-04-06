'use client';
import { useEffect, useState } from 'react';

interface Summary {
  views7d: number; views30d: number;
  unique7d: number; unique30d: number;
  ctaClicks7d: number; ctaClicks30d: number;
}
interface AnalyticsData {
  summary: Summary;
  dailyViews: Record<string, number>;
  topReferrers: { referrer: string; count: number }[];
  topCountries: { country: string; count: number }[];
  deviceCounts: Record<string, number>;
  ctaCounts: Record<string, number>;
  recentVisitors: { timestamp: number; country: string; device: string; referrer: string }[];
}

function BarChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="flex items-end gap-1 h-24 w-full">
      {entries.map(([date, count]) => (
        <div key={date} className="flex-1 flex flex-col items-center gap-1 group">
          <div
            className="w-full bg-[#00E5FF]/20 group-hover:bg-[#00E5FF]/40 transition-colors rounded-sm"
            style={{ height: `${Math.max((count / max) * 96, 2)}px` }}
            title={`${date}: ${count} views`}
          />
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5">
      <div className="text-[#71717A] text-xs uppercase tracking-wider mb-2">{label}</div>
      <div className="text-3xl font-black text-[#00E5FF]">{value.toLocaleString()}</div>
      <div className="text-[#52525B] text-xs mt-1">{sub}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noKV, setNoKV] = useState(false);

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
  }, [router]);

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  return (
    <div className="space-y-8">
        <h1 className="text-2xl font-bold">Analytics</h1>

        {loading && (
          <div className="text-[#71717A] text-sm">Loading…</div>
        )}

        {noKV && !loading && (
          <div className="bg-yellow-950/40 border border-yellow-700/40 rounded-xl p-6 text-yellow-300 text-sm space-y-2">
            <p className="font-semibold">Vercel KV not connected</p>
            <p className="text-yellow-400/80">
              To enable analytics, go to your Vercel dashboard → Storage → Create KV Database → connect it to this project.
              Then redeploy and data will start flowing.
            </p>
          </div>
        )}

        {data && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="Page views (7d)" value={data.summary.views7d} sub={`${data.summary.views30d.toLocaleString()} last 30 days`} />
              <StatCard label="Unique visitors (7d)" value={data.summary.unique7d} sub={`${data.summary.unique30d.toLocaleString()} last 30 days`} />
              <StatCard label="CTA clicks (7d)" value={data.summary.ctaClicks7d} sub={`${data.summary.ctaClicks30d.toLocaleString()} last 30 days`} />
            </div>

            {/* Chart */}
            <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
              <h2 className="text-sm font-semibold text-[#A1A1AA] mb-4">Page views — last 30 days</h2>
              <BarChart data={data.dailyViews} />
              <div className="flex justify-between text-[#52525B] text-xs mt-2">
                <span>{Object.keys(data.dailyViews)[0]}</span>
                <span>Today</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Top referrers */}
              <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
                <h2 className="text-sm font-semibold text-[#A1A1AA] mb-4">Top referrers (30d)</h2>
                <div className="space-y-2">
                  {data.topReferrers.length === 0 && (
                    <p className="text-[#52525B] text-sm">No data yet</p>
                  )}
                  {data.topReferrers.map(({ referrer, count }) => (
                    <div key={referrer} className="flex items-center justify-between text-sm">
                      <span className="text-[#A1A1AA] truncate">{referrer}</span>
                      <span className="text-[#00E5FF] font-mono ml-4">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top countries */}
              <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
                <h2 className="text-sm font-semibold text-[#A1A1AA] mb-4">Top countries (30d)</h2>
                <div className="space-y-2">
                  {data.topCountries.length === 0 && (
                    <p className="text-[#52525B] text-sm">No data yet</p>
                  )}
                  {data.topCountries.map(({ country, count }) => (
                    <div key={country} className="flex items-center justify-between text-sm">
                      <span className="text-[#A1A1AA]">{country}</span>
                      <span className="text-[#00E5FF] font-mono">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Devices */}
              <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
                <h2 className="text-sm font-semibold text-[#A1A1AA] mb-4">Devices (30d)</h2>
                <div className="space-y-2">
                  {Object.entries(data.deviceCounts).length === 0 && (
                    <p className="text-[#52525B] text-sm">No data yet</p>
                  )}
                  {Object.entries(data.deviceCounts).map(([device, count]) => (
                    <div key={device} className="flex items-center justify-between text-sm">
                      <span className="text-[#A1A1AA] capitalize">{device}</span>
                      <span className="text-[#00E5FF] font-mono">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA clicks */}
              <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
                <h2 className="text-sm font-semibold text-[#A1A1AA] mb-4">CTA clicks (30d)</h2>
                <div className="space-y-2">
                  {Object.entries(data.ctaCounts).length === 0 && (
                    <p className="text-[#52525B] text-sm">No clicks tracked yet</p>
                  )}
                  {Object.entries(data.ctaCounts).map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between text-sm">
                      <span className="text-[#A1A1AA]">{name}</span>
                      <span className="text-[#00E5FF] font-mono">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent visitors */}
            <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
              <h2 className="text-sm font-semibold text-[#A1A1AA] mb-4">Recent visitors</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#52525B] text-xs uppercase border-b border-[#27272A]">
                      <th className="text-left pb-2">Time</th>
                      <th className="text-left pb-2">Country</th>
                      <th className="text-left pb-2">Device</th>
                      <th className="text-left pb-2">Referrer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272A]/50">
                    {data.recentVisitors.length === 0 && (
                      <tr><td colSpan={4} className="py-4 text-[#52525B]">No visitors yet</td></tr>
                    )}
                    {data.recentVisitors.map((v, i) => (
                      <tr key={i} className="text-[#A1A1AA]">
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {new Date(v.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2 pr-4">{v.country}</td>
                        <td className="py-2 pr-4 capitalize">{v.device}</td>
                        <td className="py-2 truncate max-w-xs">{v.referrer || 'Direct'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
    </div>
  );
}
