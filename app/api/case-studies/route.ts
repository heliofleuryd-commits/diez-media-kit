import { NextResponse } from 'next/server';

// Fully static — no API calls needed. Update manually when campaigns change.

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 100) / 10}K`;
  return String(n);
}

function calcEngRate(views: number, likes: number, comments: number) {
  return ((likes + comments) / views * 100).toFixed(1) + '%';
}

const BRANDS = [
  {
    brand: 'Call of Duty', domain: 'callofduty.com',
    videoUrl: 'https://www.tiktok.com/@diez.gg/video/7446102664481475872',
    thumbnail: '/thumbnails/cod.jpg',
    views: 1_800_000, likes: 88_900, comments: 327,
  },
  {
    brand: 'EklipseGG', domain: 'eklipse.gg',
    videoUrl: 'https://www.tiktok.com/@diez.gg/video/7561148427082583318',
    thumbnail: '/thumbnails/eklipse.jpg',
    views: 2_900_000, likes: 15_900, comments: 178,
  },
  {
    brand: 'Epic Games', domain: 'epicgames.com',
    videoUrl: 'https://www.tiktok.com/@diez.gg/video/7395152185857953057',
    thumbnail: '/thumbnails/epicgames.jpg',
    views: 2_300_000, likes: 23_500, comments: 331,
  },
  {
    brand: 'Thunderpick', domain: 'thunderpick.io',
    videoUrl: 'https://www.tiktok.com/@diez.gg/video/7606416336364817686',
    thumbnail: '/thumbnails/thunderpick.jpg',
    views: 323_700, likes: 17_100, comments: 138,
  },
  {
    brand: 'PUBG', domain: 'pubg.com',
    videoUrl: 'https://www.tiktok.com/@diez.gg/video/7408622020017098016',
    thumbnail: '/thumbnails/pubg.jpg',
    views: 252_500, likes: 2_285, comments: 13,
  },
  {
    brand: 'Razer', domain: 'razer.com',
    videoUrl: 'https://www.tiktok.com/@diez.gg/video/7604566524501740822',
    thumbnail: '/thumbnails/razer.jpg',
    views: 60_500, likes: 3_093, comments: 57,
  },
  {
    brand: 'PlayStation', domain: 'playstation.com',
    videoUrl: null,
    thumbnail: null,
    views: 133_000, likes: 11_837, comments: 420,
  },
];

const studies = BRANDS.map(b => ({
  brand:       b.brand,
  domain:      b.domain,
  logoUrl:     `https://logo.clearbit.com/${b.domain}`,
  videoUrl:    b.videoUrl,
  thumbnail:   b.thumbnail,
  views:       b.views,
  likes:       b.likes,
  comments:    b.comments,
  viewsFmt:    fmtNum(b.views),
  likesFmt:    fmtNum(b.likes),
  commentsFmt: fmtNum(b.comments),
  engRate:     calcEngRate(b.views, b.likes, b.comments),
}));

const avgViews   = Math.round(studies.reduce((s, x) => s + x.views, 0) / studies.length);
const avgEngRate = (studies.reduce((s, x) => s + parseFloat(x.engRate), 0) / studies.length).toFixed(1) + '%';

export async function GET() {
  return NextResponse.json({
    studies,
    avgViews:   fmtNum(avgViews),
    avgEngRate,
  });
}
