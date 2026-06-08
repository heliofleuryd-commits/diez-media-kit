import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isAuthenticated } from '@/lib/auth';

const SKILLS_DIR = path.join(process.cwd(), 'content-plan', 'skills');

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // id is the filename without .md — guard against path traversal
  if (!/^[a-zA-Z0-9._-]+$/.test(params.id)) {
    return NextResponse.json({ ok: false, error: 'Invalid skill id' }, { status: 400 });
  }

  const filename = `${params.id}.md`;
  const filePath = path.join(SKILLS_DIR, filename);
  if (path.dirname(filePath) !== SKILLS_DIR || !fs.existsSync(filePath)) {
    return NextResponse.json({ ok: false, error: 'Skill not found' }, { status: 404 });
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
