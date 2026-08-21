import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Transpile maplibre-gl for compatibility.
  transpilePackages: ['maplibre-gl'],

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
    ]
  },
}

export default nextConfig
