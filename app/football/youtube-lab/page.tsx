import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { YouTubeLab } from '@/app/components/football/YouTubeLab';

export const metadata = { title: 'YouTube Lab — diez.gg' };

export default async function YouTubeLabPage() {
  if (!(await isAuthenticated())) redirect('/admin/login?next=/football/youtube-lab');
  return <YouTubeLab />;
}
