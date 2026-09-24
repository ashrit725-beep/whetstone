/**
 * Environment access. Every AI provider key is optional: the product is fully
 * usable with none of them set, and each AI feature has a deterministic fallback.
 */

function opt(name: string): string | undefined {
  const v = process.env[name]
  return v && v.trim().length > 0 ? v.trim() : undefined
}

/** Dev-only fallback so `npm run dev` works before the operator writes .env.local. */
const DEV_SECRET = 'whetstone-development-secret-do-not-use-in-production-0000'

/**
 * Why a production secret is unusable, or null when it is fine. A short or
 * copied-from-the-source secret signs sessions anybody could forge.
 */
export function authSecretProblem(secret: string | undefined): string | null {
  if (!secret) return 'AUTH_SECRET must be set in production. Generate one with: openssl rand -base64 48'
  if (secret === DEV_SECRET) return 'AUTH_SECRET is the development value from the source code. Generate a real one with: openssl rand -base64 48'
  if (secret.length < 32) return `AUTH_SECRET is ${secret.length} characters; use at least 32. Generate one with: openssl rand -base64 48`
  return null
}

/** The deployment's public origin, from `SITE_URL`. Undefined when unset or unparseable. */
function siteUrl(): string | undefined {
  const raw = opt('SITE_URL') ?? opt('NEXT_PUBLIC_SITE_URL')
  if (!raw) return undefined
  try {
    return new URL(raw).origin
  } catch {
    return undefined
  }
}

/** The first entry of a comma-joined header, without its trailing colon. */
function firstScheme(value: string | null | undefined): string | undefined {
  const first = value?.split(',')[0]?.trim().replace(/:$/, '').toLowerCase()
  return first && first.length > 0 ? first : undefined
}

/** One `Host` entry without its port: `[::1]:4311` and `whetstone.test:80`. */
function hostName(entry: string): string {
  const raw = entry.trim().toLowerCase()
  const bracketed = /^\[([^\]]+)\]/.exec(raw)
  if (bracketed?.[1]) return bracketed[1]
  // An unbracketed address full of colons is an IPv6 literal carrying no port;
  // only a single trailing `:digits` is one.
  if ((raw.match(/:/g) ?? []).length > 1) return raw
  return raw.replace(/:\d+$/, '')
}

/**
 * Hosts a browser itself reaches over plain http without complaint: the
 * loopback names and addresses, mDNS `.local`, and the private ranges a machine
 * on an office or home network is reached on. A production build served on one
 * of these is the plain-http case `secureCookies` has to keep working.
 */
function plainHttpHost(entry: string): boolean {
  const name = hostName(entry)
  if (!name) return false
  if (name === 'localhost' || name.endsWith('.localhost') || name.endsWith('.local')) return true
  if (name === '::1' || name === '0.0.0.0') return true
  if (/^127\.\d+\.\d+\.\d+$/.test(name)) return true
  if (/^10\.\d+\.\d+\.\d+$/.test(name)) return true
  if (/^192\.168\.\d+\.\d+$/.test(name)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(name)) return true
  return false
}

/**
 * Every host this request names: its `Host`, plus anything a proxy put in
 * `x-forwarded-host`. A terminator that rewrites `Host` to an internal name
 * forwards the public one alongside it, so both have to be looked at.
 */
