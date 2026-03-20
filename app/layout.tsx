import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Diez | Media Kit',
  description: 'Content creator across Warzone, Football & Gaming — 5 accounts, millions of views.',
  openGraph: {
    title: 'Diez | Media Kit',
    description: 'Content creator across Warzone, Football & Gaming',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
