'use client';

import { useState, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = '3m' | '6m' | '12m';

interface AccountStat {
  handle: string;
  platform: 'tiktok' | 'youtube' | 'instagram';
  niche: string;
  url: string;
  avgViews: Record<Period, string>;
  engRate: Record<Period, string>;
}

// ─── Static per-period data (followers come live from Apify) ──────────────────

const ACCOUNTS: AccountStat[] = [
  {
    handle: '@diez.gg',
    platform: 'tiktok',
    niche: 'Warzone / FPS',
    url: 'https://tiktok.com/@diez.gg',
    avgViews: { '3m': '310K', '6m': '285K', '12m': '248K' },
    engRate:  { '3m': '9.1%', '6m': '8.7%', '12m': '8.2%' },
  },
  {
    handle: '@diez.ball',
    platform: 'tiktok',
    niche: 'Football',
    url: 'https://tiktok.com/@diez.ball',
    avgViews: { '3m': '212K', '6m': '198K', '12m': '185K' },
    engRate:  { '3m': '7.8%', '6m': '7.4%', '12m': '7.1%' },
  },
  {
    handle: '@imDiez',
    platform: 'youtube',
    niche: 'Warzone / FPS',
    url: 'https://youtube.com/@imDiez',
    avgViews: { '3m': '224K', '6m': '210K', '12m': '195K' },
    engRate:  { '3m': '6.2%', '6m': '5.8%', '12m': '5.5%' },
  },
  {
    handle: '@diez.gg',
    platform: 'instagram',
    niche: 'Gaming / Lifestyle',
    url: 'https://instagram.com/diez.gg',
    avgViews: { '3m': '238K', '6m': '218K', '12m': '196K' },
    engRate:  { '3m': '8.9%', '6m': '8.4%', '12m': '8.0%' },
  },
  {
    handle: '@diezball10',
    platform: 'instagram',
    niche: 'Football',
    url: 'https://instagram.com/diezball10',
    avgViews: { '3m': '204K', '6m': '194K', '12m': '183K' },
    engRate:  { '3m': '10.2%', '6m': '9.7%', '12m': '9.2%' },
  },
];

const SUMMARY: Record<Period, { avgViews: string; engRate: string; totalViews: string }> = {
  '3m':  { avgViews: '238K', engRate: '8.4%', totalViews: '18.5M' },
  '6m':  { avgViews: '221K', engRate: '7.9%', totalViews: '47M'   },
  '12m': { avgViews: '201K', engRate: '7.6%', totalViews: '118M'  },
};

const PERIOD_LABELS: Record<Period, string> = {
  '3m': '3 Months', '6m': '6 Months', '12m': '12 Months',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
  if (n >= 1_000)     return `${Math.round(n / 100) / 10}K`;
  return String(n);
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function TikTokSVG({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.17 8.17 0 004.79 1.52V6.76a4.85 4.85 0 01-1.02-.07z" />
    </svg>
  );
}

function YoutubeSVG({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d="M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.51 3.55 12 3.55 12 3.55s-7.51 0-9.38.5A3.02 3.02 0 00.5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 002.12 2.14C4.49 20.45 12 20.45 12 20.45s7.51 0 9.38-.5a3.02 3.02 0 002.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" />
    </svg>
  );
}

function InstagramSVG({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function PlatformIcon({ platform, size = 40 }: { platform: string; size?: number }) {
  const r = size * 0.22;
  const is = size * 0.52;
  const styles: Record<string, { bg: string; icon: React.ReactNode }> = {
    tiktok:    { bg: '#010101', icon: <TikTokSVG size={is} /> },
    youtube:   { bg: '#FF0000', icon: <YoutubeSVG size={is} /> },
    instagram: { bg: 'linear-gradient(135deg,#833AB4 0%,#C13584 35%,#E1306C 55%,#FD1D1D 80%,#F77737 100%)', icon: <InstagramSVG size={is} /> },
  };
  const cfg = styles[platform] || { bg: '#333', icon: null };
  return (
    <div style={{ width: size, height: size, background: cfg.bg, borderRadius: r, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {cfg.icon}
    </div>
  );
}

// ─── Scorecard ────────────────────────────────────────────────────────────────

function Scorecard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 flex flex-col justify-between" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
      <div className="text-[10px] font-black uppercase tracking-[0.25em] text-black/40 mb-2">{label}</div>
      <div className="font-black italic text-3xl text-black leading-none">{value}</div>
      {sub && <div className="text-xs text-black/40 font-semibold mt-2">{sub}</div>}
    </div>
  );
}

// ─── Accordion ────────────────────────────────────────────────────────────────

function AccordionSection({
  icon, title, defaultOpen = false, children,
}: {
  icon: React.ReactNode; title: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-black/[0.02] transition-colors"
      >
        {icon}
        <span className="flex-1 text-xl font-black text-black">{title}</span>
        <div
          className="w-9 h-9 rounded-xl border border-black/10 flex items-center justify-center flex-shrink-0 transition-transform duration-300"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="border-t border-black/[0.06] px-6 py-5">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Account row inside accordion ────────────────────────────────────────────

function AccountRow({
  account, followers, period,
}: {
  account: AccountStat; followers: number; period: Period;
}) {
  return (
    <a
      href={account.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl hover:bg-black/[0.03] transition-colors group"
      style={{ border: '1px solid rgba(0,0,0,0.06)' }}
    >
      <PlatformIcon platform={account.platform} size={40} />

      <div className="flex-1 min-w-0">
        <div className="font-black italic text-black text-base">{account.handle}</div>
        <div className="text-xs text-black/40 font-semibold uppercase tracking-wider mt-0.5">{account.niche}</div>
      </div>

      {/* 3 metrics */}
      <div className="flex gap-6 sm:gap-8 flex-shrink-0">
        <div className="text-center">
          <div className="font-black italic text-xl text-black leading-none">
            {followers > 0 ? fmt(followers) : '—'}
          </div>
          <div className="text-[10px] text-black/35 uppercase tracking-wider mt-1">Followers</div>
        </div>
        <div className="text-center">
          <div className="font-black italic text-xl leading-none" style={{ color: '#FF0080' }}>
            {account.avgViews[period]}
          </div>
          <div className="text-[10px] text-black/35 uppercase tracking-wider mt-1">Avg Views</div>
        </div>
        <div className="text-center">
          <div className="font-black italic text-xl text-black leading-none">
            {account.engRate[period]}
          </div>
          <div className="text-[10px] text-black/35 uppercase tracking-wider mt-1">Eng. Rate</div>
        </div>
      </div>

      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        className="text-black/15 group-hover:text-black/40 transition-colors flex-shrink-0 hidden sm:block">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
      </svg>
    </a>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface LiveAccount { platform: string; handle: string; followers: number; }

export default function StatsClient() {
  const [period, setPeriod] = useState<Period>('3m');
  const [liveAccounts, setLiveAccounts] = useState<LiveAccount[]>([]);
  const [totalFollowers, setTotalFollowers] = useState(0);

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => {
        if (d.accounts) {
          setLiveAccounts(d.accounts);
          setTotalFollowers(d.totalFollowers || d.accounts.reduce((s: number, a: LiveAccount) => s + a.followers, 0));
        }
      })
      .catch(() => {});
  }, []);

  const getFollowers = (handle: string, platform: string) => {
    const match = liveAccounts.find(a => a.handle === handle && a.platform === platform);
    return match?.followers ?? 0;
  };

  const tiktokAccounts = ACCOUNTS.filter(a => a.platform === 'tiktok');
  const youtubeAccounts = ACCOUNTS.filter(a => a.platform === 'youtube');
  const instagramAccounts = ACCOUNTS.filter(a => a.platform === 'instagram');

  const summary = SUMMARY[period];

  return (
    <div>
      {/* ── Hero profile on cyan ── */}
      <div className="max-w-3xl mx-auto px-4 pt-10 pb-6">
        <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center mb-8">

          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center font-black italic text-3xl bg-black text-[#00E5FF]"
            >
              D
            </div>
            <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-black border-2 border-[#00E5FF] animate-pulse-dot" />
          </div>

          {/* Identity */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="font-black italic text-4xl text-black leading-none" style={{ letterSpacing: '-0.02em' }}>
                DIEZ
              </h1>
              <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
            </div>
            <p className="text-black/60 font-semibold text-sm mb-4">Content Creator · Warzone &amp; Football</p>

            {/* Platform handles row */}
            <div className="flex flex-wrap gap-4">
              {[
                { platform: 'tiktok',    label: '@diez.gg · @diez.ball'   },
                { platform: 'youtube',   label: '@imDiez'                  },
                { platform: 'instagram', label: '@diez.gg · @diezball10'   },
              ].map(p => (
                <div key={p.platform} className="flex items-center gap-2">
                  <PlatformIcon platform={p.platform} size={24} />
                  <span className="text-xs font-bold text-black/70">{p.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            <a
              href="mailto:hello@diez.gg"
              onClick={() => (window as any).trackCTA?.('lets-talk')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-black italic text-sm uppercase tracking-wider bg-black text-[#00E5FF] hover:opacity-80 transition-opacity"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
              Let's Talk
            </a>
            <span className="text-xs text-black/40 font-medium">hello@diez.gg</span>
          </div>
        </div>
      </div>

      {/* ── White content area ── */}
      <div className="bg-white min-h-screen">
        <div className="max-w-3xl mx-auto px-4 py-10">

          {/* ── Platform audience bar ── */}
          <div className="flex flex-wrap gap-6 mb-10 pb-10 border-b border-black/[0.07]">
            {[
              { platform: 'tiktok',    label: 'TikTok',    count: (liveAccounts.filter(a => a.platform === 'tiktok').reduce((s, a) => s + a.followers, 0)), sub: 'Followers' },
              { platform: 'youtube',   label: 'YouTube',   count: (liveAccounts.find(a => a.platform === 'youtube')?.followers ?? 0), sub: 'Subscribers' },
              { platform: 'instagram', label: 'Instagram', count: (liveAccounts.filter(a => a.platform === 'instagram').reduce((s, a) => s + a.followers, 0)), sub: 'Followers' },
            ].map(({ platform, count, sub }) => (
              <div key={platform} className="flex items-center gap-3">
                <PlatformIcon platform={platform} size={44} />
                <div>
                  <div className="font-black italic text-2xl text-black leading-none">
                    {count > 0 ? fmt(count) : '—'}
                  </div>
                  <div className="text-[10px] text-black/35 uppercase tracking-wider mt-0.5">{sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Period filter */}
          <div className="flex items-center gap-2 mb-10">
            {(['3m', '6m', '12m'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-5 py-2 rounded-full font-black italic text-sm uppercase tracking-wider transition-all duration-200"
                style={
                  period === p
                    ? { background: '#00E5FF', color: '#000' }
                    : { background: 'transparent', border: '1.5px solid rgba(0,0,0,0.15)', color: 'rgba(0,0,0,0.45)' }
                }
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* TOTAL AUDIENCE hero stat */}
          <div className="mb-3">
            <div className="text-[11px] font-black uppercase tracking-[0.3em] text-black/30 mb-1">Total Audience</div>
            <div
              className="font-black italic leading-none text-black"
              style={{ fontSize: 'clamp(64px, 14vw, 120px)', letterSpacing: '-0.02em' }}
            >
              {totalFollowers > 0 ? fmt(totalFollowers) : '—'}
            </div>
            <div className="text-sm text-black/35 font-semibold mt-1">Across all platforms</div>
          </div>

          {/* Thin cyan rule */}
          <div className="h-[2px] w-20 mb-8 rounded-full" style={{ background: '#00E5FF' }} />

          {/* Scorecards */}
          <div className="grid grid-cols-3 gap-3 mb-12">
            <div className="bg-white rounded-2xl p-5 flex flex-col justify-between" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-black/40 mb-2">Avg Views / Video</div>
              <div className="font-black italic text-3xl text-black leading-none">{summary.avgViews}</div>
              <div className="flex items-center gap-1 mt-2">
                <span className="text-xs font-black" style={{ color: '#22c55e' }}>↑</span>
                <span className="text-xs text-black/40 font-semibold">{PERIOD_LABELS[period]}</span>
              </div>
            </div>
            <Scorecard label="Engagement Rate" value={summary.engRate} sub="Likes + comments" />
            <Scorecard label="Total Est. Views" value={summary.totalViews} sub={PERIOD_LABELS[period]} />
          </div>

          {/* Platform accordions */}
          <div className="flex flex-col gap-3">

            {/* TikTok */}
            <AccordionSection
              icon={<PlatformIcon platform="tiktok" size={40} />}
              title="TikTok"
              defaultOpen
            >
              <div className="flex flex-col gap-2">
                {tiktokAccounts.map(acc => (
                  <AccountRow
                    key={acc.handle}
                    account={acc}
                    followers={getFollowers(acc.handle, acc.platform)}
                    period={period}
                  />
                ))}
              </div>
            </AccordionSection>

            {/* YouTube */}
            <AccordionSection
              icon={<PlatformIcon platform="youtube" size={40} />}
              title="YouTube"
            >
              <div className="flex flex-col gap-2">
                {youtubeAccounts.map(acc => (
                  <AccountRow
                    key={acc.handle}
                    account={acc}
                    followers={getFollowers(acc.handle, acc.platform)}
                    period={period}
                  />
                ))}
              </div>
            </AccordionSection>

            {/* Instagram */}
            <AccordionSection
              icon={<PlatformIcon platform="instagram" size={40} />}
              title="Instagram"
            >
              <div className="flex flex-col gap-2">
                {instagramAccounts.map(acc => (
                  <AccountRow
                    key={acc.handle}
                    account={acc}
                    followers={getFollowers(acc.handle, acc.platform)}
                    period={period}
                  />
                ))}
              </div>
            </AccordionSection>

            {/* Brand Case Studies */}
            <AccordionSection
              icon={
                <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                </div>
              }
              title="Brand Case Studies"
            >
              <div className="text-center py-8">
                <p className="font-bold text-black/30 text-sm">Brand campaigns will appear here.</p>
                <p className="text-xs text-black/20 mt-1">Get in touch — heliofleuryd@gmail.com</p>
              </div>
            </AccordionSection>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-black/[0.06] text-center">
            <p className="text-black/25 text-xs tracking-widest uppercase font-semibold">heliofleuryd@gmail.com</p>
          </div>

        </div>
      </div>
    </div>
  );
}
