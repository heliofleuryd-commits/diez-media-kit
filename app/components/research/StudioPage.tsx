'use client';

import { useState, useEffect, useRef } from 'react';

interface Script {
  rank: number; title: string; topic: string; search_signal: string;
  virality_score: number; virality_reason: string; hook: string; script: string;
  shot_list: string[]; on_screen_text: string[]; suggested_sound: string;
  caption: string; hashtags: string[];
}
interface ChatMsg { role: 'user' | 'assistant'; content: string; id: string; }
interface YTSearchItem { query: string; suggestions: string[]; }
interface TrendItem { title: string; traffic: string; }
interface NewsItem { title: string; source: string; }

// ── Chat Panel ────────────────────────────────────────────────────────────────
function ChatPanel({ context }: { context: any }) {
  const [messages, setMessages] = useState<ChatMsg[]>([{
    role: 'assistant', id: 'welcome',
    content: "I have your skills, today's signals, and everything generated this session. Ask me to rewrite a script, give you a stronger hook, suggest what to post today, or anything else.",
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: ChatMsg = { role: 'user', content: text, id: `u${Date.now()}` };
    setMessages(p => [...p, userMsg]);
    setInput(''); setLoading(true);
    try {
      const apiMessages = [...messages.filter(m => m.id !== 'welcome'), userMsg].map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/football/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, context }),
      });
      const data = await res.json();
      setMessages(p => [...p, { role: 'assistant', content: data.ok ? data.message : `Error: ${data.error}`, id: `a${Date.now()}` }]);
    } catch { setMessages(p => [...p, { role: 'assistant', content: 'Network error.', id: `e${Date.now()}` }]); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col h-full border-l border-gray-200 bg-white" style={{ width: 320 }}>
      <div className="px-4 py-3 border-b border-gray-100 shrink-0 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>AI</div>
        <div>
          <p className="text-[11px] font-black text-gray-900">Content AI</p>
          <p className="text-[8px] text-gray-400">Full project context · amend anything</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-1.5`}>
            {msg.role === 'assistant' && (
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-black text-white shrink-0 mb-0.5" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>AI</div>
            )}
            <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-violet-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-end gap-1.5">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-black text-white shrink-0" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>AI</div>
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2.5">
              <div className="flex gap-1 items-center h-3">
                {[0,150,300].map(d => <span key={d} className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay:`${d}ms` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-gray-100 p-3 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }}}
            placeholder="Rewrite script 1… stronger hook… what should I post today?…"
            rows={2}
            className="flex-1 text-[11px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder-gray-300 text-gray-800 leading-relaxed" />
          <button onClick={send} disabled={loading || !input.trim()}
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-40 shadow-sm"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
            <span className="text-white font-black text-sm" style={{ marginTop:'-1px' }}>↑</span>
          </button>
        </div>
        <p className="text-[8px] text-gray-300 mt-1.5 text-center">Enter · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

// ── Signals Sidebar ───────────────────────────────────────────────────────────
function SignalsSidebar({ signals }: { signals: any }) {
  if (!signals) return (
    <div className="flex items-center justify-center h-32">
      <p className="text-[9px] text-gray-300 animate-pulse">Fetching signals…</p>
    </div>
  );
  return (
    <div className="space-y-4 p-3">
      <div>
        <p className="text-[8px] font-bold uppercase tracking-widest text-red-500 mb-2">🔴 YouTube Searched</p>
        <div className="space-y-2">
          {signals.ytSearch?.slice(0,5).map((s: YTSearchItem, i: number) => (
            <div key={i}>
              <p className="text-[8px] text-gray-400 mb-0.5">"{s.query}"</p>
              <div className="flex flex-wrap gap-1">
                {s.suggestions.slice(0,4).map((sg, j) => (
                  <span key={j} className="text-[8px] px-1.5 py-0.5 rounded bg-red-50 text-red-500 border border-red-100">{sg}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[8px] font-bold uppercase tracking-widest text-green-600 mb-2">🟢 Google Trends · WC + US</p>
        <div className="space-y-1">
          {signals.googleTrends?.slice(0,14).map((t: any, i: number) => (
            <div key={i} className="flex items-baseline justify-between gap-1">
              <p className={`text-[9px] flex-1 leading-snug ${t.type==='football'?'text-green-700 font-semibold':t.type==='trending'?'text-gray-700':'text-gray-400'}`}>{t.title}</p>
              {t.traffic && <p className="text-[7px] text-gray-300 shrink-0">{t.traffic}</p>}
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[8px] font-bold uppercase tracking-widest text-blue-500 mb-2">🔵 WC News</p>
        <div className="space-y-1.5">
          {signals.news?.slice(0,7).map((n: NewsItem, i: number) => (
            <div key={i}>
              <p className="text-[9px] text-gray-600 leading-snug">{n.title}</p>
              <p className="text-[7px] text-gray-300">{n.source}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Studio Page ──────────────────────────────────────────────────────────
export function StudioPage() {
  const [tab, setTab] = useState<'scripts' | 'news'>('scripts');
  const [signals, setSignals] = useState<any>(null);

  const [generatingScripts, setGeneratingScripts] = useState(false);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [trendsText, setTrendsText] = useState('');
  const [trendsSummary, setTrendsSummary] = useState('');
  const [expandedScript, setExpandedScript] = useState<number | null>(0);

  const [loadingNews, setLoadingNews] = useState(false);
  const [bullets, setBullets] = useState<string[]>([]);
  const [flashDate, setFlashDate] = useState('');
  const [flashScript, setFlashScript] = useState<string | null>(null);
  const [showFlashScript, setShowFlashScript] = useState(false);
  const [generatingFlash, setGeneratingFlash] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); };

  useEffect(() => {
    fetch('/api/football/research').then(r => r.json()).then(d => { if (d.ok) setSignals(d); });
  }, []);

  const generateScripts = async () => {
    setGeneratingScripts(true); setError(null);
    try {
      const res = await fetch('/api/football/research', { method: 'POST' });
      const json = await res.json();
      if (!json.ok) { setError(json.error); return; }
      setScripts(json.data.scripts || []);
      setTrendsSummary(json.data.trends_summary || '');
      setSignals(json.trends);
      setExpandedScript(0);
      const t = json.trends;
      setTrendsText([
        t.ytSearch?.slice(0,4).map((s: YTSearchItem) => `YouTube searched: "${s.query}" → ${s.suggestions.slice(0,3).join(', ')}`).join('\n'),
        t.googleTrends?.slice(0,8).map((tr: TrendItem) => `Google Trends: ${tr.title}`).join('\n'),
        t.news?.slice(0,5).map((n: NewsItem) => `News: ${n.title}`).join('\n'),
      ].filter(Boolean).join('\n'));
    } catch (e: any) { setError(e.message); }
    finally { setGeneratingScripts(false); }
  };

  const getNews = async (withScript = false) => {
    withScript ? setGeneratingFlash(true) : setLoadingNews(true);
    setError(null);
    try {
      const res = await fetch('/api/football/news', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generateScript: withScript }),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error); return; }
      setBullets(json.bullets || []); setFlashDate(json.date || '');
      if (withScript) { setFlashScript(json.flash_script); setShowFlashScript(true); }
    } catch (e: any) { setError(e.message); }
    finally { setLoadingNews(false); setGeneratingFlash(false); }
  };

  const chatContext = { trendsText, scripts, bullets, flashScript };

  return (
    <div className="flex h-full bg-gray-50 text-gray-900 overflow-hidden">

      {/* ── SIGNALS sidebar ───────────────────────────────────────── */}
      <aside className="shrink-0 flex flex-col border-r border-gray-200 bg-white overflow-hidden" style={{ width: 210 }}>
        <div className="px-3 py-2.5 border-b border-gray-100 shrink-0">
          <p className="text-[9px] font-black tracking-widest uppercase text-gray-400">Live Signals</p>
        </div>
        <div className="flex-1 overflow-y-auto bg-white">
          <SignalsSidebar signals={signals} />
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Tab bar */}
        <div className="flex border-b border-gray-200 bg-white shrink-0">
          {(['scripts', 'news'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${tab===t ? 'border-b-2 border-violet-600 text-violet-700' : 'text-gray-400 hover:text-gray-600'}`}>
              {t === 'scripts' ? '✨ Scripts' : '⚡ Flash News'}
            </button>
          ))}
          <div className="flex-1" />
          {error && <p className="text-[9px] text-red-500 self-center pr-4">{error}</p>}
        </div>

        {/* Scripts tab */}
        {tab === 'scripts' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
              <p className="text-[10px] text-gray-400 max-w-sm truncate">
                {trendsSummary || "Generate 3 viral scripts from today's signals"}
              </p>
              <button onClick={generateScripts} disabled={generatingScripts}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[11px] font-black disabled:opacity-50 shadow-sm"
                style={{ background: generatingScripts ? '#9ca3af' : 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                {generatingScripts ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />Generating…</> : <>✨ Generate Scripts</>}
              </button>
            </div>
            {scripts.length === 0 && !generatingScripts ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
                <div className="text-4xl">🎬</div>
                <p className="text-gray-400 text-xs max-w-xs leading-relaxed">Opus reads today's YouTube searches, Google Trends, and your 120-video skill library to produce 3 World Cup scripts.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
                {scripts.map((s, i) => {
                  const open = expandedScript === i;
                  return (
                    <div key={i} className={`rounded-2xl border transition-all bg-white ${open ? 'border-violet-300 shadow-md shadow-violet-100' : 'border-gray-200 hover:border-gray-300 shadow-sm'}`}>
                      <button className="w-full flex items-center gap-3 px-4 py-3.5 text-left" onClick={() => setExpandedScript(open ? null : i)}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${i===0?'bg-violet-600 text-white':i===1?'bg-indigo-500 text-white':'bg-gray-200 text-gray-600'}`}>#{i+1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-black text-gray-900 truncate">{s.title}</p>
                          <p className="text-[9px] text-gray-400 truncate">{s.search_signal}</p>
                        </div>
                        <div className="text-right shrink-0 mr-1">
                          <p className="text-[11px] font-black text-violet-600">{s.virality_score}/100</p>
                          <p className="text-[8px] text-gray-300">virality</p>
                        </div>
                        <span className="text-gray-300">{open?'▲':'▼'}</span>
                      </button>
                      {open && (
                        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                          <p className="text-[10px] text-violet-500 italic">{s.virality_reason}</p>
                          <div>
                            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">Hook</p>
                            <p className="text-[14px] font-black text-gray-900 leading-snug">"{s.hook}"</p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Script</p>
                              <button onClick={() => copy(s.script,`s${i}`)} className="text-[8px] text-violet-500 font-semibold">{copied===`s${i}`?'✓ Copied':'Copy'}</button>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3 text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap border border-gray-200">{s.script}</div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">Shot List</p>
                              {s.shot_list?.map((sh,j)=><p key={j} className="text-[10px] text-gray-500">{j+1}. {sh}</p>)}
                            </div>
                            <div>
                              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">On-Screen Text</p>
                              {s.on_screen_text?.map((t,j)=><p key={j} className="text-[10px] text-gray-500">▸ {t}</p>)}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Caption + Hashtags</p>
                              <button onClick={() => copy(`${s.caption}\n\n${s.hashtags?.join(' ')}`,`cap${i}`)} className="text-[8px] text-violet-500 font-semibold">{copied===`cap${i}`?'✓ Copied':'Copy'}</button>
                            </div>
                            <p className="text-[10px] text-gray-600">{s.caption}</p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {s.hashtags?.map((h,j)=><span key={j} className="px-2 py-0.5 rounded-full bg-gray-100 text-[8px] text-gray-500 border border-gray-200">{h}</span>)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* News tab */}
        {tab === 'news' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
              <p className="text-[10px] text-gray-400">
                {flashDate ? `World Cup Flash News — ${flashDate}` : 'Every score, injury and talking point from the last 24 hours'}
              </p>
              <button onClick={() => getNews(false)} disabled={loadingNews || generatingFlash}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[11px] font-black disabled:opacity-50 shadow-sm"
                style={{ background: loadingNews ? '#9ca3af' : 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                {loadingNews ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />Scanning…</> : <>⚡ Get Flash News</>}
              </button>
            </div>
            {bullets.length === 0 && !loadingNews ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                <div className="text-4xl">📰</div>
                <p className="text-gray-400 text-xs max-w-xs leading-relaxed">20 bullets covering every score, injury, controversy, and group standing from the last 24 hours.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                <div className="max-w-2xl">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[8px] font-bold uppercase tracking-widest text-gray-400">{bullets.length} stories</p>
                    <button onClick={() => copy(bullets.map((b,i)=>`${i+1}. ${b}`).join('\n'),'all')} className="text-[8px] text-violet-500 font-semibold">{copied==='all'?'✓ Copied':'Copy all'}</button>
                  </div>
                  <div className="space-y-1.5 mb-5">
                    {bullets.map((b, i) => (
                      <div key={i} className="flex gap-2.5 items-start group p-3 rounded-xl bg-white border border-gray-100 hover:border-gray-200 transition-colors">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-red-100 text-red-600 text-[8px] font-black flex items-center justify-center mt-0.5">{i+1}</span>
                        <p className="text-[11px] text-gray-700 leading-relaxed flex-1">{b}</p>
                        <button onClick={() => copy(b,`b${i}`)} className="shrink-0 opacity-0 group-hover:opacity-100 text-[8px] text-violet-500 transition-opacity">{copied===`b${i}`?'✓':'Copy'}</button>
                      </div>
                    ))}
                  </div>
                  <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                    <button onClick={flashScript ? () => setShowFlashScript(s=>!s) : () => getNews(true)} disabled={generatingFlash}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span>🎙</span>
                        <div className="text-left">
                          <p className="text-[11px] font-black text-gray-900">{flashScript ? `World Cup Flash News — ${flashDate}` : 'Generate Flash News Script'}</p>
                          <p className="text-[9px] text-gray-400 mt-0.5">60–90 sec · straight to camera · clean script</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {generatingFlash && <span className="animate-spin inline-block w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full" />}
                        {!flashScript && !generatingFlash && <span className="text-[10px] px-3 py-1 rounded-full text-white font-bold shadow-sm" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>Generate</span>}
                        {flashScript && <span className="text-gray-400">{showFlashScript?'▲':'▼'}</span>}
                      </div>
                    </button>
                    {showFlashScript && flashScript && (
                      <div className="border-t border-gray-100 p-4">
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-[8px] font-bold uppercase tracking-widest text-gray-400">Read straight to camera</p>
                          <button onClick={() => copy(flashScript,'fs')} className="text-[9px] text-violet-500 font-semibold">{copied==='fs'?'✓ Copied':'Copy'}</button>
                        </div>
                        <p className="text-[13px] text-gray-800 leading-[1.9] whitespace-pre-wrap font-medium">{flashScript}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CHAT ─────────────────────────────────────────────────── */}
      <ChatPanel context={chatContext} />
    </div>
  );
}
