'use client';

import { useState, useRef, useEffect } from 'react';
import { getDailySpend, addSpend, formatCost } from '@/lib/football/costTracker';

interface HookOption {
  type: string;
  hook: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  hooks?: HookOption[]; // Hook mode: options to pick from
}

// Hook mode: what we keep while the creator is choosing a hook
interface PendingHooks {
  topic: string;
  research: string;
  shown: string[]; // every hook shown so far, so "5 more" never repeats
  msgId: string;   // only the latest hook message is clickable
}

interface Step { n: number; of: number; label: string; }

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

// Spoken-body word count — everything before the Hook/Caption/Hashtags/Fact check tail.
const TAIL_RE = /^\s*(?:\*\*)?(?:Hook|Caption|Hashtags|Fact check)\s*:?\s*(?:\*\*)?\s*:?/im;
function scriptWords(text: string): number | null {
  const cut = text.search(TAIL_RE);
  if (cut < 0) return null; // not a script
  return (text.slice(0, cut).match(/\S+/g) || []).length;
}

// Offline fallback if the intent router call fails: does this read as an edit / narrow
// ask (pasted script, hooks, a section…) rather than "create a new full script"?
function looksLikeEdit(text: string): boolean {
  const t = text.toLowerCase();
  const pasted = text.length > 240 || (text.match(/\n/g)?.length ?? 0) >= 3;
  const narrow = /\b(hook|hooks|alternativ|rephrase|reword|rewrite|shorten|shorter|longer|punch|variati|option|caption|hashtag|title|section|cta|intro|outro|opening|ending|closing|analy|feedback|critique|improve|tweak|only|just)\b/.test(t);
  return pasted || narrow;
}

const GRADIENT = 'linear-gradient(135deg,#f59e0b,#dc2626)';

