'use client';

import { useState } from 'react';

type DateRange = '30d' | '6m' | '1y';

interface ScoreCard {
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  positive?: boolean;
}

interface RangeData {
  label: string;
  cards: ScoreCard[];
  accounts: AccountRow[];
}

interface AccountRow {
  handle: string;
  platform: string;
  niche: string;
  followers: string;
  views: string;
  avgViews: string;
  engRate: string;
  posts: number;
  color: string;
}

const PLATFORM_ICON: Record<string, string> = {
  tiktok: '🎵',
  youtube: '▶',
  instagram: '📸',
};

const RANGES: Record<DateRange, RangeData> = {
  '30d': {
    label: 'Last 30 days',
    cards: [
      { label: 'Total Followers', value: '284K', sub: 'across 5 accounts', delta: '+4.2K', positive: true },
      { label: 'Total Views', value: '6.1M', sub: 'all platforms', delta: '+1.3M', positive: true },
      { label: 'Avg Views / Video', value: '218K', sub: 'top-performing', delta: '+12%', positive: true },
      { label: 'Engagement Rate', value: '8.4%', sub: 'likes + comments', delta: '+0.6%', positive: true },
      { label: 'Videos Posted', value: '36', sub: '3 / week · 5 accs', delta: '—', positive: true },
      { label: 'Top Video Views', value: '1.2M', sub: '@diez.gg · Warzone', delta: '🔥', positive: true },
    ],
    accounts: [
      { handle: '@diez.gg', platform: 'tiktok', niche: 'Warzone', followers: '142K', views: '2.8M', avgViews: '280K', engRate: '9.1%', posts: 12, color: '#FF0050' },
      { handle: '@diez.ball', platform: 'tiktok', niche: 'Football', followers: '68K', views: '1.4M', avgViews: '175K', engRate: '7.8%', posts: 10, color: '#FF0050' },
      { handle: '@imDiez', platform: 'youtube', niche: 'Warzone', followers: '31K', views: '890K', avgViews: '148K', engRate: '6.2%', posts: 6, color: '#FF0000' },
      { handle: '@diez.gg', platform: 'instagram', niche: 'Gaming', followers: '28K', views: '610K', avgViews: '87K', engRate: '8.9%', posts: 10, color: '#E1306C' },
      { handle: '@diezball10', platform: 'instagram', niche: 'Football', followers: '15K', views: '400K', avgViews: '50K', engRate: '10.2%', posts: 10, color: '#E1306C' },
    ],
  },
  '6m': {
    label: 'Last 6 months',
    cards: [
      { label: 'Total Followers', value: '284K', sub: 'across 5 accounts', delta: '+38K', positive: true },
      { label: 'Total Views', value: '47M', sub: 'all platforms', delta: '+15M', positive: true },
      { label: 'Avg Views / Video', value: '196K', sub: 'across all posts', delta: '+22%', positive: true },
      { label: 'Engagement Rate', value: '7.9%', sub: 'likes + comments', delta: '+1.1%', positive: true },
      { label: 'Videos Posted', value: '216', sub: '3 / week · 5 accs', delta: '—', positive: true },
      { label: 'Top Video Views', value: '3.4M', sub: '@diez.gg · Warzone', delta: '🔥', positive: true },
    ],
    accounts: [
      { handle: '@diez.gg', platform: 'tiktok', niche: 'Warzone', followers: '142K', views: '21M', avgViews: '262K', engRate: '8.7%', posts: 72, color: '#FF0050' },
      { handle: '@diez.ball', platform: 'tiktok', niche: 'Football', followers: '68K', views: '10M', avgViews: '167K', engRate: '7.4%', posts: 60, color: '#FF0050' },
      { handle: '@imDiez', platform: 'youtube', niche: 'Warzone', followers: '31K', views: '7.2M', avgViews: '200K', engRate: '5.8%', posts: 36, color: '#FF0000' },
      { handle: '@diez.gg', platform: 'instagram', niche: 'Gaming', followers: '28K', views: '5.4M', avgViews: '90K', engRate: '8.4%', posts: 60, color: '#E1306C' },
      { handle: '@diezball10', platform: 'instagram', niche: 'Football', followers: '15K', views: '3.4M', avgViews: '57K', engRate: '9.7%', posts: 60, color: '#E1306C' },
    ],
  },
  '1y': {
    label: 'Last 12 months',
    cards: [
      { label: 'Total Followers', value: '284K', sub: 'across 5 accounts', delta: '+121K', positive: true },
      { label: 'Total Views', value: '118M', sub: 'all platforms', delta: '+62M', positive: true },
      { label: 'Avg Views / Video', value: '181K', sub: 'across all posts', delta: '+34%', positive: true },
      { label: 'Engagement Rate', value: '7.6%', sub: 'likes + comments', delta: '+2.3%', positive: true },
      { label: 'Videos Posted', value: '432', sub: '3 / week · 5 accs', delta: '—', positive: true },
      { label: 'Top Video Views', value: '5.1M', sub: '@diez.gg · Warzone', delta: '🔥', positive: true },
    ],
    accounts: [
      { handle: '@diez.gg', platform: 'tiktok', niche: 'Warzone', followers: '142K', views: '54M', avgViews: '225K', engRate: '8.2%', posts: 144, color: '#FF0050' },
      { handle: '@diez.ball', platform: 'tiktok', niche: 'Football', followers: '68K', views: '26M', avgViews: '155K', engRate: '7.1%', posts: 120, color: '#FF0050' },
      { handle: '@imDiez', platform: 'youtube', niche: 'Warzone', followers: '31K', views: '18M', avgViews: '188K', engRate: '5.5%', posts: 72, color: '#FF0000' },
      { handle: '@diez.gg', platform: 'instagram', niche: 'Gaming', followers: '28K', views: '12M', avgViews: '83K', engRate: '8.0%', posts: 120, color: '#E1306C' },
      { handle: '@diezball10', platform: 'instagram', niche: 'Football', followers: '15K', views: '8M', avgViews: '55K', engRate: '9.2%', posts: 120, color: '#E1306C' },
    ],
  },
};

