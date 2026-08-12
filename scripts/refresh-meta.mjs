#!/usr/bin/env node
/**
 * refresh-meta.mjs — twice-monthly (1st & 15th) auto-refresh, run by GitHub Actions.
 *
 * 1. Scrapes warzoneloadout.games and uses Claude Haiku to extract the current
 *    top-3 close-range + top-3 long-range meta loadouts, then writes them into
 *    app/loadouts/data.json (same schema the loadouts page renders).
 * 2. Fetches fresh follower counts (TikTok, Instagram, YouTube) and writes them
 *    into app/api/stats/followers.json (the live-fetch fallbacks).
 *
 * Env: ANTHROPIC_API_KEY (loadout extraction), YOUTUBE_API_KEY (YT subs).
 * No writes to git/Vercel here — the workflow commits + triggers the deploy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOADOUTS_JSON = path.join(ROOT, 'app/loadouts/data.json');
const FOLLOWERS_JSON = path.join(ROOT, 'app/api/stats/followers.json');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const today = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

const log = (...a) => console.log('[refresh-meta]', ...a);

// ─── Loadouts ──────────────────────────────────────────────────────────────
async function fetchText(url, headers = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...headers } });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.text();
}

function slugFor(weapon) {
  return String(weapon).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// wzstats weapon images: prefer the hyphenated slug, fall back to no separators.
async function resolveImage(weapon) {
  const candidates = [slugFor(weapon), String(weapon).toLowerCase().replace(/[^a-z0-9]+/g, '')];
  for (const s of candidates) {
    try {
      const r = await fetch(`https://img.wzstats.gg/${s}/public`, { method: 'HEAD' });
      if (r.ok) return `https://img.wzstats.gg/${s}/public`;
    } catch {}
  }
  return `https://img.wzstats.gg/${candidates[0]}/public`; // best guess; page hides broken imgs gracefully
}

async function refreshLoadouts() {
  if (!process.env.ANTHROPIC_API_KEY) { log('SKIP loadouts — no ANTHROPIC_API_KEY'); return false; }
  log('scraping warzoneloadout.games…');
  const html = await fetchText('https://warzoneloadout.games/');
  // Strip tags to a lean text blob so the whole meta list fits the model context.
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .slice(0, 60000);

  const client = new Anthropic();
  const prompt = `Below is the text of warzoneloadout.games, a Call of Duty Warzone meta site.
Extract the current TOP 3 CLOSE RANGE loadouts and TOP 3 LONG RANGE loadouts (ranked best first).

For each loadout give: the weapon name, its weapon type (SMG, Assault Rifle, LMG, etc.), and its attachments as {slot, name} pairs (slot = Muzzle/Barrel/Optic/Stock/Underbarrel/Magazine/Rear Grip/Fire Mods; name = the exact attachment). 4–5 attachments each is typical — include what the site lists.

Return ONLY valid JSON, no prose, in exactly this shape:
{"closeRange":[{"weapon":"CBRS-3","type":"SMG","attachments":[{"slot":"Muzzle","name":"..."}]}],"longRange":[{"weapon":"MXR-17","type":"Assault Rifle","attachments":[{"slot":"Muzzle","name":"..."}]}]}

--- SITE TEXT ---
${text}`;

  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });
  const raw = res.content[0]?.type === 'text' ? res.content[0].text : '';
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim();
  let data;
  try { data = JSON.parse(cleaned); }
  catch { const m = cleaned.match(/\{[\s\S]+\}/); data = m ? JSON.parse(m[0]) : null; }

  const close = data?.closeRange, long = data?.longRange;
  if (!Array.isArray(close) || !Array.isArray(long) || close.length < 3 || long.length < 3) {
    throw new Error('extraction did not return 3 close + 3 long loadouts');
  }

  const build = async (arr, rank) => Promise.all(arr.slice(0, 3).map(async (g, i) => ({
    id: slugFor(g.weapon).replace(/-/g, ''),
    weapon: g.weapon,
    type: g.type || 'Weapon',
    game: 'BO7',
    rank,
    rankNum: i + 1,
    image: await resolveImage(g.weapon),
    attachments: (g.attachments || []).map(a => ({ slot: a.slot, name: a.name })),
    updatedAt: today,
  })));

  const out = {
    updatedAt: today,
    longRange: await build(long, 'Long Range'),
    shortRange: await build(close, 'Close Range'),
  };
  fs.writeFileSync(LOADOUTS_JSON, JSON.stringify(out, null, 2) + '\n');
  log('loadouts updated:',
    'CLOSE=' + out.shortRange.map(g => g.weapon).join(', '),
    '| LONG=' + out.longRange.map(g => g.weapon).join(', '));
  return true;
}

// ─── Followers ───────────────────────────────────────────────────────────────
function parseHumanNum(s) {
  const m = String(s).replace(/,/g, '').match(/([\d.]+)\s*([KMB]?)/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || '').toUpperCase()] || 1;
  return Math.round(n * mult);
}

async function tiktokFollowers(handle) {
  try {
    const html = await fetchText(`https://www.tiktok.com/@${handle}`);
    const m = html.match(/"followerCount":(\d+)/);
    return m ? parseInt(m[1]) : null;
  } catch (e) { log(`TikTok @${handle} failed: ${e.message}`); return null; }
}

async function igFollowers(handle) {
  try {
    const html = await fetchText(`https://www.instagram.com/${handle}/`,
      { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' });
    const m = html.match(/content="([\d.,KMB]+)\s+Followers/i);
    return m ? parseHumanNum(m[1]) : null;
  } catch (e) { log(`IG @${handle} failed: ${e.message}`); return null; }
}

async function ytSubs(handle) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${handle}&key=${key}`);
    const j = await r.json();
    const n = parseInt(j.items?.[0]?.statistics?.subscriberCount || '0');
    return n || null;
  } catch (e) { log(`YT @${handle} failed: ${e.message}`); return null; }
}

async function refreshFollowers() {
  log('fetching follower counts…');
  const cur = JSON.parse(fs.readFileSync(FOLLOWERS_JSON, 'utf-8'));
  // Only overwrite when we actually got a fresh number; otherwise keep the last good value.
  const set = (obj, key, val) => { if (val && val > 0) obj[key] = val; };

  const [tGg, tBall, tKnows, yImdiez, yBall, iGg, iBall] = await Promise.all([
    tiktokFollowers('diez.gg'), tiktokFollowers('diez.ball'), tiktokFollowers('diezknowsball'),
    ytSubs('imDiez'), ytSubs('diezball'),
    igFollowers('diez.gg'), igFollowers('diezballl'),
  ]);
  set(cur.tiktok, 'diez.gg', tGg); set(cur.tiktok, 'diez.ball', tBall); set(cur.tiktok, 'diezknowsball', tKnows);
  set(cur.youtube, 'imDiez', yImdiez); set(cur.youtube, 'diezball', yBall);
  set(cur.instagram, 'diez.gg', iGg); set(cur.instagram, 'diezballl', iBall);
  cur.updatedAt = today;

  fs.writeFileSync(FOLLOWERS_JSON, JSON.stringify(cur, null, 2) + '\n');
  log('followers updated:', JSON.stringify(cur));
  return true;
}

// ─── Main ──────────────────────────────────────────────────────────────────
(async () => {
  let ok = true;
  try { await refreshLoadouts(); } catch (e) { ok = false; log('LOADOUTS ERROR:', e.message); }
  try { await refreshFollowers(); } catch (e) { ok = false; log('FOLLOWERS ERROR:', e.message); }
  if (!ok) process.exitCode = 1; // surfaces a failed run in the Actions log, but keeps any partial writes
})();
