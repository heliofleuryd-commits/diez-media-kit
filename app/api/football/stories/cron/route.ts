export const maxDuration = 60;

import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  const authHeader = req.headers.get('authorization');

  if (secret !== process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const baseUrl = new URL(req.url).origin;
    const res = await fetch(`${baseUrl}/api/football/stories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: true, cron_secret: process.env.CRON_SECRET }),
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch { return NextResponse.json({ ok: false, error: 'Invalid response from stories API' }, { status: 500 }); }

    return NextResponse.json({
      ok: data.ok,
      generated: data.stories?.length || 0,
      date: data.date,
      cost: data.cost,
      error: data.error || null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || 'Cron failed' }, { status: 500 });
  }
}
