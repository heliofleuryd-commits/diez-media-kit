'use client';

import { useState, useEffect } from 'react';

interface Script {
  rank: number;
  title: string;
  topic: string;
  virality_score: number;
  virality_reason: string;
  hook: string;
  script: string;
  shot_list: string[];
  on_screen_text: string[];
  suggested_sound: string;
  caption: string;
  hashtags: string[];
}

interface GeneratedData {
  generated_at: string;
  trends_summary: string;
  scripts: Script[];
}

interface RedditItem  { title: string; score: number; comments: number; }
interface NewsItem    { title: string; source: string; }
interface TrendItem  { title: string; traffic: string; }
interface YTItem     { title: string; channel: string; videoId: string; }
interface TTTag      { tag: string; posts: string; views: string; }

export function ResearchPage() {
  const [generating, setGenerating] = useState(false);
  const [data, setData] = useState<GeneratedData | null>(null);
  const [trends, setTrends] = useState<{ reddit: RedditItem[]; news: NewsItem[]; googleTrends: TrendItem[]; youtube: { items: YTItem[]; note: string | null }; tiktok: { tags: TTTag[]; note: string | null } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedScript, setExpandedScript] = useState<number | null>(0);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/football/research')
      .then(r => r.json())
      .then(d => { if (d.ok) setTrends({ reddit: d.reddit, news: d.news, googleTrends: d.trends, youtube: d.youtube, tiktok: d.tiktok }); })
      .finally(() => setLoadingTrends(false));
  }, []);

  const generate = async () => {
    setGenerating(true); setError(null);
    try {
      const res = await fetch('/api/football/research', { method: 'POST' });
      const json = await res.json();
      if (!json.ok) { setError(json.error); return; }
      setData(json.data);
      setTrends({ reddit: json.trends.reddit, news: json.trends.news, googleTrends: json.trends.googleTrends, youtube: json.trends.youtube, tiktok: json.trends.tiktok });
      setExpandedScript(0);
    } catch (e: any) { setError(e.message); }
    finally { setGenerating(false); }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="flex h-full bg-[#0d0f14] text-white overflow-hidden">

      {/* ── LEFT: Trends ─────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 flex flex-col border-r border-white/[0.07] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.07] shrink-0">
          <h2 className="text-[10px] font-black tracking-widest uppercase text-white/50">Trending Now</h2>
          <p className="text-[9px] text-white/25 mt-0.5">Reddit r/soccer · Google News</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {loadingTrends && (
            <div className="flex items-center justify-center py-8">
              <span className="text-[10px] text-white/20 animate-pulse">Fetching trends…</span>
            </div>
          )}
          {trends && (<>
            {/* TikTok */}
            <div>
              <p className="text-[8px] font-bold uppercase tracking-widest text-pink-400/80 mb-2">TikTok · Trending</p>
              {trends.tiktok.tags.length > 0 ? (
                <div className="space-y-1.5">
                  {trends.tiktok.tags.slice(0, 10).map((t, i) => (
                    <div key={i}>
                      <p className="text-[11px] font-bold text-pink-300/80">{t.tag}</p>
                      {t.views && <p className="text-[8px] text-white/25">{t.views}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[9px] text-white/25 italic">{trends.tiktok.note || 'Unavailable'}</p>
              )}
            </div>

            {/* YouTube */}
            <div>
              <p className="text-[8px] font-bold uppercase tracking-widest text-red-400/80 mb-2">YouTube · Most Viewed 48h</p>
              {trends.youtube.items.length > 0 ? (
                <div className="space-y-1.5">
                  {trends.youtube.items.slice(0, 8).map((v, i) => (
                    <div key={i}>
                      <p className="text-[10px] text-white/70 leading-snug">{v.title}</p>
                      <p className="text-[8px] text-white/25">{v.channel}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[9px] text-white/25 italic">{trends.youtube.note || 'Add YOUTUBE_API_KEY'}</p>
              )}
            </div>

            {/* Google Trends */}
            <div>
              <p className="text-[8px] font-bold uppercase tracking-widest text-green-400/70 mb-2">Google Trends · US</p>
              <div className="space-y-1.5">
                {trends.googleTrends.slice(0, 10).map((t, i) => (
                  <div key={i}>
                    <p className="text-[10px] text-white/65 leading-snug">{t.title}</p>
                    {t.traffic && <p className="text-[8px] text-white/25">{t.traffic} searches</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Reddit */}
            <div>
              <p className="text-[8px] font-bold uppercase tracking-widest text-orange-400/70 mb-2">Reddit r/soccer</p>
              <div className="space-y-1.5">
                {trends.reddit.slice(0, 10).map((r, i) => (
                  <div key={i}>
                    <p className="text-[10px] text-white/60 leading-snug">{r.title}</p>
                    <p className="text-[8px] text-white/25">{r.score?.toLocaleString()} upvotes</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Google News */}
            <div>
              <p className="text-[8px] font-bold uppercase tracking-widest text-blue-400/70 mb-2">Google News</p>
              <div className="space-y-1.5">
                {trends.news.slice(0, 8).map((n, i) => (
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

        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.07] shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-black tracking-wide text-white">Daily Script Generator</h1>
            <p className="text-[10px] text-white/35 mt-0.5">
              {data
                ? `Generated ${new Date(data.generated_at).toLocaleString()} · 3 scripts ready`
                : 'Hit Generate to get 3 World Cup scripts based on today\'s trends + your skill library'}
            </p>
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-black tracking-wide disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: generating ? '#374151' : 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
          >
            {generating
              ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> Generating…</>
              : <>✨ Generate Today's Scripts</>}
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>
        )}

        {/* Trends summary */}
        {data?.trends_summary && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-violet-500/10 border border-violet-500/20 shrink-0">
            <p className="text-[10px] font-bold text-violet-300 uppercase tracking-widest mb-1">Today's Story</p>
            <p className="text-[11px] text-white/70 leading-relaxed">{data.trends_summary}</p>
          </div>
        )}

        {/* Empty state */}
        {!data && !generating && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
            <div className="text-5xl">🎬</div>
            <div>
              <p className="text-white/50 text-sm font-semibold">No scripts yet</p>
              <p className="text-white/25 text-xs mt-1 max-w-xs leading-relaxed">
                Hit Generate — Opus will analyse today's trending topics alongside your 120-video skill library and produce 3 ready-to-record scripts.
              </p>
            </div>
          </div>
        )}

        {/* Scripts */}
        {data?.scripts && (
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {data.scripts.map((script, i) => {
              const open = expandedScript === i;
              return (
                <div
                  key={i}
                  className={`rounded-2xl border transition-all ${open ? 'border-violet-500/30 bg-white/[0.04]' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12]'}`}
                >
                  {/* Script header */}
                  <button
                    className="w-full flex items-center gap-4 px-5 py-4 text-left"
                    onClick={() => setExpandedScript(open ? null : i)}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${i === 0 ? 'bg-violet-600 text-white' : i === 1 ? 'bg-indigo-600/60 text-white' : 'bg-white/10 text-white/60'}`}>
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-black text-white truncate">{script.title}</p>
                      <p className="text-[10px] text-white/40 truncate mt-0.5">{script.topic}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-violet-400">{script.virality_score}/100</p>
                        <p className="text-[8px] text-white/25">virality</p>
                      </div>
                      <span className="text-white/30 text-sm">{open ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {open && (
                    <div className="px-5 pb-5 space-y-4 border-t border-white/[0.06] pt-4">
                      {/* Virality reason */}
                      <div className="px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                        <p className="text-[9px] font-bold text-violet-400 uppercase tracking-widest mb-1">Why this works</p>
                        <p className="text-[11px] text-white/60">{script.virality_reason}</p>
                      </div>

                      {/* Hook */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Hook (0–3s)</p>
                          <button onClick={() => copy(script.hook, `hook-${i}`)} className="text-[8px] text-violet-400 hover:text-violet-300">
                            {copied === `hook-${i}` ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-[13px] font-black text-white leading-snug">"{script.hook}"</p>
                      </div>

                      {/* Full script */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Full Script</p>
                          <button onClick={() => copy(script.script, `script-${i}`)} className="text-[8px] text-violet-400 hover:text-violet-300">
                            {copied === `script-${i}` ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                        <div className="bg-black/30 rounded-xl p-4 font-mono text-[11px] text-white/75 leading-relaxed whitespace-pre-wrap border border-white/[0.06]">
                          {script.script}
                        </div>
                      </div>

                      {/* Shot list + on-screen text */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-2">Shot List</p>
                          <ul className="space-y-1">
                            {script.shot_list?.map((s, j) => (
                              <li key={j} className="text-[10px] text-white/55 flex gap-2">
                                <span className="text-white/25 shrink-0">{j + 1}.</span>{s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-2">On-Screen Text</p>
                          <ul className="space-y-1">
                            {script.on_screen_text?.map((t, j) => (
                              <li key={j} className="text-[10px] text-white/55 flex gap-2">
                                <span className="text-white/25 shrink-0">▸</span>{t}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Sound + Caption */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1">Sound</p>
                          <p className="text-[10px] text-white/55">🎵 {script.suggested_sound}</p>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Caption</p>
                            <button onClick={() => copy(`${script.caption}\n\n${script.hashtags.join(' ')}`, `cap-${i}`)} className="text-[8px] text-violet-400 hover:text-violet-300">
                              {copied === `cap-${i}` ? '✓ Copied' : 'Copy'}
                            </button>
                          </div>
                          <p className="text-[10px] text-white/55 leading-snug">{script.caption}</p>
                        </div>
                      </div>

                      {/* Hashtags */}
                      <div className="flex flex-wrap gap-1.5">
                        {script.hashtags?.map((h, j) => (
                          <span key={j} className="px-2 py-0.5 rounded-full bg-white/[0.06] text-[9px] text-white/50 font-mono">{h}</span>
                        ))}
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
