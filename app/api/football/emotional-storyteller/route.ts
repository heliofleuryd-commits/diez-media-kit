export const maxDuration = 300;

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { runResearch, runDraft, runViral, runChat, liveResearch } from '@/lib/football/emotionalEngine';

const client = new Anthropic();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { stage, topic, bullets, draft, messages, modelOverride } = body;
    const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    if (stage === 'research') {
      const live = await liveResearch(topic);
      const r = await runResearch(client, topic, todayStr, live, modelOverride);
      return NextResponse.json({ ok: true, message: r.text, cost: r.cost, model: r.model });
    }

    if (stage === 'draft') {
      const r = await runDraft(client, topic, bullets, modelOverride);
      return NextResponse.json({ ok: true, message: r.text, cost: r.cost, model: r.model });
    }

    if (stage === 'viral') {
      const r = await runViral(client, draft, modelOverride);
      return NextResponse.json({ ok: true, message: r.text, cost: r.cost, model: r.model });
    }

    const r = await runChat(client, messages, modelOverride);
    return NextResponse.json({ ok: true, message: r.text, cost: r.cost, model: r.model });
  } catch (e: any) {
    console.error('[emotional-storyteller] Failed:', e.message);
    return NextResponse.json({ ok: false, error: e.message?.slice(0, 250) || 'Unknown error' }, { status: 500 });
  }
}
