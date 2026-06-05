import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { NewsPage } from '@/app/components/research/NewsPage';

export const metadata = { title: 'Flash News — diez.gg' };

export default async function NewsRoute() {
  if (!(await isAuthenticated())) {
    redirect('/admin/login?next=/football/news');
  }
  return <NewsPage />;
}
