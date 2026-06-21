import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { ShortsAnalysis } from '@/app/components/football/ShortsAnalysis';

export const metadata = { title: 'Shorts Title Lab — diez.gg' };

export default async function ShortsTitlesPage() {
  if (!(await isAuthenticated())) redirect('/admin/login?next=/football/shorts-titles');
  return <ShortsAnalysis />;
}
