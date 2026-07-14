'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getDailySpend, addSpend, formatCost } from '@/lib/football/costTracker';
import { ShortsAnalysis } from './ShortsAnalysis';

interface Idea {
  rank: number;
  title: string;
  subject: string;
  hook: string;
  angle: string;
  source: 'current' | 'evergreen';
  relevance: 'HOT' | 'WARM' | 'TIMELESS';
}

const REL_STYLE: Record<string, string> = {
  HOT: 'bg-red-100 text-red-700 border-red-200',
  WARM: 'bg-amber-100 text-amber-700 border-amber-200',
  TIMELESS: 'bg-violet-100 text-violet-700 border-violet-200',
};

// ── Video Ideas tab ─────────────────────────────────────────────────────────
function VideoIdeas() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  async function safeJson(res: Response) {
    const t = await res.text();
    try { return JSON.parse(t); } catch { return { ok: false, error: `Server returned invalid response (${res.status})` }; }
  }
  const apply = useCallback((d: any) => {
    setIdeas(d.ideas || []); setDate(d.date || null); setCached(!!d.cached);
    if (d.cost && !d.cached) addSpend(d.cost);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/football/video-ideas');
        const d = await safeJson(res);
        if (!cancelled && d.ok && d.ideas?.length) apply(d);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [apply]);

  async function generate() {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/football/video-ideas', { method: 'POST' });
      const d = await safeJson(res);
      if (!d.ok) throw new Error(d.error || 'Failed');
      apply(d);
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={generate} disabled={loading}
          className="px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
          {loading ? 'Finding ideas…' : ideas.length ? 'Refresh Ideas' : 'Get Video Ideas'}
        </button>
        {date && <span className="text-[10px] text-gray-400 font-semibold">{date}{cached ? ' (cached)' : ''}</span>}
        <span className="text-[10px] text-gray-300 font-mono ml-auto">Daily: {formatCost(getDailySpend())}</span>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 mb-5"><p className="text-[11px] text-red-700 font-semibold">{error}</p></div>}

      {loading && ideas.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-12 text-center">
          <div className="text-3xl mb-3 animate-pulse">💡</div>
          <h2 className="text-[14px] font-bold text-gray-800 mb-1">Finding story ideas…</h2>
          <p className="text-[11px] text-gray-400 max-w-sm mx-auto">Scanning the footballing world right now, plus the greatest stories of all time.</p>
        </div>
      )}

      {!loading && ideas.length === 0 && !error && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-12 text-center">
          <div className="text-3xl mb-3">💡</div>
          <h2 className="text-[14px] font-bold text-gray-800 mb-1">Story video ideas</h2>
          <p className="text-[11px] text-gray-400 max-w-sm mx-auto">Emotional football story ideas — from what's happening now and the greatest stories ever. Each one feeds straight into the Emotional Storyteller.</p>
        </div>
      )}

      <div className="space-y-2">
        {ideas.map(idea => {
          const topic = `${idea.subject} — ${idea.angle}`;
          return (
            <div key={idea.rank} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${REL_STYLE[idea.relevance] || REL_STYLE.TIMELESS}`}>{idea.relevance}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{idea.source === 'current' ? '📰 Current' : '⭐ All-time'}</span>
                <span className="text-[10px] text-gray-400 font-semibold">{idea.subject}</span>
              </div>
              <h3 className="font-bold text-[13px] text-gray-900 leading-tight">{idea.title}</h3>
              <p className="text-[12px] text-gray-800 font-semibold italic leading-relaxed mt-1">"{idea.hook}"</p>
              <p className="text-[11px] text-gray-500 leading-relaxed mt-1">{idea.angle}</p>
              <Link href={`/football/emotional-storyteller?topic=${encodeURIComponent(topic)}`}
                className="inline-block mt-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#dc2626)' }}>
                Write Script →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── YouTube Lab shell ────────────────────────────────────────────────────────
export function YouTubeLab() {
  const [tab, setTab] = useState<'ideas' | 'titles'>('ideas');

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="max-w-4xl mx-auto px-5 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-black text-gray-900 tracking-tight">YouTube Lab</h1>
          <p className="text-[12px] text-gray-500 mt-1">Story video ideas from across football, and what makes Shorts titles land — David King benchmarked.</p>
        </div>

        <div className="flex gap-1.5 mb-5">
          {([['ideas', '💡 Video Ideas'], ['titles', '📊 Shorts Titles']] as [typeof tab, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${tab === k ? 'bg-violet-100 text-violet-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'ideas' ? <VideoIdeas /> : <ShortsAnalysis embedded />}
      </div>
    </div>
  );
}
