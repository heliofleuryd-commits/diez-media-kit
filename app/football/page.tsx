import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { FootballApp } from '@/app/components/football/FootballApp';

export const metadata = { title: 'Tactics Studio — diez.gg' };

export default async function FootballPage() {
  if (!(await isAuthenticated())) {
    redirect('/admin/login?next=/football');
  }

  return <FootballApp />;
}
