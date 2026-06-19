'use client';

import { useState, useEffect, useCallback } from 'react';
import { getDailySpend, addSpend, formatCost } from '@/lib/football/costTracker';

interface Story {
  rank: number;
  type: 'personal' | 'country';
  title: string;
  player: string | null;
  teams: string | null;
  relevance: 'HOT' | 'WARM' | 'EVERGREEN';
  why_today: string;
  headline: string;
  key_facts: string[];
  emotional_arc: string;
  script_angle: string;
}

type Filter = 'all' | 'personal' | 'country';

const RELEVANCE_STYLE: Record<string, string> = {
  HOT: 'bg-red-100 text-red-700 border-red-200',
  WARM: 'bg-amber-100 text-amber-700 border-amber-200',
  EVERGREEN: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

function StoryCard({ story }: { story: Story }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <span className="text-[11px] font-black text-gray-300 mt-0.5 shrink-0">
            #{story.rank}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${RELEVANCE_STYLE[story.relevance] || RELEVANCE_STYLE.EVERGREEN}`}>
                {story.relevance}
              </span>
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${story.type === 'personal' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                {story.type === 'personal' ? '👤 Personal' : '🏴 Country'}
              </span>
            </div>
            <h3 className="font-bold text-[13px] text-gray-900 mt-1.5 leading-tight">{story.title}</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {story.player || story.teams} — {story.why_today}
            </p>
          </div>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className="text-gray-300 transition-transform shrink-0 mt-1" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Headline / Hook</p>
            <p className="text-[12px] text-gray-800 font-semibold italic leading-relaxed">"{story.headline}"</p>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Key Facts</p>
            <ul className="space-y-1">
              {story.key_facts.map((f, i) => (
                <li key={i} className="text-[11px] text-gray-600 leading-relaxed flex gap-1.5">
                  <span className="text-gray-300 shrink-0">•</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Emotional Arc</p>
            <p className="text-[11.5px] text-gray-700 leading-relaxed">{story.emotional_arc}</p>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Script Angle</p>
            <p className="text-[11.5px] text-gray-700 leading-relaxed">{story.script_angle}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function StoryResearch() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [lastDate, setLastDate] = useState<string | null>(null);
  const [cost, setCost] = useState(0);
  const [cached, setCached] = useState(false);

  const applyData = useCallback((data: any) => {
    setStories(data.stories || []);
    setLastDate(data.date);
    setCached(!!data.cached);
    if (data.cost && !data.cached) {
      setCost(data.cost);
      addSpend(data.cost);
    }
  }, []);

  async function safeJson(res: Response) {
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { return { ok: false, error: `Server returned invalid response (${res.status})` }; }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const cachedRes = await fetch('/api/football/stories');
        const cachedData = await safeJson(cachedRes);
        if (cancelled) return;
        if (cachedData.ok && cachedData.stories?.length > 0) {
          applyData(cachedData);
          setLoading(false);
          return;
        }
        const freshRes = await fetch('/api/football/stories', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const fresh = await safeJson(freshRes);
        if (cancelled) return;
        if (fresh.ok && fresh.stories?.length > 0) {
          applyData(fresh);
        } else if (fresh.error) {
          setError(fresh.error);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load stories');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [applyData]);

  async function refreshStories() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/football/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: true }),
      });
      const data = await safeJson(res);
      if (!data.ok) throw new Error(data.error || 'Failed to fetch stories');
      if (!data.stories?.length) throw new Error('No stories returned — try again');
      applyData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const filtered = stories.filter(s =>
    filter === 'all' ? true : s.type === filter
  );

  const personalCount = stories.filter(s => s.type === 'personal').length;
  const countryCount = stories.filter(s => s.type === 'country').length;

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="max-w-3xl mx-auto px-5 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Story Research</h1>
          <p className="text-[12px] text-gray-500 mt-1">
            Daily emotional stories to script — personal player backstories and historic country narratives, ranked by what's relevant today.
          </p>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={refreshStories}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
          >
            {loading ? 'Researching…' : 'Refresh Stories'}
          </button>
          {lastDate && (
            <span className="text-[10px] text-gray-400 font-semibold">
              {lastDate}{cached ? ' (cached)' : ''}
            </span>
          )}
          {cost > 0 && (
            <span className="text-[10px] text-gray-300 font-mono">{formatCost(cost)}</span>
          )}
          <span className="text-[10px] text-gray-300 font-mono ml-auto">
            Daily: {formatCost(getDailySpend())}
          </span>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 mb-5">
            <p className="text-[11px] text-red-700 font-semibold">{error}</p>
          </div>
        )}

        {stories.length > 0 && (
          <>
            <div className="flex gap-1.5 mb-4">
              {([
                ['all', `All (${stories.length})`],
                ['personal', `👤 Personal (${personalCount})`],
                ['country', `🏴 Country (${countryCount})`],
              ] as [Filter, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-3 py-1.5 rounded-lg text-[10.5px] font-bold transition-all ${
                    filter === key
                      ? 'bg-violet-100 text-violet-700'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filtered.map(s => <StoryCard key={s.rank} story={s} />)}
            </div>
          </>
        )}

        {loading && stories.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-12 text-center">
            <div className="text-3xl mb-3 animate-pulse">📖</div>
            <h2 className="text-[14px] font-bold text-gray-800 mb-1">Researching today's stories…</h2>
            <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
              Pulling live ESPN data, Google News trends, and cross-referencing the story bank. This takes ~15 seconds.
            </p>
          </div>
        )}

        {!loading && stories.length === 0 && !error && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-12 text-center">
            <div className="text-3xl mb-3">📖</div>
            <h2 className="text-[14px] font-bold text-gray-800 mb-1">No stories yet</h2>
            <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
              Stories auto-generate each morning. Hit Refresh to generate now.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
