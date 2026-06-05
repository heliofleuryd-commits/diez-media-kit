import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { CREATOR_BIAS } from '@/lib/football/creatorBias';

const client = new Anthropic();
const SKILLS_DIR = path.join(process.cwd(), 'content-plan', 'skills');

function loadSkills(): string {
  if (!fs.existsSync(SKILLS_DIR)) return 'No skill files found.';
  return fs.readdirSync(SKILLS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => `### ${f}\n${fs.readFileSync(path.join(SKILLS_DIR, f), 'utf-8').slice(0, 1200)}`)
    .join('\n---\n');
}

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json();

    // Build context block from whatever is in the session
    const contextParts: string[] = [];
    if (context?.trendsText) {
      contextParts.push(`## Today's Live Trend Signals\n${context.trendsText}`);
    }
    if (context?.scripts?.length > 0) {
      contextParts.push(`## Generated Scripts (current session)\n${
        context.scripts.map((s: any, i: number) =>
          `### Script ${i+1}: ${s.title}\nHook: ${s.hook}\n\n${s.script}\n\nCaption: ${s.caption}\nHashtags: ${s.hashtags?.join(' ')}`
        ).join('\n\n---\n\n')
      }`);
    }
    if (context?.bullets?.length > 0) {
      contextParts.push(`## Flash News Bullets (current session)\n${context.bullets.map((b: string, i: number) => `${i+1}. ${b}`).join('\n')}`);
    }
    if (context?.flashScript) {
      contextParts.push(`## Flash News Script (current session)\n${context.flashScript}`);
    }

    const sessionContext = contextParts.length > 0
      ? contextParts.join('\n\n')
      : 'No content generated yet in this session.';

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4000,
      system: [
        {
          type: 'text',
          text: `You are an AI content strategist and creative partner for a TikTok football creator preparing for the 2026 FIFA World Cup.

You have been trained on 120 top-performing videos from 16 competitor channels. You know exactly what makes football content go viral.

CREATOR PROFILE:
- Primary style references: @pechefootball, @fiagoball, @5.at.the.back
- Format: ~50% on-camera presenter / 50% b-roll and match footage
- Tone: confident, opinionated, passionate — never neutral
- Script length: 45–90 seconds read aloud
- Scripts must be clean spoken words only — no brackets, no direction notes, no [CAM] or [BROLL] markers
- Football virality = passion, hot takes, controversy — not neutral facts

YOUR CAPABILITIES:
- Rewrite or amend any script, hook, caption, or bullet
- Suggest new video angles based on what's trending
- Answer questions about World Cup tactics, squads, narratives
- Generate entirely new scripts on request
- Tell the creator which topic will perform best and why
- Be direct, opinionated, and decisive — the creator needs strong guidance, not hedged answers

${CREATOR_BIAS}

When rewriting scripts, output the full clean script. No explanatory preamble needed — just deliver the goods.`,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: `## SKILL LIBRARY (extracted from 120 viral football videos)\n\n${loadSkills()}`,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: `## CURRENT SESSION CONTEXT\n\n${sessionContext}`,
        },
      ],
      messages: messages.slice(-20), // keep last 20 turns
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    return NextResponse.json({ ok: true, message: content });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
