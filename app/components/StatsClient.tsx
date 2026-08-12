'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import StarBorder from './StarBorder';

gsap.registerPlugin(ScrollTrigger);

// ─── Types ────────────────────────────────────────────────────────────────────

type Niche = 'gaming' | 'football';

interface AccountStat {
  handle: string;
  platform: 'tiktok' | 'youtube' | 'instagram';
  group: Niche;
  niche: string;
  url: string;
  avgViews: string;
  engRate: string;
}

interface CaseStudy {
  brand: string;
  domain: string;
  videoUrl: string | null;
  thumbnail: string | null;
  viewsFmt: string;
  likesFmt?: string;
  engRate: string;
}

// ─── Static data ──────────────────────────────────────────────────────────────

// avgViews = highest average monthly views; engRate = best.
const ACCOUNTS: AccountStat[] = [
  { handle: '@diez.gg',       platform: 'tiktok',    group: 'gaming',   niche: 'Warzone / FPS',      url: 'https://tiktok.com/@diez.gg',        avgViews: '310K', engRate: '9.1%' },
  { handle: '@imDiez',        platform: 'youtube',   group: 'gaming',   niche: 'Warzone / FPS',      url: 'https://youtube.com/@imDiez',        avgViews: '187K', engRate: '6.2%' },
  { handle: '@diez.gg',       platform: 'instagram', group: 'gaming',   niche: 'Gaming / Lifestyle', url: 'https://instagram.com/diez.gg',      avgViews: '112K', engRate: '8.9%' },
  { handle: '@diez.ball',     platform: 'tiktok',    group: 'football', niche: 'Football',           url: 'https://tiktok.com/@diez.ball',      avgViews: '425K', engRate: '14.8%' },
  { handle: '@diezknowsball', platform: 'tiktok',    group: 'football', niche: 'Football',           url: 'https://tiktok.com/@diezknowsball',  avgViews: '485K', engRate: '13.0%' },
  { handle: '@diezball',      platform: 'youtube',   group: 'football', niche: 'Football',           url: 'https://youtube.com/@diezball',      avgViews: '160K', engRate: '5.0%' },
  { handle: '@diezballl',     platform: 'instagram', group: 'football', niche: 'Football',           url: 'https://instagram.com/diezballl',    avgViews: '15K',  engRate: '8.0%' },
];

// Monthly views per niche (gaming = 150M yearly ÷ 12; football = last month).
const NICHE_MONTHLY_VIEWS: Record<Niche, string> = { gaming: '12.5M', football: '32M' };

const NICHE_META: Record<Niche, { emoji: string; label: string; tag: string }> = {
  gaming:   { emoji: '🎮', label: 'Gaming',   tag: 'Warzone · Call of Duty · Lifestyle' },
  football: { emoji: '⚽️', label: 'Football', tag: 'Emotional football storytelling' },
};

function parseNum(s: string): number { const n = parseFloat(s); return s.includes('M') ? n * 1e6 : s.includes('K') ? n * 1e3 : n; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
  if (n >= 1_000)     return `${Math.round(n / 100) / 10}K`;
  return String(n);
}

// ─── ScrollFloat ──────────────────────────────────────────────────────────────

