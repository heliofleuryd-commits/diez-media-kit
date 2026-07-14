#!/usr/bin/env node
/**
 * Step 3 of 3 — read @DavidKingStories' transcripts, KEEP ONLY THE FOOTBALL ONES,
 * park the rest, and build his football storytelling skill.
 *
 * Reads:  ~/Downloads/davidking_transcripts.txt   (from davidking-transcripts.py)
 * Writes: content-plan/skills/channel-davidkingstories-profile.md   (football skill)
 *         ~/Downloads/davidking_parked_nonfootball.txt   (the locker — other sports)
 *
 * Usage: node --env-file=.env.local scripts/analyze-davidking.mjs
 * Ringfenced: never reads or writes any other creator's skill.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT        = path.join(__dirname, '..');
const TRANSCRIPTS = path.join(homedir(), 'Downloads', 'davidking_transcripts.txt');
const PARKED      = path.join(homedir(), 'Downloads', 'davidking_parked_nonfootball.txt');
const PROFILE     = path.join(ROOT, 'content-plan', 'skills', 'channel-davidkingstories-profile.md');
const OPUS = 'claude-opus-4-8';
const SONNET = 'claude-sonnet-4-6';

if (!process.env.ANTHROPIC_API_KEY) { console.error('❌  ANTHROPIC_API_KEY not set. Run: node --env-file=.env.local scripts/analyze-davidking.mjs'); process.exit(1); }
if (!fs.existsSync(TRANSCRIPTS)) { console.error(`❌  Missing ${TRANSCRIPTS}\n    Run first:\n      node scripts/davidking-fetch.mjs\n      python3 scripts/davidking-transcripts.py`); process.exit(1); }

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const rawFile = fs.readFileSync(TRANSCRIPTS, 'utf-8');

// ── Split into individual video entries ───────────────────────────────────────
const bodyStart = rawFile.indexOf('\n', rawFile.indexOf('====')) + 1;
const body = bodyStart > 0 ? rawFile.slice(bodyStart) : rawFile;
const entries = body.split(/\n(?=\[(?:YouTube|TikTok) #\d)/).map(s => s.trim()).filter(e => /TRANSCRIPT:/.test(e));
console.log(`Parsed ${entries.length} video transcripts.`);

function titleOf(e) { return (e.match(/^Title:\s*(.+)$/m)?.[1] || '').trim(); }
function transcriptOf(e) { return (e.split(/TRANSCRIPT:\n/)[1] || '').trim(); }

// ── Classify each as football or other (Sonnet — cheap + accurate) ────────────
console.log('🔎  Classifying football vs other sports…');
const list = entries.map((e, i) => `${i + 1}. TITLE: ${titleOf(e)}\nSTART: ${transcriptOf(e).slice(0, 220)}`).join('\n\n');
const clsRes = await client.messages.create({
  model: SONNET,
  max_tokens: 1500,
  messages: [{ role: 'user', content: `For each numbered short below, decide if it is about ASSOCIATION FOOTBALL / SOCCER (players, clubs, World Cup, leagues, matches) — NOT American football/NFL, NOT other sports/topics. Output ONLY a JSON array of ${entries.length} booleans in order (true = football/soccer, false = anything else). No prose.\n\n${list}` }],
});
let flags = [];
try {
  const m = (clsRes.content.find(b => b.type === 'text')?.text || '').match(/\[[\s\S]*\]/);
  flags = m ? JSON.parse(m[0]) : [];
} catch { flags = []; }
if (flags.length !== entries.length) { console.warn('  ⚠ classifier returned an odd length — keeping all as football to be safe.'); flags = entries.map(() => true); }

const football = entries.filter((_, i) => flags[i]);
const parked   = entries.filter((_, i) => !flags[i]);
console.log(`  ⚽ football: ${football.length}   |   🏒 parked (other): ${parked.length}`);

// ── Park the non-football ones in the locker ──────────────────────────────────
fs.writeFileSync(PARKED, `@DavidKingStories — PARKED non-football transcripts (for later, other-sports scripts)\nGenerated: ${new Date().toISOString()}\nCount: ${parked.length}\n${'='.repeat(80)}\n\n${parked.join('\n\n' + '-'.repeat(60) + '\n\n')}`);
console.log(`  Parked file → ${PARKED}`);

if (football.length < 3) { console.error('❌  Too few football transcripts to analyse. Check the parked file / classifier.'); process.exit(1); }

// ── Build the football storytelling skill from the football corpus ────────────
let corpus = football.map((e, i) => `--- FOOTBALL VIDEO ${i + 1} ---\n${e}`).join('\n\n');
if (corpus.length > 240_000) corpus = corpus.slice(0, 240_000);

console.log('\n🧠  Sending David King\'s FOOTBALL transcripts to Claude Opus for deep storytelling analysis…\n');

const prompt = `You are doing a deep creative analysis of @DavidKingStories, an elite English-language STORYTELLING creator on YouTube Shorts / TikTok, on behalf of a football creator (Diez) who wants to add David King's storytelling style to his Studio toolkit — as an EMOTIONAL/STORYTELLING voice, alongside @toqueymedio and @elefutbol. Capture what is UNIQUE to David King.

The transcripts below are ONLY his FOOTBALL/SOCCER videos (his non-football videos have been filtered out) — his most-viewed of the last year across YouTube and TikTok.

CRITICAL — DO THIS FIRST: read the LITERAL first sentence of all videos and the LITERAL last sentence of each. If most share a fixed opening or closing formula, quote it verbatim, state what fraction use it, and put it at the very top as a non-negotiable template. Do NOT abstract a recurring formula into a vague description — the exact hook and closer are the most important things to capture.

"""
${corpus}
"""

Write a complete, highly specific storytelling skill profile in this EXACT markdown format. Be concrete — quote real lines. An AI must be able to write a football script indistinguishable from David King from this profile alone.

# Channel Profile: @davidkingstories

## 0. THE NON-NEGOTIABLE FORMULA
[His exact opening formula + exact closing formula, verbatim, with the fraction of videos that use each. Most important section.]

## 1. The Hook (first 3–5 seconds)
[Exactly how he opens. Named hook patterns, each with 3+ verbatim examples. What he never does.]

## 2. Voice & Persona
[Narrator type, emotional stance, relationship to the viewer, confidence, warmth.]

## 3. Story Structure & Beat Order
[Map his typical arc beat by beat: setup → escalation → turn → climax → resolution/twist. How he sequences reveals and builds/pays off tension.]

## 4. Pacing, Length & Sentence Rhythm
[Typical duration and word count (use the real data), speaking feel, sentence length, where he pauses or accelerates, short punchy vs flowing lines.]

## 5. Emotional Techniques
[Specifically how he makes viewers FEEL — suspense, dramatic irony, empathy, shock, payoff.]

## 6. Signature Phrases, Transitions & Verbal Tics
[At least 8, each with a verbatim example.]

## 7. Subject Matter & Angle
[What football stories he tells and how he picks the angle — what makes a topic "David King".]

## 8. The Closer / Twist
[Exactly how he ends — the reveal, gut-punch, moral, any CTA. Verbatim examples.]

## 9. How to Write in This Style — Step by Step
[A practical recipe specific enough to follow on ANY football story. Finish with 3 example opening lines in his exact voice for 3 different football topics.]`;

const res = await client.messages.create({ model: OPUS, max_tokens: 8000, messages: [{ role: 'user', content: prompt }] });
const profile = res.content.find(b => b.type === 'text')?.text ?? '';
if (!profile.trim()) { console.error('❌  Empty response from Claude.'); process.exit(1); }
fs.writeFileSync(PROFILE, profile);

const cost = ((clsRes.usage.input_tokens + res.usage.input_tokens) / 1e6 * 15) + ((clsRes.usage.output_tokens + res.usage.output_tokens) / 1e6 * 75);
console.log(`\n✅  Football skill → content-plan/skills/channel-davidkingstories-profile.md  (from ${football.length} football videos)`);
console.log(`📦  Parked ${parked.length} other-sports transcripts → ${PARKED}`);
console.log(`💰  Cost: ~$${cost.toFixed(3)}`);
console.log(`\nSelect @davidking under Emotional in Content Studio › Studio to write in his style.`);
