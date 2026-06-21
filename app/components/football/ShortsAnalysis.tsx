'use client';

import { useState, useEffect, useCallback } from 'react';
import { getDailySpend, addSpend, formatCost } from '@/lib/football/costTracker';

interface ShortVideo {
  id: string;
  title: string;
  channel: string;
  views: number;
  likes: number;
  published: string;
  duration: number;
}

interface Category {
  name: string;
  emoji: string;
  description: string;
  why_it_works: string;
  template: string;
  count: number;
}

interface Pattern {
  name: string;
  description: string;
  examples: string[];
}

interface Analysis {
  categories: Category[];
  assignments: Record<string, string>;
  top_patterns: Pattern[];
  power_words: string[];
  title_length: string;
  deep_insights: string;
}

function fmtViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

const CAT_COLORS = [
  'bg-red-50 border-red-200 text-red-700',
  'bg-violet-50 border-violet-200 text-violet-700',
  'bg-blue-50 border-blue-200 text-blue-700',
  'bg-amber-50 border-amber-200 text-amber-700',
  'bg-emerald-50 border-emerald-200 text-emerald-700',
  'bg-pink-50 border-pink-200 text-pink-700',
  'bg-cyan-50 border-cyan-200 text-cyan-700',
  'bg-orange-50 border-orange-200 text-orange-700',
];

