const APIFY_TOKEN = process.env.APIFY_TOKEN!;
const BASE = 'https://api.apify.com/v2';

async function getLastRunItems(actorId: string): Promise<any[]> {
  try {
    const res = await fetch(
      `${BASE}/acts/${actorId}/runs/last/dataset/items?token=${APIFY_TOKEN}&limit=50&status=SUCCEEDED`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getTikTokData() {
  return getLastRunItems('clockworks~tiktok-profile-scraper');
}

export async function getYouTubeData() {
  return getLastRunItems('streamers~youtube-scraper');
}

export async function getInstagramData() {
  return getLastRunItems('apify~instagram-scraper');
}

export async function triggerRun(actorId: string, input: object) {
  const res = await fetch(`${BASE}/acts/${actorId}/runs?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return res.json();
}
