/**
 * Runs once when the server boots. A production server with no usable
 * AUTH_SECRET refuses to start, instead of starting and failing on the first
 * request that touches a session.
 *
 * Missing mail is logged rather than fatal: everything but the password reset
 * still works, and /forgot-password tells people it cannot send a link.
 */
export async function register(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return
  const { authSecretProblem } = await import('@/lib/env')
  const problem = authSecretProblem(process.env.AUTH_SECRET?.trim() || undefined)
  if (problem) throw new Error(problem)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { reportMailProblem } = await import('@/server/mail')
    reportMailProblem()
  }
}
