/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Security headers are handled in middleware.ts
  async headers() {
    return [];
  },
  // Disable image optimization for this app (not needed)
  images: {
    unoptimized: true,
  },
  // Enable compression
  compress: true,
  // Production optimizations
  swcMinify: true,
}

module.exports = nextConfig 