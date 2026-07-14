'use client';

import { useState, useRef, useEffect } from 'react';
import { getDailySpend, addSpend, formatCost } from '@/lib/football/costTracker';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

// Lightweight markdown renderer (bold-aware, matches Studio ScriptChat)
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

const PASS_LABELS = ['Researching the story…', 'Researching — origin, comeback, the deep story…', 'Drafting in Studio (toqueymedio only)…', 'Applying your viral style — hook, flow, length…'];

export function EmotionalStoryteller() {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome', role: 'assistant',
    text: "I'm your Emotional Storyteller. Give me a player and a story — a comeback, a loss, a redemption — and I'll research it, then write you a full toqueymedio-style emotional script, perfected across three passes.\n\nTry: \"Luis Díaz, his father's kidnapping, scoring at the World Cup\" or just \"Raúl Jiménez fractured skull comeback\".",
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0); // 0 = idle, 1-3 = pass number
  const [cost, setCost] = useState(0);
  const [dailySpend, setDailySpend] = useState(0);
  const [mode, setMode] = useState<'old' | 'new'>('new'); // OLD = base viral style · NEW = blended with Diez's Notion story format
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDailySpend(getDailySpend()); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading, progress]);

  // Auto-resize textarea up to 50% of viewport
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

  async function callStage(payload: any): Promise<{ ok: boolean; message?: string; error?: string; cost?: number }> {
    const res = await fetch('/api/football/emotional-storyteller', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, mode }),
    });
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { return { ok: false, error: `Server returned invalid response (${res.status})` }; }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: `u${Date.now()}`, role: 'user', text };
    setMessages(p => [...p, userMsg]);
    setInput('');
    setLoading(true);

    // Has a script already been generated this session? (any prior assistant msg that isn't the welcome)
    const hasScript = messages.some(m => m.role === 'assistant' && m.id !== 'welcome');

    try {
      if (!hasScript) {
        // ── RESEARCH → STUDIO TOQUEYMEDIO DRAFT → VIRAL POLISH ──
        setProgress(1); // research
        const researchRes = await callStage({ stage: 'research', topic: text });
        if (!researchRes.ok) throw new Error(researchRes.error || 'Research failed');
        track(researchRes.cost || 0);

        setProgress(2); // draft (Studio, toqueymedio only)
        const draftRes = await callStage({ stage: 'draft', topic: text, bullets: researchRes.message });
        if (!draftRes.ok) throw new Error(draftRes.error || 'Draft failed');
        track(draftRes.cost || 0);

        setProgress(3); // viral elevation
        const viralRes = await callStage({ stage: 'viral', draft: draftRes.message });
        if (!viralRes.ok) throw new Error(viralRes.error || 'Viral pass failed');
        track(viralRes.cost || 0);

        setMessages(p => [...p, { id: `a${Date.now()}`, role: 'assistant', text: viralRes.message || '' }]);
      } else {
        // ── Single-pass refinement for follow-up chat ──
        const apiMessages = [...messages.filter(m => m.id !== 'welcome'), userMsg].map(m => ({ role: m.role, content: m.text }));
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
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-5 py-2.5 flex items-center gap-3">
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px]" style={{ background: 'linear-gradient(135deg,#f59e0b,#dc2626)' }}>🕯️</span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-black text-gray-900">Emotional Storyteller</p>
          <p className="text-[8px] text-gray-400 uppercase tracking-widest font-bold">{mode === 'new' ? 'diez format · 50% merged' : 'base viral style'} · 3-pass</p>
        </div>

        {/* OLD / NEW style toggle */}
        <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden shrink-0" title="OLD = base viral style. NEW = blended 50/50 with your Notion Story format.">
          {(['old', 'new'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition-colors ${
                mode === m ? 'text-white' : 'text-gray-400 hover:text-gray-600 bg-white'
              }`}
              style={mode === m ? { background: 'linear-gradient(135deg,#f59e0b,#dc2626)' } : undefined}>
              {m}
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
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] shrink-0 mb-0.5 shadow-sm"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#dc2626)' }}>🕯️</div>
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
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] shrink-0"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#dc2626)' }}>🕯️</div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="animate-spin inline-block w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full" />
                <span className="text-[10.5px] text-gray-500 font-semibold">{PASS_LABELS[progress] || 'Writing…'}</span>
              </div>
              {progress > 0 && (
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3].map(n => (
                    <div key={n} className={`h-1 rounded-full transition-all ${n <= progress ? 'bg-amber-500' : 'bg-gray-200'}`} style={{ width: 28 }} />
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
        <div className="flex gap-2 items-end">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl flex flex-col overflow-hidden focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-100 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="A player and their story… 'Diogo Jota tribute' · 'Iniesta's goal for Dani Jarque' · or refine the script above…"
              rows={1}
              className="w-full text-[12px] bg-transparent px-4 pt-3 pb-1 resize-none overflow-y-auto focus:outline-none placeholder-gray-300 text-gray-800 leading-relaxed"
              style={{ minHeight: 44, maxHeight: '50vh' }}
            />
            <div className="flex items-center justify-end px-3 pb-2">
              <p className="text-[8px] text-gray-300">Enter · Shift+Enter new line · first script runs 3 passes (~1–3 min)</p>
            </div>
          </div>
          <button onClick={send} disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 disabled:opacity-40 shadow-sm transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#dc2626)' }}>
            <span className="text-white font-black text-[15px]" style={{ marginTop: '-1px' }}>↑</span>
          </button>
        </div>
      </div>
    </div>
  );
}
