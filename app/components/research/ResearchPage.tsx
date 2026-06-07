'use client';

import { useState, useEffect } from 'react';

interface Script {
  rank: number; title: string; topic: string; search_signal: string;
  virality_score: number; virality_reason: string; hook: string; script: string;
  shot_list: string[]; on_screen_text: string[]; suggested_sound: string;
  caption: string; hashtags: string[];
}
interface GeneratedData { generated_at: string; trends_summary: string; scripts: Script[]; }
interface YTSearchItem { query: string; suggestions: string[]; }
interface YTVideo { title: string; channel: string; views?: string; videoId?: string; }
interface TrendItem { title: string; traffic: string; }
interface NewsItem { title: string; source: string; }
interface TTItem { desc: string; plays: number; }
interface XTrendItem { name: string; countries: string[]; }

interface Trends {
  ytSearch: YTSearchItem[];
  ytContent: { trending: YTVideo[]; recent: YTVideo[] };
  googleTrends: TrendItem[];
  news: NewsItem[];
  tiktok: { items: TTItem[]; note: string | null };
  xTrends: { trends: XTrendItem[]; note: string | null };
}

export function ResearchPage() {
  const [generating, setGenerating] = useState(false);
  const [data, setData] = useState<GeneratedData | null>(null);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedScript, setExpandedScript] = useState<number | null>(0);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/football/research')
      .then(r => r.json())
      .then(d => { if (d.ok) setTrends(d); })
      .finally(() => setLoadingTrends(false));
  }, []);

  const generate = async () => {
    setGenerating(true); setError(null);
    try {
      const res = await fetch('/api/football/research', { method: 'POST' });
      const json = await res.json();
      if (!json.ok) { setError(json.error); return; }
      setData(json.data);
      setTrends(json.trends);
      setExpandedScript(0);
    } catch (e: any) { setError(e.message); }
    finally { setGenerating(false); }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key); setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="flex h-full bg-[#0d0f14] text-white overflow-hidden">

      {/* ── LEFT: Trends sidebar ─────────────────────────────────── */}
      <aside className="w-72 shrink-0 flex flex-col border-r border-white/[0.07] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.07] shrink-0">
          <h2 className="text-[10px] font-black tracking-widest uppercase text-white/50">Live Signals</h2>
          <p className="text-[9px] text-white/25 mt-0.5">YouTube · Google Trends · News · TikTok</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {loadingTrends && (
            <div className="flex items-center justify-center py-8">
              <span className="text-[10px] text-white/20 animate-pulse">Fetching signals…</span>
            </div>
          )}
          {trends && (<>

            {/* YouTube: What people search */}
            <div>
              <p className="text-[8px] font-bold uppercase tracking-widest text-red-400 mb-2">🔴 YouTube · Searched Right Now</p>
              <div className="space-y-2">
                {trends.ytSearch?.slice(0, 5).map((s, i) => (
                  <div key={i}>
                    <p className="text-[9px] font-semibold text-white/50 mb-0.5">"{s.query}"</p>
                    <div className="flex flex-wrap gap-1">
                      {s.suggestions.map((sg, j) => (
                        <span key={j} className="text-[8px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300/70">{sg}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* YouTube: Trending now */}
            {trends.ytContent?.trending?.length > 0 && (
              <div>
                <p className="text-[8px] font-bold uppercase tracking-widest text-red-400/70 mb-2">🔴 YouTube · Trending Sports</p>
                <div className="space-y-1.5">
                  {trends.ytContent.trending.slice(0, 5).map((v, i) => (
                    <div key={i}>
                      <p className="text-[10px] text-white/65 leading-snug">{v.title}</p>
                      <p className="text-[8px] text-white/25">{v.channel}{v.views ? ` · ${v.views}` : ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Google Trends */}
            <div>
              <p className="text-[8px] font-bold uppercase tracking-widest text-green-400/70 mb-2">🟢 Google Trends · US</p>
              <div className="space-y-1.5">
                {trends.googleTrends?.slice(0, 12).map((t, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-2">
                    <p className="text-[10px] text-white/65 leading-snug flex-1">{t.title}</p>
                    {t.traffic && <p className="text-[8px] text-white/25 shrink-0">{t.traffic}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* TikTok */}
            <div>
              <p className="text-[8px] font-bold uppercase tracking-widest text-pink-400/70 mb-2">🩷 TikTok · WC Content</p>
              {trends.tiktok?.items?.length > 0 ? (
                <div className="space-y-1.5">
                  {trends.tiktok.items.slice(0, 8).map((v, i) => (
                    <div key={i}>
                      <p className="text-[10px] text-white/60 leading-snug">{v.desc}</p>
                      <p className="text-[8px] text-white/25">{(v.plays/1000).toFixed(0)}K plays</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[9px] text-white/25 italic">{trends.tiktok?.note || 'Fetching…'}</p>
              )}
            </div>

            {/* X (Twitter) */}
            <div>
              <p className="text-[8px] font-bold uppercase tracking-widest text-sky-400/70 mb-2">⚪ X (Twitter) · Football Trends</p>
              {trends.xTrends?.trends?.length > 0 ? (
                <div className="space-y-1.5">
                  {trends.xTrends.trends.slice(0, 10).map((t, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-2">
                      <p className="text-[10px] text-white/65 leading-snug flex-1">{t.name}</p>
                      <p className="text-[8px] text-white/25 shrink-0">{t.countries.join(', ')}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[9px] text-white/25 italic">{trends.xTrends?.note || 'Fetching…'}</p>
              )}
            </div>

            {/* Google News */}
            <div>
              <p className="text-[8px] font-bold uppercase tracking-widest text-blue-400/70 mb-2">🔵 WC News</p>
              <div className="space-y-1.5">
                {trends.news?.slice(0, 8).map((n, i) => (
                  <div key={i}>
                    <p className="text-[10px] text-white/55 leading-snug">{n.title}</p>
                    <p className="text-[8px] text-white/25">{n.source}</p>
                  </div>
                ))}
              </div>
            </div>

          </>)}
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.07] shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-black tracking-wide text-white">Daily Script Generator</h1>
            <p className="text-[10px] text-white/35 mt-0.5">
              {data
                ? `Generated ${new Date(data.generated_at).toLocaleString()} · 3 scripts ready`
                : 'Reads today\'s signals → generates 3 ready-to-record scripts'}
            </p>
          </div>
          <button onClick={generate} disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-black disabled:opacity-50 transition-all hover:scale-[1.02]"
            style={{ background: generating ? '#374151' : 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
            {generating
              ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> Generating…</>
              : <>✨ Generate Today's Scripts</>}
          </button>
        </div>

        {error && <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>}

        {data?.trends_summary && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-violet-500/10 border border-violet-500/20 shrink-0">
            <p className="text-[9px] font-bold text-violet-300 uppercase tracking-widest mb-1">Today's Story</p>
            <p className="text-[11px] text-white/70 leading-relaxed">{data.trends_summary}</p>
          </div>
        )}

        {!data && !generating && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
            <div className="text-5xl">🎬</div>
            <div>
              <p className="text-white/50 text-sm font-semibold">No scripts yet</p>
              <p className="text-white/25 text-xs mt-1 max-w-xs leading-relaxed">
                Hit Generate — Opus reads today's YouTube search trends, Google Trends, and your 120-video skill library to produce 3 scripts.
              </p>
            </div>
          </div>
        )}

        {data?.scripts && (
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {data.scripts.map((script, i) => {
              const open = expandedScript === i;
              return (
                <div key={i} className={`rounded-2xl border transition-all ${open ? 'border-violet-500/30 bg-white/[0.04]' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12]'}`}>
                  <button className="w-full flex items-center gap-4 px-5 py-4 text-left" onClick={() => setExpandedScript(open ? null : i)}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${i === 0 ? 'bg-violet-600 text-white' : i === 1 ? 'bg-indigo-600/60 text-white' : 'bg-white/10 text-white/60'}`}>#{i+1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-black text-white truncate">{script.title}</p>
                      <p className="text-[9px] text-white/35 mt-0.5">{script.search_signal}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-violet-400">{script.virality_score}/100</p>
                        <p className="text-[8px] text-white/25">virality</p>
                      </div>
                      <span className="text-white/30">{open ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {open && (
                    <div className="px-5 pb-5 space-y-4 border-t border-white/[0.06] pt-4">
                      <div className="px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                        <p className="text-[9px] font-bold text-violet-400 uppercase tracking-widest mb-1">Why this works</p>
                        <p className="text-[11px] text-white/60">{script.virality_reason}</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Hook (0–3s)</p>
                          <button onClick={() => copy(script.hook, `hook-${i}`)} className="text-[8px] text-violet-400">{copied===`hook-${i}`?'✓ Copied':'Copy'}</button>
                        </div>
                        <p className="text-[14px] font-black text-white leading-snug">"{script.hook}"</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Full Script</p>
                          <button onClick={() => copy(script.script, `script-${i}`)} className="text-[8px] text-violet-400">{copied===`script-${i}`?'✓ Copied':'Copy'}</button>
                        </div>
                        <div className="bg-black/30 rounded-xl p-4 font-mono text-[11px] text-white/75 leading-relaxed whitespace-pre-wrap border border-white/[0.06]">{script.script}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-2">Shot List</p>
                          <ul className="space-y-1">{script.shot_list?.map((s,j)=><li key={j} className="text-[10px] text-white/55 flex gap-2"><span className="text-white/25 shrink-0">{j+1}.</span>{s}</li>)}</ul>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-2">On-Screen Text</p>
                          <ul className="space-y-1">{script.on_screen_text?.map((t,j)=><li key={j} className="text-[10px] text-white/55 flex gap-2"><span className="text-white/25">▸</span>{t}</li>)}</ul>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1">Sound</p>
                          <p className="text-[10px] text-white/55">🎵 {script.suggested_sound}</p>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Caption</p>
                            <button onClick={() => copy(`${script.caption}\n\n${script.hashtags?.join(' ')}`, `cap-${i}`)} className="text-[8px] text-violet-400">{copied===`cap-${i}`?'✓ Copied':'Copy'}</button>
                          </div>
                          <p className="text-[10px] text-white/55 leading-snug">{script.caption}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {script.hashtags?.map((h,j)=><span key={j} className="px-2 py-0.5 rounded-full bg-white/[0.06] text-[9px] text-white/50 font-mono">{h}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
