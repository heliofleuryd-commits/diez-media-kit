import StatsClient from './components/StatsClient';

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

export default function MediaKitPage() {
  return (
    <main className="min-h-screen bg-[#09090B] text-white">

      {/* ── Hero ── */}
      <section className="relative border-b border-[#27272A] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00E5FF]/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">

          <div className="inline-flex items-center gap-2 bg-[#18181B] border border-[#27272A] rounded-full px-4 py-1.5 text-sm text-[#A1A1AA] mb-8">
            <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
            Media Kit · 2025
          </div>

          <h1 className="text-7xl font-black tracking-tighter mb-4">
            <span className="text-[#00E5FF] stat-glow">DIEZ</span>
          </h1>
          <p className="text-[#A1A1AA] text-xl max-w-lg mx-auto mb-4">
            Content creator · Warzone &amp; Football · TikTok · YouTube · Instagram
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-[#52525B] mb-16">
            <span>🎵 @diez.gg · @diez.ball</span>
            <span className="text-[#27272A]">|</span>
            <span>▶ @imDiez</span>
            <span className="text-[#27272A]">|</span>
            <span>📸 @diez.gg · @diezball10</span>
          </div>

          <StatsClient />
        </div>
      </section>

      {/* ── Accounts ── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-8 text-[#FAFAFA]">Accounts</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { platform: 'tiktok', handle: '@diez.gg', niche: 'Warzone / FPS', followers: '142K', url: 'https://tiktok.com/@diez.gg' },
            { platform: 'tiktok', handle: '@diez.ball', niche: 'Football', followers: '68K', url: 'https://tiktok.com/@diez.ball' },
            { platform: 'youtube', handle: '@imDiez', niche: 'Warzone / FPS', followers: '31K', url: 'https://youtube.com/@imDiez' },
            { platform: 'instagram', handle: '@diez.gg', niche: 'Gaming / Lifestyle', followers: '28K', url: 'https://instagram.com/diez.gg' },
            { platform: 'instagram', handle: '@diezball10', niche: 'Football', followers: '15K', url: 'https://instagram.com/diezball10' },
          ].map((account) => (
            <a
              key={account.handle + account.platform}
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
              <div className="text-2xl font-black text-[#00E5FF] stat-glow">{account.followers}</div>
              <div className="text-xs text-[#71717A] mt-1">followers</div>
            </a>
          ))}
        </div>
      </section>

      {/* ── Contact CTA ── */}
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
        </div>
      </section>

    </main>
  );
}