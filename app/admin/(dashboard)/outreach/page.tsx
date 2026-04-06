export default function OutreachPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Brand Outreach</h1>
          <p className="text-[#71717A] text-sm mt-1">Prospect and manage brand partnerships</p>
        </div>
        <button className="bg-[#00E5FF] text-black font-bold px-4 py-2 rounded-lg text-sm hover:bg-[#00C8E0] transition-colors">
          + Add Contact
        </button>
      </div>

      {/* Coming soon placeholder */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-16 text-center">
        <div className="text-4xl mb-4">🎯</div>
        <h2 className="text-lg font-semibold text-white mb-2">Brand Outreach coming soon</h2>
        <p className="text-[#71717A] text-sm max-w-sm mx-auto">
          Add brand contacts, track outreach status, and send personalised pitches — all in one place.
        </p>
      </div>
    </div>
  );
}
