'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  {
    section: 'Admin',
    items: [
      {
        label: 'Analytics', href: '/admin',
        icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path d="M3 12l4-4 4 4 4-6 4 6" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 20h18" strokeLinecap="round"/></svg>,
      },
      {
        label: 'Brand Outreach', href: '/admin/outreach',
        icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      },
    ],
  },
  {
    section: 'Football',
    items: [
      { label: 'Tactics Board',   href: '/football/tactics',  icon: <span className="text-[12px]">⚽</span> },
      { label: 'Content Studio',  href: '/football/research', icon: <span className="text-[12px]">🎬</span> },
      { label: 'Skill Library',   href: '/football/skills',   icon: <span className="text-[12px]">📂</span> },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router  = useRouter();
  const isDark  = pathname.startsWith('/admin');

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const s = isDark ? {
    aside:   'bg-[#111113] border-[#27272A]',
    logo:    'text-[#00E5FF]',
    sub:     'text-[#52525B]',
    border:  'border-[#27272A]',
    section: 'text-[#3F3F46]',
    active:  'bg-[#00E5FF]/10 text-[#00E5FF]',
    inactive:'text-[#71717A] hover:text-white hover:bg-[#27272A]/60',
    foot:    'text-[#52525B] hover:text-white hover:bg-[#27272A]/60',
  } : {
    aside:   'bg-white border-gray-200',
    logo:    'text-gray-900',
    sub:     'text-gray-400',
    border:  'border-gray-100',
    section: 'text-gray-400',
    active:  'bg-violet-50 text-violet-700 font-bold',
    inactive:'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
    foot:    'text-gray-400 hover:text-gray-700 hover:bg-gray-100',
  };

  return (
    <aside className={`flex flex-col h-full border-r ${s.aside}`} style={{ width: 220, flexShrink: 0 }}>
      {/* Logo */}
      <div className={`px-5 py-5 border-b ${s.border} shrink-0`}>
        <span className={`text-base font-black tracking-tight ${s.logo}`}>diez.gg</span>
        <span className={`text-[9px] block mt-0.5 tracking-widest uppercase ${s.sub}`}>Studio</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <p className={`text-[8px] font-black uppercase tracking-widest px-3 mb-1.5 ${s.section}`}>{section}</p>
            <div className="space-y-0.5">
              {items.map(({ label, href, icon }) => (
                <Link key={href} href={href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all ${isActive(href) ? s.active : s.inactive}`}>
                  {icon}
                  {label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Sign out */}
      <div className={`px-3 py-4 border-t ${s.border} shrink-0`}>
        <button onClick={logout}
          className={`flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-[11px] font-semibold transition-all ${s.foot}`}>
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round"/>
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}
