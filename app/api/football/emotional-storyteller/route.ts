export const maxDuration = 300;

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { calcCost } from '@/lib/football/costTracker';

const client = new Anthropic();
const OPUS = 'claude-opus-4-8';
const SONNET = 'claude-sonnet-4-6';

// Per-stage model. Opus drafts (deep biographical recall + creativity);
// Sonnet handles the structural critique/rewrite and the flow polish within
// Opus's frame — far cheaper, quality holds because the facts/structure are set.
const STAGE_MODELS: Record<string, string> = {
  draft: OPUS,
  refine: SONNET,
  polish: SONNET,
  chat: SONNET,
};

const SKILLS_DIR = path.join(process.cwd(), 'content-plan', 'skills');
const VIRAL_SKILL_PATH = path.join(process.cwd(), 'content-plan', 'emotional-storyteller', 'viral-style-skill.md');

function loadToqueymedio(): string {
  try { return fs.readFileSync(path.join(SKILLS_DIR, 'channel-toqueymedio-profile.md'), 'utf-8'); } catch { return ''; }
}
function loadViralSkill(): string {
  try { return fs.readFileSync(VIRAL_SKILL_PATH, 'utf-8'); } catch { return ''; }
}

// ── Research (same capability as Content Studio › Studio) ───────────────────────
async function quickResearch(topic: string): Promise<string> {
  const results: string[] = [];
  try {
    const ytRes = await fetch(
      `https://suggestqueries-clients6.youtube.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(topic)}&hl=en`,
      { signal: AbortSignal.timeout(5000) }
    );
    const ytText = await ytRes.text();
    const match = ytText.match(/\[[\s\S]+\]/);
    if (match) {
      const suggestions = JSON.parse(match[0])[1]?.slice(0, 8).map((s: any) => Array.isArray(s) ? s[0] : s) || [];
      if (suggestions.length) results.push(`YouTube searches: ${suggestions.join(', ')}`);
    }
  } catch { /* skip */ }

  try {
    const newsRes = await fetch(
      `https://news.google.com/rss/search?q=${encodeURIComponent(topic + ' football')}&hl=en-US&gl=US&ceid=US:en`,
      { signal: AbortSignal.timeout(5000) }
    );
    const xml = await newsRes.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8);
    const headlines = items.map(m => {
      const t = m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').trim();
      return t ? `- ${t}` : '';
    }).filter(Boolean);
    if (headlines.length) results.push(`Recent news:\n${headlines.join('\n')}`);
  } catch { /* skip */ }

  return results.length ? `\n\n[Live research on "${topic}"]\n${results.join('\n\n')}` : '';
}

function styleSystem(): string {
  const toqueymedio = loadToqueymedio();
  const viral = loadViralSkill();
  return `You are the Emotional Storyteller — an elite scriptwriter for viral TikTok/Shorts football films about players' lives: comeback arcs, loss, injury, poverty, redemption, with the World Cup as the stage where wound meets glory.

You write in EXACTLY ONE voice: the refined toqueymedio emotional style below. There is no other style. Never analytical, never a hot take.

The CONTENT is always specific, accurate, real facts (dates, places, clubs, minutes, scores, named players). The EMOTION is the delivery. Facts + emotion woven together is the entire craft.

═══════════════════════════════════════════
TOQUEYMEDIO BASE PROFILE
═══════════════════════════════════════════
${toqueymedio.slice(0, 3500)}

═══════════════════════════════════════════
REFINED VIRAL STYLE — THIS OVERRIDES THE BASE WHERE THEY DIFFER
═══════════════════════════════════════════
${viral}`;
}

function extractText(res: any): string {
  return res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { stage, topic, draft, messages, modelOverride } = body;

    // Per-stage model (modelOverride lets us A/B test cheaper configs).
    const model = modelOverride || STAGE_MODELS[stage] || SONNET;

    const system = styleSystem();
    let userPrompt = '';
    let maxTokens = 5000;

    if (stage === 'draft') {
      const research = topic ? await quickResearch(String(topic).slice(0, 90)) : '';
      maxTokens = 5000;
      userPrompt = `TOPIC: ${topic}
${research}

PASS 1 of 3 — THE DRAFT.

First, think step by step and recall EVERY specific, real fact about this subject: full birth name, birthplace, family, the clubs and dates of their rise, the exact wound (date, place, what happened), the aftermath, and the World Cup moment (date, stadium, opponent, minute, the play). Be ruthlessly factual — this is the spine.

Then write a complete long-form emotional script (≈350–700 words, 2.5–3.5 min spoken) following the full arc: bold 3-line flash-forward hook → humble origin → the rise → the wound (dated, cinematic) → the darkness → resurrection setup at the World Cup → ceremonial full name → the climax with minute markers and the silence motif → eruption → sky-point dedication → the nation weeps → aphoristic two-line closer.

Output ONLY the script — no commentary, no labels.`;
    } else if (stage === 'refine') {
      maxTokens = 5000;
      userPrompt = `PASS 2 of 3 — CRITIQUE & REWRITE.

Here is the draft:
"""
${draft}
"""

First, think step by step and critique it hard against the viral style: Is the hook a bold 3-line second-person flash-forward to the climax? Is every emotional beat sitting on a SPECIFIC real fact (dates, minutes, scores, named players)? Is the full birth name reserved for the climax only? Are the signature motifs present (the silence line, "for a heartbeat time slows", the eruption, the sky-point, the epithet-by-wound)? Is the closer an earned, story-specific aphorism? Is anything generic, invented, or vague?

Then rewrite the ENTIRE script fixing every weakness. Make it denser with real facts and more emotionally precise. Keep it long-form.

Output ONLY the rewritten script — no commentary.`;
    } else if (stage === 'polish') {
      maxTokens = 4000;
      userPrompt = `PASS 3 of 3 — FINAL FLOW POLISH.

Here is the refined script:
"""
${draft}
"""

Apply the ONE rule that matters most: FLOW OVER FULL STOPS. The emotional passages should run in long, breathing cascades joined by commas and "and", then snap to short punchy fragments at the moments of impact — that contrast is the texture. Kill choppy all-short-sentence rhythm. Keep the bold 3-line hook. Keep every fact. Make it sound like it is meant to be spoken aloud, not read.

Do not shorten the story or remove facts — only re-flow and tighten the prose to match the perfected viral voice.

Output ONLY the final script, then on new lines add:
**Hook:** (the opening bold lines as one block)
**Caption:** (under 150 chars)
**Hashtags:** (6–8 tags)`;
    } else {
      // chat refinement on an existing script — single pass, full conversation context
      maxTokens = 4000;
      const apiMessages = (messages || []).slice(-20);
      const res = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: apiMessages,
      });
      const text = extractText(res);
      const cost = calcCost(model, res.usage.input_tokens, res.usage.output_tokens);
      return NextResponse.json({ ok: true, message: text, cost, model });
    }

    const res = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
    });
    const text = extractText(res);
    const cost = calcCost(model, res.usage.input_tokens, res.usage.output_tokens);

    return NextResponse.json({ ok: true, message: text, cost, stage, model });
  } catch (e: any) {
    console.error('[emotional-storyteller] Failed:', e.message);
    return NextResponse.json({ ok: false, error: e.message?.slice(0, 250) || 'Unknown error' }, { status: 500 });
  }
}
