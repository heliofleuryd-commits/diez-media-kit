'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  {
    label: 'Analytics',
    href: '/admin',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path d="M3 12l4-4 4 4 4-6 4 6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 20h18" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: 'Brand Outreach',
    href: '/admin/outreach',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  return (
    <aside className="fixed top-0 left-0 h-screen w-56 bg-[#111113] border-r border-[#27272A] flex flex-col z-10">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-[#27272A]">
        <span className="text-xl font-black text-[#00E5FF]">DIEZ</span>
        <span className="text-[#52525B] text-xs block mt-0.5">Admin Panel</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ label, href, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#00E5FF]/10 text-[#00E5FF]'
                  : 'text-[#71717A] hover:text-white hover:bg-[#27272A]/60'
              }`}
            >
              {icon}
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-[#27272A]">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-[#71717A] hover:text-white hover:bg-[#27272A]/60 transition-colors"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
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
