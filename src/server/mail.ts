/**
 * Outbound mail. One message today: the password reset link.
 *
 * `env.mailTransport` decides where a message goes, and `.env.example` lists
 * the variables behind it:
 *
 *   provider     Resend or Postmark, called over their HTTPS APIs with `fetch`,
 *                so there is no SMTP client to install and no connection to
 *                hold open. The default whenever MAIL_FROM and a key are set.
 *   outbox       each message written as an `.eml` file into MAIL_OUTBOX_DIR,
 *                when MAIL_TRANSPORT=outbox asks for it. For a self-hosted
 *                instance with no provider, and for end-to-end tests that
 *                follow the link out of the message the way a person would.
 *                Any mail client opens the files.
 *   log          development with nothing else configured: the message goes to
 *                the server's standard output, and the forgot-password form
 *                also shows the link, so the flow can be finished on a machine
 *                with no mailbox.
 *
 * With none of them usable, which in production means no provider and no
 * outbox, nothing can be sent. Instrumentation calls `reportMailProblem()` at
 * boot, and the forgot-password page says no link can be sent rather than
 * promising one that will never arrive.
 *
 * Links are absolute and built from `SITE_URL`. They are never built from the
 * Host header in production: a reset link assembled from a header the caller
 * chose is how an attacker receives somebody else's token.
 *
 * Writes to `process.stdout` and `process.stderr` rather than `console`, which
 * committed code does not use (CONTRACT ban 53).
 */

import { randomBytes } from 'node:crypto'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { headers } from 'next/headers'
import { env, mailProblem, type MailTransport } from '@/lib/env'

export type MailDelivery = MailTransport['kind']

/** How mail leaves this server, or null when it cannot leave at all. */
export function mailDelivery(): MailDelivery | null {
  return env.mailTransport?.kind ?? null
}

function logLine(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, string>): void {
  const line = `${JSON.stringify({ at: new Date().toISOString(), level, event, ...fields })}\n`
  if (level === 'info') process.stdout.write(line)
  else process.stderr.write(line)
}

/**
 * Called once at boot in production, so the operator hears about missing mail
 * before a member does. An outbox is announced as well: it is a deliberate
 * choice, but one that means nobody receives an email, and it silently
 * overriding a provider key left over from before would be worse.
 */
export function reportMailProblem(): void {
  const problem = mailProblem()
  if (problem) {
    logLine('error', 'mail.unconfigured', { message: problem })
    return
  }
  const transport = env.mailTransport
  if (transport?.kind !== 'outbox') return
  const ignoredKey = env.mailProviderKeySet
    ? ' A provider key is also set and is not used while MAIL_TRANSPORT is outbox; remove MAIL_TRANSPORT to email through it.'
    : ''
  logLine(ignoredKey ? 'warn' : 'info', 'mail.outbox', {
    message: `MAIL_TRANSPORT is outbox, so password reset links are written to ${resolve(transport.dir)} as .eml files and not emailed.${ignoredKey}`,
  })
}

/**
 * The origin every emailed link starts with. `SITE_URL` when it is set, which
 * production requires before any transport counts as configured; outside
 * production the development server's own address is an acceptable stand-in.
 */
export async function linkOrigin(): Promise<string> {
  if (env.siteUrl) return env.siteUrl
  const host = (await headers()).get('host')
  return `http://${host ?? 'localhost'}`
}

interface Message {
  readonly to: string
  readonly subject: string
  readonly text: string
  readonly html: string
}

const SEND_TIMEOUT_MS = 10_000

