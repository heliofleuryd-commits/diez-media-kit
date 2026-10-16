#!/usr/bin/env node
/**
 * Analyzes @lafechadeportes TikTok channel and generates a skill profile + gap analysis.
 *
 * Prerequisites:
 *   brew install yt-dlp ffmpeg
 *
 * Usage:
 *   node --env-file=.env.local scripts/analyze-lafechadeportes.mjs
 *
 * If TikTok blocks yt-dlp, re-run with cookies:
 *   YT_DLP_COOKIES=chrome node --env-file=.env.local scripts/analyze-lafechadeportes.mjs
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, '..');
const OUT_DIR   = '/tmp/lafechadeportes';
const SKILLS_DIR = path.join(ROOT, 'content-plan', 'skills');
const PROFILE_FILE = path.join(SKILLS_DIR, 'channel-lafechadeportes-profile.md');
const GAP_FILE   = path.join(SKILLS_DIR, 'lafechadeportes-gap-analysis.md');
const CHANNEL    = 'https://www.tiktok.com/@lafechadeportes';
const N_VIDEOS   = 50;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseVTT(vtt) {
  return vtt
    .split('\n')
    .filter(l =>
      l.trim() &&
      !l.startsWith('WEBVTT') &&
      !l.startsWith('NOTE') &&
      !/^\d{2}:\d{2}/.test(l) &&
      !/^[\d]+$/.test(l)
    )
    .join(' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function shell(cmd, opts = {}) {
  try {
    execSync(cmd, { stdio: 'inherit', ...opts });
    return true;
  } catch {
    return false;
  }
}

// ── Step 1: Check dependencies ───────────────────────────────────────────────

console.log('🎬  @lafechadeportes Deep Analysis Tool\n');

try { execSync('yt-dlp --version', { stdio: 'pipe' }); }
catch {
  console.error('❌  yt-dlp not found.\n    Run: brew install yt-dlp ffmpeg\n    Then re-run this script.');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌  ANTHROPIC_API_KEY not set.\n    Run: node --env-file=.env.local scripts/analyze-lafechadeportes.mjs');
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Step 2: Scrape videos + auto-captions ────────────────────────────────────

const cookieFlag = process.env.YT_DLP_COOKIES ? `--cookies-from-browser ${process.env.YT_DLP_COOKIES}` : '';

console.log(`📥  Scraping last ${N_VIDEOS} videos from @lafechadeportes...`);
console.log('    Getting metadata + Spanish auto-captions (no video download)\n');

const ytCmd = [
  'yt-dlp',
  '--write-auto-subs',
  '--sub-langs "es,es-419,es-ES,es-MX,es-CO"',
  '--sub-format vtt',
  '--skip-download',
  '--write-info-json',
  '--no-warnings',
  `--playlist-items 1-${N_VIDEOS}`,
  `-o "${OUT_DIR}/%(upload_date)s_%(id)s"`,
  cookieFlag,
  `"${CHANNEL}"`,
].filter(Boolean).join(' ');

const scraped = shell(ytCmd);
if (!scraped) {
  console.log('⚠️   yt-dlp finished with warnings — continuing with whatever was downloaded.\n');
  console.log('    💡 If you got 0 videos, TikTok may need browser cookies. Re-run with:');
  console.log('       YT_DLP_COOKIES=chrome node --env-file=.env.local scripts/analyze-lafechadeportes.mjs\n');
}

// ── Step 3: Parse all files ───────────────────────────────────────────────────

console.log('\n📊  Parsing downloaded files...');
const allFiles = fs.readdirSync(OUT_DIR);
const infoFiles = allFiles.filter(f => f.endsWith('.info.json')).sort();

if (infoFiles.length === 0) {
  console.error('\n❌  No video data found in', OUT_DIR);
  console.error('    TikTok likely blocked the scrape. Try:');
  console.error('    1. Open TikTok in Chrome, stay logged in');
  console.error('    2. Re-run with: YT_DLP_COOKIES=chrome node --env-file=.env.local scripts/analyze-lafechadeportes.mjs');
  process.exit(1);
}

const videos = [];
for (const infoFile of infoFiles.slice(0, N_VIDEOS)) {
  try {
    const raw  = fs.readFileSync(path.join(OUT_DIR, infoFile), 'utf-8');
    const info = JSON.parse(raw);
    const base = infoFile.replace('.info.json', '');

    // Find any subtitle file for this video
    const subFile = allFiles.find(f => f.startsWith(base) && f.endsWith('.vtt'));
    let transcript = '';
    if (subFile) {
      const vtt = fs.readFileSync(path.join(OUT_DIR, subFile), 'utf-8');
      transcript = parseVTT(vtt);
    }

    videos.push({
      id:          info.id,
      date:        info.upload_date,
      description: (info.description || info.title || '').slice(0, 500),
      views:       info.view_count,
      likes:       info.like_count,
      hashtags:    (info.tags || []).join(' '),
      duration:    info.duration,
      transcript:  transcript || null,
    });
  } catch { /* skip corrupted entries */ }
}

const withTranscript = videos.filter(v => v.transcript).length;
console.log(`    Found ${videos.length} videos, ${withTranscript} with Spanish transcripts\n`);

if (videos.length < 5) {
  console.error('❌  Too few videos to do a meaningful analysis. Try the browser cookie approach above.');
  process.exit(1);
}

// ── Step 4: Claude deep analysis → skill profile ─────────────────────────────

console.log('🧠  Sending to Claude Opus for deep style analysis...');
console.log('    (30–60 seconds)\n');

