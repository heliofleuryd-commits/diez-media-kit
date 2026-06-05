import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { FootballApp } from '@/app/components/football/FootballApp';

export const metadata = { title: 'Tactics Board — diez.gg' };

export default async function TacticsPage() {
  if (!(await isAuthenticated())) {
    redirect('/admin/login?next=/football/tactics');
  }
  return <FootballApp />;
}
