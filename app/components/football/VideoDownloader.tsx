'use client';

import { useState, useRef } from 'react';

const HELPER_URL = 'http://localhost:8765';

type Status = 'idle' | 'checking' | 'offline' | 'ready' | 'running' | 'done' | 'error';

export function VideoDownloader() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [log, setLog] = useState('');
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  async function checkHelper() {
    setStatus('checking');
    try {
      const r = await fetch(`${HELPER_URL}/health`);
      const d = await r.json();
      setStatus(d.ok ? 'ready' : 'offline');
      return d.ok;
    } catch {
      setStatus('offline');
      return false;
    }
  }

  async function start() {
    if (!url.trim()) return;
    setLog('');
    setSavedPath(null);

    const helperUp = status === 'ready' || (await checkHelper());
    if (!helperUp) return;

    setStatus('running');
    try {
      const res = await fetch(`${HELPER_URL}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.body) throw new Error('No response stream');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        buf += chunk;
        setLog(prev => {
          const next = prev + chunk;
          requestAnimationFrame(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; });
          return next;
        });

        const doneMatch = buf.match(/__DONE__:(.+)/);
        const errMatch = buf.match(/__ERROR__:(.+)/);
        if (doneMatch) setSavedPath(doneMatch[1].trim());
        if (errMatch && !doneMatch) setStatus('error');
      }

      setStatus(prev => (prev === 'error' ? 'error' : 'done'));
    } catch (e) {
      setLog(prev => prev + `\n${e instanceof Error ? e.message : 'Download failed'}\n`);
      setStatus('error');
    }
  }

  const isRunning = status === 'running';

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="max-w-2xl mx-auto px-5 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Video Downloader</h1>
          <p className="text-[12px] text-gray-500 mt-1">
            Paste a YouTube or TikTok link — downloads the highest quality available straight to your <span className="font-semibold text-gray-700">Downloads</span> folder.
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 mb-5">
          <p className="text-[11px] text-amber-800 leading-relaxed">
            <span className="font-bold">One-time setup:</span> this runs through a small local helper on your Mac (no upload limits or timeouts). Open Terminal and run:
          </p>
          <pre className="mt-1.5 text-[11px] font-mono bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 text-gray-700 overflow-x-auto">node scripts/video-downloader-server.mjs</pre>
          <p className="text-[10.5px] text-amber-700 mt-1.5">Keep that terminal tab open while you use this page. (Needs <code className="font-mono">yt-dlp</code> + <code className="font-mono">ffmpeg</code> — already installed for the content pipeline.)</p>
        </div>

        <div className="flex items-center gap-2 mb-1.5">
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !isRunning) start(); }}
            placeholder="https://www.youtube.com/watch?v=… or https://www.tiktok.com/@user/video/…"
            className="flex-1 text-[12px] bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder-gray-300 text-gray-800"
          />
          <button
            onClick={start}
            disabled={isRunning || !url.trim()}
            className="px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider text-white shrink-0 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
          >
            {isRunning ? 'Downloading…' : 'Download'}
          </button>
        </div>

        {status === 'offline' && (
          <p className="text-[11px] text-red-600 font-semibold mb-3">
            ⚠ Can&apos;t reach the local helper at localhost:8765 — make sure the terminal command above is running.
          </p>
        )}

        {(log || isRunning) && (
          <pre
            ref={logRef}
            className="mt-3 text-[10.5px] font-mono bg-gray-900 text-gray-200 rounded-xl px-3.5 py-3 leading-relaxed overflow-y-auto whitespace-pre-wrap"
            style={{ maxHeight: 280 }}
          >
            {log
              .replace(/__FILE__:.+\n?/g, '')
              .replace(/__DONE__:.+\n?/g, '')
              .replace(/__ERROR__:.+\n?/g, '')
              || 'Waiting for output…'}
          </pre>
        )}

        {status === 'done' && savedPath && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
            <p className="text-[11.5px] text-emerald-800 font-semibold">✓ Saved to your Downloads folder</p>
            <p className="text-[10.5px] text-emerald-700 font-mono mt-0.5 break-all">{savedPath}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5">
            <p className="text-[11.5px] text-red-700 font-semibold">✗ Download failed — check the log above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
