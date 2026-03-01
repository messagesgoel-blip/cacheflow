/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    API_URL: process.env.API_URL || 'http://api:8100',
  },
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://api:8100';
    return [
      { source: '/health', destination: `${apiUrl}/health` },
      { source: '/cache', destination: `${apiUrl}/cache` },
      { source: '/cache/:path*', destination: `${apiUrl}/cache/:path*` },
      { source: '/transfer/:path*', destination: `${apiUrl}/transfer/:path*` },
      { source: '/api/:path*', destination: `${apiUrl}/api/:path*` },
      { source: '/auth/:path*', destination: `${apiUrl}/auth/:path*` },
      { source: '/files/:path*', destination: `${apiUrl}/files/:path*` },
      { source: '/tokens/:path*', destination: `${apiUrl}/tokens/:path*` },
    ];
  },
}
module.exports = nextConfig
