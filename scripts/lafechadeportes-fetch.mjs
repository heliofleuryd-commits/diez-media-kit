#!/usr/bin/env node
/**
 * Pull the last 50 @lafechadeportes TikTok videos → ~/Downloads/lafechadeportes_videos.txt
 * Usage: node scripts/lafechadeportes-fetch.mjs
 */

import { execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CHANNEL = 'https://www.tiktok.com/@lafechadeportes';
const LIMIT   = 50;
const OUT     = join(homedir(), 'Downloads', 'lafechadeportes_videos.txt');

console.log(`Fetching last ${LIMIT} videos from ${CHANNEL} …`);

let raw;
try {
  raw = execFileSync('yt-dlp', [
    '--flat-playlist',
    '--dump-json',
    '--no-warnings',
    '--playlist-end', String(LIMIT),
    CHANNEL,
  ], { encoding: 'utf8', timeout: 120_000 });
} catch (e) {
  console.error('yt-dlp failed:', e.stderr || e.message);
  process.exit(1);
}

const videos = raw.split('\n').filter(Boolean).map(line => {
  try { return JSON.parse(line); } catch { return null; }
}).filter(Boolean);

console.log(`Got ${videos.length} video(s).`);

const lines = [
  `@lafechadeportes — last ${videos.length} TikTok videos`,
  `Fetched: ${new Date().toISOString()}`,
  '='.repeat(80),
  '',
];

for (const [i, v] of videos.entries()) {
  const url  = v.webpage_url || v.url || `https://www.tiktok.com/video/${v.id}`;
  const d    = v.upload_date || '';
  const date = d ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : 'unknown';
  const views = v.view_count != null ? `${Number(v.view_count).toLocaleString()} views` : '';
  const dur   = v.duration   != null ? `${Math.floor(v.duration/60)}m${String(v.duration%60).padStart(2,'0')}s` : '';
  const desc  = (v.description || v.title || '').replace(/\n+/g, ' ').trim().slice(0, 300);

  lines.push(`[${String(i+1).padStart(2,'0')}] ${date}  ${views}  ${dur}`);
  lines.push(`URL: ${url}`);
  lines.push(`Caption: ${desc}`);
  lines.push('');
}

writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log(`\nSaved → ${OUT}`);
