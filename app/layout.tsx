import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import Grainient from '@/components/Grainient';
import CursorController from '@/components/CursorController';

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
        <CursorController />
        {/* Page content above the gradient */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {children}
          <script dangerouslySetInnerHTML={{ __html: `
            (function() {
              // Persistent anonymous visitor ID — survives across sessions
              var vid = localStorage.getItem('_dvid');
              if (!vid) {
                vid = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
                localStorage.setItem('_dvid', vid);
              }

              // Session ID — new each tab/session
              var sid = sessionStorage.getItem('_dsid');
              if (!sid) {
                sid = 's_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
                sessionStorage.setItem('_dsid', sid);
              }

              var pageStart = Date.now();
              var path = window.location.pathname;

              function send(payload) {
                navigator.sendBeacon('/api/track', JSON.stringify(payload));
              }

              // Pageview with visitor + session IDs
              send({
                type: 'pageview',
                referrer: document.referrer,
                path: path,
                visitorId: vid,
                sessionId: sid,
              });

              // Track time on page when leaving
              function sendDuration() {
                var duration = Math.round((Date.now() - pageStart) / 1000);
                if (duration < 1) return;
                send({ type: 'duration', path: path, visitorId: vid, sessionId: sid, duration: duration });
              }
              window.addEventListener('pagehide', sendDuration);
              document.addEventListener('visibilitychange', function() {
                if (document.visibilityState === 'hidden') sendDuration();
              });

              window.trackCTA = function(name) {
                send({ type: 'cta_click', referrer: document.referrer, ctaName: name, path: path, visitorId: vid, sessionId: sid });
              };
            })();
          ` }} />
        </div>
      </body>
    </html>
  );
}
