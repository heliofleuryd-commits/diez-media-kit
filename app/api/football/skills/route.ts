import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SKILLS_DIR = path.join(process.cwd(), 'content-plan', 'skills');

const SKILLS = [
  {
    id: 'toqueymedio',
    file: 'channel-toqueymedio-profile.md',
    name: '@toqueymedio — Emotional Storytelling',
    description: 'The complete narrative DNA of toqueymedio\'s viral style: voice, hooks ("Imagine…", paradox, dramatic irony), the 7-beat factual storytelling structure, rhetorical devices, and a step-by-step writing guide — distilled from analysing 50 of their highest-performing videos.',
  },
  {
    id: 'elefutbol',
    file: 'channel-elefutbol-profile.md',
    name: '@elefutbol — Cinematic Football Narratives',
    description: 'A deep structural breakdown of elefutbol\'s emotional storytelling voice, metaphors, and narrative techniques — distilled from analysing 50 of their highest-performing videos.',
  },
];

export async function GET() {
  const skills = SKILLS.map(s => {
    const filePath = path.join(SKILLS_DIR, s.file);
    const exists = fs.existsSync(filePath);
    let size = 0;
    let updatedAt: string | null = null;
    if (exists) {
      const stat = fs.statSync(filePath);
      size = stat.size;
      updatedAt = stat.mtime.toISOString();
    }
    return { id: s.id, name: s.name, description: s.description, available: exists, size, updatedAt };
  });
  return NextResponse.json({ ok: true, skills });
}
