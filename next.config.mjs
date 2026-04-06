/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.tiktokcdn.com' },
      { protocol: 'https', hostname: '**.tiktokcdn-us.com' },
      { protocol: 'https', hostname: '**.ytimg.com' },
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: '**.instagram.com' },
      { protocol: 'https', hostname: 'p16-sign.tiktokcdn-us.com' },
      { protocol: 'https', hostname: 'p77-sign.tiktokcdn-us.com' },
    ],
  },
};

export default nextConfig;
