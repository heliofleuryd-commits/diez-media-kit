import { AppSidebar } from '@/app/components/AppSidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', background: '#f9fafb' }}>
      <AppSidebar />
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }} className="p-8">
        {children}
      </main>
    </div>
  );
}
