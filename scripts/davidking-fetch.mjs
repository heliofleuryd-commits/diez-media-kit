#!/usr/bin/env node
/**
 * Step 1 of 3 — pick @DavidKingStories' top 30 YouTube Shorts of the last year (by views).
 *
 * Writes:
 *   ~/Downloads/davidking_videos.txt   (human-readable ranked list)
 *   ~/Downloads/davidking_urls.json    (machine list for the transcribe step)
 *   ~/Downloads/davidking_titles.txt   (titles + views, for the YouTube Lab)
 *
 * Prereqs: pip3 install yt-dlp   (and: brew install ffmpeg)
 * Usage:   node scripts/davidking-fetch.mjs
 */

import { execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CHANNEL   = 'https://www.youtube.com/@DavidKingStories/shorts';
const POOL      = 250;   // how many recent shorts to consider before ranking
const TOP       = 30;
const DAYS      = 365;
const OUT_TXT   = join(homedir(), 'Downloads', 'davidking_videos.txt');
const OUT_JSON  = join(homedir(), 'Downloads', 'davidking_urls.json');
const OUT_TITLES = join(homedir(), 'Downloads', 'davidking_titles.txt');

console.log(`Pulling up to ${POOL} shorts from ${CHANNEL} to rank by views …`);
console.log('(full metadata extraction — this can take a few minutes)\n');

let raw;
try {
  raw = execFileSync('python3', [
    '-m', 'yt_dlp',        // pip-installed yt-dlp (no separate binary needed)
    '--dump-json',
    '--skip-download',
    '--no-warnings',
    '--playlist-end', String(POOL),
    CHANNEL,
  ], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 512, timeout: 900_000 });
} catch (e) {
  console.error('yt-dlp failed:', (e.stderr || e.message || '').toString().slice(0, 500));
  process.exit(1);
}

const all = raw.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
console.log(`Got ${all.length} shorts.`);

const cutoff = Number(new Date(Date.now() - DAYS * 86400_000).toISOString().slice(0, 10).replace(/-/g, ''));
const recent = all.filter(v => { const d = Number(v.upload_date || 0); return !d || d >= cutoff; });
const ranked = recent.sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, TOP);
console.log(`Kept last ${DAYS} days → ${recent.length}; taking top ${ranked.length} by views.\n`);

const jsonOut = [];
const lines = [`@DavidKingStories — top ${ranked.length} Shorts by views (last ${DAYS} days)`, `Fetched: ${new Date().toISOString()}`, '='.repeat(80), ''];
const titleLines = [`@DavidKingStories — top ${ranked.length} Shorts titles by views (last ${DAYS} days)`, ''];

for (const [i, v] of ranked.entries()) {
  const url   = v.webpage_url || v.url || `https://www.youtube.com/watch?v=${v.id}`;
  const d     = v.upload_date || '';
  const date  = d.length === 8 ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : 'unknown';
  const views = v.view_count != null ? Number(v.view_count) : 0;
  const dur   = v.duration != null ? `${Math.floor(v.duration/60)}m${String(v.duration%60).padStart(2,'0')}s` : '';
  const title = (v.title || '').replace(/\n+/g, ' ').trim();

  lines.push(`[${String(i+1).padStart(2,'0')}] ${date}  ${views.toLocaleString()} views  ${dur}`);
  lines.push(`URL: ${url}`);
  lines.push(`Title: ${title}`);
  lines.push('');

  titleLines.push(`${String(i+1).padStart(2,'0')}. "${title}" — ${views.toLocaleString()} views`);
  jsonOut.push({ rank: i + 1, id: v.id, url, date, views, duration: v.duration || 0, title });
}

writeFileSync(OUT_TXT, lines.join('\n'), 'utf8');
writeFileSync(OUT_JSON, JSON.stringify(jsonOut, null, 2), 'utf8');
writeFileSync(OUT_TITLES, titleLines.join('\n'), 'utf8');

console.log(`Saved ranked list → ${OUT_TXT}`);
console.log(`Saved url list    → ${OUT_JSON}`);
console.log(`Saved titles      → ${OUT_TITLES}`);
console.log(`\nNext: python3 scripts/davidking-transcripts.py`);
