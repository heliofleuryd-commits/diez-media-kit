import type { Metadata } from 'next';
import Sidebar from './components/Sidebar';

export const metadata: Metadata = {
  title: 'Admin · Diez',
  robots: 'noindex,nofollow',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#09090B] text-white flex">
      <Sidebar />
      <main className="flex-1 ml-56 p-8">
        {children}
      </main>
    </div>
  );
}
