import type { MediaKitData } from '@/lib/types';

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: '#FF0050',
  youtube: '#FF0000',
  instagram: '#E1306C',
};

const PLATFORM_ICONS: Record<string, string> = {
  tiktok: '🎵',
  youtube: '▶',
  instagram: '📸',
};

async function getStats(): Promise<MediaKitData | null> {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${base}/api/stats`, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function MediaKitPage() {
  const data = await getStats();

  return (
    <main className="min-h-screen bg-[#09090B] text-white">
      {/* Hero */}
      <section className="relative border-b border-[#27272A] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00E5FF]/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-[#18181B] border border-[#27272A] rounded-full px-4 py-1.5 text-sm text-[#A1A1AA] mb-8">
            <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
            Stats updated daily
          </div>
          <h1 className="text-6xl font-black tracking-tight mb-4">
            <span className="text-[#00E5FF] stat-glow">DIEZ</span>
          </h1>
          <p className="text-[#A1A1AA] text-xl max-w-lg mx-auto mb-12">
            Content creator · Warzone &amp; Football · TikTok · YouTube · Instagram
          </p>

          {data ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
              {[
                { label: 'Total Followers', value: fmt(data.totalFollowers) },
                { label: 'Total Views', value: fmt(data.totalViews) },
                { label: 'Accounts', value: data.accounts.length.toString() },
                { label: 'Top Video Views', value: data.topVideos[0] ? fmt(data.topVideos[0].views) : '—' },
              ].map((s) => (
                <div key={s.label} className="bg-[#18181B] border border-[#27272A] rounded-2xl p-5">
                  <div className="text-3xl font-black text-[#00E5FF] stat-glow">{s.value}</div>
                  <div className="text-[#71717A] text-sm mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[#52525B]">Stats loading — run the cron job to populate data.</div>
          )}
        </div>
      </section>

      {/* Accounts */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-8 text-[#FAFAFA]">Accounts</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.accounts.map((account) => (
            <a
              key={account.handle}
              href={account.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-[#18181B] border border-[#27272A] rounded-2xl p-6 hover:border-[#00E5FF]/40 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{PLATFORM_ICONS[account.platform]}</span>
                  <div>
                    <div className="font-semibold text-white group-hover:text-[#00E5FF] transition-colors">
                      {account.handle}
                    </div>
                    <div className="text-xs text-[#71717A] capitalize">{account.platform}</div>
                  </div>
                </div>
                <span
                  className="text-xs px-2 py-1 rounded-full"
                  style={{
                    background: PLATFORM_COLORS[account.platform] + '20',
                    color: PLATFORM_COLORS[account.platform],
                  }}
                >
                  {account.niche}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div>
                  <div className="text-xl font-bold text-white">{fmt(account.followers)}</div>
                  <div className="text-xs text-[#71717A]">Followers</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-white">{fmt(account.totalViews)}</div>
                  <div className="text-xs text-[#71717A]">Total Views</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-white">{account.videoCount}</div>
                  <div className="text-xs text-[#71717A]">Videos</div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Top Videos */}
      {data?.topVideos && data.topVideos.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-16">
          <h2 className="text-2xl font-bold mb-8 text-[#FAFAFA]">Top Videos</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.topVideos.slice(0, 8).map((video) => (
              <a
                key={video.id}
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-[#18181B] border border-[#27272A] rounded-2xl overflow-hidden hover:border-[#00E5FF]/40 transition-all"
              >
                {video.thumbnail && (
                  <div className="aspect-video bg-[#27272A] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-xs">{PLATFORM_ICONS[video.platform]}</span>
                    <span className="text-xs text-[#71717A]">@{video.account}</span>
                  </div>
                  <p className="text-sm text-[#D4D4D8] line-clamp-2 mb-3">{video.title}</p>
                  <div className="flex gap-3 text-xs text-[#71717A]">
                    <span>👁 {fmt(video.views)}</span>
                    <span>❤️ {fmt(video.likes)}</span>
                    <span>💬 {fmt(video.comments)}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Contact CTA */}
      <section className="border-t border-[#27272A]">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">Work with Diez</h2>
          <p className="text-[#A1A1AA] mb-8 max-w-md mx-auto">
            Brand deals, sponsored content, and collaborations across gaming and football niches.
          </p>
          <a
            href="mailto:heliofleuryd@gmail.com"
            className="inline-flex items-center gap-2 bg-[#00E5FF] text-black font-bold px-8 py-3 rounded-full hover:bg-[#00C8E0] transition-colors"
          >
            Get in Touch →
          </a>
          {data?.lastUpdated && (
            <p className="text-[#3F3F46] text-xs mt-8">
              Stats last updated: {new Date(data.lastUpdated).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
