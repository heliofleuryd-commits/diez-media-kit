import { AppSidebar } from '@/app/components/AppSidebar';

export const metadata = { title: 'Football — diez.gg', robots: 'noindex,nofollow' };

export default function FootballLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', background: '#f9fafb' }}>
      <AppSidebar />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
