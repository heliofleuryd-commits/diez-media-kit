export const metadata = { title: 'Tactics Studio — diez.gg', robots: 'noindex,nofollow' };

export default function FootballLayout({ children }: { children: React.ReactNode }) {
  return (
    // Covers the purple gradient from root layout with a clean white surface
    <div style={{ position: 'fixed', inset: 0, background: '#f9fafb', zIndex: 10, overflow: 'hidden' }}>
      {children}
    </div>
  );
}
