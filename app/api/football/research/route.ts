import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const SKILLS_DIR = path.join(process.cwd(), 'content-plan', 'skills');

// ── Trend fetchers ────────────────────────────────────────────────────────────

async function fetchReddit(): Promise<{ title: string; score: number; comments: number; url: string }[]> {
  const res = await fetch(
    'https://www.reddit.com/r/soccer/hot.json?limit=25&t=day',
    { headers: { 'User-Agent': 'diez-content-agent/1.0' }, next: { revalidate: 0 } }
  );
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data?.children || []).map((c: any) => ({
    title:    c.data.title,
    score:    c.data.score,
    comments: c.data.num_comments,
    url:      `https://reddit.com${c.data.permalink}`,
  }));
}

async function fetchGoogleNews(): Promise<{ title: string; source: string }[]> {
  const queries = ['World Cup 2026', 'FIFA World Cup', 'football 2026'];
  const results: { title: string; source: string }[] = [];
  for (const q of queries) {
    try {
      const res = await fetch(
        `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,
        { next: { revalidate: 0 } }
      );
      const xml = await res.text();
      const titles = [...xml.matchAll(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/g)].slice(1, 8);
      const sources = [...xml.matchAll(/<source[^>]*>([^<]+)<\/source>/g)];
      titles.forEach((m, i) => {
        results.push({ title: m[1], source: sources[i]?.[1] || 'Google News' });
      });
    } catch { /* skip */ }
  }
  return results;
}

// ── Skill loader ──────────────────────────────────────────────────────────────

function loadSkills(): string {
  if (!fs.existsSync(SKILLS_DIR)) return 'No skills extracted yet.';
  const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));
  return files.map(f => {
    const content = fs.readFileSync(path.join(SKILLS_DIR, f), 'utf-8');
    return `### ${f}\n${content.slice(0, 1500)}\n`;
  }).join('\n---\n\n');
}

// ── POST /api/football/research ───────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const [reddit, news] = await Promise.all([fetchReddit(), fetchGoogleNews()]);

    const trendsText = [
      '## Reddit r/soccer (hot today)',
      reddit.slice(0, 15).map(r => `- [${r.score} upvotes] ${r.title}`).join('\n'),
      '',
      '## Google News — World Cup 2026',
      news.slice(0, 15).map(n => `- [${n.source}] ${n.title}`).join('\n'),
    ].join('\n');

    const skills = loadSkills();

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 8000,
      system: [
        {
          type: 'text',
          text: `You are a viral TikTok football content strategist for a creator preparing daily videos during the 2026 FIFA World Cup.

You have access to:
1. Skill files extracted from 120 top-performing videos across 16 football creators
2. Today's trending topics from Reddit r/soccer and Google News

Your job: generate exactly 3 viral-ready TikTok scripts optimised for maximum reach.

STYLE RULES (non-negotiable):
- Primary reference style: @pechefootball, @fiagoball, @5.at.the.back
- Format: ~50% on-camera presenter delivery / 50% b-roll or match footage
- Tone: confident, passionate, strong POV — never neutral
- Length: 45–60 seconds when read aloud
- Structure: bold hook (0–3s) → setup (3–15s) → payoff/reveal (15–45s) → CTA (45–60s)
- Every script needs a hot take or contrarian angle — facts alone don't go viral

OUTPUT FORMAT — return valid JSON only, no markdown fences:
{
  "generated_at": "ISO timestamp",
  "trends_summary": "2-sentence summary of what's trending today",
  "scripts": [
    {
      "rank": 1,
      "title": "Short internal title",
      "topic": "The trending hook this exploits",
      "virality_score": 85,
      "virality_reason": "Why this will perform",
      "hook": "Exact opening line (0–3s)",
      "script": "Full script with [CAM] and [BROLL: description] markers",
      "shot_list": ["Shot 1", "Shot 2"],
      "on_screen_text": ["Text overlay 1", "Text overlay 2"],
      "suggested_sound": "Sound/music direction",
      "caption": "TikTok caption (under 150 chars)",
      "hashtags": ["#tag1", "#tag2"]
    }
  ]
}`,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: `## SKILL FILES\n\n${skills}`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Generate 3 scripts for today.\n\n${trendsText}`,
        },
      ],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]+\}/);
      parsed = match ? JSON.parse(match[0]) : { error: 'Parse failed', raw };
    }

    return NextResponse.json({ ok: true, data: parsed, trends: { reddit: reddit.slice(0, 15), news: news.slice(0, 15) } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// ── GET /api/football/research — just return trends ───────────────────────────

export async function GET() {
  try {
    const [reddit, news] = await Promise.all([fetchReddit(), fetchGoogleNews()]);
    return NextResponse.json({ ok: true, reddit: reddit.slice(0, 20), news: news.slice(0, 20) });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
