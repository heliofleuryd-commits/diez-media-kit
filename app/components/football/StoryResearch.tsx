'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
interface ChatMsg { role: 'user' | 'assistant'; content: string }

const RELEVANCE_STYLE: Record<string, string> = {
  HOT: 'bg-red-100 text-red-700 border-red-200',
  WARM: 'bg-amber-100 text-amber-700 border-amber-200',
  EVERGREEN: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

// ---- Script Writer Chat ----

const PASS_LABELS = ['Writing…', 'Drafting in Studio (toqueymedio only)…', 'Applying your viral style — hook, flow, length…'];

// Renders the script as clean spoken lines; trailing **Hook:/Caption:/Hashtags:**
// become small grey labels. No literal asterisks, no bold in the body.
function ScriptText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
          return <p key={i} className="font-bold text-gray-500 text-[9px] uppercase tracking-widest mt-2.5">{line.slice(2, -2).replace(/:$/, '')}</p>;
        }
        if (line.trim() === '') return <div key={i} className="h-1.5" />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className="text-[11px] text-gray-800 leading-[1.6]">
            {parts.map((p, j) => p.startsWith('**') && p.endsWith('**')
              ? <span key={j} className="font-semibold text-gray-900">{p.slice(2, -2)}</span>
              : p)}
          </p>
        );
      })}
    </div>
  );
}

