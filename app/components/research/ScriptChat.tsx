'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Attachment {
  name: string;
  type: string;   // 'image' | 'document' | 'text'
  mediaType: string;
  data: string;   // base64
  preview?: string;
  size: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  thinking?: string;
  attachments?: Attachment[];
}

function formatBytes(b: number) {
  return b < 1024 ? `${b}B` : b < 1048576 ? `${(b/1024).toFixed(0)}KB` : `${(b/1048576).toFixed(1)}MB`;
}

// Lightweight markdown renderer
function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
          return <p key={i} className="font-black text-gray-900 text-[12px] mt-2">{line.slice(2,-2)}</p>;
        }
        if (line.startsWith('## ')) return <p key={i} className="font-black text-gray-900 text-[13px] mt-3">{line.slice(3)}</p>;
        if (line.startsWith('# '))  return <p key={i} className="font-black text-gray-900 text-[14px] mt-3">{line.slice(2)}</p>;
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return <p key={i} className="text-[11px] text-gray-700 leading-relaxed pl-3">• {line.slice(2)}</p>;
        }
        if (/^\d+\.\s/.test(line)) return <p key={i} className="text-[11px] text-gray-700 leading-relaxed pl-3">{line}</p>;
        if (line.trim() === '') return <div key={i} className="h-1" />;
        // Inline bold
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className="text-[11px] text-gray-800 leading-relaxed">
            {parts.map((p, j) => p.startsWith('**') && p.endsWith('**')
              ? <strong key={j} className="font-bold text-gray-900">{p.slice(2,-2)}</strong>
              : p
            )}
          </p>
        );
      })}
    </div>
  );
}

