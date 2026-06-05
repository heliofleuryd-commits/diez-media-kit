'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/football/tactics',  label: 'Tactics Board',  icon: '⚽' },
  { href: '/football/research', label: 'Content Studio', icon: '🎬' },
];

export function FootballNav() {
  const path = usePathname();
  return (
    <nav className="flex flex-col h-full bg-white border-r border-gray-200" style={{ width: 52 }}>
      <div className="flex items-center justify-center h-12 border-b border-gray-100 shrink-0">
        <span className="text-[11px] font-black tracking-widest text-gray-400 uppercase">dz</span>
      </div>
      <div className="flex flex-col items-center gap-1 pt-2 flex-1">
        {NAV.map(({ href, label, icon }) => {
          const active = path.startsWith(href);
          return (
            <Link key={href} href={href} title={label}
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-[16px] transition-all
                ${active ? 'bg-violet-100 ring-1 ring-violet-400/40' : 'hover:bg-gray-100'}`}>
              {icon}
            </Link>
          );
        })}
      </div>
      <div className="flex flex-col items-center pb-3 gap-1 shrink-0 border-t border-gray-100 pt-2">
        <Link href="/admin" title="Analytics"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-[14px] hover:bg-gray-100 transition-all">
          📊
        </Link>
      </div>
    </nav>
  );
}
