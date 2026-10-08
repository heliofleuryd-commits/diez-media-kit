export const maxDuration = 300;

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { runResearch, runDraft, runViral, runFactCheck, runChat, runClassify, liveResearch, parseWordLimit, wordLimitFromMessages } from '@/lib/football/emotionalEngine';

const client = new Anthropic();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { stage, topic, bullets, draft, messages, modelOverride } = body;
    const mode = body.mode === 'old' ? 'old' : 'new'; // OLD = base viral only; NEW = blended with Diez's format
    const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    // "max 300 words" in the request caps the script; amendments inherit the latest limit given.
    const wordLimit = stage === 'chat' || !stage ? wordLimitFromMessages(messages) : parseWordLimit(topic);

    if (stage === 'classify') {
      const r = await runClassify(client, body.text || '');
      return NextResponse.json({ ok: true, intent: r.intent, cost: r.cost });
    }

    if (stage === 'research') {
      const live = await liveResearch(topic);
      const r = await runResearch(client, topic, todayStr, live, modelOverride);
      return NextResponse.json({ ok: true, message: r.text, cost: r.cost, model: r.model });
    }

    if (stage === 'draft') {
      const r = await runDraft(client, topic, bullets, modelOverride, wordLimit);
      return NextResponse.json({ ok: true, message: r.text, cost: r.cost, model: r.model });
    }

    if (stage === 'viral') {
      const r = await runViral(client, draft, modelOverride, mode, wordLimit);
      return NextResponse.json({ ok: true, message: r.text, cost: r.cost, model: r.model });
    }

    // Runs once, on a brand-new script only — amendments never come here.
    if (stage === 'factcheck') {
      const r = await runFactCheck(client, body.script || '', todayStr, bullets || '', wordLimit, modelOverride);
      return NextResponse.json({ ok: true, message: r.text, cost: r.cost, model: r.model });
    }

    const r = await runChat(client, messages, modelOverride, mode, wordLimit);
    return NextResponse.json({ ok: true, message: r.text, cost: r.cost, model: r.model });
  } catch (e: any) {
    console.error('[emotional-storyteller] Failed:', e.message);
    return NextResponse.json({ ok: false, error: e.message?.slice(0, 250) || 'Unknown error' }, { status: 500 });
  }
}