function ScrollFloat({
  children,
  textClassName = '',
  containerClassName = '',
  animationDuration = 1,
  ease = 'back.inOut(2)',
  scrollStart = 'center bottom+=50%',
  scrollEnd = 'bottom bottom-=40%',
  stagger = 0.03,
}: {
  children: string;
  textClassName?: string;
  containerClassName?: string;
  animationDuration?: number;
  ease?: string;
  scrollStart?: string;
  scrollEnd?: string;
  stagger?: number;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const chars = useMemo(
    () => children.split('').map((ch, i) => (
      <span key={i} className="char">{ch === ' ' ? '\u00a0' : ch}</span>
    )),
    [children]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Respect reduced-motion: show text statically, skip the scroll animation.
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(el.querySelectorAll('.char'), { opacity: 1, yPercent: 0, scaleY: 1, scaleX: 1 });
      return;
    }
    const letters = el.querySelectorAll('.char');
    gsap.fromTo(letters,
      { willChange: 'opacity, transform', opacity: 0, yPercent: 120, scaleY: 2.3, scaleX: 0.7, transformOrigin: '50% 0%' },
      {
        duration: animationDuration, ease, opacity: 1, yPercent: 0, scaleY: 1, scaleX: 1, stagger,
        scrollTrigger: { trigger: el, scroller: window, start: scrollStart, end: scrollEnd, scrub: true },
      }
    );
  }, [animationDuration, ease, scrollStart, scrollEnd, stagger]);

  return (
    <h2 ref={ref} className={`scroll-float ${containerClassName}`}>
      <span className={`scroll-float-text ${textClassName}`}>{chars}</span>
    </h2>
  );
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
function TwitchSVG({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  );
}
function FacebookSVG({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function PlatformIcon({ platform, size = 40 }: { platform: string; size?: number }) {
  const r = size * 0.22;
  const is = size * 0.52;
  const cfg: Record<string, { bg: string; icon: React.ReactNode }> = {
    tiktok:    { bg: '#010101',     icon: <TikTokSVG size={is} /> },
    youtube:   { bg: '#FF0000',     icon: <YoutubeSVG size={is} /> },
    instagram: { bg: 'linear-gradient(135deg,#833AB4 0%,#C13584 35%,#E1306C 55%,#FD1D1D 80%,#F77737 100%)', icon: <InstagramSVG size={is} /> },
    twitch:    { bg: '#9146FF',     icon: <TwitchSVG size={is} /> },
    facebook:  { bg: '#1877F2',     icon: <FacebookSVG size={is} /> },
  };
  const { bg, icon } = cfg[platform] || { bg: '#333', icon: null };
  return (
    <div style={{ width: size, height: size, background: bg, borderRadius: r, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icon}
    </div>
  );
}

// ─── CaseStudiesCarousel ──────────────────────────────────────────────────────

function CaseStudiesCarousel({ studies }: { studies: CaseStudy[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const rafRef = useRef(0);
  const resumeTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const tick = () => {
      if (!pausedRef.current && el) {
        el.scrollLeft += 0.6;
        if (el.scrollLeft >= el.scrollWidth - el.clientWidth) el.scrollLeft = 0;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const pause = () => {
    pausedRef.current = true;
    clearTimeout(resumeTimeout.current);
    resumeTimeout.current = setTimeout(() => { pausedRef.current = false; }, 2500);
  };

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    pause();
    scrollRef.current.scrollBy({ left: dir === 'right' ? 260 : -260, behavior: 'smooth' });
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      {/* Fade edges */}
      <div className="absolute inset-y-0 left-0 w-10 z-10 pointer-events-none" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.55) 0%, transparent 100%)' }} />
      <div className="absolute inset-y-0 right-0 w-10 z-10 pointer-events-none" style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.55) 0%, transparent 100%)' }} />

      {/* Nav arrows */}
      <button onClick={() => scroll('left')} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-100 opacity-70" style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
      </button>
      <button onClick={() => scroll('right')} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-100 opacity-70" style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
      </button>

      {/* Cards */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
        onTouchStart={() => { pausedRef.current = true; }}
        onTouchEnd={pause}
      >
        {studies.map(study => (
          <a
            key={study.brand}
            href={study.videoUrl ?? '#'}
            target={study.videoUrl ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="cursor-target flex-shrink-0 w-52 sm:w-60 rounded-2xl overflow-hidden flex flex-col transition-transform hover:scale-[1.02]"
            style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {/* Brand header */}
            <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ background: 'rgba(0,0,0,0.7)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <img
                src={`https://logo.clearbit.com/${study.domain}`}
                alt={study.brand}
                className="w-8 h-8 rounded-lg object-contain bg-white p-1 flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://www.google.com/s2/favicons?domain=${study.domain}&sz=64`; }}
              />
              <span className="font-black italic text-white text-base leading-none text-stroke-sm">{study.brand}</span>
            </div>

            {/* Thumbnail */}
            <div className="relative w-full aspect-[9/16] bg-black/40 overflow-hidden">
              {study.thumbnail ? (
                <img src={study.thumbnail} alt={study.brand} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" opacity="0.3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                  </svg>
                </div>
              )}
              {study.videoUrl && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="px-3 py-2.5 flex gap-4" style={{ background: 'rgba(0,0,0,0.6)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <div className="font-black italic text-white text-base leading-none text-stroke-sm">{study.viewsFmt ?? '—'}</div>
                <div className="text-[9px] text-white/50 uppercase tracking-wider font-semibold mt-0.5">Views</div>
              </div>
              {study.engRate && (
                <div>
                  <div className="font-black italic text-base leading-none text-stroke-sm" style={{ color: '#FF0080' }}>{study.engRate}</div>
                  <div className="text-[9px] text-white/50 uppercase tracking-wider font-semibold mt-0.5">Eng. Rate</div>
                </div>
              )}
              {study.likesFmt && (
                <div>
                  <div className="font-black italic text-white text-base leading-none text-stroke-sm">{study.likesFmt}</div>
                  <div className="text-[9px] text-white/50 uppercase tracking-wider font-semibold mt-0.5">Likes</div>
                </div>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── AccordionSection ─────────────────────────────────────────────────────────

function AccordionSection({
  icon, title, defaultOpen = false, children, bestAvgViews, bestEngRate,
}: {
  icon: React.ReactNode;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  bestAvgViews?: string;
  bestEngRate?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card-surface card-interactive cursor-target rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 sm:px-6 py-4 sm:py-5 text-left transition-colors hover:bg-white/5"
      >
        {icon}
        <span className="flex-1 text-base sm:text-xl font-black text-white text-stroke-sm">{title}</span>

        {/* Desktop: show best metrics in header */}
        {bestAvgViews && (
          <div className="hidden sm:flex items-center gap-6 mr-4">
            <div className="text-right">
              <div className="text-2xl font-black italic leading-none" style={{ color: '#FF0080' }}>{bestAvgViews}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mt-0.5">Avg Views</div>
            </div>
            {bestEngRate && (
              <div className="text-right">
                <div className="text-2xl font-black italic text-white leading-none text-stroke-sm">{bestEngRate}</div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mt-0.5">Eng. Rate</div>
              </div>
            )}
          </div>
        )}

        {/* Mobile: compact best metric */}
        {bestAvgViews && (
          <div className="sm:hidden text-right mr-2">
            <div className="text-base font-black italic leading-none" style={{ color: '#FF0080' }}>{bestAvgViews}</div>
            <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mt-0.5">Avg Views</div>
          </div>
        )}

        <div
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300"
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t px-3 sm:px-6 py-4 sm:py-5" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── AccountRow ───────────────────────────────────────────────────────────────

function AccountRow({ account, followers }: { account: AccountStat; followers: number }) {
  return (
    <a
      href={account.url}
      target="_blank"
      rel="noopener noreferrer"
      className="cursor-target flex items-center gap-3 p-3 sm:p-4 rounded-xl transition-colors group hover:bg-white/5"
      style={{ border: '1px solid rgba(255,255,255,0.1)' }}
    >
      <PlatformIcon platform={account.platform} size={36} />

      <div className="flex-1 min-w-0">
        <div className="font-black italic text-white text-sm sm:text-base text-stroke-sm">{account.handle}</div>
        <div className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mt-0.5">{account.niche}</div>
      </div>

      <div className="flex gap-4 sm:gap-8 flex-shrink-0">
        {/* Followers — hidden on mobile */}
        <div className="hidden sm:block text-center">
          <div className="font-black italic text-xl text-white leading-none text-stroke-sm">{followers > 0 ? fmt(followers) : '—'}</div>
          <div className="text-[10px] text-white/35 uppercase tracking-wider mt-1">Followers</div>
        </div>
        <div className="text-center">
          <div className="font-black italic text-base sm:text-xl leading-none" style={{ color: '#FF0080' }}>{account.avgViews}</div>
          <div className="text-[9px] sm:text-[10px] text-white/35 uppercase tracking-wider mt-1">Avg Views</div>
        </div>
        {/* Eng rate — hidden on mobile */}
        <div className="hidden sm:block text-center">
          <div className="font-black italic text-xl text-white leading-none text-stroke-sm">{account.engRate}</div>
          <div className="text-[10px] text-white/35 uppercase tracking-wider mt-1">Eng. Rate</div>
        </div>
      </div>

      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"
        className="opacity-20 group-hover:opacity-50 transition-opacity flex-shrink-0 hidden sm:block">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
      </svg>
    </a>
  );
}

// ─── HeroSection ──────────────────────────────────────────────────────────────

function HeroSection({ totalFollowers }: { totalFollowers: number }) {
  return (
    <div className="mb-2 sm:mb-5">
      <div className="flex items-stretch gap-4 sm:gap-5 mb-2 sm:mb-4">
        {/* Avatar */}
        <div className="relative flex-shrink-0 self-start">
          <div
            className="cursor-target w-36 h-36 sm:w-48 sm:h-48 rounded-full overflow-hidden"
            style={{ border: '2px solid rgba(255,255,255,0.2)', boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.4)' }}
          >
            <img
              src="https://images.squarespace-cdn.com/content/v1/66e051a492185d22d4dafad3/1729342217416-U6VL0Q9QS0H4O3FDHYUE/imdiez.png"
              alt="Diez"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="absolute bottom-1 right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-400 border-2 border-white animate-pulse-dot" />
        </div>

        {/* Identity */}
        <div className="flex flex-col gap-2 sm:gap-3 flex-1 py-0.5">
          {/* Top row: DIEZ + badge */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-black italic text-4xl sm:text-5xl leading-none tracking-tight text-white text-stroke">DIEZ</h1>
              {/* Twitter-style verified badge */}
              <svg className="w-6 h-6 sm:w-7 sm:h-7 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.58 2.28a2.44 2.44 0 0 1 4.84 0 2.44 2.44 0 0 0 2.98 1.63 2.44 2.44 0 0 1 3.43 3.43 2.44 2.44 0 0 0 1.63 2.98 2.44 2.44 0 0 1 0 4.84 2.44 2.44 0 0 0-1.63 2.98 2.44 2.44 0 0 1-3.43 3.43 2.44 2.44 0 0 0-2.98 1.63 2.44 2.44 0 0 1-4.84 0 2.44 2.44 0 0 0-2.98-1.63 2.44 2.44 0 0 1-3.43-3.43 2.44 2.44 0 0 0-1.63-2.98 2.44 2.44 0 0 1 0-4.84 2.44 2.44 0 0 0 1.63-2.98 2.44 2.44 0 0 1 3.43-3.43 2.44 2.44 0 0 0 2.98-1.63z" fill="#1D9BF0" />
                <path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-white/55 font-semibold text-sm sm:text-base text-stroke-sm">🎮 Gaming · ⚽️ Football</p>
          </div>

          {/* Total Audience — everything, every platform */}
          <div>
            <div className="text-[10px] sm:text-xs font-black uppercase tracking-[0.18em] text-white/60 leading-none mb-1">Total Audience</div>
            <div className="font-black italic text-3xl sm:text-4xl leading-none text-white text-stroke" style={{ letterSpacing: '-0.02em' }}>
              {totalFollowers > 0 ? fmt(totalFollowers) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Bio */}
      <p className="text-white text-sm sm:text-base leading-relaxed font-semibold" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9), 0 2px 16px rgba(0,0,0,0.7)' }}>
        Diez is a top Gaming and Football creator, running one of the most engaging Call of Duty channels worldwide. With{' '}
        <span className="font-black italic">1.4M followers</span> and{' '}
        <span className="font-black italic">150M+ yearly views</span>, he delivers strong audience engagement, now rapidly expanding into Football with{' '}
        <span className="font-black italic">30M+ views</span> in just two months.
      </p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface LiveAccount { platform: string; handle: string; followers: number; }

export default function StatsClient() {
  const [niche, setNiche] = useState<Niche>('gaming');
  const [liveAccounts, setLiveAccounts] = useState<LiveAccount[]>([]);
  const [studies, setStudies] = useState<CaseStudy[]>([]);

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(d => { if (d.accounts) setLiveAccounts(d.accounts); }).catch(() => {});
    fetch('/api/case-studies').then(r => r.json()).then(d => { if (d.studies) setStudies(d.studies); }).catch(() => {});
  }, []);

  const getFollowers = (handle: string, platform: string) =>
    liveAccounts.find(a => a.handle === handle && a.platform === platform)?.followers ?? 0;

  const nicheAccounts   = ACCOUNTS.filter(a => a.group === niche);
  const tiktokAccounts  = nicheAccounts.filter(a => a.platform === 'tiktok');
  const youtubeAccounts = nicheAccounts.filter(a => a.platform === 'youtube');
  const instaAccounts   = nicheAccounts.filter(a => a.platform === 'instagram');

  // Niche totals (Performance section)
  // Avg Views = sum of each platform's best account (TikTok best + YouTube + Instagram).
  const nicheAvgViews  = nicheAccounts.length
    ? fmt((['tiktok', 'youtube', 'instagram'] as const).reduce((sum, p) => {
        const accs = nicheAccounts.filter(a => a.platform === p);
        return sum + (accs.length ? Math.max(...accs.map(a => parseNum(a.avgViews))) : 0);
      }, 0))
    : '—';
  const nicheEng       = nicheAccounts.length ? (nicheAccounts.reduce((s, a) => s + parseFloat(a.engRate), 0) / nicheAccounts.length).toFixed(1) + '%' : '—';

  const bestAvgViews = (accs: AccountStat[]) => accs.length ? fmt(Math.max(...accs.map(a => parseNum(a.avgViews)))) : '';
  const bestEngRate  = (accs: AccountStat[]) => accs.length ? accs.reduce((b, a) => parseFloat(a.engRate) > parseFloat(b) ? a.engRate : b, accs[0].engRate) : '';

  // Grand-total audience bar — every platform, both niches, plus Twitch + Facebook. Descending.
  const STATIC_PLATFORMS: { platform: string; label: string; count: number }[] = [
    { platform: 'facebook', label: 'Facebook', count: 18000 },
    { platform: 'twitch',   label: 'Twitch',   count: 15000 },
  ];
  const platformBar = [
    ...(['tiktok', 'youtube', 'instagram'] as const).map(p => ({
      platform: p as string,
      label: p === 'tiktok' ? 'TikTok' : p === 'youtube' ? 'YouTube' : 'Instagram',
      count: ACCOUNTS.filter(a => a.platform === p).reduce((s, a) => s + getFollowers(a.handle, a.platform), 0),
    })),
    ...STATIC_PLATFORMS,
  ].sort((a, b) => b.count - a.count);

  const grandFollowers = liveAccounts.length ? platformBar.reduce((s, x) => s + x.count, 0) : 0;

  // Niche total followers (Performance banner) — live sum of this niche's accounts,
  // plus Facebook + Twitch on the gaming side.
  const nicheStatic = niche === 'gaming' ? STATIC_PLATFORMS.reduce((s, p) => s + p.count, 0) : 0;
  const nicheFollowers = liveAccounts.length
    ? nicheAccounts.reduce((s, a) => s + getFollowers(a.handle, a.platform), 0) + nicheStatic
    : 0;

  return (
    <div className="min-h-screen px-4 py-3 sm:py-6 max-w-3xl mx-auto">

      <HeroSection totalFollowers={grandFollowers} />

      {/* Platform audience bar — every platform, descending */}
      <div className={`grid gap-2 sm:gap-3 mb-2 sm:mb-4`} style={{ gridTemplateColumns: `repeat(${platformBar.length}, minmax(0, 1fr))` }}>
        {platformBar.map(({ platform, count, label }) => (
          <div key={platform} className="card-surface card-interactive cursor-target flex flex-col items-center gap-1.5 px-1 py-3 sm:px-3 sm:py-3 rounded-2xl">
            <PlatformIcon platform={platform} size={26} />
            <div className="text-center">
              <div className="font-black italic text-sm sm:text-base text-white leading-none text-stroke-sm">
                {count > 0 ? fmt(count) : '—'}
              </div>
              <div className="text-[8px] sm:text-[9px] text-white/50 uppercase tracking-wider font-semibold mt-0.5">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Thunderpick banner */}
      <StarBorder as="a" href="https://bit.ly/ThunderDiez" target="_blank" rel="noopener noreferrer" onClick={() => (window as any).trackCTA?.('thunderpick')} color="orange" speed="4s" className="cursor-target w-full mb-1.5 hover:opacity-90 transition-opacity active:scale-[0.99]">
        <div className="flex items-center justify-between px-5 sm:px-6 py-2.5 rounded-[13px]" style={{ background: 'linear-gradient(90deg, #FF7A00 0%, #FFB800 100%)' }}>
          <div className="flex items-center gap-2.5">
            <span className="text-base">⚡</span>
            <span className="font-black italic text-sm sm:text-base text-black uppercase tracking-widest">Thunderpick Loadouts</span>
          </div>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </div>
      </StarBorder>

      {/* Loadouts CTA */}
      <StarBorder as="a" href="/loadouts" onClick={() => (window as any).trackCTA?.('loadouts')} color="cyan" speed="5s" className="cursor-target w-full mb-1.5 hover:opacity-90 transition-opacity active:scale-[0.99]">
        <div className="flex items-center justify-between px-5 sm:px-6 py-2.5 rounded-[13px]" style={{ background: 'rgba(255,255,255,0.95)' }}>
          <div className="flex items-center gap-2.5">
            <span className="text-base">📝</span>
            <span className="font-black italic text-sm sm:text-base text-black uppercase tracking-widest">All My Loadouts</span>
          </div>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </div>
      </StarBorder>

      {/* Full-width Let's Talk CTA */}
      <StarBorder as="a" href="mailto:diez@gltchgroup.com" onClick={() => (window as any).trackCTA?.('lets-talk')} color="white" speed="7s" className="cursor-target w-full mb-2 sm:mb-4 hover:opacity-90 transition-opacity active:scale-[0.99]">
        <div className="flex items-center justify-between px-5 sm:px-6 py-2.5 rounded-[13px]" style={{ background: 'rgba(255,255,255,0.95)' }}>
          <div className="flex items-center gap-2.5">
            <span className="text-base">📩</span>
            <span className="font-black italic text-sm sm:text-base text-black/40 uppercase tracking-widest">Let&apos;s Talk</span>
            <span className="text-black/25 font-bold">·</span>
            <span className="font-black italic text-sm sm:text-base text-black tracking-tight">diez@gltchgroup.com</span>
          </div>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </div>
      </StarBorder>

      <div className="border-b border-white/10 mb-2 sm:mb-5" />

      <ScrollFloat
        animationDuration={1}
        ease="back.inOut(2)"
        scrollStart="top bottom-=5%"
        scrollEnd="top center+=10%"
        stagger={0.03}
        textClassName="text-2xl sm:text-4xl font-black italic text-white text-stroke"
        containerClassName="mb-3 sm:mb-4"
      >
        Performance
      </ScrollFloat>

      {/* Niche switch — pick which niche the Performance section below reflects */}
      <div className="card-surface flex gap-1.5 p-1 rounded-2xl mb-3 sm:mb-4">
        {(['gaming', 'football'] as Niche[]).map(n => (
          <button
            key={n}
            onClick={() => setNiche(n)}
            className="cursor-target flex-1 py-2 rounded-xl font-black italic text-sm sm:text-base uppercase tracking-wider transition-all duration-200"
            style={niche === n
              ? { background: 'rgba(255,255,255,0.92)', color: '#000' }
              : { background: 'transparent', color: 'rgba(255,255,255,0.6)' }}
          >
            {NICHE_META[n].emoji} {NICHE_META[n].label}
          </button>
        ))}
      </div>

      {/* Total-followers banner — this niche's combined audience */}
      <div className="card-surface cursor-target rounded-2xl px-4 py-3 sm:px-5 sm:py-4 mb-3 sm:mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <span className="text-lg sm:text-xl">{NICHE_META[niche].emoji}</span>
          <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-white/55">
            {NICHE_META[niche].label} · Total Followers
          </span>
        </div>
        <div className="font-black italic text-xl sm:text-3xl text-white leading-none text-stroke-sm">
          {nicheFollowers > 0 ? fmt(nicheFollowers) : '—'}
        </div>
      </div>

      {/* Scorecards — avg monthly views (highest), engagement, total views */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5">
        <div className="card-surface card-interactive cursor-target rounded-2xl p-3 sm:p-5 flex flex-col justify-between">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-white/60 mb-1 sm:mb-2">Avg Views</div>
          <div className="font-black italic text-xl sm:text-3xl text-white leading-none text-stroke">{nicheAvgViews}</div>
          <div className="text-[9px] sm:text-xs text-white/50 font-semibold mt-1 sm:mt-2">Per video, monthly</div>
        </div>
        <div className="card-surface card-interactive cursor-target rounded-2xl p-3 sm:p-5 flex flex-col justify-between">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-white/60 mb-1 sm:mb-2">Eng. Rate</div>
          <div className="font-black italic text-xl sm:text-3xl text-white leading-none text-stroke">{nicheEng}</div>
          <div className="text-[9px] sm:text-xs text-white/50 font-semibold mt-1 sm:mt-2">Likes + comments</div>
        </div>
        <div className="card-surface card-interactive cursor-target rounded-2xl p-3 sm:p-5 flex flex-col justify-between">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-white/60 mb-1 sm:mb-2">Monthly Views</div>
          <div className="font-black italic text-xl sm:text-3xl text-white leading-none text-stroke">{NICHE_MONTHLY_VIEWS[niche]}</div>
          <div className="text-[9px] sm:text-xs text-white/50 font-semibold mt-1 sm:mt-2">{niche === 'football' ? 'Last 30 days' : 'Avg per month'}</div>
        </div>
      </div>

      {/* Platform accordions — only the platforms in this niche */}
      <div className="flex flex-col gap-3">
        {tiktokAccounts.length > 0 && (
          <AccordionSection icon={<PlatformIcon platform="tiktok" size={40} />} title="TikTok" defaultOpen bestAvgViews={bestAvgViews(tiktokAccounts)} bestEngRate={bestEngRate(tiktokAccounts)}>
            <div className="flex flex-col gap-2">
              {tiktokAccounts.map(acc => <AccountRow key={acc.handle + acc.platform} account={acc} followers={getFollowers(acc.handle, acc.platform)} />)}
            </div>
          </AccordionSection>
        )}

        {youtubeAccounts.length > 0 && (
          <AccordionSection icon={<PlatformIcon platform="youtube" size={40} />} title="YouTube" bestAvgViews={bestAvgViews(youtubeAccounts)} bestEngRate={bestEngRate(youtubeAccounts)}>
            <div className="flex flex-col gap-2">
              {youtubeAccounts.map(acc => <AccountRow key={acc.handle + acc.platform} account={acc} followers={getFollowers(acc.handle, acc.platform)} />)}
            </div>
          </AccordionSection>
        )}

        {instaAccounts.length > 0 && (
          <AccordionSection icon={<PlatformIcon platform="instagram" size={40} />} title="Instagram" bestAvgViews={bestAvgViews(instaAccounts)} bestEngRate={bestEngRate(instaAccounts)}>
            <div className="flex flex-col gap-2">
              {instaAccounts.map(acc => <AccountRow key={acc.handle + acc.platform} account={acc} followers={getFollowers(acc.handle, acc.platform)} />)}
            </div>
          </AccordionSection>
        )}
      </div>

      <ScrollFloat
        animationDuration={1}
        ease="back.inOut(2)"
        scrollStart="top bottom-=5%"
        scrollEnd="top center+=10%"
        stagger={0.03}
        textClassName="text-2xl sm:text-4xl font-black italic text-white text-stroke"
        containerClassName="mt-5 mb-3 sm:mb-4"
      >
        Brand Work
      </ScrollFloat>

      {/* Brand Case Studies */}
      <div className="card-surface cursor-target mt-3 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-4 sm:py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </div>
          <span className="text-base sm:text-xl font-black text-white text-stroke-sm">Brand Case Studies</span>
          <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-white/40">{studies.length || 7} Campaigns</span>
        </div>

        <div className="px-3 sm:px-6 py-4 sm:py-5">
          {/* Brand stats */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
            <div className="card-surface card-interactive cursor-target rounded-2xl p-3 sm:p-5 flex flex-col justify-between">
              <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-white/60 mb-1 sm:mb-2">Avg Views / Brand Video</div>
              <div className="font-black italic text-xl sm:text-3xl text-white leading-none text-stroke">257K</div>
              <div className="text-[9px] sm:text-xs text-white/50 font-semibold mt-1 sm:mt-2">Across all campaigns</div>
            </div>
            <div className="card-surface card-interactive cursor-target rounded-2xl p-3 sm:p-5 flex flex-col justify-between">
              <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-white/60 mb-1 sm:mb-2">Avg Eng. Rate / Brand Video</div>
              <div className="font-black italic text-xl sm:text-3xl text-white leading-none text-stroke">5%</div>
              <div className="text-[9px] sm:text-xs text-white/50 font-semibold mt-1 sm:mt-2">Likes + comments / views</div>
            </div>
          </div>

          {/* Carousel or skeleton */}
          {studies.length > 0 ? (
            <CaseStudiesCarousel studies={studies} />
          ) : (
            <div className="flex gap-3 overflow-hidden">
              {[0,1,2,3].map(i => (
                <div key={i} className="flex-shrink-0 w-52 sm:w-60 rounded-2xl h-44 animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-white/10 text-center">
        <p className="text-white/25 text-xs tracking-widest uppercase font-semibold">diez@gltchgroup.com</p>
      </div>
    </div>
  );
}
