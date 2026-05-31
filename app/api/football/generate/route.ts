import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { AnimationActionSchema, clampPlan } from '@/lib/football/animationSchema';
import type { SceneState } from '@/lib/football/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Scene description ─────────────────────────────────────────────────────────

function sceneContext(scene: SceneState): string {
  const { teams, ball } = scene;
  const slots = (t: typeof teams.home, key: string) =>
    t.slots.map(s => `${key}.${s.slotId}@[${s.position.map(Math.round).join(',')}]${s.playerId ? `(${s.playerId})` : ''}`).join(' ');
  return [
    `HOME(${teams.home.formation}): ${slots(teams.home, 'home')}`,
    teams.away ? `AWAY(${teams.away.formation}): ${slots(teams.away, 'away')}` : '',
    `ball:${ball.ownerSlot ?? 'free'}`,
  ].filter(Boolean).join('\n');
}

// ── Action reference ──────────────────────────────────────────────────────────

const ACTIONS_REF = `ANIMATION ACTIONS:
move        {type,playerId,from:[x,y],to:[x,y],start,end}
pass        {type,fromPlayerId,toPlayerId,start,end,curve?}
dribble     {type,playerId,path:[[x,y],...],start,end}
zoneHighlight {type,bounds:[x1,y1,x2,y2],start,end}
arrow       {type,from:[x,y],to:[x,y],start,end,style?"thick-white"|"thin-dashed"}
arrowsBurst {type,positions:[[x,y],...],direction:"up"|"down"|"left"|"right",start,end}
markerPulse {type,position:[x,y],color?,start,end}
label       {type,text,position:[x,y],start,end}
formationShift {type,team:"home"|"away",toFormation,start,end}

SCENE CHANGES:
{"op":"move","team":"home"|"away","slotId":"LW","position":[x,y]}
{"op":"assign","team":"home"|"away","slotId":"ST","playerId":"some-id"}
{"op":"unassign","team":"home"|"away","slotId":"GK"}`;

const COORD_NOTE = `COORDS: x=0-100 left→right, y=0-100 top→bottom.
Home=bottom half(y>50) attacks UP. Away=top half(y<50) attacks DOWN.
playerIds MUST be "home.SLOTID" or "away.SLOTID" — never use player names as IDs.
TIMING: moves 1.5–2.5s, passes 1.0–1.5s, dribbles 2.0–3.5s. Never shorter than 1s. Stagger starts by 0.2-0.5s for natural feel.`;

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildChatPrompt(scene: SceneState): string {
  return `You are an AI tactics animator for a football TikTok content creation tool.
You can animate the pitch, move players, and have a conversation to refine the result.

${COORD_NOTE}

CURRENT SCENE:
${sceneContext(scene)}

${ACTIONS_REF}

BEHAVIOR:
- If the request is clear → generate animation and/or move players
- If ambiguous → ask ONE specific clarifying question, set animation and sceneChanges to null
- You REMEMBER the full conversation — refer back to previous turns
- Keep messages brief and conversational (1-3 sentences)
- You can do multiple things at once: move players AND animate in one reply

ALWAYS respond with this exact JSON (no prose before or after):
{
  "message": "brief reply to user",
  "animation": null | {"duration":N,"actions":[...]},
  "sceneChanges": null | [{"op":"move","team":"home"|"away","slotId":"...","position":[x,y]}]
}`;
}

function buildQuickPrompt(scene: SceneState): string {
  return `Football tactics animator. Convert description→JSON animation plan.

${COORD_NOTE}

SCENE:
${sceneContext(scene)}

${ACTIONS_REF}

Reply ONLY with JSON: {"duration":<1-12>,"actions":[...]}`;
}

function buildScriptPrompt(scene: SceneState): string {
  return `Football tactics animator for TikTok content.
Given a commentary script, identify 3-6 tactical moments and generate an animation clip for each.

${COORD_NOTE}
IMPORTANT: Every clip needs ≥3 actions. Use markerPulse+arrow+label for abstract moments.
Always use valid player IDs from the scene below.

SCENE:
${sceneContext(scene)}

${ACTIONS_REF}

Reply ONLY with JSON array:
[{"id":"clip_1","label":"Short title","description":"One sentence.","startSec":0,"endSec":5,"duration":6,"actions":[...]}]`;
}