function ScriptWriter({ story, onBack }: { story: Story; onBack: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scriptCost, setScriptCost] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(Math.max(el.scrollHeight, 96), Math.floor(window.innerHeight * 0.5)) + 'px';
  }, [input]);

  async function callStage(payload: any) {
    const res = await fetch('/api/football/stories/script', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { ok: false, error: `Server returned invalid response (${res.status})` }; }
  }

  function track(c?: number) { if (c) { setScriptCost(x => x + c); addSpend(c); } }

  // First generation: Studio-toqueymedio draft → viral elevation
  async function generateScript() {
    setMessages([{ role: 'user', content: `Write the script for "${story.title}"` }]);
    setGenerating(true);
    try {
      setProgress(1);
      const draftRes = await callStage({ stage: 'draft', story });
      if (!draftRes.ok) throw new Error(draftRes.error || 'Draft failed');
      track(draftRes.cost);

      setProgress(2);
      const viralRes = await callStage({ stage: 'viral', draft: draftRes.message });
      if (!viralRes.ok) throw new Error(viralRes.error || 'Viral pass failed');
      track(viralRes.cost);

      setMessages(m => [...m, { role: 'assistant', content: viralRes.message }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: `Error: ${e instanceof Error ? e.message : 'Network error'}` }]);
    } finally { setGenerating(false); setProgress(0); }
  }

  // Follow-up refinement
  async function refine(userText: string) {
    const newMsgs: ChatMsg[] = [...messages, { role: 'user', content: userText }];
    setMessages(newMsgs);
    setInput('');
    setGenerating(true);
    try {
      const data = await callStage({ stage: 'chat', messages: newMsgs.map(m => ({ role: m.role, content: m.content })) });
      if (!data.ok) throw new Error(data.error || 'Failed');
      track(data.cost);
      setMessages([...newMsgs, { role: 'assistant', content: data.message }]);
    } catch (e) {
      setMessages([...newMsgs, { role: 'assistant', content: `Error: ${e instanceof Error ? e.message : 'Network error'}` }]);
    } finally { setGenerating(false); }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, generating, progress]);

  // Auto-generate on mount
  useEffect(() => {
    generateScript();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || generating) return;
    refine(input.trim());
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="shrink-0 border-b border-gray-100 px-5 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-gray-700 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${RELEVANCE_STYLE[story.relevance] || RELEVANCE_STYLE.EVERGREEN}`}>
                {story.relevance}
              </span>
              <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${story.type === 'personal' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                {story.type}
              </span>
            </div>
            <h2 className="font-bold text-[13px] text-gray-900 mt-1 leading-tight truncate">{story.title}</h2>
          </div>
          {scriptCost > 0 && (
            <span className="text-[10px] text-gray-300 font-mono shrink-0">{formatCost(scriptCost)}</span>
          )}
        </div>
      </div>

      {/* Story context (collapsible) */}
      <StoryContext story={story} />

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
            {msg.role === 'user' ? (
              <div className="bg-violet-50 rounded-xl px-3.5 py-2.5 max-w-[85%]">
                <p className="text-[12px] text-violet-900 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl px-4 py-3 max-w-full">
                <ScriptText text={msg.content} />
              </div>
            )}
          </div>
        ))}

        {generating && (
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-[11px] text-gray-400">{PASS_LABELS[progress] || 'Writing…'}</span>
            </div>
            {progress > 0 && (
              <div className="flex gap-1 mt-2">
                {[1, 2].map(n => (
                  <div key={n} className={`h-1 rounded-full transition-all ${n <= progress ? 'bg-violet-500' : 'bg-gray-200'}`} style={{ width: 28 }} />
                ))}
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="shrink-0 border-t border-gray-100 px-5 py-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any); } }}
            placeholder="Adjust the script... (e.g. 'make the hook darker', 'add more minute markers', 'shorter version')"
            disabled={generating}
            rows={3}
            className="flex-1 text-[12px] px-3.5 py-2.5 rounded-xl border border-gray-200 resize-none focus:outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-200 disabled:opacity-40 placeholder:text-gray-300 leading-relaxed"
            style={{ minHeight: 96, maxHeight: '50vh' }}
          />
          <button
            type="submit"
            disabled={generating || !input.trim()}
            className="px-4 py-2.5 rounded-xl text-[11px] font-bold text-white disabled:opacity-30 shrink-0"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function StoryContext({ story }: { story: Story }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="shrink-0 border-b border-gray-100">
      <button onClick={() => setOpen(o => !o)} className="w-full text-left px-5 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Story Context</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-300" style={{ transform: open ? 'rotate(180deg)' : '' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-3 space-y-2">
          <p className="text-[11px] text-gray-500 italic">"{story.headline}"</p>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-0.5">Key Facts</p>
            <ul className="space-y-0.5">
              {story.key_facts.map((f, i) => (
                <li key={i} className="text-[10.5px] text-gray-500 flex gap-1"><span className="text-gray-300">•</span>{f}</li>
              ))}
            </ul>
          </div>
          <p className="text-[10.5px] text-gray-500"><span className="text-gray-300 font-bold">Arc:</span> {story.emotional_arc}</p>
          <p className="text-[10.5px] text-gray-500"><span className="text-gray-300 font-bold">Angle:</span> {story.script_angle}</p>
        </div>
      )}
    </div>
  );
}

// ---- Story Card ----

function StoryCard({ story, onWriteScript }: { story: Story; onWriteScript: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <span className="text-[11px] font-black text-gray-300 mt-0.5 shrink-0">#{story.rank}</span>
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
            <p className="text-[11px] text-gray-500 mt-0.5">{story.player || story.teams} — {story.why_today}</p>
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
                  <span className="text-gray-300 shrink-0">•</span>{f}
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
          <button
            onClick={onWriteScript}
            className="w-full mt-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
          >
            Write Script
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Main ----

export function StoryResearch() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [lastDate, setLastDate] = useState<string | null>(null);
  const [cost, setCost] = useState(0);
  const [cached, setCached] = useState(false);
  const [activeStory, setActiveStory] = useState<Story | null>(null);

  const applyData = useCallback((data: any) => {
    setStories(data.stories || []);
    setLastDate(data.date);
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
      try {
        setLoading(true);
        const cachedRes = await fetch('/api/football/stories');
        const cachedData = await safeJson(cachedRes);
        if (cancelled) return;
        if (cachedData.ok && cachedData.stories?.length > 0) { applyData(cachedData); setLoading(false); return; }
        const freshRes = await fetch('/api/football/stories', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
        });
        const fresh = await safeJson(freshRes);
        if (cancelled) return;
        if (fresh.ok && fresh.stories?.length > 0) applyData(fresh);
        else if (fresh.error) setError(fresh.error);
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load stories'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [applyData]);

  async function refreshStories() {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/football/stories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: true }),
      });
      const data = await safeJson(res);
      if (!data.ok) throw new Error(data.error || 'Failed');
      if (!data.stories?.length) throw new Error('No stories returned');
      applyData(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
    finally { setLoading(false); }
  }

  // Script writer view
  if (activeStory) {
    return <ScriptWriter story={activeStory} onBack={() => setActiveStory(null)} />;
  }

  const filtered = stories.filter(s => filter === 'all' ? true : s.type === filter);
  const personalCount = stories.filter(s => s.type === 'personal').length;
  const countryCount = stories.filter(s => s.type === 'country').length;

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="max-w-3xl mx-auto px-5 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Story Research</h1>
          <p className="text-[12px] text-gray-500 mt-1">
            Daily emotional stories to script — click any story and hit Write Script to generate a full toqueymedio-style script.
          </p>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <button onClick={refreshStories} disabled={loading}
            className="px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
            {loading ? 'Researching...' : 'Refresh Stories'}
          </button>
          {lastDate && <span className="text-[10px] text-gray-400 font-semibold">{lastDate}{cached ? ' (cached)' : ''}</span>}
          {cost > 0 && <span className="text-[10px] text-gray-300 font-mono">{formatCost(cost)}</span>}
          <span className="text-[10px] text-gray-300 font-mono ml-auto">Daily: {formatCost(getDailySpend())}</span>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 mb-5">
            <p className="text-[11px] text-red-700 font-semibold">{error}</p>
          </div>
        )}

        {stories.length > 0 && (
          <>
            <div className="flex gap-1.5 mb-4">
              {([['all', `All (${stories.length})`], ['personal', `👤 Personal (${personalCount})`], ['country', `🏴 Country (${countryCount})`]] as [Filter, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setFilter(key)}
                  className={`px-3 py-1.5 rounded-lg text-[10.5px] font-bold transition-all ${filter === key ? 'bg-violet-100 text-violet-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {filtered.map(s => <StoryCard key={s.rank} story={s} onWriteScript={() => setActiveStory(s)} />)}
            </div>
          </>
        )}

        {loading && stories.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-12 text-center">
            <div className="text-3xl mb-3 animate-pulse">📖</div>
            <h2 className="text-[14px] font-bold text-gray-800 mb-1">Researching today's stories...</h2>
            <p className="text-[11px] text-gray-400 max-w-sm mx-auto">Pulling live ESPN data, Google News trends, and cross-referencing the story bank. This takes ~15 seconds.</p>
          </div>
        )}

        {!loading && stories.length === 0 && !error && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-12 text-center">
            <div className="text-3xl mb-3">📖</div>
            <h2 className="text-[14px] font-bold text-gray-800 mb-1">No stories yet</h2>
            <p className="text-[11px] text-gray-400 max-w-sm mx-auto">Stories auto-generate each morning. Hit Refresh to generate now.</p>
          </div>
        )}
      </div>
    </div>
  );
}
