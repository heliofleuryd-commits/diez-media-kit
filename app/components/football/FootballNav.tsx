'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/football/tactics',  label: 'Tactics Board', icon: '⚽' },
  { href: '/football/research', label: 'Research',      icon: '🔬' },
];

export function FootballNav() {
  const path = usePathname();

  return (
    <nav className="flex flex-col h-full bg-[#0d0f14] border-r border-white/[0.06]" style={{ width: 52 }}>
      {/* Brand */}
      <div className="flex items-center justify-center h-12 border-b border-white/[0.06] shrink-0">
        <span className="text-[11px] font-black tracking-widest text-white/40 uppercase">dz</span>
      </div>

      {/* Football routes */}
      <div className="flex flex-col items-center gap-1 pt-2 flex-1">
        {NAV.map(({ href, label, icon }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-[16px] transition-all
                ${active
                  ? 'bg-violet-600/20 ring-1 ring-violet-500/40'
                  : 'hover:bg-white/[0.06]'
                }`}
            >
              {icon}
            </Link>
          );
        })}
      </div>

      {/* Admin link at bottom */}
      <div className="flex flex-col items-center pb-3 gap-1 shrink-0 border-t border-white/[0.06] pt-2">
        <Link
          href="/admin"
          title="Analytics"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-[14px] hover:bg-white/[0.06] transition-all"
        >
          📊
        </Link>
      </div>
    </nav>
  );
}
