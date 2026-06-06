'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getDailySpend, addSpend, formatCost } from '@/lib/football/costTracker';
import { ScriptChat } from './ScriptChat';

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
function ChatPanel({ context, onCost }: { context: any; onCost: (c: number) => void }) {
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
      if (data.cost) onCost(data.cost);
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
        <p className="text-[8px] font-bold uppercase tracking-widest text-pink-500 mb-2">🩷 TikTok · Trending</p>
        {signals.tiktok?.hashtags?.length > 0 ? (
          <div className="space-y-1">
            {signals.tiktok.hashtags.map((h: any, i: number) => (
              <div key={i} className="flex items-baseline justify-between gap-1">
                <p className="text-[10px] font-semibold text-pink-600">{h.tag}</p>
                {h.views && <p className="text-[7px] text-gray-300">{h.views}</p>}
              </div>
            ))}
            {signals.tiktok.videos?.slice(0,3).map((v: any, i: number) => (
              <p key={i} className="text-[9px] text-gray-500 leading-snug mt-1 truncate">{v.desc}</p>
            ))}
          </div>
        ) : (
          <p className="text-[9px] text-gray-300 italic">{signals.tiktok?.note || 'Loading…'}</p>
        )}
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
  const [tab, setTab] = useState<'scripts' | 'news' | 'studio'>('scripts');

  // ── Style selector ───────────────────────────────────────────────────────────
  const STYLE_GROUPS = {
    analytical: [
      { id: 'pechefootball', label: 'peche' },
      { id: 'fiagoball',     label: 'fiago' },
      { id: '5.at.the.back', label: '5atb'  },
      { id: 'joeham.1',      label: 'joeham' },
      { id: 'matchday.fc',   label: 'matchday' },
    ],
    emotional: [
      { id: 'toqueymedio', label: 'toqueymedio' },
    ],
  };
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(
    new Set(['pechefootball', 'fiagoball', '5.at.the.back'])
  );
  const toggleStyle = (id: string) =>
    setSelectedStyles(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [signals, setSignals] = useState<any>(null);
  const [signalsAge, setSignalsAge] = useState<string>('');
  const [refreshingSignals, setRefreshingSignals] = useState(false);

  // 3-step script workflow
  type ScriptStep = 'idle' | 'researching' | 'pick' | 'generating' | 'done';
  const [scriptStep, setScriptStep] = useState<ScriptStep>('idle');
  const [topics, setTopics] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [trendsSummary, setTrendsSummary] = useState('');
  const [scripts, setScripts] = useState<Script[]>([]);
  const [expandedScript, setExpandedScript] = useState<number | null>(0);
  const [trendsText, setTrendsText] = useState('');

  const [loadingNews, setLoadingNews] = useState(false);
  const [bullets, setBullets] = useState<string[]>([]);
  const [selectedBullets, setSelectedBullets] = useState<Set<number>>(new Set());
  const [flashDate, setFlashDate] = useState('');
  const [flashScript, setFlashScript] = useState<string | null>(null);
  const [showFlashScript, setShowFlashScript] = useState(false);
  const [generatingFlash, setGeneratingFlash] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [dailySpend, setDailySpend] = useState(0);
  const [spendAlert, setSpendAlert] = useState<{ message: string; onConfirm: () => void } | null>(null);

  useEffect(() => { setDailySpend(getDailySpend()); }, []);

  const trackCost = useCallback((cost: number) => {
    if (!cost) return;
    const total = addSpend(cost);
    setDailySpend(total);
    if (total > 2.00) setSpendAlert(null);
  }, []);

  const guardSpend = useCallback((estimatedCost: number, onConfirm: () => void) => {
    if (getDailySpend() + estimatedCost > 2.00) {
      setSpendAlert({
        message: `Daily spend is ${formatCost(getDailySpend())} — this will push it over $2.00. Continue?`,
        onConfirm: () => { setSpendAlert(null); onConfirm(); },
      });
    } else {
      onConfirm();
    }
  }, []);

  const copy = (text: string, key: string) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); };

  const CACHE_KEY = 'diez_signals_cache';
  const CACHE_TTL = 48 * 60 * 60 * 1000; // 48h — conserves TokAPI World Cup quota
  const todayKey = () => new Date().toISOString().slice(0, 10);

  const formatAge = (ts: number) => {
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  const loadSignals = async (force = false) => {
    if (!force) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL) {
            setSignals(data);
            setSignalsAge(formatAge(ts));
            return;
          }
        }
      } catch { /* ignore */ }
    }
    setRefreshingSignals(true);
    try {
      const res = await fetch('/api/football/research');
      const d = await res.json();
      if (d.ok) {
        setSignals(d);
        const ts = Date.now();
        setSignalsAge(formatAge(ts));
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: d, ts }));
      }
    } catch { /* ignore */ }
    finally { setRefreshingSignals(false); }
  };

  useEffect(() => { loadSignals(); }, []);

  const researchTopics = (force = false) => guardSpend(0.02, () => _researchTopics(force));
  const _researchTopics = async (force = false) => {
    setScriptStep('researching'); setError(null); setSelectedIds(new Set()); setScripts([]);

    const cacheKey = `diez_topics_${todayKey()}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { topics: ct, summary, trendsText: tt } = JSON.parse(cached);
        setTopics(ct); setTrendsSummary(summary); setTrendsText(tt);
        setScriptStep('pick');
        return;
      }
    } catch { /* ignore */ }

    try {
      const res = await fetch('/api/football/research', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'topics' }),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error); setScriptStep('idle'); return; }
      trackCost(json.cost || 0);
      const newTopics = json.data.topics || [];
      const summary = json.data.trends_summary || '';
      const t = json.trends;
      const tt = [
        t.ytSearch?.slice(0,4).map((s: YTSearchItem) => `YouTube: "${s.query}" → ${s.suggestions.slice(0,3).join(', ')}`).join('\n'),
        t.googleTrends?.slice(0,6).map((tr: TrendItem) => `Trends: ${tr.title}`).join('\n'),
        t.news?.slice(0,4).map((n: NewsItem) => `News: ${n.title}`).join('\n'),
      ].filter(Boolean).join('\n');

      setTopics(newTopics); setTrendsSummary(summary); setSignals(t); setTrendsText(tt);
      try { localStorage.setItem(cacheKey, JSON.stringify({ topics: newTopics, summary, trendsText: tt })); } catch { /* ignore */ }
      setScriptStep('pick');
    } catch (e: any) { setError(e.message); setScriptStep('idle'); }
  };

  const toggleTopic = (id: number) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const generateScripts = () => guardSpend(selectedIds.size * 0.12, _generateScripts);
  const _generateScripts = async () => {
    const selected = topics.filter(t => selectedIds.has(t.id));
    if (!selected.length) return;

    const scriptCacheKey = `diez_scripts_${todayKey()}_${[...selectedIds].sort().join('_')}`;
    try {
      const cached = localStorage.getItem(scriptCacheKey);
      if (cached) {
        setScripts(JSON.parse(cached));
        setExpandedScript(0);
        setScriptStep('done');
        return;
      }
    } catch { /* ignore */ }

    setScriptStep('generating'); setError(null);
    try {
      const res = await fetch('/api/football/research', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'scripts', topics: selected, styles: [...selectedStyles] }),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error); setScriptStep('pick'); return; }
      trackCost(json.cost || 0);
      const newScripts = json.data.scripts || [];
      setScripts(newScripts);
      setExpandedScript(0);
      setScriptStep('done');
      try { localStorage.setItem(scriptCacheKey, JSON.stringify(newScripts)); } catch { /* ignore */ }
    } catch (e: any) { setError(e.message); setScriptStep('pick'); }
  };

  const getNews = async () => {
    setLoadingNews(true); setError(null);
    try {
      const res = await fetch('/api/football/news', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generateScript: false }),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error); return; }
      trackCost(json.cost || 0);
      setBullets(json.bullets || []);
      setSelectedBullets(new Set());
      setFlashDate(json.date || '');
      setFlashScript(null); setShowFlashScript(false);
    } catch (e: any) { setError(e.message); }
    finally { setLoadingNews(false); }
  };

  const generateFlashFromSelected = async () => {
    const chosen = bullets.filter((_, i) => selectedBullets.has(i));
    if (!chosen.length) return;
    setGeneratingFlash(true); setError(null);
    try {
      const res = await fetch('/api/football/news', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generateScript: true, selectedBullets: chosen, date: flashDate }),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error); return; }
      trackCost(json.cost || 0);
      setFlashScript(json.flash_script);
      setShowFlashScript(true);
    } catch (e: any) { setError(e.message); }
    finally { setGeneratingFlash(false); }
  };

  const chatContext = { trendsText, scripts, bullets, flashScript };

  return (
    <div className="flex flex-col h-full bg-gray-50 text-gray-900 overflow-hidden">

      {/* ── TAB BAR (always visible) ──────────────────────────────── */}
      <div className="flex border-b border-gray-200 bg-white shrink-0">
        <button onClick={() => setTab('scripts')}
          className={`px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${tab==='scripts' ? 'border-b-2 border-violet-600 text-violet-700' : 'text-gray-400 hover:text-gray-600'}`}>
          ✨ Scripts
        </button>
        <button onClick={() => setTab('news')}
          className={`px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${tab==='news' ? 'border-b-2 border-violet-600 text-violet-700' : 'text-gray-400 hover:text-gray-600'}`}>
          ⚡ Flash News
        </button>
        <button onClick={() => setTab('studio')}
          className={`px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${tab==='studio' ? 'border-b-2 border-violet-600 text-violet-700' : 'text-gray-400 hover:text-gray-600'}`}>
          ✦ Studio
        </button>
        <div className="flex-1" />
        {error && tab !== 'studio' && <p className="text-[9px] text-red-500 self-center pr-4 truncate max-w-xs">{error}</p>}
        <div className={`self-center pr-4 text-[9px] font-mono font-bold ${dailySpend >= 1.80 ? 'text-orange-500' : 'text-gray-300'}`}>
          {formatCost(dailySpend)}<span className="font-normal text-gray-300">/day</span>
        </div>
      </div>

      {/* ── STUDIO ───────────────────────────────────────────────── */}
      {tab === 'studio' && (
        <div className="flex-1 overflow-hidden">
          <ScriptChat onCost={trackCost} />
        </div>
      )}

      {/* ── SCRIPTS + NEWS (3-panel layout) ──────────────────────── */}
      {tab !== 'studio' && (
        <div className="flex flex-1 overflow-hidden">

          {/* ── SIGNALS sidebar ─────────────────────────────────── */}
          <aside className="shrink-0 flex flex-col border-r border-gray-200 bg-white overflow-hidden" style={{ width: 210 }}>
            <div className="px-3 py-2.5 border-b border-gray-100 shrink-0 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black tracking-widest uppercase text-gray-400">Live Signals</p>
                {signalsAge && <p className="text-[7px] text-gray-300 mt-0.5">{signalsAge}</p>}
              </div>
              <button
                onClick={() => loadSignals(true)}
                disabled={refreshingSignals}
                title="Refresh signals"
                className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-40"
              >
                <span className={`text-[11px] ${refreshingSignals ? 'animate-spin inline-block' : ''}`}>↺</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-white">
              <SignalsSidebar signals={signals} />
            </div>
          </aside>

          {/* ── MAIN ──────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* Scripts tab — 3-step workflow */}
            {tab === 'scripts' && (
              <div className="flex-1 flex flex-col overflow-hidden">

                {/* Step indicator bar */}
                <div className="px-5 py-2.5 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    {[['1','Research','idle researching'],['2','Pick Topics','pick'],['3','Scripts','generating done']].map(([num, label, states], i) => {
                      const active = states.split(' ').some(s => s === scriptStep);
                      const done = (i===0 && ['pick','generating','done'].includes(scriptStep)) || (i===1 && ['generating','done'].includes(scriptStep)) || (i===2 && scriptStep==='done');
                      return (
                        <div key={num} className="flex items-center gap-1.5">
                          {i > 0 && <span className="text-gray-300 text-[10px]">›</span>}
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black transition-all ${done ? 'bg-violet-100 text-violet-700' : active ? 'bg-violet-600 text-white' : 'text-gray-300'}`}>
                            <span>{done ? '✓' : num}</span>
                            <span>{label}</span>
                          </div>
                        </div>
                      );
                    })}
                    {trendsSummary && <p className="text-[9px] text-gray-400 ml-2 max-w-xs truncate hidden xl:block">{trendsSummary}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {scriptStep === 'idle' && (
                      <button onClick={researchTopics}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[11px] font-black shadow-sm"
                        style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                        🔍 Research Today's Topics
                      </button>
                    )}
                    {scriptStep === 'researching' && (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-[11px] text-gray-500 font-semibold">
                        <span className="animate-spin inline-block w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full" />
                        Researching signals…
                      </div>
                    )}
                    {scriptStep === 'pick' && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => {
                            try { localStorage.removeItem(`diez_topics_${todayKey()}`); } catch { /* ignore */ }
                            setScriptStep('idle'); setTopics([]); setSelectedIds(new Set());
                          }}
                          className="text-[9px] text-gray-400 hover:text-gray-600 font-semibold px-2 py-1">
                          ↺ Fresh research
                        </button>
                        <button onClick={generateScripts} disabled={selectedIds.size === 0 || selectedStyles.size === 0}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[11px] font-black disabled:opacity-40 shadow-sm"
                          style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                          ✨ Generate {selectedIds.size > 0 ? selectedIds.size : ''} Script{selectedIds.size !== 1 ? 's' : ''}
                        </button>
                      </div>
                    )}
                    {scriptStep === 'generating' && (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-[11px] text-gray-500 font-semibold">
                        <span className="animate-spin inline-block w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full" />
                        Writing scripts…
                      </div>
                    )}
                    {scriptStep === 'done' && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => setScriptStep('pick')}
                          className="text-[9px] text-violet-500 hover:text-violet-700 font-semibold px-2 py-1">
                          ← Back to topics
                        </button>
                        <button onClick={researchTopics}
                          className="text-[9px] text-gray-400 hover:text-gray-600 font-semibold px-2 py-1">
                          ↺ Fresh research
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Style selector — visible once research is loaded */}
                {scriptStep !== 'idle' && scriptStep !== 'researching' && (
                  <div className="px-5 py-2 border-b border-gray-100 bg-white flex items-center gap-2.5 shrink-0 flex-wrap">
                    <p className="text-[7px] font-black uppercase tracking-widest text-gray-300 shrink-0">Style</p>

                    {/* Analytical group */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[7px] font-bold uppercase tracking-wider text-gray-300 mr-0.5">Analytical</span>
                      {STYLE_GROUPS.analytical.map(s => (
                        <button key={s.id} onClick={() => toggleStyle(s.id)}
                          className={`px-2 py-0.5 rounded-full text-[8px] font-bold transition-all border ${
                            selectedStyles.has(s.id)
                              ? 'bg-violet-600 text-white border-violet-600'
                              : 'bg-white text-gray-400 border-gray-200 hover:border-violet-300 hover:text-violet-500'
                          }`}>
                          {s.label}
                        </button>
                      ))}
                    </div>

                    <span className="text-gray-200 text-[10px]">|</span>

                    {/* Emotional group */}
                    <div className="flex items-center gap-1">
                      <span className="text-[7px] font-bold uppercase tracking-wider text-gray-300 mr-0.5">Emotional</span>
                      {STYLE_GROUPS.emotional.map(s => (
                        <button key={s.id} onClick={() => toggleStyle(s.id)}
                          className={`px-2.5 py-0.5 rounded-full text-[8px] font-bold transition-all border ${
                            selectedStyles.has(s.id)
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'bg-white text-gray-400 border-gray-200 hover:border-amber-300 hover:text-amber-500'
                          }`}>
                          {s.label}
                        </button>
                      ))}
                    </div>

                    {selectedStyles.size === 0 && (
                      <span className="text-[8px] text-red-400 font-semibold">Pick at least one style</span>
                    )}
                  </div>
                )}

                {/* Step 1: idle */}
                {scriptStep === 'idle' && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
                    <div className="text-5xl">🔍</div>
                    <div>
                      <p className="text-gray-700 text-sm font-black">Start with deep research</p>
                      <p className="text-gray-400 text-xs mt-1.5 max-w-sm leading-relaxed">
                        Opus scans YouTube search trends, Google Trends, TikTok, and news — then gives you 10 ranked topic ideas. You pick which ones to script.
                      </p>
                    </div>
                    <button onClick={researchTopics}
                      className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white text-sm font-black shadow-md mt-2"
                      style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                      🔍 Research Today's Topics
                    </button>
                  </div>
                )}

                {/* Step 2: pick topics */}
                {scriptStep === 'pick' && (
                  <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">
                        10 topics ranked by virality — click to select, then hit Generate
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => setSelectedIds(new Set(topics.map(t=>t.id)))} className="text-[8px] text-violet-500 font-semibold">Select all</button>
                        <button onClick={() => setSelectedIds(new Set())} className="text-[8px] text-gray-400 font-semibold">Clear</button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {topics.map((t, i) => {
                        const sel = selectedIds.has(t.id);
                        return (
                          <button key={t.id} onClick={() => toggleTopic(t.id)}
                            className={`w-full text-left rounded-2xl border p-4 transition-all ${sel ? 'border-violet-400 bg-violet-50 shadow-md shadow-violet-100' : 'border-gray-200 bg-white hover:border-violet-200 shadow-sm'}`}>
                            <div className="flex items-start gap-3">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 transition-all ${sel ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                {sel ? '✓' : i+1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className={`text-[12px] font-black leading-tight ${sel ? 'text-violet-900' : 'text-gray-900'}`}>{t.title}</p>
                                  <span className={`text-[10px] font-black shrink-0 ${t.virality_score >= 90 ? 'text-green-600' : t.virality_score >= 75 ? 'text-violet-600' : 'text-gray-400'}`}>{t.virality_score}/100</span>
                                </div>
                                <p className="text-[10px] text-gray-600 mt-1 leading-snug">{t.angle}</p>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <span className="text-[8px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">{t.format}</span>
                                  <span className="text-[8px] text-gray-400">{t.platform_signal}</span>
                                </div>
                                {t.Spain_Yamal_angle && (
                                  <p className="text-[9px] text-red-500 mt-1.5">🇪🇸 {t.Spain_Yamal_angle}</p>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Step 2.5: generating */}
                {scriptStep === 'generating' && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
                    <span className="animate-spin inline-block w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full" />
                    <div>
                      <p className="text-gray-700 text-sm font-black">Writing {selectedIds.size} script{selectedIds.size!==1?'s':''}…</p>
                      <p className="text-gray-400 text-xs mt-1">Using all 21 skill files + today's signals. This takes ~30 seconds.</p>
                    </div>
                  </div>
                )}

                {/* Step 3: scripts */}
                {scriptStep === 'done' && (
                  <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
                    {scripts.map((s: any, i) => {
                      const open = expandedScript === i;
                      return (
                        <div key={i} className={`rounded-2xl border transition-all bg-white ${open ? 'border-violet-300 shadow-md shadow-violet-100' : 'border-gray-200 hover:border-gray-300 shadow-sm'}`}>
                          <button className="w-full flex items-center gap-3 px-4 py-3.5 text-left" onClick={() => setExpandedScript(open ? null : i)}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${i===0?'bg-violet-600 text-white':i===1?'bg-indigo-500 text-white':i===2?'bg-blue-500 text-white':'bg-gray-200 text-gray-600'}`}>#{i+1}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-black text-gray-900 truncate">{s.title}</p>
                              <p className="text-[9px] text-gray-400 mt-0.5 truncate">"{s.hook}"</p>
                            </div>
                            <div className="text-right shrink-0 mr-1">
                              <p className="text-[11px] font-black text-violet-600">{s.virality_score}/100</p>
                            </div>
                            <span className="text-gray-300">{open?'▲':'▼'}</span>
                          </button>
                          {open && (
                            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                              <div>
                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">Hook</p>
                                <p className="text-[14px] font-black text-gray-900 leading-snug">"{s.hook}"</p>
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Script</p>
                                  <button onClick={() => copy(s.script,`s${i}`)} className="text-[8px] text-violet-500 font-semibold">{copied===`s${i}`?'✓ Copied':'Copy'}</button>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4 text-[12px] text-gray-800 leading-relaxed whitespace-pre-wrap border border-gray-200">{s.script}</div>
                              </div>
                              {s.on_screen_text?.length > 0 && (
                                <div>
                                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">On-Screen Text</p>
                                  {s.on_screen_text.map((t: string, j: number) => <p key={j} className="text-[10px] text-gray-500">▸ {t}</p>)}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Caption + Hashtags</p>
                                  <button onClick={() => copy(`${s.caption}\n\n${s.hashtags?.join(' ')}`,`cap${i}`)} className="text-[8px] text-violet-500 font-semibold">{copied===`cap${i}`?'✓ Copied':'Copy'}</button>
                                </div>
                                <p className="text-[10px] text-gray-600">{s.caption}</p>
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {s.hashtags?.map((h: string, j: number) => <span key={j} className="px-2 py-0.5 rounded-full bg-gray-100 text-[8px] text-gray-500 border border-gray-200">{h}</span>)}
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
                  <div>
                    <p className="text-[10px] text-gray-400">
                      {flashDate ? `World Cup Flash News — ${flashDate}` : 'Every score, injury and talking point from the last 24 hours'}
                    </p>
                    {bullets.length > 0 && (
                      <p className="text-[9px] text-gray-300 mt-0.5">Select stories → Generate script</p>
                    )}
                  </div>
                  <button onClick={getNews} disabled={loadingNews}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[11px] font-black disabled:opacity-50 shadow-sm"
                    style={{ background: loadingNews ? '#9ca3af' : 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                    {loadingNews ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />Scanning…</> : <>⚡ Get Flash News</>}
                  </button>
                </div>

                {bullets.length === 0 && !loadingNews ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                    <div className="text-4xl">📰</div>
                    <p className="text-gray-400 text-xs max-w-xs leading-relaxed">20 bullets ranked by importance — scores, injuries, controversies, group standings. Select the ones you want, then generate a Flash News script.</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                    <div className="max-w-2xl">

                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <p className="text-[8px] font-bold uppercase tracking-widest text-gray-400">{bullets.length} stories</p>
                          {selectedBullets.size > 0 && (
                            <span className="text-[8px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                              {selectedBullets.size} selected
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setSelectedBullets(new Set(bullets.map((_,i)=>i)))} className="text-[8px] text-violet-500 font-semibold">Select all</button>
                          <span className="text-gray-200">·</span>
                          <button onClick={() => setSelectedBullets(new Set())} className="text-[8px] text-gray-400 font-semibold">Clear</button>
                          <span className="text-gray-200">·</span>
                          <button onClick={() => copy(bullets.map((b,i)=>`${i+1}. ${b}`).join('\n'),'all')} className="text-[8px] text-gray-400 font-semibold">{copied==='all'?'✓ Copied':'Copy all'}</button>
                        </div>
                      </div>

                      <div className="space-y-1.5 mb-4">
                        {bullets.map((b, i) => {
                          const sel = selectedBullets.has(i);
                          return (
                            <button key={i} onClick={() => setSelectedBullets(prev => { const n = new Set(prev); sel ? n.delete(i) : n.add(i); return n; })}
                              className={`w-full flex gap-2.5 items-start p-3 rounded-xl border text-left transition-all ${sel ? 'bg-violet-50 border-violet-300 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                              <span className={`shrink-0 w-5 h-5 rounded-full text-[8px] font-black flex items-center justify-center mt-0.5 transition-all ${sel ? 'bg-violet-600 text-white' : 'bg-red-100 text-red-600'}`}>
                                {sel ? '✓' : i+1}
                              </span>
                              <p className={`text-[11px] leading-relaxed flex-1 ${sel ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>{b}</p>
                            </button>
                          );
                        })}
                      </div>

                      <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                        <div className="px-4 py-3.5 flex items-center justify-between border-b border-gray-100">
                          <div className="flex items-center gap-3">
                            <span>🎙</span>
                            <div>
                              <p className="text-[11px] font-black text-gray-900">
                                {flashScript ? `World Cup Flash News — ${flashDate}` : 'World Cup Flash News Script'}
                              </p>
                              <p className="text-[9px] text-gray-400 mt-0.5">
                                {selectedBullets.size === 0
                                  ? 'Select stories above then generate'
                                  : `${selectedBullets.size} stories selected · straight to camera · facts only`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {generatingFlash && <span className="animate-spin inline-block w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full" />}
                            {!generatingFlash && selectedBullets.size > 0 && (
                              <button onClick={() => flashScript ? setShowFlashScript(s=>!s) : generateFlashFromSelected()}
                                className="text-[10px] px-3 py-1.5 rounded-xl text-white font-black shadow-sm"
                                style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                                {flashScript ? (showFlashScript ? 'Hide' : 'Show') : `Generate for ${selectedBullets.size}`}
                              </button>
                            )}
                            {!generatingFlash && flashScript && selectedBullets.size > 0 && (
                              <button onClick={generateFlashFromSelected} className="text-[9px] text-gray-400 hover:text-gray-600 font-semibold">↺ Redo</button>
                            )}
                          </div>
                        </div>
                        {showFlashScript && flashScript && (
                          <div className="p-4">
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

          {/* ── CHAT ──────────────────────────────────────────────── */}
          <ChatPanel context={chatContext} onCost={trackCost} />
        </div>
      )}

      {/* ── SPEND ALERT MODAL ────────────────────────────────────── */}
      {spendAlert && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full border border-orange-200">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-sm font-black text-gray-900">Daily limit reached</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{spendAlert.message}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setSpendAlert(null)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-[11px] font-bold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={spendAlert.onConfirm}
                className="flex-1 py-2 rounded-xl text-[11px] font-black text-white"
                style={{ background: 'linear-gradient(135deg,#f97316,#dc2626)' }}>
                Continue anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
