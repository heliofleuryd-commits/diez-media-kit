import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isAuthenticated } from '@/lib/auth';

const SKILLS_DIR = path.join(process.cwd(), 'content-plan', 'skills');

const CHANNEL_RE = /^channel-(.+)-profile\.md$/;

const SKILL_META: Record<string, { name: string; description: string; category: string }> = {
  'hook-guide': {
    name: 'Hook Guide',
    description: 'How to pick, construct, and deliver every hook type — with decision maps, step-by-step templates, and what kills each one.',
    category: 'Writing Guides',
  },
  'structure-guide': {
    name: 'Structure Guide',
    description: 'Beat-by-beat architecture for analytical football scripts — video length guide, format templates, and the most common structural mistakes.',
    category: 'Writing Guides',
  },
  'analytical-research-scriptwriter': {
    name: 'Analytical Research + Scriptwriter',
    description: 'Combined research and scriptwriting skill for analytical football content — from topic idea to publish-ready script, grounded in evidence and built around a strong central argument.',
    category: 'Writing Guides',
  },
};

function titleCase(slug: string) {
  return slug.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function describe(filename: string): { name: string; description: string; category: string } {
  const channelMatch = filename.match(CHANNEL_RE);
  if (channelMatch) {
    const handle = channelMatch[1];
    return {
      name: `@${handle}`,
      description: `Deep narrative voice profile for @${handle} — hooks, persona, rhetorical devices, and writing structure distilled from their highest-performing videos.`,
      category: 'Creator Voice Profiles',
    };
  }
  const base = filename.replace(/\.md$/, '');
  if (SKILL_META[base]) return SKILL_META[base];
  return {
    name: titleCase(base),
    description: `Format/pattern skill: "${titleCase(base)}" — a reusable structural template distilled across multiple creators' top videos.`,
    category: 'Format & Pattern Skills',
  };
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const files = fs.existsSync(SKILLS_DIR)
    ? fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md')).sort()
    : [];

  const skills = files.map(file => {
    const filePath = path.join(SKILLS_DIR, file);
    const stat = fs.statSync(filePath);
    const { name, description, category } = describe(file);
    return {
      id: file.replace(/\.md$/, ''),
      name,
      description,
      category,
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
    };
  });

  return NextResponse.json({ ok: true, skills });
}
