'use client';

import { useState, useRef, useEffect } from 'react';
import { getDailySpend, addSpend, formatCost } from '@/lib/football/costTracker';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

type Mode = 'story' | 'videos' | 'trending';

const GRAD = 'linear-gradient(135deg,#10b981,#0284c7)';

const MODE_META: Record<Mode, { label: string; welcome: string; placeholder: string }> = {
  story: {
    label: 'Your story',
    welcome: "I'm La Fecha — I write in @lafechadeportes's redemption-storytelling style, in English. Give me a player and their story — a wound, a comeback, an injustice — and I'll research it and write you a full script across three passes.\n\nTry: \"João Cancelo, his mother's death\" or \"Vinícius, the man who beat the critics\".",
    placeholder: "A player and their story… 'Luva de Pedreiro, from the dirt field to fame' · or refine the script above…",
  },
  videos: {
    label: 'His videos',
    welcome: "La Fecha · **mine his videos** mode. Hit **💡 Ideas** and I'll pull the strongest untapped stories in his lane — the ones he hasn't done — from the gap analysis. Then reply with a number, or type your own, and I'll write it in his style (in English).",
    placeholder: "Reply with an idea number, or type your own story…",
  },
  trending: {
    label: 'Trending',
    welcome: "La Fecha · **trending** mode. Hit **💡 Ideas** and I'll surface football stories doing well RIGHT NOW with the strongest emotional pull. Reply with a number, or type your own, and I'll write it in his style (in English).",
    placeholder: "Reply with an idea number, or type your own story…",
  },
};

const PASS_LABELS = ['Researching the story…', 'Researching — origin, wound, redemption…', 'Drafting in La Fecha\'s voice…', 'Polishing — hook, flow, English punch…'];

function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
          return <p key={i} className="font-bold text-gray-500 text-[9px] uppercase tracking-widest mt-2.5">{line.slice(2, -2)}</p>;
        }
        if (line.trim() === '') return <div key={i} className="h-1.5" />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className="text-[10.5px] text-gray-800 leading-[1.6]">
            {parts.map((p, j) => p.startsWith('**') && p.endsWith('**')
              ? <span key={j} className="font-semibold text-gray-900">{p.slice(2, -2)}</span>
              : p
            )}
          </p>
        );
      })}
    </div>
  );
}

function looksLikeEdit(text: string): boolean {
  const t = text.toLowerCase();
  const pasted = text.length > 240 || (text.match(/\n/g)?.length ?? 0) >= 3;
  const narrow = /\b(hook|hooks|alternativ|rephrase|reword|rewrite|shorten|shorter|longer|punch|variati|option|caption|hashtag|title|section|cta|intro|outro|opening|ending|closing|analy|feedback|critique|improve|tweak|only|just)\b/.test(t);
  return pasted || narrow;
}

// If the user replies with just a number, resolve it to that line from the most
// recent assistant ideas list so we write the idea rather than the bare digit.
function resolveTopic(input: string, messages: Message[]): string {
  const m = input.trim().match(/^(\d{1,2})[.)]?$/);
  if (!m) return input.trim();
  const n = m[1];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'assistant') continue;
    const line = messages[i].text.split('\n').find(l => new RegExp(`^\\s*${n}[.)]`).test(l));
    if (line) return line.replace(/^\s*\d{1,2}[.)]\s*/, '').replace(/\*\*/g, '').trim();
  }
  return input.trim();
}

