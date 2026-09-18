import path from 'node:path'
import type { NextConfig } from 'next'

const config: NextConfig = {
  // `next dev` and `next start` used to share `.next`, so starting the dev
  // server quietly replaced the production build with a development one and
  // a running `next start` began serving pages whose assets no longer existed.
  // The dev script points this elsewhere; builds keep the default.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // There is a lockfile above this directory as well, and Next picks the
  // outermost one when it guesses. Saying so removes the guess and the warning.
  outputFileTracingRoot: path.resolve(import.meta.dirname),
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['node:sqlite'],
  experimental: { optimizePackageImports: ['lucide-react'] },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default config
