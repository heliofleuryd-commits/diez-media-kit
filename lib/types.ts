export interface VideoStat {
  id: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  shares?: number;
  thumbnail?: string;
  url: string;
  platform: 'tiktok' | 'youtube' | 'instagram';
  account: string;
  publishedAt?: string;
}

export interface AccountStat {
  platform: 'tiktok' | 'youtube' | 'instagram';
  handle: string;
  displayName: string;
  followers: number;
  totalViews: number;
  videoCount: number;
  url: string;
  niche: string;
}

export interface MediaKitData {
  accounts: AccountStat[];
  topVideos: VideoStat[];
  lastUpdated: string;
  totalFollowers: number;
  totalViews: number;
}
