import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { LaFechaStoryteller } from '@/app/components/football/LaFechaStoryteller';

export const metadata = { title: 'La Fecha — diez.gg' };

export default async function LaFechaPage() {
  if (!(await isAuthenticated())) redirect('/admin/login?next=/football/la-fecha');
  return <LaFechaStoryteller />;
}
