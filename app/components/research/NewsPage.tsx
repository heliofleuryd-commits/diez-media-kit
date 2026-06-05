'use client';

import { useState } from 'react';

export function NewsPage() {
  const [loading, setLoading] = useState(false);
  const [bullets, setBullets] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showScript, setShowScript] = useState(false);
  const [script, setScript] = useState<string | null>(null);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key); setTimeout(() => setCopied(null), 1500);
  };

  const fetchBullets = async () => {
    setLoading(true); setError(null); setBullets([]); setScript(null); setShowScript(false);
    try {
      const res = await fetch('/api/football/news', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ generateScript: false }) });
      const json = await res.json();
      if (!json.ok) { setError(json.error); return; }
      setBullets(json.bullets);
      setDate(json.date);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const generateScript = async () => {
    setGeneratingScript(true); setError(null);
    try {
      const res = await fetch('/api/football/news', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ generateScript: true }) });
      const json = await res.json();
      if (!json.ok) { setError(json.error); return; }
      setBullets(json.bullets);
      setDate(json.date);
      setScript(json.flash_script);
      setShowScript(true);
    } catch (e: any) { setError(e.message); }
    finally { setGeneratingScript(false); }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0f14] text-white overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.07] shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-black tracking-wide text-white">World Cup Flash News</h1>
          <p className="text-[10px] text-white/35 mt-0.5">
            {date ? `${date}` : '20 bullet points · everything that matters from the last 24 hours'}
          </p>
        </div>
        <button onClick={fetchBullets} disabled={loading || generatingScript}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-black disabled:opacity-50 transition-all hover:scale-[1.02]"
          style={{ background: loading ? '#374151' : 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
          {loading
            ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> Scanning…</>
            : <>⚡ Get Today's Flash News</>}
        </button>
      </div>

      {error && <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>}

      {/* Empty state */}
      {bullets.length === 0 && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
          <div className="text-5xl">📰</div>
          <div>
            <p className="text-white/50 text-sm font-semibold">No news loaded yet</p>
            <p className="text-white/25 text-xs mt-1 max-w-sm leading-relaxed">
              Hit Flash News to get 20 bullets covering every score, injury, controversy, and talking point from the last 24 hours.
            </p>
          </div>
        </div>
      )}

      {bullets.length > 0 && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">

            {/* Bullets */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[11px] font-black uppercase tracking-widest text-white/50">
                  {bullets.length} Key Stories — {date}
                </h2>
                <button onClick={() => copy(bullets.map((b,i)=>`${i+1}. ${b}`).join('\n'), 'bullets')}
                  className="text-[9px] text-violet-400 hover:text-violet-300 font-semibold">
                  {copied==='bullets' ? '✓ Copied all' : 'Copy all'}
                </button>
              </div>
              <div className="space-y-2">
                {bullets.map((bullet, i) => (
                  <div key={i} className="flex gap-3 items-start group p-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-red-600/20 text-red-400 text-[9px] font-black flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-[12px] text-white/80 leading-relaxed flex-1">{bullet}</p>
                    <button onClick={() => copy(bullet, `b-${i}`)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 text-[8px] text-violet-400 transition-opacity">
                      {copied===`b-${i}` ? '✓' : 'Copy'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Generate script CTA */}
            <div className="border border-white/[0.07] rounded-2xl overflow-hidden">
              <button
                onClick={script ? () => setShowScript(s => !s) : generateScript}
                disabled={generatingScript}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">🎙</span>
                  <div className="text-left">
                    <p className="text-[11px] font-black text-white">
                      {script ? `World Cup Flash News — ${date}` : 'Generate Flash News Script'}
                    </p>
                    <p className="text-[9px] text-white/35 mt-0.5">
                      {script ? 'Tap to expand · read straight to camera' : '60–90 second on-camera script · no notes or cues · just words'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {generatingScript && <span className="animate-spin inline-block w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full" />}
                  {!script && !generatingScript && (
                    <span className="text-[10px] px-3 py-1 rounded-full text-white font-bold" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                      Generate
                    </span>
                  )}
                  {script && <span className="text-white/30 text-sm">{showScript ? '▲' : '▼'}</span>}
                </div>
              </button>

              {showScript && script && (
                <div className="border-t border-white/[0.07] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Read straight to camera</p>
                    <button onClick={() => copy(script, 'script')} className="text-[9px] text-violet-400 font-semibold">
                      {copied==='script' ? '✓ Copied' : 'Copy script'}
                    </button>
                  </div>
                  <div className="text-[13px] text-white/85 leading-[1.9] whitespace-pre-wrap font-medium">
                    {script}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
