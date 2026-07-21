export const maxDuration = 60;

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { CREATOR_BIAS } from '@/lib/football/creatorBias';
import { calcCost } from '@/lib/football/costTracker';
import { fetchScoreboards, fetchFootballNews, fetchTrendingYouTube } from '@/lib/football/footballData';

const client = new Anthropic();
const M_FAST = 'claude-haiku-4-5-20251001';
const YT_KEY = process.env.YOUTUBE_API_KEY || '';
const EVERGREEN_PATH = path.join(process.cwd(), 'content-plan', 'evergreen-stories.json');
const CACHE_DIR = '/tmp';

function todayKey() { return new Date().toISOString().slice(0, 10); }
function cachePath() { return path.join(CACHE_DIR, `stories-${todayKey()}.json`); }

function readCache(): any | null {
  try { const data = JSON.parse(fs.readFileSync(cachePath(), 'utf-8')); if (data._date === todayKey()) return data; } catch {}
  return null;
}
function writeCache(payload: any) { try { fs.writeFileSync(cachePath(), JSON.stringify({ ...payload, _date: todayKey() })); } catch {} }

function loadEvergreen(): any[] {
  try { return (JSON.parse(fs.readFileSync(EVERGREEN_PATH, 'utf-8')).stories) || []; } catch { return []; }
}

function norm(s: string): string { return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function nameHit(name: string, haystack: string): boolean {
  const n = norm(name);
  if (n.length > 4 && haystack.includes(n)) return true;
  const last = norm(name).split(/\s+/).pop() || '';
  return last.length >= 5 && haystack.includes(last);
}

// ---- HANDLERS ----

export async function GET() {
  const cached = readCache();
  if (cached) return NextResponse.json({ ok: true, stories: cached.stories, date: cached.date, cost: 0, cached: true });
  return NextResponse.json({ ok: true, stories: [], date: null, cached: false });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  try {
    if (!body.refresh) {
      const cached = readCache();
      if (cached) return NextResponse.json({ ok: true, stories: cached.stories, date: cached.date, cost: 0, cached: true });
    }

    const [scores, news, ytItems] = await Promise.all([fetchScoreboards(), fetchFootballNews(), fetchTrendingYouTube(YT_KEY)]);
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    // Surface evergreen stories whose subject is trending in today's football news/matches.
    const haystack = norm([...scores.today, ...scores.yesterday, ...scores.headlines, ...news, ...ytItems].join(' | '));
    const evergreen = loadEvergreen();
    const trending = evergreen.filter(s => nameHit(s.name, haystack) || nameHit(s.subject || '', haystack));
    const fallback = evergreen.filter(s => !trending.includes(s)).sort(() => Math.random() - 0.5).slice(0, 6);
    const fmt = (s: any, tag: string) => `- [${tag}] ${s.name} (${s.subject}) — tags: ${(s.tags || []).join(', ')}. ${s.story} HOOK: "${s.hook}"${s.caution ? ` ⚠️ CAUTION: ${s.caution}` : ''}`;

    const rawData = [
      '## MATCHES TODAY (top-5 leagues + UCL/Europa)', scores.today.join('\n') || 'No matches today.',
      '\n## RESULTS YESTERDAY', scores.yesterday.join('\n') || 'No results.',
      '\n## FOOTBALL NEWS (trending — weighted to death / controversy / injury / resilience / transfers)', news.map(n => `- ${n}`).join('\n') || 'None',
      '\n## ESPN HEADLINES', scores.headlines.map(h => `- ${h}`).join('\n') || 'None',
      ytItems.length ? `\n## YOUTUBE TRENDING\n${ytItems.map(y => `- ${y}`).join('\n')}` : '',
    ].join('\n');

    const prompt = `Today is ${today}. The World Cup is over — this is GENERAL football now (leagues, transfers, and above all the human stories breaking across the football world).

${rawData}

## EVERGREEN STORIES TRENDING TODAY (their subject is in the news/matches above — PRIORITISE if relevant)
${trending.length ? trending.map(s => fmt(s, 'TRENDING NOW')).join('\n') : '(none of the evergreen classics are in today\'s news)'}

## EVERGREEN CLASSICS (always-tellable — use as fallback when live news is thin)
${fallback.map(s => fmt(s, 'EVERGREEN')).join('\n')}

Build 10 emotional football story ideas ranked by today's relevance.

PRIORITISE, in order:
1. BREAKING / TRENDING emotional human stories from the news above — a death, a serious injury, a controversy, a moment of resilience, a comeback, a big transfer with a real human angle. These are the most valuable because they're happening NOW.
2. Evergreen classics whose subject is trending today.
3. Evergreen classics as fallback (mark relevance EVERGREEN) only if live news is thin.

STRONGLY PREFER stories of controversy, death, tragedy, resilience, injustice, grief and comeback — the deeply emotional, sad, tellable ones. Avoid dry results or transfers with no human story. At least 4 should be HOT (breaking today). For anything drawn from live news, put the real trigger in "why_today" (e.g. "Reported today — [outlet]").

If a story carries a ⚠️ CAUTION, copy it into "caution". Never invent a death or tragedy that isn't real — only use what the news or evergreen bank supports.

${CREATOR_BIAS}

Output ONLY valid JSON array, no other text:
[{"rank":1,"type":"personal","title":"Short title","player":"Name or null","teams":"Team/club or null","relevance":"HOT","why_today":"The live trigger","headline":"Hook line","key_facts":["F1","F2","F3","F4","F5"],"emotional_arc":"Arc","script_angle":"Angle","caution":"Flag or empty string"}]`;

    const res = await client.messages.create({
      model: M_FAST,
      max_tokens: 4500,
      system: [{
        type: 'text',
        text: `You are a football story researcher for an emotional storyteller. The World Cup is over — you cover the whole footballing world. You find the deeply emotional, tellable human stories breaking in the news TODAY (deaths, tragedies, controversies, injuries, resilience, comebacks) and blend in timeless classics when their subject is trending. Be specific and factual — never invent a death or tragedy. Output only a valid JSON array, no markdown.`,
        cache_control: { type: 'ephemeral' },
      }],
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = res.content[0].type === 'text' ? res.content[0].text : '';
    let stories: any[] = [];
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    try { const p = JSON.parse(cleaned); stories = Array.isArray(p) ? p : (p.stories || []); }
    catch {
      const m = cleaned.match(/\[[\s\S]+\]/);
      if (m) { try { stories = JSON.parse(m[0]); } catch {} }
      if (!stories.length) { const m2 = cleaned.match(/\{[\s\S]+\}/); if (m2) { try { stories = JSON.parse(m2[0]).stories || []; } catch {} } }
    }

    const cost = calcCost(M_FAST, res.usage.input_tokens, res.usage.output_tokens);
    const payload = { stories, date: today, cost };
    if (stories.length > 0) writeCache(payload);
    return NextResponse.json({ ok: true, ...payload, cached: false });
  } catch (e: any) {
    const msg = e?.message || e?.toString() || 'Unknown error';
    console.error('[stories] Failed:', msg);
    return NextResponse.json({ ok: false, error: msg.slice(0, 200), stories: [], date: null, cost: 0 });
  }
}
