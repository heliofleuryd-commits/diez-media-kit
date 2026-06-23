export const maxDuration = 300;

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { runDraft, runViral, runChat } from '@/lib/football/emotionalEngine';

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
    const { stage, story, draft, messages, modelOverride } = body;

    // STAGE 1: DRAFT — Studio toqueymedio, seeded by the story's curated facts
    // (the research is already done — these stories come pre-researched).
    if (stage === 'draft') {
      const topic = story?.player ? `${story.title} — ${story.player}` : story?.title || 'this story';
      const r = await runDraft(client, topic, storyContext(story || {}), modelOverride);
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
