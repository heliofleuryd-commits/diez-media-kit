import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { EmotionalStoryteller } from '@/app/components/football/EmotionalStoryteller';

export const metadata = { title: 'Emotional Storyteller — diez.gg' };

export default async function EmotionalStorytellerPage() {
  if (!(await isAuthenticated())) redirect('/admin/login?next=/football/emotional-storyteller');
  return <EmotionalStoryteller />;
}