function requestHosts(headers: Headers): readonly string[] {
  return [headers.get('host'), headers.get('x-forwarded-host')]
    .flatMap((value) => value?.split(',') ?? [])
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

/** `COOKIE_SECURE`, when the operator has settled the question themselves. */
function cookieSecureOverride(): boolean | undefined {
  const v = opt('COOKIE_SECURE')?.toLowerCase()
  if (v === '1' || v === 'true') return true
  if (v === '0' || v === 'false') return false
  return undefined
}

/**
 * Whether a cookie set on this request should be HTTPS-only.
 *
 * Deciding it from NODE_ENV alone marked the session and CSRF cookies Secure
 * on every production build, including one opened over plain http (the
 * machine's network address, or Safari on localhost). The browser then drops
 * them without a word: sign-in and sign-up appear to succeed and leave the
 * reader signed out, and every button that posts through the API fails its
 * CSRF check.
 *
 * Deciding it from `x-forwarded-proto` instead traded that for the opposite
 * failure: the header is written by whoever sends the request, so an HTTPS
 * deployment that has no SITE_URL and sits behind a terminator sending
 * `X-Forwarded-Scheme` or RFC 7239 `Forwarded:` issued both cookies without
 * Secure, and the browser then sent the session over plain http.
 *
 * So the question is answered from what the deployment says about itself,
 * hardest evidence first, and the forwarded header is believed only behind a
 * proxy the operator vouched for — the discipline `clientIp` already applies to
 * `x-forwarded-for`:
 *
 *   1. COOKIE_SECURE, when the operator has settled it.
 *   2. SITE_URL, which every real deployment sets because mail links need it.
 *   3. `x-forwarded-proto`, but only with TRUST_PROXY_HEADERS set.
 *   4. The scheme this process itself spoke, when nothing forwarded one at all.
 *   5. In production, Secure — unless every host the request names is one a
 *      browser is happy to reach over plain http (localhost, a LAN address),
 *      which is the development-build-on-the-network case above.
 */
export function secureCookies(headers: Headers, ownScheme?: string | null): boolean {
  const override = cookieSecureOverride()
  if (override !== undefined) return override

  const site = siteUrl()
  if (site) return site.startsWith('https:')

  const forwardedProto = headers.get('x-forwarded-proto')
  const forwarded = env.trustProxyHeaders ? firstScheme(forwardedProto) : undefined
  // `ownScheme` is the scheme this process spoke, and it is only that when
  // nothing forwarded one: Next builds `nextUrl` out of `x-forwarded-proto`
  // when the header is there, so trusting it then would be trusting the header
  // through the back door — which is how the spoof survived the first fix.
  const own = forwardedProto === null ? firstScheme(ownScheme) : undefined
  if ((forwarded ?? own) === 'https') return true

  if (!env.isProduction) return false
  const hosts = requestHosts(headers)
  return !(hosts.length > 0 && hosts.every(plainHttpHost))
}

export type MailProvider = 'resend' | 'postmark'

/**
 * How a reset link leaves this server.
 *
 *   provider  emailed through Resend or Postmark. The default whenever MAIL_FROM
 *             and a provider key are set.
 *   outbox    written as one `.eml` file per message into `dir`, for a
 *             self-hosted instance with no mail provider and for end-to-end
 *             tests. Only ever used when MAIL_TRANSPORT=outbox asks for it, so it
 *             never takes over from a configured provider by default.
 *   log       written to standard output. Development only, when nothing else is
 *             configured, so the flow can be finished on a machine with no mailbox.
 */
export type MailTransport =
  | { readonly kind: 'provider'; readonly provider: MailProvider; readonly apiKey: string; readonly from: string }
  | { readonly kind: 'outbox'; readonly dir: string; readonly from: string }
  | { readonly kind: 'log' }

type MailResolution =
  | { readonly transport: MailTransport; readonly problem: null }
  | { readonly transport: null; readonly problem: string }

/** Where outbox messages go when MAIL_OUTBOX_DIR is unset, resolved against the working directory. */
const DEFAULT_OUTBOX_DIR = './data/outbox'

/**
 * The one place mail configuration is read. `env.mailTransport` and
 * `mailProblem()` are both views of it, so the transport in use and the reason
 * there is none can never disagree.
 */
function resolveMail(): MailResolution {
  const production = process.env.NODE_ENV === 'production'
  const selected = opt('MAIL_TRANSPORT')
  const from = opt('MAIL_FROM')
  const fail = (problem: string): MailResolution => ({ transport: null, problem })
  const use = (transport: MailTransport): MailResolution => ({ transport, problem: null })

  // A value this code does not know is refused rather than guessed at: an
  // operator who asked for something specific should hear that it was not
  // honoured, not find mail quietly going somewhere else.
  if (selected !== undefined && selected !== 'outbox') {
    return fail(
      `MAIL_TRANSPORT is "${selected}", which is not a transport this server knows, so password reset links cannot be sent. Set it to outbox to write each message to a file, or remove it to send through RESEND_API_KEY or POSTMARK_SERVER_TOKEN.`,
    )
  }

  // Emailed links are built from SITE_URL and never from the request, so in
  // production no transport is usable without it.
  const noSite = production && !siteUrl()
  const NO_SITE =
    'SITE_URL is not set, so password reset links cannot be sent. Emailed links are built from it, never from the Host header a request carried.'

  if (selected === 'outbox') {
    if (noSite) return fail(NO_SITE)
    const site = siteUrl()
    return use({
      kind: 'outbox',
      dir: opt('MAIL_OUTBOX_DIR') ?? DEFAULT_OUTBOX_DIR,
      from: from ?? `Whetstone <no-reply@${site ? new URL(site).hostname : 'localhost'}>`,
    })
  }

  const resend = opt('RESEND_API_KEY')
  const postmark = opt('POSTMARK_SERVER_TOKEN')
  const key = resend
    ? { provider: 'resend' as const, apiKey: resend }
    : postmark
      ? { provider: 'postmark' as const, apiKey: postmark }
      : null

  // Outside production an incomplete setup falls back to the log, so a reset
  // can still be finished on a development machine.
  const orLog = (problem: string): MailResolution => (production ? fail(problem) : use({ kind: 'log' }))
  if (!key) {
    return orLog(
      'No mail provider is configured, so password reset links cannot be sent. Set RESEND_API_KEY or POSTMARK_SERVER_TOKEN, plus MAIL_FROM, or set MAIL_TRANSPORT=outbox to write each message to a file instead.',
    )
  }
  if (!from) {
    return orLog(
      'MAIL_FROM is not set, so password reset links cannot be sent. Use an address on a domain the mail provider has verified.',
    )
  }
  if (noSite) return fail(NO_SITE)
  return use({ kind: 'provider', ...key, from })
}

/**
 * Why outbound mail cannot be sent, or null when it can. Written for the
 * operator: instrumentation logs it at boot in production, where the
 * forgot-password page otherwise has to tell people no link can be sent.
 */
export function mailProblem(): string | null {
  return resolveMail().problem
}

export const env = {
  get authSecret(): string {
    const s = opt('AUTH_SECRET')
    if (process.env.NODE_ENV === 'production') {
      const problem = authSecretProblem(s)
      if (problem) throw new Error(problem)
    }
    return s ?? DEV_SECRET
  },
  /**
   * Set this behind a proxy that appends the address it saw to
   * `x-forwarded-for`, so the right-most entry is used instead of the left-most
   * one a caller could have written. See `clientIp`.
   */
  get trustProxyHeaders(): boolean {
    const v = opt('TRUST_PROXY_HEADERS')
    return v === '1' || v === 'true'
  },

  /** How reset links leave this server, or null when they cannot (see `mailProblem`). */
  get mailTransport(): MailTransport | null {
    return resolveMail().transport
  },
  /** Set when a provider key is present, whichever transport is in use. */
  get mailProviderKeySet(): boolean {
    return Boolean(opt('RESEND_API_KEY') ?? opt('POSTMARK_SERVER_TOKEN'))
  },
  get siteUrl(): string | undefined {
    return siteUrl()
  },

  get databasePath(): string {
    return opt('DATABASE_PATH') ?? './data/whetstone.db'
  },
  get anthropicKey(): string | undefined {
    return opt('ANTHROPIC_API_KEY')
  },
  get openaiKey(): string | undefined {
    return opt('OPENAI_API_KEY')
  },
  get kimiKey(): string | undefined {
    return opt('KIMI_API_KEY')
  },
  get kimiBaseUrl(): string {
    return opt('KIMI_BASE_URL') ?? 'https://api.moonshot.ai/v1'
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === 'production'
  },
}

/** Which AI providers are configured. Drives graceful degradation across the app. */
export function aiAvailability() {
  return {
    anthropic: Boolean(env.anthropicKey),
    openai: Boolean(env.openaiKey),
    kimi: Boolean(env.kimiKey),
    get any(): boolean {
      return this.anthropic || this.openai || this.kimi
    },
  }
}
