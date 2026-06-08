import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { SkillsLibrary } from '@/app/components/football/SkillsLibrary';

export const metadata = { title: 'Skill Library — diez.gg' };

export default async function SkillsPage() {
  if (!(await isAuthenticated())) redirect('/admin/login?next=/football/skills');
  return <SkillsLibrary />;
}
