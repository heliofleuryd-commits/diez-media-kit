import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { StudioPage } from '@/app/components/research/StudioPage';

export const metadata = { title: 'Content Studio — diez.gg' };

export default async function ResearchRoute() {
  if (!(await isAuthenticated())) redirect('/admin/login?next=/football/research');
  return <StudioPage />;
}
