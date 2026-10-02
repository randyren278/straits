import type { NextConfig } from 'next'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const maplibreVersion = (require('maplibre-gl/package.json') as { version: string }).version

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  ...(process.env.STRAITS_CANARY === '1' && process.env.VERCEL_ENV !== 'production'
    ? [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]
    : []),
]

const nextConfig: NextConfig = {
  distDir: process.env.STRAITS_DIST_DIR || '.next',
  env: {
    NEXT_PUBLIC_MAPLIBRE_VERSION: maplibreVersion,
    NEXT_PUBLIC_STRAITS_CANARY:
      process.env.STRAITS_CANARY === '1' && process.env.VERCEL_ENV !== 'production' ? '1' : '0',
  },
  reactStrictMode: true,
  poweredByHeader: false,

  // Empty turbopack config to use Turbopack (Next.js 16 default).
  turbopack: {},

  // Hide the dev-mode indicator badge (bottom-left "N") for clean UI/screenshots.
  devIndicators: false,

  // Baseline browser hardening. CSP is intentionally handled separately because
  // the map and external data layers require a carefully tested allow-list.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/maplibre/v:version/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
}

export default nextConfig