// ── JSON extraction — 5 fallback layers ───────────────────────────────────────

function extractJson(text: string): unknown {
  // Layer 1: strip markdown fences
  let s = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(s); } catch { /* continue */ }

  // Layer 2: find outermost { or [
  const objStart = s.indexOf('{');
  const arrStart = s.indexOf('[');
  const start = objStart === -1 ? arrStart : arrStart === -1 ? objStart : Math.min(objStart, arrStart);
  if (start === -1) throw new Error('No JSON object or array found');

  const openChar = s[start];
  const closeChar = openChar === '{' ? '}' : ']';
  const end = s.lastIndexOf(closeChar);
  if (end === -1) throw new Error('Unclosed JSON — response likely truncated');

  const candidate = s.slice(start, end + 1);

  // Layer 3: fix trailing commas
  const fixed = candidate.replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(fixed); } catch { /* continue */ }

  // Layer 4: truncation recovery — salvage all complete {...} objects
  const recovered: unknown[] = [];
  let depth = 0, objBegin = -1;
  for (let i = 0; i < fixed.length; i++) {
    if (fixed[i] === '{') { if (depth === 0) objBegin = i; depth++; }
    else if (fixed[i] === '}') {
      depth--;
      if (depth === 0 && objBegin !== -1) {
        try { recovered.push(JSON.parse(fixed.slice(objBegin, i + 1))); } catch { /* skip bad object */ }
        objBegin = -1;
      }
    }
  }
  if (recovered.length > 0) {
    if (openChar === '{') {
      const durMatch = fixed.match(/"duration"\s*:\s*(\d+(?:\.\d+)?)/);
      return { duration: durMatch ? Number(durMatch[1]) : 6, actions: recovered };
    }
    return recovered;
  }

  // Layer 5: give up with a clear error
  throw new Error(`JSON malformed and unrecoverable (${text.length} chars)`);
}

// ── Action validation — one-by-one so one bad action never kills the plan ────

function parseActions(raw: unknown[]): ReturnType<typeof AnimationActionSchema.parse>[] {
  return raw.flatMap(a => {
    const r = AnimationActionSchema.safeParse(a);
    return r.success ? [r.data] : [];
  });
}

// ── Guarantee at least one visible thing ─────────────────────────────────────

function ensureVisible(
  actions: ReturnType<typeof AnimationActionSchema.parse>[],
  duration: number,
  scene: SceneState,
): ReturnType<typeof AnimationActionSchema.parse>[] {
  if (actions.length > 0) return actions;
  const slot = scene.teams.home.slots[9] ?? scene.teams.home.slots[0];
  const [x, y] = slot.position;
  return [
    { type: 'markerPulse', position: [x, y] as [number, number], color: '#7c3aed', start: 0, end: duration * 0.6 },
    { type: 'label', text: 'KEY MOMENT', position: [x, Math.max(5, y - 8)] as [number, number], start: 0.3, end: duration * 0.8 },
  ] as ReturnType<typeof AnimationActionSchema.parse>[];
}