export function EmotionalStoryteller() {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome', role: 'assistant',
    text: "I'm your Emotional Storyteller. Give me a player and a story — a comeback, a loss, a redemption — and I'll research it, write the script in your voice, and fact-check it.\n\nCLASSIC writes the whole script in one go. HOOK gives you 5 hooks in your style first — pick one, and the script is written under it.\n\nTry: \"Luis Díaz, his father's kidnapping, scoring at the World Cup\" or \"Raúl Jiménez fractured skull comeback\".",
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step | null>(null);
  const [runKind, setRunKind] = useState<'create' | 'edit' | null>(null); // what the current run is doing
  const [cost, setCost] = useState(0);
  const [dailySpend, setDailySpend] = useState(0);
  const [mode, setMode] = useState<'old' | 'new'>('new'); // OLD = base viral style · NEW = blended with Diez's Notion story format
  const [flow, setFlow] = useState<'classic' | 'hook'>('classic'); // HOOK = pick from 5 hooks before the script is written
  const [maxWords, setMaxWords] = useState(''); // optional hard cap on the script body
  const [pending, setPending] = useState<PendingHooks | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDailySpend(getDailySpend()); }, []);

  // Prefill the topic when arriving from a YouTube Lab "Write Script" link (?topic=…)
  useEffect(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('topic');
      if (t) setInput(t);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading, step]);

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

  const limit = Number(maxWords) >= 50 ? Number(maxWords) : undefined;

  const say = (text: string, extra: Partial<Message> = {}) => {
    const id = `a${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    setMessages(p => [...p, { id, role: 'assistant', text, ...extra }]);
    return id;
  };

  async function callStage(payload: any): Promise<{ ok: boolean; message?: string; error?: string; cost?: number; hooks?: HookOption[] }> {
    const res = await fetch('/api/football/emotional-storyteller', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, mode, wordLimit: limit }),
    });
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { return { ok: false, error: `Server returned invalid response (${res.status})` }; }
  }

  // DRAFT → VIRAL → FACT CHECK. With a hook (Hook mode) it's locked in as the opening.
  async function writeScript(topic: string, research: string, hook?: string) {
    const of = hook ? 3 : 4;
    const off = hook ? 0 : 1; // classic mode already spent step 1 on research

    setStep({ n: off + 1, of, label: hook ? 'Drafting the story under your hook…' : 'Drafting in Studio (toqueymedio only)…' });
    const draftRes = await callStage({ stage: 'draft', topic, bullets: research, hook });
    if (!draftRes.ok) throw new Error(draftRes.error || 'Draft failed');
    track(draftRes.cost || 0);

    setStep({ n: off + 2, of, label: 'Applying your viral style — flow, length…' });
    const viralRes = await callStage({ stage: 'viral', topic, draft: draftRes.message, hook });
    if (!viralRes.ok) throw new Error(viralRes.error || 'Viral pass failed');
    track(viralRes.cost || 0);

    setStep({ n: off + 3, of, label: 'Fact-checking every date, score and stat…' });
    let finalScript = viralRes.message || '';
    try {
      const checkRes = await callStage({ stage: 'factcheck', topic, script: finalScript, bullets: research, hook });
      track(checkRes.cost || 0);
      if (checkRes.ok && checkRes.message) finalScript = checkRes.message;
      else finalScript += `\n\n**Fact check:**\n- ⚠️ Fact check failed (${checkRes.error || 'unknown error'}) — verify dates and stats before recording.`;
    } catch {
      finalScript += '\n\n**Fact check:**\n- ⚠️ Fact check failed — verify dates and stats before recording.';
    }
    say(finalScript);
  }

  // Hook mode: ask for 5 hooks (first set, "5 more", or a set shaped by typed feedback).
  async function showHooks(topic: string, research: string, shown: string[], feedback = '') {
    const hooksRes = await callStage({ stage: 'hooks', topic, bullets: research, previous: shown, feedback });
    if (!hooksRes.ok) throw new Error(hooksRes.error || 'Hooks failed');
    track(hooksRes.cost || 0);
    const hooks = hooksRes.hooks || [];
    if (!hooks.length) {
      say(hooksRes.message || "I couldn't write hooks for that one — try rephrasing the story.");
      return;
    }
    const msgId = say(shown.length ? 'Five more — pick one, or tell me what to change:' : 'Pick the hook — the script gets written under it:', { hooks });
    setPending({ topic, research, shown: [...shown, ...hooks.map(h => h.hook)], msgId });
  }

  async function run(work: () => Promise<void>, kind: 'create' | 'edit') {
    setLoading(true);
    setRunKind(kind);
    try { await work(); }
    catch (e: any) { say(`Error: ${e.message || 'Something went wrong'}`); }
    finally { setLoading(false); setStep(null); setRunKind(null); }
  }

  function pickHook(h: HookOption) {
    if (!pending || loading) return;
    const p = pending;
    setPending(null);
    setMessages(m => [...m, { id: `u${Date.now()}`, role: 'user', text: `Use this hook:\n${h.hook}` }]);
    run(() => writeScript(p.topic, p.research, h.hook), 'create');
  }

  function moreHooks() {
    if (!pending || loading) return;
    const p = pending;
    run(async () => {
      setStep({ n: 1, of: 1, label: 'Writing 5 new hooks in your style…' });
      await showHooks(p.topic, p.research, p.shown);
    }, 'create');
  }

  function writeWithoutHook() {
    if (!pending || loading) return;
    const p = pending;
    setPending(null);
    run(() => writeScript(p.topic, p.research), 'create');
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: `u${Date.now()}`, role: 'user', text };
    setMessages(p => [...p, userMsg]);
    setInput('');

    // Hooks are on screen: whatever is typed is feedback for 5 new ones.
    if (pending && flow === 'hook') {
      const p = pending;
      return run(async () => {
        setStep({ n: 1, of: 1, label: 'Rewriting the hooks with your notes…' });
        await showHooks(p.topic, p.research, p.shown, text);
      }, 'create');
    }
    setPending(null);

    setLoading(true);
    // Has a script already been generated this session? (any prior assistant msg that isn't the welcome)
    const hasScript = messages.some(m => m.role === 'assistant' && m.id !== 'welcome' && !m.hooks);

    // Decide intent. Follow-ups (a script already exists) are always edits. For a first
    // message, ask the fast router whether this is "create a new full script" or an edit /
    // narrow ask (pasted script, hooks, a section…) — with a heuristic fallback — so a
    // "give me 5 hooks" or a pasted script never triggers the full research pipeline.
    let intent: 'create' | 'edit' = 'edit';
    if (!hasScript) {
      intent = looksLikeEdit(text) ? 'edit' : 'create';
      try {
        const c: any = await callStage({ stage: 'classify', text });
        if (c?.intent === 'create' || c?.intent === 'edit') intent = c.intent;
        track(c?.cost || 0);
      } catch { /* keep heuristic guess */ }
    }

    await run(async () => {
      if (intent === 'create') {
        setStep({ n: 1, of: flow === 'hook' ? 2 : 4, label: 'Researching — origin, comeback, the deep story…' });
        const researchRes = await callStage({ stage: 'research', topic: text });
        if (!researchRes.ok) throw new Error(researchRes.error || 'Research failed');
        track(researchRes.cost || 0);

        if (flow === 'hook') {
          setStep({ n: 2, of: 2, label: 'Writing 5 hooks in your style…' });
          await showHooks(text, researchRes.message || '', []);
        } else {
          await writeScript(text, researchRes.message || '');
        }
      } else {
        // ── Single-pass edit: do EXACTLY what's asked (hooks, a section, analysis…) ──
        const apiMessages = [...messages.filter(m => m.id !== 'welcome' && !m.hooks), userMsg].map(m => ({ role: m.role, content: m.text }));
        const chatRes = await callStage({ stage: 'chat', messages: apiMessages });
        if (!chatRes.ok) throw new Error(chatRes.error || 'Failed');
        track(chatRes.cost || 0);
        say(chatRes.message || '');
      }
    }, intent);
  }

  const toggle = <T extends string>(options: readonly T[], value: T, set: (v: T) => void, title: string) => (
    <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden shrink-0" title={title}>
      {options.map(o => (
        <button key={o} onClick={() => set(o)}
          className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition-colors ${
            value === o ? 'text-white' : 'text-gray-400 hover:text-gray-600 bg-white'
          }`}
          style={value === o ? { background: GRADIENT } : undefined}>
          {o}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-5 py-2.5 flex items-center gap-3 flex-wrap">
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px]" style={{ background: GRADIENT }}>🕯️</span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-black text-gray-900">Emotional Storyteller</p>
          <p className="text-[8px] text-gray-400 uppercase tracking-widest font-bold">
            {mode === 'new' ? 'diez format · 50% merged' : 'base viral style'} · {flow === 'hook' ? 'pick the hook first' : 'classic'} · fact-checked
          </p>
        </div>

        {/* CLASSIC / HOOK flow toggle */}
        {toggle(['classic', 'hook'] as const, flow, setFlow, 'CLASSIC = the whole script in one go. HOOK = 5 hooks in your style first; pick one and the script is written under it.')}

        {/* OLD / NEW style toggle */}
        {toggle(['old', 'new'] as const, mode, setMode, 'OLD = base viral style. NEW = blended 50/50 with your Notion Story format.')}

        {/* Max words */}
        <label className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-0.5 shrink-0" title="Hard cap on the script's spoken words. Leave empty for the usual ~500.">
          <span className="text-[8px] text-gray-400 uppercase tracking-wider font-black">Max</span>
          <input
            type="number" min={50} max={1500} step={10} inputMode="numeric"
            value={maxWords}
            onChange={e => setMaxWords(e.target.value)}
            placeholder="—"
            className="w-12 text-[10px] font-mono text-gray-700 bg-transparent focus:outline-none placeholder-gray-300"
          />
          <span className="text-[8px] text-gray-400 uppercase tracking-wider font-black">words</span>
        </label>

        {cost > 0 && <span className="text-[9px] text-gray-300 font-mono">{formatCost(cost)} this session</span>}
        <span className={`text-[9px] font-mono font-bold ${dailySpend >= 1.8 ? 'text-orange-500' : 'text-gray-300'}`}>
          {formatCost(dailySpend)}<span className="font-normal text-gray-300">/day</span>
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.map(msg => {
          const words = msg.role === 'assistant' ? scriptWords(msg.text) : null;
          const activeHooks = msg.hooks && pending?.msgId === msg.id && !loading;
          return (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] shrink-0 mb-0.5 shadow-sm"
                  style={{ background: GRADIENT }}>🕯️</div>
              )}
              <div className={`max-w-[82%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`rounded-2xl px-4 py-3 shadow-sm ${
                  msg.role === 'user' ? 'bg-violet-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 rounded-bl-sm'
                }`}>
                  {msg.role === 'user'
                    ? <p className="text-[12px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    : <Markdown text={msg.text} />}

                  {msg.hooks && (
                    <div className="mt-3 space-y-2">
                      {msg.hooks.map((h, i) => (
                        <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-amber-600 mb-1">{i + 1} · {h.type}</p>
                          {h.hook.split('\n').filter(l => l.trim()).map((l, j) => (
                            <p key={j} className="text-[11px] text-gray-800 leading-[1.55]">{l}</p>
                          ))}
                          <button onClick={() => pickHook(h)} disabled={!activeHooks}
                            className="mt-2 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider text-white disabled:opacity-30"
                            style={{ background: GRADIENT }}>
                            Use this hook
                          </button>
                        </div>
                      ))}
                      {activeHooks && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button onClick={moreHooks}
                            className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-[9px] font-black uppercase tracking-wider text-gray-600 hover:text-gray-900">
                            5 more hooks
                          </button>
                          <button onClick={writeWithoutHook}
                            className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-[9px] font-black uppercase tracking-wider text-gray-400 hover:text-gray-700">
                            Skip — write it classic
                          </button>
                          <span className="text-[8.5px] text-gray-400">or type what to change and get 5 new ones</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {words !== null && (
                  <span className={`mt-1 text-[8.5px] font-mono ${limit && words > limit ? 'text-orange-500 font-bold' : 'text-gray-400'}`}>
                    {words} words{limit ? ` / max ${limit}` : ''}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-end gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] shrink-0"
              style={{ background: GRADIENT }}>🕯️</div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="animate-spin inline-block w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full" />
                <span className="text-[10.5px] text-gray-500 font-semibold">
                  {step?.label || (runKind === 'edit' ? 'Working on your request…' : 'Reading your request…')}
                </span>
              </div>
              {step && step.of > 1 && (
                <div className="flex gap-1 mt-2">
                  {Array.from({ length: step.of }, (_, i) => i + 1).map(n => (
                    <div key={n} className={`h-1 rounded-full transition-all ${n <= step.n ? 'bg-amber-500' : 'bg-gray-200'}`} style={{ width: 28 }} />
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
              placeholder={pending && flow === 'hook'
                ? "Tell me what to change — 'more about his mother', 'darker', 'start at the World Cup goal'…"
                : "A player and their story… 'Diogo Jota tribute' · 'Iniesta's goal for Dani Jarque' · or refine the script above…"}
              rows={1}
              className="w-full text-[12px] bg-transparent px-4 pt-3 pb-1 resize-none overflow-y-auto focus:outline-none placeholder-gray-300 text-gray-800 leading-relaxed"
              style={{ minHeight: 44, maxHeight: '50vh' }}
            />
            <div className="flex items-center justify-end px-3 pb-2">
              <p className="text-[8px] text-gray-300">Enter · Shift+Enter new line · edits after a script are one quick pass — no new research or fact check</p>
            </div>
          </div>
          <button onClick={send} disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 disabled:opacity-40 shadow-sm transition-all hover:scale-105"
            style={{ background: GRADIENT }}>
            <span className="text-white font-black text-[15px]" style={{ marginTop: '-1px' }}>↑</span>
          </button>
        </div>
      </div>
    </div>
  );
}
