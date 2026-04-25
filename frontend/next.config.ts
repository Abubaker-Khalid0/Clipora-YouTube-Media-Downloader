import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

const withNextIntl = createNextIntlPlugin('./i18n.ts')

const nextConfig: NextConfig = {
  output: 'standalone',

  images: {
    remotePatterns: [
      // YouTube thumbnails — served by VideoPreview and RecentActivity
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      // YouTube thumbnails (alternate CDN used by some videos)
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
    ],
  },
}

export default withNextIntl(nextConfig)