const videoBlock = videos.map((v, i) => `
--- VIDEO ${i + 1} | ${v.date || 'unknown date'} | ${v.views?.toLocaleString() ?? '?'} views | ${v.duration ?? '?'}s ---
DESCRIPTION: ${v.description}
HASHTAGS: ${v.hashtags}
${v.transcript ? `SPANISH TRANSCRIPT:\n${v.transcript}` : '[auto-caption not available for this video]'}
`).join('\n');

const profilePrompt = `You are performing a deep creative analysis of the TikTok channel @lafechadeportes — a Spanish-language football channel — on behalf of a football creator (Diez, 3.1M followers) who wants to add this creator's style to his own scriptwriting toolkit.

Here are ${videos.length} recent videos (descriptions + Spanish auto-transcripts where available):

${videoBlock}

IMPORTANT CONTEXT:
- Diez already has skill profiles for several other football creators (analytical, informative, and emotional/storytelling styles)
- Your first job is to figure out what makes @lafechadeportes distinct — name the style precisely rather than assuming it
- The profile must be specific enough that an AI can actually write scripts in this exact style
- Include Spanish-specific techniques that can be adapted to English while keeping their power

Write a complete channel skill profile in this EXACT format. Be extremely specific — vague descriptions are useless:

# Channel Profile: @lafechadeportes

## 1. Voice & Persona
[How does he position himself? What's the relationship with the viewer? Is he a witness? A historian? An analyst? A hype-man? A poet? What does he feel, and how does the viewer feel watching?]

## 2. Vocabulary Register
[Spanish register, formal/informal, football vocabulary level, signature phrasing patterns, sentence rhythm — and how these translate to English]

## 3. Recurring Rhetorical Devices
[List each device with name, explanation, and SPECIFIC example from his videos. At least 7 devices.]

## 4. Typical Length & Pacing
[Second-by-second beat structure. What happens at 0–5s, 5–15s, etc. How fast does he speak? How does he use silence/pauses?]

## 5. Primary Audience Hook
[What specific emotions or curiosities does he press? Pride? Nostalgia? Injustice? Awe? Debate? In what sequence?]

## 6. Signature Format Patterns
[3–4 named patterns with descriptions. E.g. "Pattern A — ..." etc. Include which video topics use each pattern.]

## 7. Distinctive Techniques (what makes @lafechadeportes different)
[This is the most important section. The specific techniques that set this creator apart from other football creators. Be concrete about how he handles his core subject matter.]

## 8. How to Write in This Style — Step-by-Step Guide
[Practical guide. Start with Step 1, Step 2, etc. Specific enough that someone could follow it to write a @lafechadeportes-style script on any football topic. Include example opening lines.]`;

const profileRes = await client.messages.create({
  model: 'claude-opus-4-8',
  max_tokens: 4000,
  messages: [{ role: 'user', content: profilePrompt }],
});

const profile = profileRes.content.find(b => b.type === 'text')?.text ?? '';
fs.writeFileSync(PROFILE_FILE, profile);
console.log(`✅  Skill profile → content-plan/skills/channel-lafechadeportes-profile.md`);

// ── Step 5: Gap analysis ──────────────────────────────────────────────────────

console.log('\n🔭  Running gap analysis — what videos Diez could make in lafechadeportes style...');

const topicList = videos.map((v, i) =>
  `${i + 1}. [${v.views?.toLocaleString() ?? '?'} views] ${v.description.slice(0, 120)}`
).join('\n');

const gapPrompt = `You have just analyzed @lafechadeportes's last ${videos.length} TikTok videos. Here are the topics/descriptions:

${topicList}

Now, for a football creator called Diez (@DiezFootball, @imDiez on TikTok), identify:

**PART 1 — TOPIC GAPS (stories @lafechadeportes hasn't done)**
List 20+ football stories with strong potential that @lafechadeportes has NOT covered, in the same lane/style as this creator. Focus on:
- Stories that fit this creator's distinctive angle
- Underdog/redemption arcs
- Historical moments or forgotten heroes
- World Cup 2026 storylines (specific nations, players, backstories)
- Stories that would hit hard in English-speaking TikTok (US/UK audience)

**PART 2 — ANGLES HE'S DONE THAT DIEZ COULD DO BETTER**
Pick 5 topics he covered and suggest a sharper, more English-audience angle for the same story.

**PART 3 — WORLD CUP 2026 SCRIPTS (priority)**
10 specific World Cup 2026 scripts in @lafechadeportes style. Give each one:
- Title
- The hook (1 sentence)
- Why it'll hit hard

Format clearly with headers and numbered lists. This will be loaded into a Studio AI chat for Diez to work from.`;

const gapRes = await client.messages.create({
  model: 'claude-opus-4-8',
  max_tokens: 3000,
  messages: [{ role: 'user', content: gapPrompt }],
});

const gapText = gapRes.content.find(b => b.type === 'text')?.text ?? '';
fs.writeFileSync(GAP_FILE, `# @lafechadeportes Gap Analysis\nGenerated: ${new Date().toISOString()}\n\n${gapText}`);
console.log(`✅  Gap analysis  → content-plan/skills/lafechadeportes-gap-analysis.md`);

// ── Done ──────────────────────────────────────────────────────────────────────

const inputTokens  = profileRes.usage.input_tokens  + gapRes.usage.input_tokens;
const outputTokens = profileRes.usage.output_tokens + gapRes.usage.output_tokens;
const cost = (inputTokens / 1_000_000 * 15) + (outputTokens / 1_000_000 * 75);

console.log(`
🎉  Analysis complete!
    ├─ content-plan/skills/channel-lafechadeportes-profile.md
    └─ content-plan/skills/lafechadeportes-gap-analysis.md

💰  Cost: ~$${cost.toFixed(3)}

Next steps:
  1. In Studio, type: "use lafechadeportes style, make a vid about [topic]"
  2. The gap analysis has 20+ ready-to-use story ideas — ask Studio to write any of them
`);
