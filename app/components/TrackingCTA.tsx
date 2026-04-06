'use client';

export default function TrackingCTA() {
  return (
    <a
      href="mailto:heliofleuryd@gmail.com"
      onClick={() => (window as any).trackCTA?.('get-in-touch')}
      className="inline-flex items-center gap-2 bg-[#00E5FF] text-black font-bold px-8 py-3 rounded-full hover:bg-[#00C8E0] transition-colors"
    >
      Get in Touch →
    </a>
  );
}