function CategoryCard({
  cat,
  colorClass,
  titles,
  expanded,
  onToggle,
}: {
  cat: Category;
  colorClass: string;
  titles: ShortVideo[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const avgViews = titles.length > 0
    ? titles.reduce((sum, t) => sum + t.views, 0) / titles.length
    : 0;

  return (
    <div className={`rounded-xl border ${colorClass.split(' ').slice(0, 2).join(' ')} overflow-hidden`}>
      <button onClick={onToggle} className="w-full text-left px-4 py-3 hover:bg-white/50 transition-colors">
        <div className="flex items-start gap-2.5">
          <span className="text-lg">{cat.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-[13px] text-gray-900">{cat.name}</h3>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${colorClass}`}>
                {titles.length} titles
              </span>
              <span className="text-[9px] font-bold text-gray-400">
                avg {fmtViews(avgViews)} views
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{cat.description}</p>
          </div>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className="text-gray-300 shrink-0 mt-1 transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : '' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          <div className="space-y-2">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Why It Works</p>
              <p className="text-[11px] text-gray-600 leading-relaxed">{cat.why_it_works}</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Template</p>
              <p className="text-[11.5px] text-gray-800 font-mono leading-relaxed bg-gray-50 px-2.5 py-1.5 rounded-lg">{cat.template}</p>
            </div>
          </div>

          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">
              Top Titles ({titles.length})
            </p>
            <div className="space-y-1.5">
              {titles.slice(0, 20).map((t, i) => (
                <a
                  key={t.id}
                  href={`https://www.youtube.com/shorts/${t.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <span className="text-[10px] font-black text-gray-300 mt-0.5 shrink-0 w-4 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11.5px] text-gray-800 font-semibold leading-tight group-hover:text-violet-700 transition-colors">{t.title}</p>
                    <p className="text-[9.5px] text-gray-400 mt-0.5">@{t.channel}</p>
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 shrink-0 tabular-nums">{fmtViews(t.views)}</span>
                </a>
              ))}
              {titles.length > 20 && (
                <p className="text-[10px] text-gray-300 font-semibold pl-6">+{titles.length - 20} more</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ShortsAnalysis() {
  const [shorts, setShorts] = useState<ShortVideo[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [cost, setCost] = useState(0);
  const [cached, setCached] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [showInsights, setShowInsights] = useState(false);
  const [activeTab, setActiveTab] = useState<'categories' | 'patterns' | 'all'>('categories');

  const applyData = useCallback((data: any) => {
    setShorts(data.shorts || []);
    setAnalysis(data.analysis || null);
    setDate(data.date || null);
    setCached(!!data.cached);
    if (data.cost && !data.cached) { setCost(data.cost); addSpend(data.cost); }
  }, []);

  async function safeJson(res: Response) {
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { return { ok: false, error: `Server returned invalid response (${res.status})` }; }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/football/shorts-analysis');
        const data = await safeJson(res);
        if (cancelled) return;
        if (data.ok && data.shorts?.length > 0) { applyData(data); setLoading(false); return; }
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [applyData]);

  async function analyze() {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/football/shorts-analysis', { method: 'POST' });
      const data = await safeJson(res);
      if (!data.ok) throw new Error(data.error || 'Analysis failed');
      applyData(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
    finally { setLoading(false); }
  }

  const titlesByCategory = useCallback(() => {
    if (!analysis || !shorts.length) return new Map<string, ShortVideo[]>();
    const map = new Map<string, ShortVideo[]>();
    for (const cat of analysis.categories) map.set(cat.name, []);
    for (const [idx, catName] of Object.entries(analysis.assignments)) {
      const i = parseInt(idx) - 1;
      if (i >= 0 && i < shorts.length) {
        const arr = map.get(catName);
        if (arr) arr.push(shorts[i]);
        else map.set(catName, [shorts[i]]);
      }
    }
    for (const [, arr] of map) arr.sort((a, b) => b.views - a.views);
    return map;
  }, [analysis, shorts]);

  const catMap = titlesByCategory();
  const sortedCategories = analysis?.categories
    ? [...analysis.categories].sort((a, b) => {
      const aAvg = (catMap.get(a.name) || []).reduce((s, t) => s + t.views, 0) / ((catMap.get(a.name) || []).length || 1);
      const bAvg = (catMap.get(b.name) || []).reduce((s, t) => s + t.views, 0) / ((catMap.get(b.name) || []).length || 1);
      return bAvg - aAvg;
    })
    : [];

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="max-w-4xl mx-auto px-5 py-6">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Shorts Title Lab</h1>
          <p className="text-[12px] text-gray-500 mt-1">
            Analyzes top-performing YouTube Shorts titles in football — what packaging patterns get the most views.
          </p>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <button onClick={analyze} disabled={loading}
            className="px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
            {loading ? 'Analyzing...' : shorts.length > 0 ? 'Re-Analyze' : 'Analyze Shorts Titles'}
          </button>
          {date && <span className="text-[10px] text-gray-400 font-semibold">{date}{cached ? ' (cached)' : ''}</span>}
          {cost > 0 && <span className="text-[10px] text-gray-300 font-mono">{formatCost(cost)}</span>}
          <span className="text-[10px] text-gray-300 font-mono ml-auto">Daily: {formatCost(getDailySpend())}</span>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 mb-5">
            <p className="text-[11px] text-red-700 font-semibold">{error}</p>
          </div>
        )}

        {/* Loading state */}
        {loading && !analysis && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-12 text-center">
            <div className="text-3xl mb-3 animate-pulse">🔍</div>
            <h2 className="text-[14px] font-bold text-gray-800 mb-1">Analyzing YouTube Shorts titles...</h2>
            <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
              Fetching top football Shorts across 9 search queries, getting view stats, then running deep AI analysis. Takes ~30-60 seconds.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !analysis && !error && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-12 text-center">
            <div className="text-3xl mb-3">📊</div>
            <h2 className="text-[14px] font-bold text-gray-800 mb-1">No analysis yet</h2>
            <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
              Hit "Analyze Shorts Titles" to fetch the top-performing football YouTube Shorts and analyze their title patterns.
            </p>
          </div>
        )}

        {/* Results */}
        {analysis && shorts.length > 0 && (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-center">
                <p className="text-[18px] font-black text-gray-900">{shorts.length}</p>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Titles Analyzed</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-center">
                <p className="text-[18px] font-black text-gray-900">{analysis.categories.length}</p>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Categories Found</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-center">
                <p className="text-[18px] font-black text-gray-900">{fmtViews(shorts[0]?.views || 0)}</p>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Top Views</p>
              </div>
            </div>

            {/* Deep insights */}
            {analysis.deep_insights && (
              <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-violet-50/50 to-white mb-5 overflow-hidden">
                <button onClick={() => setShowInsights(o => !o)}
                  className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-white/50 transition-colors">
                  <span className="text-sm">🧠</span>
                  <span className="text-[11px] font-black text-gray-900 uppercase tracking-wider">Deep Insights</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-300 ml-auto" style={{ transform: showInsights ? 'rotate(180deg)' : '' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showInsights && (
                  <div className="px-4 pb-4">
                    <div className="text-[12px] text-gray-700 leading-[1.8] whitespace-pre-wrap">{analysis.deep_insights}</div>
                    {analysis.title_length && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Title Length</p>
                        <p className="text-[11.5px] text-gray-600 leading-relaxed">{analysis.title_length}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Power words + Title length */}
            {analysis.power_words?.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 mb-5">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Power Words</p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.power_words.map((w, i) => (
                    <span key={i} className="text-[10px] font-bold bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full border border-violet-200">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1.5 mb-4">
              {([
                ['categories', `Categories (${analysis.categories.length})`],
                ['patterns', `Top Patterns (${analysis.top_patterns?.length || 0})`],
                ['all', `All Titles (${shorts.length})`],
              ] as [typeof activeTab, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`px-3 py-1.5 rounded-lg text-[10.5px] font-bold transition-all ${
                    activeTab === key ? 'bg-violet-100 text-violet-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Category view */}
            {activeTab === 'categories' && (
              <div className="space-y-2">
                {sortedCategories.map((cat, i) => (
                  <CategoryCard
                    key={cat.name}
                    cat={{ ...cat, count: catMap.get(cat.name)?.length || 0 }}
                    colorClass={CAT_COLORS[i % CAT_COLORS.length]}
                    titles={catMap.get(cat.name) || []}
                    expanded={expandedCat === cat.name}
                    onToggle={() => setExpandedCat(expandedCat === cat.name ? null : cat.name)}
                  />
                ))}
              </div>
            )}

            {/* Patterns view */}
            {activeTab === 'patterns' && analysis.top_patterns && (
              <div className="space-y-3">
                {analysis.top_patterns.map((p, i) => (
                  <div key={i} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-black text-violet-600">#{i + 1}</span>
                      <h3 className="text-[13px] font-black text-gray-900">{p.name}</h3>
                    </div>
                    <p className="text-[11.5px] text-gray-600 leading-relaxed mb-2">{p.description}</p>
                    <div className="space-y-1">
                      {p.examples.map((ex, j) => (
                        <p key={j} className="text-[11px] text-gray-500 italic pl-3 border-l-2 border-violet-200">"{ex}"</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* All titles view */}
            {activeTab === 'all' && (
              <div className="space-y-1">
                {shorts.map((s, i) => {
                  const catName = analysis.assignments[String(i + 1)] || 'Uncategorized';
                  const catIdx = sortedCategories.findIndex(c => c.name === catName);
                  return (
                    <a key={s.id} href={`https://www.youtube.com/shorts/${s.id}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-start gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors group">
                      <span className="text-[10px] font-black text-gray-300 mt-0.5 shrink-0 w-5 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11.5px] text-gray-800 font-semibold leading-tight group-hover:text-violet-700 transition-colors">{s.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9.5px] text-gray-400">@{s.channel}</span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${CAT_COLORS[catIdx >= 0 ? catIdx % CAT_COLORS.length : 0]}`}>
                            {catName}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-gray-500 shrink-0 tabular-nums">{fmtViews(s.views)}</span>
                    </a>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
