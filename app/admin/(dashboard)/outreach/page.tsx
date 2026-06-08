export default function OutreachPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brand Outreach</h1>
          <p className="text-gray-400 text-sm mt-1">Prospect and manage brand partnerships</p>
        </div>
        <button className="text-white font-bold px-4 py-2 rounded-lg text-sm transition-opacity hover:opacity-90" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
          + Add Contact
        </button>
      </div>

      {/* Coming soon placeholder */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-16 text-center">
        <div className="text-4xl mb-4">🎯</div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Brand Outreach coming soon</h2>
        <p className="text-gray-400 text-sm max-w-sm mx-auto">
          Add brand contacts, track outreach status, and send personalised pitches — all in one place.
        </p>
      </div>
    </div>
  );
}
