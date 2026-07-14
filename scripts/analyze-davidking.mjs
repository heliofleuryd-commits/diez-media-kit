#!/usr/bin/env node
/**
 * Step 3 of 3 — read @DavidKingStories' transcripts and build his storytelling skill.
 *
 * Reads:  ~/Downloads/davidking_transcripts.txt  (from davidking-transcripts.py)
 * Writes: content-plan/skills/channel-davidkingstories-profile.md   (ONLY this file)
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
const ROOT       = path.join(__dirname, '..');
const TRANSCRIPTS = path.join(homedir(), 'Downloads', 'davidking_transcripts.txt');
const PROFILE    = path.join(ROOT, 'content-plan', 'skills', 'channel-davidkingstories-profile.md');

if (!process.env.ANTHROPIC_API_KEY) { console.error('❌  ANTHROPIC_API_KEY not set. Run: node --env-file=.env.local scripts/analyze-davidking.mjs'); process.exit(1); }
if (!fs.existsSync(TRANSCRIPTS)) { console.error(`❌  Missing ${TRANSCRIPTS}\n    Run first:\n      node scripts/davidking-fetch.mjs\n      python3 scripts/davidking-transcripts.py`); process.exit(1); }

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
let corpus = fs.readFileSync(TRANSCRIPTS, 'utf-8');
if (corpus.length > 140_000) corpus = corpus.slice(0, 140_000);

console.log('🧠  Sending @DavidKingStories transcripts to Claude Opus for deep storytelling analysis…\n');

const prompt = `You are doing a deep creative analysis of @DavidKingStories, an elite English-language STORYTELLING creator on YouTube Shorts / TikTok, on behalf of a football creator (Diez) who wants to add David King's storytelling style to his Studio toolkit — as an EMOTIONAL/STORYTELLING voice, alongside @toqueymedio and @elefutbol. Capture what is UNIQUE to David King.

IMPORTANT WEIGHTING: Diez makes FOOTBALL/SOCCER content, so weight your analysis toward David King's football stories — treat those as the PRIMARY model, and lead every example, template and opening line with football. David King also covers other sports and topics, which are useful too — his storytelling *technique* transfers to any sport — so still capture the universal method, but flag which patterns are football-specific vs universal, and when in doubt bias toward football.

CRITICAL — DO THIS FIRST: read the LITERAL first sentence of all videos and the LITERAL last sentence of each. If most share a fixed opening or closing formula, quote it verbatim, state what fraction use it, and put it at the very top as a non-negotiable template. Do NOT abstract a recurring formula into a vague description — the exact hook and closer are the most important things to capture.

Below are his top ~30 videos of the last year by views, with titles and full transcripts:

"""
${corpus}
"""

Write a complete, highly specific storytelling skill profile in this EXACT markdown format. Be concrete — quote real lines. An AI must be able to write a script indistinguishable from David King from this profile alone.

# Channel Profile: @davidkingstories

## 0. THE NON-NEGOTIABLE FORMULA
[His exact opening formula + exact closing formula, verbatim, with the fraction of videos that use each. This is the most important section.]

## 1. The Hook (first 3–5 seconds)
[Exactly how he opens. Named hook patterns, each with 3+ verbatim examples. What he never does.]

## 2. Voice & Persona
[Narrator type, emotional stance, relationship to the viewer, confidence, warmth.]

## 3. Story Structure & Beat Order
[Map his typical arc beat by beat: setup → escalation → turn → climax → resolution/twist. How he sequences reveals. How he builds tension and pays it off.]

## 4. Pacing, Length & Sentence Rhythm
[Typical duration and word count (use the real data), words-per-minute feel, sentence length, where he pauses or accelerates, use of short punchy lines vs flowing ones.]

## 5. Emotional Techniques
[Specifically how he makes viewers FEEL — suspense, dramatic irony, empathy, shock, payoff. The devices that make his stories land.]

## 6. Signature Phrases, Transitions & Verbal Tics
[At least 8, each with a verbatim example — recurring phrases, transitions, the way he signals a twist, callbacks.]

## 7. Subject Matter & Angle
[What kinds of stories he tells, how he picks the angle, what makes a topic "David King".]

## 8. The Closer / Twist
[Exactly how he ends — the reveal, the gut-punch, the moral, any CTA. Verbatim examples.]

## 9. How to Write in This Style — Step by Step
[A practical recipe specific enough to follow on ANY story topic. Finish with 3 example opening lines in his exact voice for 3 different topics.]`;

const res = await client.messages.create({
  model: 'claude-opus-4-8',
  max_tokens: 8000,
  messages: [{ role: 'user', content: prompt }],
});

const profile = res.content.find(b => b.type === 'text')?.text ?? '';
if (!profile.trim()) { console.error('❌  Empty response from Claude.'); process.exit(1); }
fs.writeFileSync(PROFILE, profile);

const cost = (res.usage.input_tokens / 1e6 * 15) + (res.usage.output_tokens / 1e6 * 75);
console.log(`✅  Skill written → content-plan/skills/channel-davidkingstories-profile.md`);
console.log(`💰  Cost: ~$${cost.toFixed(3)}`);
console.log(`\nIt's wired into Studio: open Content Studio › Studio, select @davidking under Emotional, and write a script.`);
