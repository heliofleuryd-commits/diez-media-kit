import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { VideoDownloader } from '@/app/components/football/VideoDownloader';

export const metadata = { title: 'Video Downloader — diez.gg' };

export default async function DownloaderPage() {
  if (!(await isAuthenticated())) redirect('/admin/login?next=/football/downloader');
  return <VideoDownloader />;
}
