export const maxDuration = 300;

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { runResearch, runHooks, runDraft, runViral, runFactCheck, runChat, runClassify, liveResearch, parseWordLimit, wordLimitFromMessages } from '@/lib/football/emotionalEngine';

const client = new Anthropic();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { stage, topic, bullets, draft, messages, modelOverride } = body;
    const mode = body.mode === 'old' ? 'old' : 'new'; // OLD = base viral only; NEW = blended with Diez's format
    const hook = typeof body.hook === 'string' && body.hook.trim() ? body.hook.trim() : undefined; // Hook mode: the hook the creator picked
    const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    // Word cap: the "Max words" box wins; otherwise "max 300 words" in the request.
    // Amendments inherit the latest limit given in the conversation.
    const boxLimit = Number(body.wordLimit);
    const wordLimit = boxLimit >= 50 && boxLimit <= 1500
      ? boxLimit
      : stage === 'chat' || !stage ? wordLimitFromMessages(messages) : parseWordLimit(topic);

    if (stage === 'classify') {
      const r = await runClassify(client, body.text || '');
      return NextResponse.json({ ok: true, intent: r.intent, cost: r.cost });
    }

    if (stage === 'research') {
      const live = await liveResearch(topic);
      const r = await runResearch(client, topic, todayStr, live, modelOverride);
      return NextResponse.json({ ok: true, message: r.text, cost: r.cost, model: r.model });
    }

    // Hook mode: 5 hooks in Diez's own style to pick from before the script is written.
    if (stage === 'hooks') {
      const previous = Array.isArray(body.previous) ? body.previous.filter((h: unknown) => typeof h === 'string') : [];
      const r = await runHooks(client, topic, bullets || '', String(body.feedback || ''), previous, modelOverride);
      return NextResponse.json({ ok: true, hooks: r.hooks, message: r.hooks.length ? '' : r.raw, cost: r.cost, model: r.model });
    }

    if (stage === 'draft') {
      const r = await runDraft(client, topic, bullets, modelOverride, wordLimit, hook);
      return NextResponse.json({ ok: true, message: r.text, cost: r.cost, model: r.model });
    }

    if (stage === 'viral') {
      const r = await runViral(client, draft, modelOverride, mode, wordLimit, hook);
      return NextResponse.json({ ok: true, message: r.text, cost: r.cost, model: r.model });
    }

    // Runs once, on a brand-new script only — amendments never come here.
    if (stage === 'factcheck') {
      const r = await runFactCheck(client, body.script || '', todayStr, bullets || '', wordLimit, modelOverride, hook);
      return NextResponse.json({ ok: true, message: r.text, cost: r.cost, model: r.model });
    }

    const r = await runChat(client, messages, modelOverride, mode, wordLimit);
    return NextResponse.json({ ok: true, message: r.text, cost: r.cost, model: r.model });
  } catch (e: any) {
    console.error('[emotional-storyteller] Failed:', e.message);
    return NextResponse.json({ ok: false, error: e.message?.slice(0, 250) || 'Unknown error' }, { status: 500 });
  }
}