function makeValidIds(scene: SceneState) {
  const ids = new Set<string>();
  scene.teams.home.slots.forEach(s => ids.add(`home.${s.slotId}`));
  scene.teams.away?.slots.forEach(s => ids.add(`away.${s.slotId}`));
  return ids;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY.includes('REPLACE_WITH')) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured.' }, { status: 503 });
  }

  try {
    const body = await req.json() as {
      mode?: string;
      prompt?: string;
      script?: string;
      messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
      scene: SceneState;
    };
    const { mode = 'quick', scene } = body;
    const validIds = makeValidIds(scene);

    // ── CHAT MODE ─────────────────────────────────────────────────────────────
    if (mode === 'chat') {
      const messages = body.messages;
      if (!messages?.length) return NextResponse.json({ error: 'Messages required' }, { status: 400 });

      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: buildChatPrompt(scene),
        messages: messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      });

      const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';

      let parsed: Record<string, unknown>;
      try {
        parsed = extractJson(raw) as Record<string, unknown>;
      } catch {
        // Graceful fallback: treat raw text as the message
        return NextResponse.json({
          ok: true, mode: 'chat',
          message: raw.replace(/[{}"\[\]]/g, '').trim().slice(0, 300) || 'Done!',
          animation: null,
          sceneChanges: null,
        });
      }

      // Validate animation if present
      let animation = null;
      if (parsed.animation && typeof parsed.animation === 'object') {
        const animObj = parsed.animation as Record<string, unknown>;
        const rawActions = Array.isArray(animObj.actions) ? animObj.actions : [];
        const actions = parseActions(rawActions);
        const duration = Math.min(12, Math.max(1, Number(animObj.duration) || 6));
        const plan = clampPlan({ duration, actions } as Parameters<typeof clampPlan>[0], validIds);
        animation = { duration: plan.duration, actions: ensureVisible(plan.actions, plan.duration, scene) };
      }

      // Validate scene changes if present
      const sceneChanges = Array.isArray(parsed.sceneChanges)
        ? (parsed.sceneChanges as unknown[]).filter(c => {
            const ch = c as Record<string, unknown>;
            return ['move', 'assign', 'unassign'].includes(ch.op as string) &&
              ['home', 'away'].includes(ch.team as string) &&
              typeof ch.slotId === 'string';
          })
        : null;

      return NextResponse.json({
        ok: true, mode: 'chat',
        message: String(parsed.message || 'Done!'),
        animation,
        sceneChanges: sceneChanges?.length ? sceneChanges : null,
      });
    }

    // ── SCRIPT MODE ───────────────────────────────────────────────────────────
    if (mode === 'script') {
      const script = body.script?.trim();
      if (!script) return NextResponse.json({ error: 'Script is required' }, { status: 400 });

      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 3500,
        system: buildScriptPrompt(scene),
        messages: [{ role: 'user', content: script }],
      });

      const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';

      let parsed: unknown;
      try { parsed = extractJson(raw); }
      catch (e) {
        return NextResponse.json({ error: `Parse failed: ${e instanceof Error ? e.message : 'unknown'}`, preview: raw.slice(0, 300) }, { status: 422 });
      }

      if (!Array.isArray(parsed)) {
        return NextResponse.json({ error: 'Expected JSON array', preview: raw.slice(0, 200) }, { status: 422 });
      }

      const clips = (parsed as Array<Record<string, unknown>>).map((clip, i) => {
        const rawActions = Array.isArray(clip.actions) ? clip.actions : [];
        const actions = parseActions(rawActions);
        const duration = Math.min(12, Math.max(1, Number(clip.duration) || 6));
        const plan = clampPlan({ duration, actions } as Parameters<typeof clampPlan>[0], validIds);
        return {
          id: String(clip.id || `clip_${i + 1}`),
          label: String(clip.label || `Clip ${i + 1}`),
          description: String(clip.description || ''),
          startSec: Number(clip.startSec) || 0,
          endSec: Number(clip.endSec) || 0,
          duration: plan.duration,
          actions: ensureVisible(plan.actions, plan.duration, scene),
        };
      });

      return NextResponse.json({ ok: true, mode: 'script', clips });
    }

    // ── QUICK MODE ────────────────────────────────────────────────────────────
    const prompt = body.prompt?.trim();
    if (!prompt) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      system: buildQuickPrompt(scene),
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';

    let parsed: unknown;
    try { parsed = extractJson(raw); }
    catch (e) {
      return NextResponse.json({ error: `Parse failed: ${e instanceof Error ? e.message : 'unknown'}`, preview: raw.slice(0, 300) }, { status: 422 });
    }

    const asObj = parsed as Record<string, unknown>;
    const rawActions = Array.isArray(asObj?.actions) ? asObj.actions : [];
    const actions = parseActions(rawActions);
    const duration = Math.min(12, Math.max(1, Number(asObj?.duration) || 6));
    const plan = clampPlan({ duration, actions } as Parameters<typeof clampPlan>[0], validIds);
    return NextResponse.json({ ok: true, mode: 'quick', plan: { ...plan, actions: ensureVisible(plan.actions, plan.duration, scene) } });

  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