export function ScriptChat({ onCost, styles = ['pechefootball', 'fiagoball', '5.at.the.back'] }: { onCost: (c: number) => void; styles?: string[] }) {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome', role: 'assistant',
    text: "I'm your script writer. Tell me what video you want to make — a topic, a take, a player, a moment — and I'll research it and write you a full script.\n\nYou can also attach images, articles, or PDFs for context.",
  }]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [useThinking, setUseThinking] = useState(false);
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set());
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxH = Math.floor(window.innerHeight * 0.5);
    el.style.height = Math.min(el.scrollHeight, maxH) + 'px';
  }, [input]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    const newAtts: Attachment[] = [];
    for (const file of Array.from(files)) {
      const data = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const isImage = file.type.startsWith('image/');
      const isPDF = file.type === 'application/pdf';
      newAtts.push({
        name: file.name,
        type: isImage ? 'image' : isPDF ? 'document' : 'text',
        mediaType: file.type || 'text/plain',
        data,
        preview: isImage ? `data:${file.type};base64,${data}` : undefined,
        size: formatBytes(file.size),
      });
    }
    setAttachments(p => [...p, ...newAtts]);
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text && !attachments.length) return;
    if (loading) return;

    // Build user content blocks
    const contentBlocks: any[] = [];
    for (const att of attachments) {
      if (att.type === 'image') {
        contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: att.mediaType, data: att.data } });
      } else if (att.type === 'document') {
        contentBlocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: att.data } });
      } else {
        contentBlocks.push({ type: 'text', text: `[Attached file: ${att.name}]\n${atob(att.data)}` });
      }
    }
    if (text) contentBlocks.push({ type: 'text', text });

    const userMsg: Message = { id: `u${Date.now()}`, role: 'user', text, attachments: [...attachments] };
    setMessages(p => [...p, userMsg]);
    setInput(''); setAttachments([]);
    setLoading(true);

    // Build API messages (exclude welcome, format for Anthropic)
    const apiMessages = [...messages.filter(m => m.id !== 'welcome'), userMsg].map(m => ({
      role: m.role,
      content: m.role === 'user' && m.id === userMsg.id
        ? contentBlocks
        : m.text,
    }));

    try {
      const res = await fetch('/api/football/scriptchat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, useThinking, styles }),
      });
      const data = await res.json();
      if (data.cost) onCost(data.cost);
      setMessages(p => [...p, {
        id: `a${Date.now()}`,
        role: 'assistant',
        text: data.ok ? data.message : `Error: ${data.error}`,
        thinking: data.thinking || undefined,
      }]);
    } catch (e: any) {
      setMessages(p => [...p, { id: `e${Date.now()}`, role: 'assistant', text: 'Network error — try again.' }]);
    } finally { setLoading(false); }
  };

  const toggleThinking = (id: string) => {
    setExpandedThinking(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>

            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0 mb-0.5 shadow-sm"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>AI</div>
            )}

            <div className={`max-w-[80%] space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>

              {/* Attachments preview */}
              {msg.attachments?.length ? (
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {msg.attachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 shadow-sm">
                      {att.preview
                        ? <img src={att.preview} className="w-8 h-8 rounded-lg object-cover" />
                        : <span className="text-[14px]">{att.type === 'document' ? '📄' : '📎'}</span>}
                      <div>
                        <p className="text-[9px] font-semibold text-gray-700 max-w-[100px] truncate">{att.name}</p>
                        <p className="text-[8px] text-gray-400">{att.size}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Thinking block */}
              {msg.thinking && (
                <div className="w-full">
                  <button onClick={() => toggleThinking(msg.id)}
                    className="flex items-center gap-1.5 text-[8px] font-semibold text-violet-400 hover:text-violet-600 transition-colors">
                    <span className="text-[10px]">💭</span>
                    {expandedThinking.has(msg.id) ? 'Hide thinking' : 'Show thinking'}
                    <span className="text-[10px]">{expandedThinking.has(msg.id) ? '▲' : '▼'}</span>
                  </button>
                  {expandedThinking.has(msg.id) && (
                    <div className="mt-1.5 bg-violet-50 border border-violet-200 rounded-xl p-3 text-[10px] text-violet-700 leading-relaxed whitespace-pre-wrap font-mono">
                      {msg.thinking}
                    </div>
                  )}
                </div>
              )}

              {/* Message bubble */}
              {msg.text && (
                <div className={`rounded-2xl px-4 py-3 shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-br-sm'
                    : 'bg-white border border-gray-200 rounded-bl-sm'
                }`}>
                  {msg.role === 'user'
                    ? <p className="text-[11px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    : <Markdown text={msg.text} />
                  }
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-end gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>AI</div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="animate-spin inline-block w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full" />
                <span className="text-[10px] text-gray-400">
                  {useThinking ? 'Thinking deeply…' : 'Researching + writing…'}
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 flex flex-wrap gap-2 border-t border-gray-200 bg-white shrink-0">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5">
              {att.preview
                ? <img src={att.preview} className="w-6 h-6 rounded-lg object-cover" />
                : <span className="text-[12px]">{att.type === 'document' ? '📄' : '📝'}</span>}
              <span className="text-[9px] font-semibold text-gray-600 max-w-[80px] truncate">{att.name}</span>
              <button onClick={() => setAttachments(p => p.filter((_,j) => j !== i))}
                className="text-gray-300 hover:text-red-400 text-[11px] ml-0.5">×</button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white px-4 py-3 shrink-0">
        <div className="flex gap-2 items-end">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl flex flex-col overflow-hidden focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Make a vid about Ecuador being the dark horse… rewrite my hook… make this more controversial…"
              rows={1}
              className="w-full text-[12px] bg-transparent px-4 pt-3 pb-1 resize-none overflow-y-auto focus:outline-none placeholder-gray-300 text-gray-800 leading-relaxed"
              style={{ minHeight: 44, maxHeight: '50vh' }}
            />
            <div className="flex items-center justify-between px-3 pb-2">
              <div className="flex items-center gap-1">
                <button onClick={() => fileRef.current?.click()}
                  title="Attach file"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-all text-[14px]">
                  📎
                </button>
                <button
                  onClick={() => setUseThinking(t => !t)}
                  title={useThinking ? 'Extended thinking ON — deep reasoning, slower' : 'Enable extended thinking'}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-bold transition-all ${useThinking ? 'bg-violet-100 text-violet-700 border border-violet-300' : 'text-gray-300 hover:text-violet-500'}`}>
                  💭 {useThinking ? 'Thinking ON' : 'Think'}
                </button>
              </div>
              <p className="text-[8px] text-gray-300">Enter · Shift+Enter new line</p>
            </div>
          </div>
          <button onClick={send} disabled={loading || (!input.trim() && !attachments.length)}
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 disabled:opacity-40 shadow-sm transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
            <span className="text-white font-black text-[15px]" style={{ marginTop: '-1px' }}>↑</span>
          </button>
        </div>
        <input ref={fileRef} type="file" className="hidden" multiple
          accept="image/*,application/pdf,text/plain,text/markdown,.md,.txt,.csv"
          onChange={e => handleFiles(e.target.files)} />
      </div>
    </div>
  );
}
