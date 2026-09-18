/**
 * Server-only guard.
 *
 * The canonical way to do this is `import 'server-only'`, which makes the
 * bundler fail the build when a client component pulls a module in. That
 * package is not installed here, so this module is the stand-in: every file in
 * `src/server/ai` imports it for side effects, and it throws the moment it is
 * evaluated in a browser realm. A provider key must never reach a client
 * bundle, so a loud runtime failure beats a silent leak.
 */

if (typeof window !== 'undefined') {
  throw new Error(
    'src/server/ai is server-only and was imported into a client bundle. ' +
      'Call it from a Server Component, a Route Handler, or a Server Action.',
  )
}

/** Re-exported so a file can reference the guard without a bare side-effect import. */
export const SERVER_ONLY = true as const
