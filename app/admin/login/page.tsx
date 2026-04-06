'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push('/admin');
    } else {
      setError('Wrong password');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#09090B] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-[#00E5FF]">DIEZ</h1>
          <p className="text-[#71717A] text-sm mt-1">Admin Dashboard</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-[#18181B] border border-[#27272A] rounded-2xl p-8 space-y-4">
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#00E5FF] transition-colors"
              placeholder="Enter admin password"
              autoFocus
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00E5FF] text-black font-bold py-2.5 rounded-lg hover:bg-[#00C8E0] transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
