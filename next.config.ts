import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable React strict mode for development
  reactStrictMode: true,

  // Transpile maplibre-gl for compatibility
  transpilePackages: ['maplibre-gl'],

  // Empty turbopack config to use Turbopack (Next.js 16 default)
  turbopack: {},

  // Hide the dev-mode indicator badge (bottom-left "N") for clean UI/screenshots.
  devIndicators: false,
}

export default nextConfig
