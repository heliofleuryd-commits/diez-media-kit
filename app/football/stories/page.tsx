import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { StoryResearch } from '@/app/components/football/StoryResearch';

export const metadata = { title: 'Story Research — diez.gg' };

export default async function StoriesPage() {
  if (!(await isAuthenticated())) redirect('/admin/login?next=/football/stories');
  return <StoryResearch />;
}