/* ------------------------------------------------------------------------- *
 * Messages
 * ------------------------------------------------------------------------- */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function passwordResetMessage(to: string, url: string): Message {
  const intro =
    'Somebody asked to reset the password on the Whetstone account that uses this address. If it was you, open the link below to choose a new one.'
  const terms =
    'The link works once and expires 30 minutes after it was sent. Setting a new password signs out every other device on the account.'
  const ignore = 'If you did not ask for this, ignore this message. Your password stays as it is.'

  const text = [intro, url, terms, ignore].join('\n\n')

  // Paper and ink, from the light theme's tokens. Mail clients strip <style>
  // blocks and custom properties, so every rule is inline and every colour is
  // a literal.
  const link = escapeHtml(url)
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:32px 24px;background:#f6f0e4;color:#17120c;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.55">
    <div style="max-width:32rem">
      <p style="margin:0 0 24px;font-size:18px;font-weight:bold">Whetstone</p>
      <p style="margin:0 0 16px">${escapeHtml(intro)}</p>
      <p style="margin:0 0 24px"><a href="${link}" style="color:#a32d14;text-decoration:underline">Choose a new password</a></p>
      <p style="margin:0 0 16px;color:#453c2e;font-size:14px">${escapeHtml(terms)}</p>
      <p style="margin:0 0 16px;color:#453c2e;font-size:14px">${escapeHtml(ignore)}</p>
      <p style="margin:0;color:#665b49;font-size:13px;word-break:break-all">If the link does not open, paste this address into your browser: ${link}</p>
    </div>
  </body>
</html>`

  return { to, subject: 'Reset your Whetstone password', text, html }
}

/* ------------------------------------------------------------------------- *
 * Transports
 * ------------------------------------------------------------------------- */

async function postJson(url: string, init: { headers: Record<string, string>; body: unknown }): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...init.headers },
    body: JSON.stringify(init.body),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  })
  if (response.ok) return
  // The provider's own words, trimmed. They name the problem (an unverified
  // sender, a revoked key) and never echo the key back.
  const detail = (await response.text().catch(() => '')).slice(0, 300)
  throw new Error(`${new URL(url).host} answered ${String(response.status)}: ${detail}`)
}

type ProviderTransport = Extract<MailTransport, { kind: 'provider' }>

function viaProvider(config: ProviderTransport, message: Message): Promise<void> {
  if (config.provider === 'resend') {
    return postJson('https://api.resend.com/emails', {
      headers: { authorization: `Bearer ${config.apiKey}` },
      body: { from: config.from, to: [message.to], subject: message.subject, text: message.text, html: message.html },
    })
  }
  return postJson('https://api.postmarkapp.com/email', {
    headers: { 'x-postmark-server-token': config.apiKey },
    body: {
      From: config.from,
      To: message.to,
      Subject: message.subject,
      TextBody: message.text,
      HtmlBody: message.html,
      MessageStream: 'outbound',
    },
  })
}

/** Header values come from the database and the environment; neither gets to add a header. */
function headerValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

/**
 * The message as RFC 5322 text with a plain and an HTML alternative, which is
 * what a provider would have delivered. Both parts are 8bit UTF-8: every line
 * in these messages is far under the 998-octet limit, and the plain part stays
 * readable (and greppable for the link) in the file itself.
 */
function toEml(from: string, message: Message, sentAt: Date, id: string): string {
  const boundary = `whetstone-${id}`
  const domain = /@([^\s>]+)/.exec(from)?.[1] ?? 'localhost'
  const crlf = (body: string) => body.replace(/\r?\n/g, '\r\n')
  return [
    `From: ${headerValue(from)}`,
    `To: ${headerValue(message.to)}`,
    `Subject: ${headerValue(message.subject)}`,
    `Date: ${sentAt.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${sentAt.getTime().toString(36)}.${id}@${domain}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    crlf(message.text),
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    crlf(message.html),
    `--${boundary}--`,
    '',
  ].join('\r\n')
}

/**
 * One file per message, named so that a directory listing sorts oldest first.
 * Written under a dot-name and renamed into place, so a reader watching the
 * folder never opens half a message. The file holds a live reset link, so only
 * the server's own user can read it.
 */
async function toOutbox(config: Extract<MailTransport, { kind: 'outbox' }>, message: Message): Promise<string> {
  const dir = resolve(config.dir)
  await mkdir(dir, { recursive: true, mode: 0o700 })
  const sentAt = new Date()
  const id = randomBytes(6).toString('hex')
  const name = `${sentAt.toISOString().replace(/[:.]/g, '-')}-${id}.eml`
  const partial = join(dir, `.${name}.partial`)
  await writeFile(partial, toEml(config.from, message, sentAt, id), { mode: 0o600 })
  await rename(partial, join(dir, name))
  return name
}

function toLog(message: Message): void {
  process.stdout.write(
    `\n[mail] No mail provider is configured, so this message was written here instead of sent.\n` +
      `To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n\n`,
  )
}

/* ------------------------------------------------------------------------- *
 * Sending
 * ------------------------------------------------------------------------- */

/**
 * Sends the reset link through whichever transport is configured. Never
 * throws: it runs after the response has gone (`after()`), where there is
 * nobody left to show an error to, so a failure is logged for the operator.
 * The recipient and the link are left out of every log line on purpose.
 */
export async function sendPasswordReset(to: string, url: string): Promise<void> {
  const message = passwordResetMessage(to, url)
  const transport = env.mailTransport
  if (!transport) return
  try {
    if (transport.kind === 'provider') {
      await viaProvider(transport, message)
    } else if (transport.kind === 'outbox') {
      const file = await toOutbox(transport, message)
      logLine('info', 'mail.outbox.written', { file })
    } else {
      toLog(message)
    }
  } catch (error) {
    logLine('error', 'mail.password-reset.failed', {
      transport: transport.kind === 'provider' ? transport.provider : transport.kind,
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}
