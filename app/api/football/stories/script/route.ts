export const maxDuration = 300;

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { runResearch, runDraft, runViral, runChat, liveResearch } from '@/lib/football/emotionalEngine';

const client = new Anthropic();

// Build the research "context" from a story's already-curated facts.
function storyContext(story: any): string {
  const lines: string[] = [];
  if (story.player) lines.push(`- Subject: ${story.player}`);
  if (story.teams) lines.push(`- Teams: ${story.teams}`);
  if (story.why_today) lines.push(`- Why it matters now: ${story.why_today}`);
  if (story.headline) lines.push(`- Headline angle: ${story.headline}`);
  for (const f of story.key_facts || []) lines.push(`- ${f}`);
  if (story.emotional_arc) lines.push(`- Emotional arc: ${story.emotional_arc}`);
  if (story.script_angle) lines.push(`- Suggested angle: ${story.script_angle}`);
  if (story.caution) lines.push(`- ⚠️ ACCURACY GUARDRAIL (do NOT contradict or repeat as myth): ${story.caution}`);
  return lines.join('\n');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { stage, story, topic, context, draft, messages, modelOverride } = body;

    // STAGE 0: RESEARCH — for a free-text custom topic the creator typed in.
    // Deep + recency-aware bullets, same engine as the Emotional Storyteller.
    if (stage === 'research') {
      const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      const live = await liveResearch(topic);
      const r = await runResearch(client, topic, todayStr, live, modelOverride);
      return NextResponse.json({ ok: true, message: r.text, cost: r.cost, model: r.model });
    }

    // STAGE 1: DRAFT — Studio toqueymedio. Seeded by the story's curated facts,
    // or by `context` (researched bullets) when it's a custom typed-in topic.
    if (stage === 'draft') {
      const t = story?.player ? `${story.title} — ${story.player}` : story?.title || topic || 'this story';
      const ctx = context || storyContext(story || {});
      const r = await runDraft(client, t, ctx, modelOverride);
      return NextResponse.json({ ok: true, message: r.text, cost: r.cost, model: r.model });
    }

    // STAGE 2: VIRAL — apply the 9-script refined style
    if (stage === 'viral') {
      const r = await runViral(client, draft, modelOverride);
      return NextResponse.json({ ok: true, message: r.text, cost: r.cost, model: r.model });
    }

    // CHAT — refine an existing script
    const r = await runChat(client, messages, modelOverride);
    return NextResponse.json({ ok: true, message: r.text, cost: r.cost, model: r.model });
  } catch (e: any) {
    console.error('[stories/script] Failed:', e.message);
    return NextResponse.json({ ok: false, error: e.message?.slice(0, 250) || 'Unknown error' }, { status: 500 });
  }
}
