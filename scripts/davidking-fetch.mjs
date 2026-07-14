#!/usr/bin/env node
/**
 * Step 1 of 3 — pick @DavidKingStories' top 50 YouTube Shorts AND top 50 TikToks
 * of the last year (by views).
 *
 * Writes:
 *   ~/Downloads/davidking_videos.txt   (human-readable ranked list, both platforms)
 *   ~/Downloads/davidking_urls.json    (machine list for the transcribe step)
 *   ~/Downloads/davidking_titles.txt   (titles + views, for the YouTube Lab)
 *
 * Prereqs: pip3 install yt-dlp   (and: brew install ffmpeg)
 * Usage:   node scripts/davidking-fetch.mjs
 *   If TikTok blocks it, log into TikTok in Chrome and re-run with:
 *          YT_DLP_COOKIES=chrome node scripts/davidking-fetch.mjs
 */

import { execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const SOURCES = [
  { name: 'YouTube', url: 'https://www.youtube.com/@DavidKingStories/shorts' },
  { name: 'TikTok',  url: 'https://www.tiktok.com/@davidkingstories' },
];
const POOL = 250;   // recent videos to consider per platform before ranking
const TOP  = 50;    // top-by-views to keep per platform
const DAYS = 365;

const OUT_TXT    = join(homedir(), 'Downloads', 'davidking_videos.txt');
const OUT_JSON   = join(homedir(), 'Downloads', 'davidking_urls.json');
const OUT_TITLES = join(homedir(), 'Downloads', 'davidking_titles.txt');

const cookieArgs = process.env.YT_DLP_COOKIES ? ['--cookies-from-browser', process.env.YT_DLP_COOKIES] : [];
const cutoff = Number(new Date(Date.now() - DAYS * 86400_000).toISOString().slice(0, 10).replace(/-/g, ''));

const jsonOut = [];
const lines = [`@DavidKingStories — top ${TOP} by views on each platform (last ${DAYS} days)`, `Fetched: ${new Date().toISOString()}`, '='.repeat(80), ''];
const titleLines = [`@DavidKingStories — top titles by views (last ${DAYS} days)`, ''];

for (const src of SOURCES) {
  console.log(`\n=== ${src.name}: ${src.url} ===`);
  console.log(`Pulling up to ${POOL} videos to rank by views (full metadata — a few minutes)…`);
  let raw = '';
  try {
    raw = execFileSync('python3', [
      '-m', 'yt_dlp', '--dump-json', '--skip-download', '--no-warnings',
      '--playlist-end', String(POOL), ...cookieArgs, src.url,
    ], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 512, timeout: 900_000 });
  } catch (e) {
    console.error(`  ${src.name} failed:`, (e.stderr || e.message || '').toString().slice(0, 400));
    if (src.name === 'TikTok') console.error('  → If blocked, log into TikTok in Chrome and re-run with YT_DLP_COOKIES=chrome');
    continue; // keep whatever the other platform produced
  }

  const all = raw.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const recent = all.filter(v => { const d = Number(v.upload_date || 0); return !d || d >= cutoff; });
  const ranked = recent.sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, TOP);
  console.log(`  Got ${all.length}; kept last year ${recent.length}; taking top ${ranked.length} by views.`);

  lines.push(`\n## ${src.name} — top ${ranked.length}\n`);
  titleLines.push(`\n## ${src.name}\n`);

  for (const [i, v] of ranked.entries()) {
    const url   = v.webpage_url || v.url || (src.name === 'TikTok' ? `https://www.tiktok.com/@davidkingstories/video/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`);
    const d     = v.upload_date || '';
    const date  = d.length === 8 ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : 'unknown';
    const views = v.view_count != null ? Number(v.view_count) : 0;
    const title = (v.title || v.description || '').replace(/\n+/g, ' ').trim().slice(0, 300);

    lines.push(`[${src.name[0]}${String(i+1).padStart(2,'0')}] ${date}  ${views.toLocaleString()} views`);
    lines.push(`URL: ${url}`);
    lines.push(`Title: ${title}`);
    lines.push('');
    titleLines.push(`${String(i+1).padStart(2,'0')}. "${title}" — ${views.toLocaleString()} views`);
    jsonOut.push({ source: src.name, rank: i + 1, id: v.id, url, date, views, duration: v.duration || 0, title });
  }
}

writeFileSync(OUT_TXT, lines.join('\n'), 'utf8');
writeFileSync(OUT_JSON, JSON.stringify(jsonOut, null, 2), 'utf8');
writeFileSync(OUT_TITLES, titleLines.join('\n'), 'utf8');

console.log(`\nSaved ${jsonOut.length} videos across ${SOURCES.length} platforms.`);
console.log(`  ranked list → ${OUT_TXT}`);
console.log(`  url list    → ${OUT_JSON}`);
console.log(`  titles      → ${OUT_TITLES}`);
console.log(`\nNext: python3 scripts/davidking-transcripts.py`);
