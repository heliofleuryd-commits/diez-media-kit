#!/usr/bin/env node
/**
 * Rebuild the @lafechadeportes skill profile + gap analysis from the FULL Whisper
 * transcripts (not captions). Reads ~/Downloads/lafechadeportes_transcripts.txt.
 *
 * Usage:
 *   node --env-file=.env.local scripts/lafechadeportes-build-skill.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT        = path.join(__dirname, '..');
const SKILLS_DIR  = path.join(ROOT, 'content-plan', 'skills');
const PROFILE_FILE = path.join(SKILLS_DIR, 'channel-lafechadeportes-profile.md');
const GAP_FILE     = path.join(SKILLS_DIR, 'lafechadeportes-gap-analysis.md');
const TRANSCRIPTS  = path.join(homedir(), 'Downloads', 'lafechadeportes_transcripts.txt');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌  ANTHROPIC_API_KEY not set. Run with: node --env-file=.env.local scripts/lafechadeportes-build-skill.mjs');
  process.exit(1);
}
if (!fs.existsSync(TRANSCRIPTS)) {
  console.error(`❌  Transcripts not found at ${TRANSCRIPTS}. Run scripts/lafechadeportes-transcripts.py first.`);
  process.exit(1);
}

const transcripts = fs.readFileSync(TRANSCRIPTS, 'utf-8');
console.log(`📄  Loaded transcripts (${transcripts.length.toLocaleString()} chars)\n`);

const ENGLISH_RULE = `HARD OUTPUT RULE: This profile trains an AI that writes scripts for an ENGLISH-speaking audience (US/UK TikTok). The source videos are in Spanish. Every script produced in this style MUST be written in ENGLISH. The Spanish rhetorical devices are to be ADAPTED into natural, powerful English — never copied in Spanish, never translated word-for-word into stiff English. State this rule explicitly at the top of the profile so it can never be missed.`;

const profilePrompt = `You are performing a deep creative analysis of the TikTok channel @lafechadeportes — a Colombian Spanish-language football storytelling channel — on behalf of a football creator (Diez, 3.1M followers) who wants to add this creator's style to his own English-language scriptwriting toolkit.

${ENGLISH_RULE}

Below are the FULL Whisper transcripts of his last 50 TikTok videos (actual spoken narration, in Spanish). Analyse the real spoken rhythm, sentence construction, pacing, and emotional technique — not just topics.

${transcripts.slice(0, 160000)}

Write a complete channel skill profile in this EXACT format. Be extremely specific — vague descriptions are useless. Ground every claim in what he actually SAYS in the transcripts, quoting short Spanish phrases and giving the English adaptation.

# Channel Profile: @lafechadeportes

> **OUTPUT LANGUAGE: ENGLISH.** Scripts in this style are always written in English for a US/UK audience. Spanish devices below are adapted into natural English, never left in Spanish.

## 1. Voice & Persona
[How does he position himself? Witness? Preacher? Defender of the wronged? What does the viewer feel?]

## 2. Vocabulary Register & Spoken Rhythm
[Register, football vocab level, signature phrasing, SENTENCE RHYTHM as actually spoken — sentence length, where he pauses, how he builds. Quote real lines + English adaptation.]

## 3. Recurring Rhetorical Devices
[Each device: name, explanation, and a SPECIFIC quoted example from the transcripts + its English adaptation. At least 8 devices.]

## 4. Typical Length & Pacing
[Second-by-second beat structure drawn from the real transcripts. What happens 0–5s, 5–15s, etc. Speaking speed, use of silence.]

## 5. Primary Audience Hook
[Which emotions/curiosities he presses, in what sequence.]

## 6. Signature Format Patterns
[3–4 named patterns with descriptions, each tied to real videos.]

## 7. Distinctive Techniques (what sets @lafechadeportes apart)
[The most important section. The concrete techniques that make him different — how he handles tragedy, redemption, injustice, faith, the "named wound", the reveal.]

## 8. How to Write in This Style — Step-by-Step Guide (in ENGLISH)
[Practical step-by-step so an AI can write an English @lafechadeportes-style script on any football topic. Include 3 example opening lines IN ENGLISH.]`;

console.log('🧠  Generating profile from transcripts (Opus)…');
const profileRes = await client.messages.create({
  model: 'claude-opus-4-8',
  max_tokens: 5000,
  messages: [{ role: 'user', content: profilePrompt }],
});
const profile = profileRes.content.find(b => b.type === 'text')?.text ?? '';
fs.writeFileSync(PROFILE_FILE, profile);
console.log(`✅  Profile → ${path.relative(ROOT, PROFILE_FILE)}`);

// ── Gap analysis (kept English, audience-targeted) ────────────────────────────
console.log('\n🔭  Regenerating gap analysis…');
const topicsOnly = [...transcripts.matchAll(/^Title: (.+)$/gm)].map(m => m[1]).slice(0, 50)
  .map((t, i) => `${i + 1}. ${t}`).join('\n');

const gapPrompt = `You have analysed @lafechadeportes's last 50 TikTok videos. Here are the titles/topics:

${topicsOnly}

For football creator Diez (@imDiez on TikTok), writing in ENGLISH for a US/UK audience, produce:

**PART 1 — TOPIC GAPS** — 20+ football stories in his redemption/human-story lane that he has NOT covered.
**PART 2 — SHARPER ANGLES** — pick 5 topics he did and give a sharper English-audience angle.
**PART 3 — WORLD CUP 2026 SCRIPTS (priority)** — 10 specific scripts: Title, 1-sentence hook, why it hits hard.

All output in English. Clear headers and numbered lists.`;

const gapRes = await client.messages.create({
  model: 'claude-opus-4-8',
  max_tokens: 3000,
  messages: [{ role: 'user', content: gapPrompt }],
});
const gapText = gapRes.content.find(b => b.type === 'text')?.text ?? '';
fs.writeFileSync(GAP_FILE, `# @lafechadeportes Gap Analysis\nGenerated: ${new Date().toISOString()} (from Whisper transcripts)\n\n${gapText}`);
console.log(`✅  Gap analysis → ${path.relative(ROOT, GAP_FILE)}`);

const inTok = profileRes.usage.input_tokens + gapRes.usage.input_tokens;
const outTok = profileRes.usage.output_tokens + gapRes.usage.output_tokens;
console.log(`\n💰  ~$${((inTok / 1e6 * 15) + (outTok / 1e6 * 75)).toFixed(3)}`);
console.log('🎉  Done — profile rebuilt from real spoken transcripts.');