export default function StatsClient() {
  const [range, setRange] = useState<DateRange>('30d');
  const data = RANGES[range];

  return (
    <div>
      <div className="flex items-center justify-center gap-2 mb-10">
        {(['30d', '6m', '1y'] as DateRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              range === r
                ? 'bg-[#00E5FF] text-black'
                : 'bg-[#18181B] border border-[#27272A] text-[#A1A1AA] hover:border-[#00E5FF]/40'
            }`}
          >
            {r === '30d' ? 'Last 30 days' : r === '6m' ? 'Last 6 months' : 'Last year'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-12">
        {data.cards.map((card) => (
          <div key={card.label} className="bg-[#18181B] border border-[#27272A] rounded-2xl p-4">
            <div className="text-2xl font-black text-[#00E5FF] stat-glow leading-none mb-1">
              {card.value}
            </div>
            {card.delta && (
              <div className={`text-xs font-semibold mb-1 ${card.positive ? 'text-emerald-400' : 'text-red-400'}`}>
                {card.delta !== '🔥' && card.delta !== '—' ? '↑ ' : ''}{card.delta}
              </div>
            )}
            <div className="text-[#71717A] text-xs leading-tight">{card.label}</div>
            {card.sub && <div className="text-[#52525B] text-xs mt-0.5">{card.sub}</div>}
          </div>
        ))}
      </div>

      <div className="bg-[#18181B] border border-[#27272A] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#27272A] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#FAFAFA]">Account Breakdown</h3>
          <span className="text-xs text-[#52525B]">{data.label}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#27272A]">
                {['Account', 'Platform', 'Niche', 'Followers', 'Views', 'Avg / Video', 'Eng. Rate', 'Posts'].map((h) => (
                  <th key={h} className="text-left text-xs text-[#52525B] font-medium px-6 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((acc, i) => (
                <tr key={i} className="border-b border-[#27272A]/50 hover:bg-[#27272A]/20 transition-colors">
                  <td className="px-6 py-3 font-medium text-white whitespace-nowrap">
                    {PLATFORM_ICON[acc.platform]} {acc.handle}
                  </td>
                  <td className="px-6 py-3 text-[#A1A1AA] capitalize whitespace-nowrap">{acc.platform}</td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: acc.color + '20', color: acc.color }}>
                      {acc.niche}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-white font-semibold whitespace-nowrap">{acc.followers}</td>
                  <td className="px-6 py-3 text-[#00E5FF] font-semibold whitespace-nowrap">{acc.views}</td>
                  <td className="px-6 py-3 text-[#A1A1AA] whitespace-nowrap">{acc.avgViews}</td>
                  <td className="px-6 py-3 whitespace-nowrap"><span className="text-emerald-400 font-medium">{acc.engRate}</span></td>
                  <td className="px-6 py-3 text-[#71717A] whitespace-nowrap">{acc.posts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}