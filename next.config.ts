import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable React strict mode for development
  reactStrictMode: true,

  // Transpile mapbox-gl for compatibility
  transpilePackages: ['mapbox-gl'],

  // Empty turbopack config to use Turbopack (Next.js 16 default)
  turbopack: {},
}

export default nextConfig
