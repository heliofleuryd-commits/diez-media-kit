'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/admin';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      router.push(next);
    } else {
      setError('Invalid username or password');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#09090B] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl font-black italic text-white mb-1">DIEZ</div>
          <p className="text-[#52525B] text-sm">Admin Analytics</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-[#18181B] border border-[#27272A] rounded-2xl p-8 space-y-4">
          <div>
            <label className="block text-xs text-[#71717A] uppercase tracking-wider mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#5227FF] transition-colors"
              placeholder="diez.gg"
              autoFocus
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-xs text-[#71717A] uppercase tracking-wider mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#5227FF] transition-colors"
              placeholder="••••••••••"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-black text-sm text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #5227FF 0%, #9B59F5 100%)' }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
