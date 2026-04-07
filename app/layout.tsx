import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import Grainient from '@/components/Grainient';
import TargetCursor from '@/components/TargetCursor';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '600', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-montserrat',
  display: 'swap',
});

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
    <html lang="en" className={montserrat.variable}>
      <body className="font-montserrat" style={{ background: '#1a0a3d' }}>
        {/* Fixed full-screen animated gradient background */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: '#1a0a3d' }}>
          <Grainient color1="#9edaff" color2="#5227FF" color3="#b0a3f0" />
        </div>
        <TargetCursor />
        {/* Page content above the gradient */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {children}
          <script dangerouslySetInnerHTML={{ __html: `
            (function() {
              function send(payload) {
                navigator.sendBeacon('/api/track', JSON.stringify(payload));
              }
              send({ type: 'pageview', referrer: document.referrer });
              window.trackCTA = function(name) {
                send({ type: 'cta_click', referrer: document.referrer, ctaName: name });
              };
            })();
          ` }} />
        </div>
      </body>
    </html>
  );
}
