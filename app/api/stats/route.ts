import { NextResponse } from 'next/server';
import { getTikTokData, getYouTubeData, getInstagramData } from '@/lib/apify';
import type { AccountStat, VideoStat } from '@/lib/types';

export const revalidate = 86400;

export async function GET() {
  try {
    const [tiktokData, youtubeData, instagramData] = await Promise.all([
      getTikTokData(),
      getYouTubeData(),
      getInstagramData(),
    ]);

    // --- TikTok ---
    const tiktokVideos: VideoStat[] = tiktokData.map((item: any) => ({
      id: item.id || String(Math.random()),
      title: item.text || item.desc || '',
      views: item.playCount || item.stats?.playCount || 0,
      likes: item.diggCount || item.stats?.diggCount || 0,
      comments: item.commentCount || item.stats?.commentCount || 0,
      shares: item.shareCount || item.stats?.shareCount || 0,
      thumbnail: item.videoMeta?.covers?.[0] || item.covers?.[0] || '',
      url: item.webVideoUrl || `https://tiktok.com/@${item.authorMeta?.name}/video/${item.id}`,
      platform: 'tiktok',
      account: item.authorMeta?.name || '',
      publishedAt: item.createTime ? new Date(item.createTime * 1000).toISOString() : '',
    }));

    const tiktokByAccount = (handle: string) =>
      tiktokData.find((i: any) => i.authorMeta?.name === handle);

    // --- YouTube ---
    const channelItem = youtubeData.find((i: any) => i.type === 'channel') || youtubeData[0] || null;
    const youtubeVideos: VideoStat[] = youtubeData
      .filter((i: any) => i.type === 'video')
      .map((item: any) => ({
        id: item.id || item.videoId || String(Math.random()),
        title: item.title || '',
        views: item.viewCount || 0,
        likes: item.likes || 0,
        comments: item.commentsCount || 0,
        thumbnail: item.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
        url: item.url || `https://youtube.com/watch?v=${item.id}`,
        platform: 'youtube',
        account: 'imDiez',
        publishedAt: item.date || '',
      }));

    // --- Instagram ---
    const instagramPosts: VideoStat[] = instagramData
      .filter((i: any) => i.type === 'Image' || i.type === 'Video' || i.type === 'Sidecar' || i.shortCode)
      .map((item: any) => ({
        id: item.id || item.shortCode || String(Math.random()),
        title: item.caption || item.alt || '',
        views: item.videoViewCount || item.likesCount || 0,
        likes: item.likesCount || 0,
        comments: item.commentsCount || 0,
        thumbnail: item.displayUrl || item.imageUrl || '',
        url: item.url || `https://instagram.com/p/${item.shortCode}`,
        platform: 'instagram',
        account: item.ownerUsername || '',
        publishedAt: item.timestamp || '',
      }));

    // --- Account summaries ---
    const accounts: AccountStat[] = [
      {
        platform: 'tiktok',
        handle: '@diez.gg',
        displayName: 'Diez · Warzone',
        followers: tiktokByAccount('diez.gg')?.authorMeta?.fans || 1200000,
        totalViews: tiktokVideos.filter(v => v.account === 'diez.gg').reduce((s, v) => s + v.views, 0),
        videoCount: tiktokVideos.filter(v => v.account === 'diez.gg').length,
        url: 'https://tiktok.com/@diez.gg',
        niche: 'Warzone / FPS',
      },
      {
        platform: 'tiktok',
        handle: '@diez.ball',
        displayName: 'Diez · Football',
        followers: tiktokByAccount('diez.ball')?.authorMeta?.fans || 26900,
        totalViews: tiktokVideos.filter(v => v.account === 'diez.ball').reduce((s, v) => s + v.views, 0),
        videoCount: tiktokVideos.filter(v => v.account === 'diez.ball').length,
        url: 'https://tiktok.com/@diez.ball',
        niche: 'Football',
      },
      {
        platform: 'youtube',
        handle: '@imDiez',
        displayName: 'imDiez',
        followers: channelItem?.numberOfSubscribers || channelItem?.subscriberCount || 100000,
        totalViews: youtubeVideos.reduce((s, v) => s + v.views, 0),
        videoCount: youtubeVideos.length,
        url: 'https://youtube.com/@imDiez',
        niche: 'Warzone / FPS',
      },
      {
        platform: 'instagram',
        handle: '@diez.gg',
        displayName: 'Diez · Gaming',
        followers: instagramData.filter((i) => i.ownerUsername === 'diez.gg')[0]?.followersCount || 38212,
        totalViews: instagramPosts.filter(v => v.account === 'diez.gg').reduce((s, v) => s + v.views, 0),
        videoCount: instagramPosts.filter(v => v.account === 'diez.gg').length,
        url: 'https://instagram.com/diez.gg',
        niche: 'Gaming / Lifestyle',
      },
      {
        platform: 'instagram',
        handle: '@diezball10',
        displayName: 'Diez · Football',
        followers: instagramData.filter((i) => i.ownerUsername === 'diezball10')[0]?.followersCount || 4065,
        totalViews: instagramPosts.filter(v => v.account === 'diezball10').reduce((s, v) => s + v.views, 0),
        videoCount: instagramPosts.filter(v => v.account === 'diezball10').length,
        url: 'https://instagram.com/diezball10',
        niche: 'Football',
      },
    ];

    const topVideos = [...tiktokVideos, ...youtubeVideos, ...instagramPosts]
      .sort((a, b) => b.views - a.views)
      .slice(0, 20);

    return NextResponse.json({
      accounts,
      topVideos,
      lastUpdated: new Date().toISOString(),
      totalFollowers: accounts.reduce((s, a) => s + a.followers, 0),
      totalViews: accounts.reduce((s, a) => s + a.totalViews, 0),
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
