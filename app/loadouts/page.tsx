'use client';

import { useState } from 'react';
import Link from 'next/link';

// ─── Data ─────────────────────────────────────────────────────────────────────

interface Attachment {
  slot: string;
  name: string;
}

interface Gun {
  id: string;
  weapon: string;
  type: string;
  game: string;
  rank: string;
  rankNum: number;
  image: string;
  attachments: Attachment[];
  code?: string;
  updatedAt: string;
}

const LONG_RANGE: Gun[] = [
  {
    id: 'mxr17',
    weapon: 'MXR-17',
    type: 'Assault Rifle',
    game: 'BO7',
    rank: 'Long Range',
    rankNum: 1,
    image: 'https://img.wzstats.gg/mxr-17/public',
    attachments: [
      { slot: 'Muzzle', name: 'Monolithic Suppressor' },
      { slot: 'Barrel', name: '17" Greaves Scourge Barrel' },
      { slot: 'Optic',  name: 'FANG HoverPoint ELO' },
      { slot: 'Stock',  name: 'Winch Stock' },
    ],
    updatedAt: 'Aug 12, 2026',
  },
  {
    id: 'fg42',
    weapon: 'FG42',
    type: 'Assault Rifle',
    game: 'BO7',
    rank: 'Long Range',
    rankNum: 2,
    image: 'https://img.wzstats.gg/fg42/public',
    attachments: [
      { slot: 'Muzzle',      name: 'Monolithic Suppressor' },
      { slot: 'Barrel',      name: '16" Bandolier Barrel' },
      { slot: 'Optic',       name: 'FANG HoverPoint ELO' },
      { slot: 'Underbarrel', name: 'RIF Handguard' },
    ],
    updatedAt: 'Aug 12, 2026',
  },
  {
    id: 'an94',
    weapon: 'AN-94',
    type: 'Assault Rifle',
    game: 'BO7',
    rank: 'Long Range',
    rankNum: 3,
    image: 'https://img.wzstats.gg/an-94/public',
    attachments: [
      { slot: 'Muzzle',      name: 'Monolithic Suppressor' },
      { slot: 'Barrel',      name: '15" Benthic Barrel' },
      { slot: 'Optic',       name: 'FANG HoverPoint ELO' },
      { slot: 'Underbarrel', name: 'VAS Convergence Foregrip' },
    ],
    updatedAt: 'Aug 12, 2026',
  },
];

const SHORT_RANGE: Gun[] = [
  {
    id: 'cbrs3',
    weapon: 'CBRS-3',
    type: 'SMG',
    game: 'BO7',
    rank: 'Close Range',
    rankNum: 1,
    image: 'https://img.wzstats.gg/cbrs-3/public',
    attachments: [
      { slot: 'Muzzle',   name: 'LTI Stentorian Brake' },
      { slot: 'Barrel',   name: '11" Gaunt Barrel' },
      { slot: 'Optic',    name: 'FANG HoverPoint ELO' },
      { slot: 'Stock',    name: 'Casino Light Stock' },
      { slot: 'Magazine', name: 'MFS Carrousel Fast Mag' },
    ],
    updatedAt: 'Aug 12, 2026',
  },
  {
    id: 'vst',
    weapon: 'VST',
    type: 'SMG',
    game: 'BO7',
    rank: 'Close Range',
    rankNum: 2,
    image: 'https://img.wzstats.gg/vst/public',
    attachments: [
      { slot: 'Muzzle',      name: 'LTI Stentorian Brake' },
      { slot: 'Barrel',      name: '9.7" Enmity Barrel' },
      { slot: 'Stock',       name: 'Hawker Cub-55 Pad' },
      { slot: 'Underbarrel', name: 'EAM Steady-90 Grip' },
    ],
    updatedAt: 'Aug 12, 2026',
  },
  {
    id: 'rev46',
    weapon: 'REV-46',
    type: 'SMG',
    game: 'BO7',
    rank: 'Close Range',
    rankNum: 3,
    image: 'https://img.wzstats.gg/rev-46/public',
    attachments: [
      { slot: 'Muzzle',      name: 'LTI Stentorian Brake' },
      { slot: 'Barrel',      name: '14.9" Caudal Target Barrel' },
      { slot: 'Optic',       name: 'FANG HoverPoint ELO' },
      { slot: 'Underbarrel', name: 'Sapper Guard Handstop' },
    ],
    updatedAt: 'Aug 12, 2026',
  },
];

const RANK_BG: Record<number, string> = {
  1: '#E8A000',
  2: '#6B7280',
  3: '#92400E',
};

// ─── Gun card ─────────────────────────────────────────────────────────────────

