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
      {
        // Everything under `public/` is served `public, max-age=0`, which makes
        // the preloaded face in the root layout stale the moment it lands: the
        // @font-face request that follows revalidates instead of consuming the
        // preload, and Chrome then reports the preload as unused on every page
        // after the first. A year and `immutable` lets the same response serve
        // both, which is also what a face that never changes deserves.
        //
        // These filenames carry no content hash, so a new cut of a face must
        // ship under a new filename (bricolage-var-2.woff2), not over the old
        // one: a reader holding the old bytes would keep them for a year.
        source: '/fonts/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
}

export default config
