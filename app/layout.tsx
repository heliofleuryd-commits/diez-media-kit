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
      <body className={inter.className}>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            function send(payload) {
              navigator.sendBeacon('/api/track', JSON.stringify(payload));
            }
            // Page view
            send({ type: 'pageview', referrer: document.referrer });
            // Expose CTA tracker globally
            window.trackCTA = function(name) {
              send({ type: 'cta_click', referrer: document.referrer, ctaName: name });
            };
          })();
        ` }} />
      </body>
    </html>
  );
}
