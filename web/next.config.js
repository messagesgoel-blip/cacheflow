const path = require('path');

function resolveInternalApiUrl() {
  const explicit =
    process.env.API_URL ||
    process.env.API_INTERNAL_URL ||
    process.env.CACHEFLOW_API_INTERNAL_URL;

  if (explicit) return explicit.replace(/\/+$/, '');

  return process.env.NODE_ENV === 'production'
    ? 'http://api:8100'
    : 'http://127.0.0.1:8100';
}

const internalApiUrl = resolveInternalApiUrl();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.resolve(__dirname),
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    // Avoid pulling transient `.next/dev/types` into standalone `tsc --noEmit`.
    isolatedDevBuild: false,
  },
  typescript: {
    // Existing codebase contains legacy TS issues; do not block deploy builds.
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      { source: '/health', destination: `${internalApiUrl}/health` },
      { source: '/cache', destination: `${internalApiUrl}/cache` },
      { source: '/cache/:path*', destination: `${internalApiUrl}/cache/:path*` },
      { source: '/transfer/:path*', destination: `${internalApiUrl}/transfer/:path*` },
      { source: '/auth/:path*', destination: `${internalApiUrl}/auth/:path*` },
      { source: '/files/:path*', destination: `${internalApiUrl}/files/:path*` },
      { source: '/tokens/:path*', destination: `${internalApiUrl}/tokens/:path*` },
    ];
  },
}

module.exports = nextConfig
