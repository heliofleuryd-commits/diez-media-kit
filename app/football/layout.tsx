import { FootballNav } from '@/app/components/football/FootballNav';

export const metadata = { title: 'Football — diez.gg', robots: 'noindex,nofollow' };

export default function FootballLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#f9fafb', zIndex: 10, display: 'flex', overflow: 'hidden' }}>
      <FootballNav />
      <div style={{ flex: 1, overflow: 'hidden', background: '#f9fafb' }}>
        {children}
      </div>
    </div>
  );
}
