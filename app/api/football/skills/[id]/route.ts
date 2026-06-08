import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SKILLS_DIR = path.join(process.cwd(), 'content-plan', 'skills');

const FILES: Record<string, string> = {
  toqueymedio: 'channel-toqueymedio-profile.md',
  elefutbol: 'channel-elefutbol-profile.md',
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const filename = FILES[params.id];
  if (!filename) {
    return NextResponse.json({ ok: false, error: 'Unknown skill' }, { status: 404 });
  }

  const filePath = path.join(SKILLS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ ok: false, error: 'Skill not generated yet' }, { status: 404 });
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
