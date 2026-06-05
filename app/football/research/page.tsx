import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { ResearchPage } from '@/app/components/research/ResearchPage';

export const metadata = { title: 'Research — diez.gg' };

export default async function ResearchRoute() {
  if (!(await isAuthenticated())) {
    redirect('/admin/login?next=/football/research');
  }
  return <ResearchPage />;
}
