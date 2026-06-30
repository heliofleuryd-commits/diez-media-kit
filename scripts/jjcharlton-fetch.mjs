#!/usr/bin/env node
/**
 * Step 1 of 3 — pick @jjcharlton's 50 BEST videos of the last year (by views).
 *
 * Pulls a pool of recent videos, keeps the last 365 days, sorts by view count,
 * takes the top 50, and writes:
 *   ~/Downloads/jjcharlton_videos.txt   (human-readable ranked list)
 *   ~/Downloads/jjcharlton_urls.json    (machine list for the transcribe step)
 *
 * Prereqs: brew install yt-dlp ffmpeg
 * Usage:   node scripts/jjcharlton-fetch.mjs
 *   If TikTok blocks it, log into TikTok in Chrome and re-run with:
 *          YT_DLP_COOKIES=chrome node scripts/jjcharlton-fetch.mjs
 */

import { execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CHANNEL  = 'https://www.tiktok.com/@jjcharlton';
const POOL     = 150;   // how many recent videos to consider before ranking
const TOP      = 50;    // how many of the best to keep
const DAYS     = 365;   // "of the year"
const OUT_TXT  = join(homedir(), 'Downloads', 'jjcharlton_videos.txt');
const OUT_JSON = join(homedir(), 'Downloads', 'jjcharlton_urls.json');

const cookieArgs = process.env.YT_DLP_COOKIES ? ['--cookies-from-browser', process.env.YT_DLP_COOKIES] : [];

console.log(`Pulling up to ${POOL} videos from ${CHANNEL} to rank by views …`);
console.log('(full metadata extraction — this can take a few minutes)\n');

let raw;
try {
  raw = execFileSync('yt-dlp', [
    '--dump-json',          // full info per video → includes view_count
    '--skip-download',
    '--no-warnings',
    '--playlist-end', String(POOL),
    ...cookieArgs,
    CHANNEL,
  ], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 256, timeout: 600_000 });
} catch (e) {
  console.error('yt-dlp failed:', (e.stderr || e.message || '').toString().slice(0, 500));
  console.error('\nIf this is an access/blocked error, log into TikTok in Chrome and re-run with:');
  console.error('  YT_DLP_COOKIES=chrome node scripts/jjcharlton-fetch.mjs');
  process.exit(1);
}

const all = raw.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
console.log(`Got ${all.length} videos.`);

const cutoff = Number(
  new Date(Date.now() - DAYS * 86400_000).toISOString().slice(0, 10).replace(/-/g, '')
); // YYYYMMDD

const recent = all.filter(v => {
  const d = Number(v.upload_date || 0);
  return !d || d >= cutoff; // keep if within the year (or unknown date)
});

const ranked = recent
  .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
  .slice(0, TOP);

console.log(`Kept last ${DAYS} days → ${recent.length} videos; taking top ${ranked.length} by views.\n`);

const jsonOut = [];
const lines = [
  `@jjcharlton — top ${ranked.length} videos by views (last ${DAYS} days)`,
  `Fetched: ${new Date().toISOString()}`,
  '='.repeat(80),
  '',
];

for (const [i, v] of ranked.entries()) {
  const url   = v.webpage_url || v.url || `https://www.tiktok.com/@jjcharlton/video/${v.id}`;
  const d     = v.upload_date || '';
  const date  = d.length === 8 ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : 'unknown';
  const views = v.view_count != null ? Number(v.view_count) : 0;
  const dur   = v.duration != null ? `${Math.floor(v.duration/60)}m${String(v.duration%60).padStart(2,'0')}s` : '';
  const cap   = (v.description || v.title || '').replace(/\n+/g, ' ').trim().slice(0, 300);

  lines.push(`[${String(i+1).padStart(2,'0')}] ${date}  ${views.toLocaleString()} views  ${dur}`);
  lines.push(`URL: ${url}`);
  lines.push(`Caption: ${cap}`);
  lines.push('');

  jsonOut.push({ rank: i + 1, id: v.id, url, date, views, duration: v.duration || 0, caption: cap, likes: v.like_count || 0 });
}

writeFileSync(OUT_TXT, lines.join('\n'), 'utf8');
writeFileSync(OUT_JSON, JSON.stringify(jsonOut, null, 2), 'utf8');

console.log(`Saved ranked list → ${OUT_TXT}`);
console.log(`Saved url list    → ${OUT_JSON}`);
console.log(`\nNext: python3 scripts/jjcharlton-transcripts.py`);
