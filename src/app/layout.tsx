import type { Metadata, Viewport } from 'next'
import { HydrationGate } from '@/components/chrome/hydration-gate'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:4311'),
  title: {
    default: 'Whetstone: feedback that sharpens what you are building',
    template: '%s · Whetstone',
  },
  description:
    'Post the thing you are building and get structured feedback from people who will actually use it. Rated on the axes that matter for your kind of project, not a thumbs up.',
  applicationName: 'Whetstone',
  openGraph: {
    type: 'website',
    siteName: 'Whetstone',
    title: 'Whetstone: feedback that sharpens what you are building',
    description:
      'Structured, category-scoped critique from real users, before you launch.',
  },
  // No `robots` here. Index and follow are the default already, and an explicit
  // value put a second, contradicting robots meta beside the noindex Next adds
  // to every not-found view. Pages that must stay out of an index say so on
  // their own metadata.
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#1a1610' },
    { media: '(prefers-color-scheme: light)', color: '#f6f0e4' },
  ],
}

/**
 * Applies the stored theme before first paint. Without this the page renders in
 * the system theme for a frame and then swaps, which reads as a bug.
 */
const THEME_BOOT = `(function(){try{var t=document.cookie.match(/(?:^|; )ws_theme=([^;]*)/);t=t&&decodeURIComponent(t[1]);if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t}}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        {/* Preload only the face every page paints with. Newsreader is the
            voice of people's own words and most chrome, dashboard and settings
            pages print none, so preloading it here made Chrome report an
            unused preload on them; where it is used, @font-face fetches it and
            its metric-matched fallback keeps the swap from moving anything. */}
        <link rel="preload" href="/fonts/bricolage-var.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        {/* Everything a route renders hydrates behind the gate: the file says
            which React defect it keeps from tearing the page down (#418). */}
        <HydrationGate>
          <a className="skip-link" href="#main">Skip to content</a>
          {children}
        </HydrationGate>
      </body>
    </html>
  )
}