function GunCard({ gun }: { gun: Gun }) {
  const [open, setOpen] = useState(false);

  const left  = gun.attachments.filter((_, i) => i % 2 === 0);
  const right = gun.attachments.filter((_, i) => i % 2 === 1);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.12)' }}
    >
      {/* Collapsed header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="cursor-target w-full flex items-center gap-3 px-4 sm:px-5 py-3 text-left hover:bg-white/5 transition-colors"
      >
        {/* Gun image — left, white bg knocked out via multiply */}
        <div className="flex-shrink-0 w-24 sm:w-32 h-14 sm:h-16 flex items-center justify-center overflow-hidden rounded-xl"
          style={{ background: 'rgba(255,255,255,0.06)' }}>
          <img
            src={gun.image}
            alt={gun.weapon}
            className="w-full h-full object-contain"
            style={{ mixBlendMode: 'screen', filter: 'brightness(1.1) contrast(1.05)' }}
          />
        </div>

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <div className="font-black italic text-lg sm:text-xl text-white leading-none text-stroke-sm mb-1.5">
            {gun.weapon}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider text-white"
              style={{ background: RANK_BG[gun.rankNum] ?? '#6B7280' }}
            >
              #{gun.rankNum} {gun.rank}
            </span>
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">{gun.type}</span>
          </div>
        </div>

        {/* Chevron */}
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded */}
      {open && (
        <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          {/* Attachments */}
          <div className="px-4 sm:px-5 pt-4 pb-5">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3">
              {gun.attachments.length} Attachments
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex flex-col gap-2">
                {left.map(att => (
                  <div
                    key={att.slot}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35 w-20 flex-shrink-0">{att.slot}</span>
                    <span className="font-black italic text-xs sm:text-sm text-white leading-tight" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{att.name}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {right.map(att => (
                  <div
                    key={att.slot}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35 w-20 flex-shrink-0">{att.slot}</span>
                    <span className="font-black italic text-xs sm:text-sm text-white leading-tight" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{att.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Code + updated */}
            <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {gun.code ? (
                <button
                  onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(gun.code!); }}
                  className="cursor-target flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Code</span>
                  <span className="font-black italic text-xs text-white">{gun.code}</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" opacity="0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                </button>
              ) : <div />}
              <span className="text-[10px] text-white/30 font-semibold italic">Updated {gun.updatedAt}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ label, emoji, guns }: { label: string; emoji: string; guns: Gun[] }) {
  return (
    <div className="mb-6 sm:mb-8">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-xl">{emoji}</span>
        <h2
          className="font-black italic text-xl sm:text-2xl text-white uppercase tracking-tight"
          style={{ textShadow: '0 1px 8px rgba(0,0,0,0.9), 0 2px 20px rgba(0,0,0,0.6)' }}
        >
          {label}
        </h2>
      </div>
      <div className="flex flex-col gap-2.5">
        {guns.map(g => <GunCard key={g.id} gun={g} />)}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoadoutsPage() {
  return (
    <div className="min-h-screen px-4 py-5 sm:py-7 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-4 mb-6 sm:mb-8">
        <div className="relative flex-shrink-0">
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden"
            style={{ border: '2px solid rgba(255,255,255,0.25)', boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.5)' }}
          >
            <img
              src="https://images.squarespace-cdn.com/content/v1/66e051a492185d22d4dafad3/1729342217416-U6VL0Q9QS0H4O3FDHYUE/imdiez.png"
              alt="Diez"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-emerald-400 border-2 border-white animate-pulse-dot" />
        </div>
        <div>
          <div
            className="text-[10px] font-black uppercase tracking-[0.25em] mb-1"
            style={{ color: 'rgba(255,255,255,0.75)', textShadow: '0 1px 6px rgba(0,0,0,0.95), 0 2px 12px rgba(0,0,0,0.8)' }}
          >
            Updated: Aug 12, 2026
          </div>
          <h1
            className="font-black italic text-2xl sm:text-4xl text-white leading-none mb-1"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 4px 24px rgba(0,0,0,0.6)' }}
          >
            DIEZ&apos;S LOADOUTS
          </h1>
          <p
            className="text-xs sm:text-sm font-semibold"
            style={{ color: 'rgba(255,255,255,0.75)', textShadow: '0 1px 6px rgba(0,0,0,0.95), 0 2px 12px rgba(0,0,0,0.8)' }}
          >
            Current meta — updated after every major patch.
          </p>
        </div>
      </div>

      <Section label="Short Range" emoji="⚡" guns={SHORT_RANGE} />
      <Section label="Long Range" emoji="🎯" guns={LONG_RANGE} />

      {/* Back to media kit */}
      <Link
        href="/"
        className="cursor-target w-full flex items-center justify-between px-5 py-3 rounded-xl mt-2 hover:opacity-90 transition-opacity"
        style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.15)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
            <img src="https://images.squarespace-cdn.com/content/v1/66e051a492185d22d4dafad3/1729342217416-U6VL0Q9QS0H4O3FDHYUE/imdiez.png" alt="Diez" className="w-full h-full object-cover" />
          </div>
          <span className="font-black italic text-sm text-white" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>diez.gg — Media Kit</span>
        </div>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" opacity="0.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </Link>

      {/* Footer CTA */}
      <a
        href="mailto:diez@gltchgroup.com"
        className="cursor-target w-full flex items-center justify-between px-5 py-3 rounded-2xl mt-2 hover:opacity-90 transition-opacity"
        style={{
          background: 'rgba(255,255,255,0.97)',
          boxShadow: '0 4px 32px rgba(255,255,255,0.25), 0 2px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,1)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <span>📩</span>
          <span className="font-black italic text-sm text-black/40 uppercase tracking-widest">Let&apos;s Talk</span>
          <span className="text-black/25">·</span>
          <span className="font-black italic text-sm text-black">diez@gltchgroup.com</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
        </svg>
      </a>

    </div>
  );
}
