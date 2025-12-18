/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self' https://*.supabase.co",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.tile.openstreetmap.org",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com",
              "style-src 'self' 'unsafe-inline' https://unpkg.com",
              `img-src 'self' data: blob: https://*.tile.openstreetmap.org https://unpkg.com https://*.supabase.co`,
              "media-src 'self' data: blob: https://*.supabase.co"
            ].join('; ')
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=*, camera=(), microphone=()'
          }
        ]
      }
    ]
  },
}

module.exports = nextConfig
