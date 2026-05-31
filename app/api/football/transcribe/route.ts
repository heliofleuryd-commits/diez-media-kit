import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not configured. Add it to enable MP3 transcription.' },
      { status: 503 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // Forward to OpenAI Whisper
    const outForm = new FormData();
    outForm.append('file', file);
    outForm.append('model', 'whisper-1');
    outForm.append('response_format', 'verbose_json');
    outForm.append('timestamp_granularities[]', 'word');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: outForm,
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Whisper API error: ${err}` }, { status: 502 });
    }

    const data = await res.json() as { text: string; words?: Array<{ word: string; start: number; end: number }> };

    return NextResponse.json({
      ok: true,
      text: data.text,
      words: data.words ?? [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
