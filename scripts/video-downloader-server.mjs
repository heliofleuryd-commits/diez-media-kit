#!/usr/bin/env node
/**
 * Local video downloader helper for the diez.gg "Skill Library" / Football tools.
 *
 * Runs yt-dlp on YOUR machine (no Vercel timeouts/storage limits) and saves
 * the result straight to ~/Downloads. The diez.gg page in the browser talks
 * to this server on localhost and streams progress live.
 *
 * Prerequisites: brew install yt-dlp ffmpeg
 *
 * Usage:
 *   node scripts/video-downloader-server.mjs
 *   (leave it running in a terminal tab while you use the Downloader page)
 */

import http from 'http';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

const PORT = 8765;
const DOWNLOADS_DIR = path.join(os.homedir(), 'Downloads');
const ALLOWED_HOSTS = [
  'youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com',
  'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com',
];

function isAllowedUrl(raw) {
  try {
    const u = new URL(raw);
    return ALLOWED_HOSTS.includes(u.hostname.toLowerCase()) && (u.protocol === 'https:' || u.protocol === 'http:');
  } catch {
    return false;
  }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer((req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, downloadsDir: DOWNLOADS_DIR }));
  }

  if (req.method === 'POST' && req.url === '/download') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let url;
      try {
        ({ url } = JSON.parse(body));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }));
      }

      if (typeof url !== 'string' || !isAllowedUrl(url)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Only youtube.com / youtu.be / tiktok.com links are allowed' }));
      }

      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      });

      const isYouTube = /youtube\.com|youtu\.be/i.test(url);
      const outTemplate = path.join(DOWNLOADS_DIR, '%(title).200B [%(id)s].%(ext)s');
      const args = [
        '-f', 'bv*+ba/b',           // best video + best audio, falling back to best combined
        '--merge-output-format', 'mp4',
        '--no-playlist',
        '--newline',
        '-o', outTemplate,
        '--print', 'after_move:__FILE__:%(filepath)s',
        // YouTube now requires a PO token for most clients (web/ios/tv) or it 403s
        // mid-download — the android_vr client still serves full-quality formats
        // (including 1080p) without one.
        ...(isYouTube ? ['--extractor-args', 'youtube:player_client=android_vr'] : []),
        url,
      ];

      res.write(`Starting download…\n$ yt-dlp ${args.join(' ')}\n\n`);

      const proc = spawn('yt-dlp', args);
      let savedPath = null;

      proc.stdout.on('data', d => {
        const text = d.toString();
        const match = text.match(/__FILE__:(.+)/);
        if (match) savedPath = match[1].trim();
        res.write(text);
      });
      proc.stderr.on('data', d => res.write(d.toString()));

      proc.on('error', err => {
        res.write(`\n__ERROR__: Failed to launch yt-dlp — is it installed? (brew install yt-dlp ffmpeg)\n${err.message}\n`);
        res.end();
      });

      proc.on('close', code => {
        if (code === 0 && savedPath) {
          res.write(`\n__DONE__:${savedPath}\n`);
        } else {
          res.write(`\n__ERROR__: yt-dlp exited with code ${code}\n`);
        }
        res.end();
      });
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n📥  Video downloader helper running at http://localhost:${PORT}`);
  console.log(`    Saving downloads to: ${DOWNLOADS_DIR}`);
  console.log(`    Keep this running, then open diez.gg/football/downloader\n`);
});
