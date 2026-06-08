'use client';

import { useState, useRef } from 'react';

const HELPER_URL = 'http://localhost:8765';

type Status = 'idle' | 'checking' | 'offline' | 'ready' | 'running' | 'done' | 'error';
type OS = 'mac' | 'windows';

const STEP_BOX = 'mt-1.5 text-[11px] font-mono bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 overflow-x-auto';

function SetupGuide() {
  const [os, setOs] = useState<OS>('mac');

  return (
    <details className="group rounded-xl border border-gray-200 bg-gray-50 mb-5 open:bg-white">
      <summary className="cursor-pointer select-none px-3.5 py-2.5 text-[11.5px] font-bold text-gray-700 flex items-center justify-between">
        <span>📋 How to set this up on your computer (one-time, ~5 min)</span>
        <span className="text-gray-400 text-[10px] group-open:hidden">click to expand</span>
        <span className="text-gray-400 text-[10px] hidden group-open:inline">click to collapse</span>
      </summary>

      <div className="px-3.5 pb-3.5 pt-1">
        <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
          Downloading needs <code className="font-mono text-gray-700">yt-dlp</code> + <code className="font-mono text-gray-700">ffmpeg</code> running on
          <em> your</em> computer — that's what avoids upload limits and timeouts on long videos. This page talks to a small
          helper program on <code className="font-mono text-gray-700">localhost:8765</code>. Set it up once per computer (Mac and PC both supported),
          then just keep the terminal window open whenever you want to download.
        </p>

        <div className="flex gap-1.5 mb-3">
          <button onClick={() => setOs('mac')}
            className={`px-3 py-1.5 rounded-lg text-[10.5px] font-bold transition-all ${os === 'mac' ? 'bg-violet-100 text-violet-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}>
            🍎 Mac
          </button>
          <button onClick={() => setOs('windows')}
            className={`px-3 py-1.5 rounded-lg text-[10.5px] font-bold transition-all ${os === 'windows' ? 'bg-violet-100 text-violet-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}>
            🪟 Windows
          </button>
        </div>

        {os === 'mac' ? (
          <ol className="space-y-3 text-[11px] text-gray-600 leading-relaxed list-decimal list-inside">
            <li>
              <span className="font-semibold text-gray-800">Install Homebrew</span> (skip if you already have it — open Terminal and run):
              <pre className={STEP_BOX}>{'/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'}</pre>
            </li>
            <li>
              <span className="font-semibold text-gray-800">Install Node, yt-dlp and ffmpeg</span> (one command installs all three):
              <pre className={STEP_BOX}>brew install node yt-dlp ffmpeg</pre>
            </li>
            <li>
              <span className="font-semibold text-gray-800">Download the helper script</span> — right-click and save, or run:
              <pre className={STEP_BOX}>{'curl -O '}<a href="/video-downloader-server.mjs" download className="underline text-violet-600 hover:text-violet-700">https://diez.gg/video-downloader-server.mjs</a></pre>
            </li>
            <li>
              <span className="font-semibold text-gray-800">Run it</span> from the folder where you saved it (e.g. your Downloads folder):
              <pre className={STEP_BOX}>cd ~/Downloads && node video-downloader-server.mjs</pre>
              Keep that Terminal window open — that's the “local helper” this page talks to. Downloaded videos land in your <span className="font-semibold">Downloads</span> folder.
            </li>
          </ol>
        ) : (
          <ol className="space-y-3 text-[11px] text-gray-600 leading-relaxed list-decimal list-inside">
            <li>
              <span className="font-semibold text-gray-800">Install Node.js</span> — download and run the installer from{' '}
              <span className="font-mono text-gray-700">nodejs.org</span> (choose the LTS version), or via winget in PowerShell:
              <pre className={STEP_BOX}>winget install OpenJS.NodeJS.LTS</pre>
            </li>
            <li>
              <span className="font-semibold text-gray-800">Install yt-dlp and ffmpeg</span> (PowerShell):
              <pre className={STEP_BOX}>{'winget install yt-dlp.yt-dlp\nwinget install Gyan.FFmpeg'}</pre>
            </li>
            <li>
              <span className="font-semibold text-gray-800">Download the helper script</span> — right-click{' '}
              <a href="/video-downloader-server.mjs" download className="underline text-violet-600 hover:text-violet-700">this link</a> and “Save link as…” into your Downloads folder.
            </li>
            <li>
              <span className="font-semibold text-gray-800">Run it</span> — open PowerShell, then:
              <pre className={STEP_BOX}>{'cd $HOME\\Downloads; node video-downloader-server.mjs'}</pre>
              Keep that PowerShell window open — that's the “local helper” this page talks to. Downloaded videos land in your <span className="font-semibold">Downloads</span> folder.
            </li>
          </ol>
        )}

        <p className="text-[10.5px] text-gray-400 mt-3">
          You only need to do this once per computer. Next time, just reopen the terminal/PowerShell window, run the same{' '}
          <code className="font-mono">node video-downloader-server.mjs</code> command, and come back to this page.
        </p>
      </div>
    </details>
  );
}

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

        <SetupGuide />

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
            ⚠ Can&apos;t reach the local helper at localhost:8765 — make sure the helper is running on this computer (see the setup guide above).
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
