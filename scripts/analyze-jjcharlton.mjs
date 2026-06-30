#!/usr/bin/env node
/**
 * Step 3 of 3 — read @jjcharlton's transcripts and build the channel skill.
 *
 * Reads:  ~/Downloads/jjcharlton_transcripts.txt  (from jjcharlton-transcripts.py)
 * Writes: content-plan/skills/channel-jjcharlton-profile.md   (ONLY this file)
 *
 * Usage: node --env-file=.env.local scripts/analyze-jjcharlton.mjs
 *
 * Ringfenced: this script never reads or writes any other creator's skill.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.join(__dirname, '..');
const TRANSCRIPTS = path.join(homedir(), 'Downloads', 'jjcharlton_transcripts.txt');
const PROFILE    = path.join(ROOT, 'content-plan', 'skills', 'channel-jjcharlton-profile.md');

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌  ANTHROPIC_API_KEY not set. Run with: node --env-file=.env.local scripts/analyze-jjcharlton.mjs');
  process.exit(1);
}
if (!fs.existsSync(TRANSCRIPTS)) {
  console.error(`❌  Missing ${TRANSCRIPTS}\n    Run the first two steps:\n      node scripts/jjcharlton-fetch.mjs\n      python3 scripts/jjcharlton-transcripts.py`);
  process.exit(1);
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

let corpus = fs.readFileSync(TRANSCRIPTS, 'utf-8');
if (corpus.length > 140_000) corpus = corpus.slice(0, 140_000); // keep well within context

console.log('🧠  Sending @jjcharlton transcripts to Claude Opus for deep style analysis…\n');

const prompt = `You are doing a deep creative analysis of the English-language football TikTok creator @jjcharlton, on behalf of a football creator (Diez) who wants to add jjcharlton's ANALYTICAL writing style to his Studio toolkit — sitting ALONGSIDE existing analytical profiles (@pechefootball, @fiagoball, @5.at.the.back, @joeham.1, @matchday.fc). Capture what is UNIQUE to jjcharlton versus those.

Below are his ${'50'} best videos of the last year (ranked by views) with captions and full transcripts:

"""
${corpus}
"""

CRITICAL — DO THIS FIRST: read the LITERAL first words of all 50 transcripts and the LITERAL last sentence of each. If most/all share a fixed formula (e.g. they all open with the same phrase, or all close with the same sign-off), THAT formula is the hook/closer — quote it verbatim, state what fraction use it, and put it at the very top as a non-negotiable template. DO NOT abstract a recurring formula away into a vague description. The opening and closing formulas are the most important things to capture exactly.

Write a complete, highly specific channel skill profile in this EXACT markdown format. Be concrete — quote real lines from the transcripts. Vague descriptions are useless; an AI must be able to write a script that is indistinguishable from jjcharlton from this profile alone.

# Channel Profile: @jjcharlton

## 1. Voice & Persona
[Who is he to the viewer — analyst, mate down the pub, authority, contrarian? Confidence level, attitude, how he positions his take.]

## 2. Tone & Vocabulary Register
[Formality, slang, football vocabulary level, British-isms, sentence rhythm, how punchy vs measured. Signature word choices.]

## 3. The Hook (first 3 seconds) — THE MOST IMPORTANT SECTION
[Exactly how he opens. List the distinct hook patterns you see, each with a NAME, how it works, and 3+ VERBATIM examples pulled from the transcripts. Note what he never does.]

## 4. Intro / Setup (≈3–12s)
[How he frames the video right after the hook — context, the question, the stakes. Real examples.]

## 5. Body Structure & Argument Flow
[How the middle is built: point order, how he stacks evidence/examples, how he handles counterpoints, list vs single-argument, how he builds to the payoff. Map a typical beat order.]

## 6. Length & Pacing
[Typical duration in seconds and word count, words-per-minute / speaking speed, how many beats, where he speeds up or pauses. Use the real durations from the data.]

## 7. Signature Rhetorical Devices, Phrases & Verbal Tics
[At least 8, each named with a verbatim example — repeated phrases, transitions, rhetorical questions, callbacks, the way he emphasises, etc.]

## 8. Format Patterns (named)
[3–4 recurring video formats, each named (e.g. "Pattern A — The Ranking", "Pattern B — The Hot Take Defence"), with which topics use them and the structure.]

## 9. Endings / CTAs
[How he closes — the payoff line, any call to follow/comment, signature sign-off.]

## 10. How to Write in This Style — Step-by-Step
[A practical recipe: Step 1, Step 2, … specific enough to follow on ANY football topic. Finish with 3 example opening lines written in his exact voice for 3 different topics.]`;

const res = await client.messages.create({
  model: 'claude-opus-4-8',
  max_tokens: 8000,
  messages: [{ role: 'user', content: prompt }],
});

const profile = res.content.find(b => b.type === 'text')?.text ?? '';
if (!profile.trim()) { console.error('❌  Empty response from Claude.'); process.exit(1); }

fs.writeFileSync(PROFILE, profile);

const cost = (res.usage.input_tokens / 1e6 * 15) + (res.usage.output_tokens / 1e6 * 75);
console.log(`✅  Skill written → content-plan/skills/channel-jjcharlton-profile.md`);
console.log(`💰  Cost: ~$${cost.toFixed(3)}`);
console.log(`\nIt's already wired into Studio: open Content Studio › Studio, select @jjcharlton under Analytical, and write a script.`);