export function LaFechaStoryteller() {
  const [mode, setMode] = useState<Mode>('story');
  const [messages, setMessages] = useState<Message[]>([{ id: 'welcome', role: 'assistant', text: MODE_META.story.welcome }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [runKind, setRunKind] = useState<'create' | 'edit' | 'ideas' | null>(null);
  const [cost, setCost] = useState(0);
  const [dailySpend, setDailySpend] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDailySpend(getDailySpend()); }, []);
  useEffect(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('topic');
      if (t) setInput(t);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading, progress]);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, Math.floor(window.innerHeight * 0.5)) + 'px';
  }, [input]);

  const track = (c: number) => {
    if (!c) return;
    setCost(x => x + c);
    setDailySpend(addSpend(c));
  };

  // Switching mode resets the thread so each mode starts clean with its own welcome.
  function switchMode(m: Mode) {
    if (m === mode) return;
    setMode(m);
    setMessages([{ id: `welcome-${m}`, role: 'assistant', text: MODE_META[m].welcome }]);
    setInput('');
  }

  async function callStage(payload: any): Promise<any> {
    const res = await fetch('/api/football/la-fecha', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { return { ok: false, error: `Server returned invalid response (${res.status})` }; }
  }

  async function getIdeas() {
    if (loading) return;
    setLoading(true);
    setRunKind('ideas');
    try {
      const r = await callStage({ stage: 'ideas', source: mode === 'trending' ? 'trending' : 'videos' });
      if (!r.ok) throw new Error(r.error || 'Failed to fetch ideas');
      track(r.cost || 0);
      setMessages(p => [...p, { id: `a${Date.now()}`, role: 'assistant', text: r.message || '' }]);
    } catch (e: any) {
      setMessages(p => [...p, { id: `e${Date.now()}`, role: 'assistant', text: `Error: ${e.message || 'Something went wrong'}` }]);
    } finally {
      setLoading(false);
      setRunKind(null);
    }
  }

  async function send() {
    const raw = input.trim();
    if (!raw || loading) return;

    const userMsg: Message = { id: `u${Date.now()}`, role: 'user', text: raw };
    const topic = resolveTopic(raw, messages);
    setMessages(p => [...p, userMsg]);
    setInput('');
    setLoading(true);

    const hasScript = messages.some(m => m.role === 'assistant' && !m.id.startsWith('welcome'));

    // In story mode a first message is classified (create vs edit). In videos/trending
    // mode a first reply (a picked idea or a typed topic) is always a create.
    let intent: 'create' | 'edit' = 'edit';
    if (!hasScript) {
      if (mode !== 'story') {
        intent = 'create';
      } else {
        intent = looksLikeEdit(raw) ? 'edit' : 'create';
        try {
          const c: any = await callStage({ stage: 'classify', text: raw });
          if (c?.intent === 'create' || c?.intent === 'edit') intent = c.intent;
          track(c?.cost || 0);
        } catch { /* keep heuristic guess */ }
      }
    }
    setRunKind(intent);

    try {
      if (intent === 'create') {
        setProgress(1);
        const researchRes = await callStage({ stage: 'research', topic });
        if (!researchRes.ok) throw new Error(researchRes.error || 'Research failed');
        track(researchRes.cost || 0);

        setProgress(2);
        const draftRes = await callStage({ stage: 'draft', topic, bullets: researchRes.message });
        if (!draftRes.ok) throw new Error(draftRes.error || 'Draft failed');
        track(draftRes.cost || 0);

        setProgress(3);
        const viralRes = await callStage({ stage: 'viral', draft: draftRes.message });
        if (!viralRes.ok) throw new Error(viralRes.error || 'Polish pass failed');
        track(viralRes.cost || 0);

        setMessages(p => [...p, { id: `a${Date.now()}`, role: 'assistant', text: viralRes.message || '' }]);
      } else {
        const apiMessages = [...messages.filter(m => !m.id.startsWith('welcome')), userMsg].map(m => ({ role: m.role, content: m.text }));
        const chatRes = await callStage({ stage: 'chat', messages: apiMessages });
        if (!chatRes.ok) throw new Error(chatRes.error || 'Failed');
        track(chatRes.cost || 0);
        setMessages(p => [...p, { id: `a${Date.now()}`, role: 'assistant', text: chatRes.message || '' }]);
      }
    } catch (e: any) {
      setMessages(p => [...p, { id: `e${Date.now()}`, role: 'assistant', text: `Error: ${e.message || 'Something went wrong'}` }]);
    } finally {
      setLoading(false);
      setProgress(0);
      setRunKind(null);
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-5 py-2.5 flex items-center gap-3">
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px]" style={{ background: GRAD }}>📅</span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-black text-gray-900">La Fecha</p>
          <p className="text-[8px] text-gray-400 uppercase tracking-widest font-bold">@lafechadeportes style · english · 3-pass</p>
        </div>

        {/* Mode selector */}
        <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden shrink-0" title="Your story = you give a story. His videos = mine his untapped stories. Trending = football stories hot right now.">
          {(['story', 'videos', 'trending'] as const).map(m => (
            <button key={m} onClick={() => switchMode(m)}
              className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition-colors ${
                mode === m ? 'text-white' : 'text-gray-400 hover:text-gray-600 bg-white'
              }`}
              style={mode === m ? { background: GRAD } : undefined}>
              {MODE_META[m].label}
            </button>
          ))}
        </div>

        {cost > 0 && <span className="text-[9px] text-gray-300 font-mono">{formatCost(cost)} this session</span>}
        <span className={`text-[9px] font-mono font-bold ${dailySpend >= 1.8 ? 'text-orange-500' : 'text-gray-300'}`}>
          {formatCost(dailySpend)}<span className="font-normal text-gray-300">/day</span>
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] shrink-0 mb-0.5 shadow-sm" style={{ background: GRAD }}>📅</div>
            )}
            <div className={`max-w-[82%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              <div className={`rounded-2xl px-4 py-3 shadow-sm ${
                msg.role === 'user' ? 'bg-violet-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 rounded-bl-sm'
              }`}>
                {msg.role === 'user'
                  ? <p className="text-[12px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  : <Markdown text={msg.text} />}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-end gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] shrink-0" style={{ background: GRAD }}>📅</div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="animate-spin inline-block w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full" />
                <span className="text-[10.5px] text-gray-500 font-semibold">
                  {runKind === 'ideas' ? 'Finding the best stories…' : runKind === 'edit' ? 'Working on your request…' : runKind === 'create' ? (PASS_LABELS[progress] || 'Writing…') : 'Reading your request…'}
                </span>
              </div>
              {runKind === 'create' && progress > 0 && (
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3].map(n => (
                    <div key={n} className={`h-1 rounded-full transition-all ${n <= progress ? 'bg-emerald-500' : 'bg-gray-200'}`} style={{ width: 28 }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white px-4 py-3 shrink-0">
        {mode !== 'story' && (
          <div className="flex items-center gap-2 mb-2">
            <button onClick={getIdeas} disabled={loading}
              className="px-3 py-1.5 rounded-full text-[10px] font-black text-white shadow-sm disabled:opacity-40 transition-all hover:scale-105"
              style={{ background: GRAD }}>
              💡 Ideas
            </button>
            <span className="text-[9px] text-gray-400">{mode === 'videos' ? 'Pull his untapped stories' : 'Pull stories hot right now'} — then reply with a number</span>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl flex flex-col overflow-hidden focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={MODE_META[mode].placeholder}
              rows={1}
              className="w-full text-[12px] bg-transparent px-4 pt-3 pb-1 resize-none overflow-y-auto focus:outline-none placeholder-gray-300 text-gray-800 leading-relaxed"
              style={{ minHeight: 44, maxHeight: '50vh' }}
            />
            <div className="flex items-center justify-end px-3 pb-2">
              <p className="text-[8px] text-gray-300">Enter · Shift+Enter new line · output is in English · paste a script for just hooks / a section</p>
            </div>
          </div>
          <button onClick={send} disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 disabled:opacity-40 shadow-sm transition-all hover:scale-105"
            style={{ background: GRAD }}>
            <span className="text-white font-black text-[15px]" style={{ marginTop: '-1px' }}>↑</span>
          </button>
        </div>
      </div>
    </div>
  );
}
