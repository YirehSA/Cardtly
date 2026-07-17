import { Resend } from 'resend'
import crypto from 'crypto'
import { FROM_EMAIL } from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com'

export function newInviteToken(): string {
  return crypto.randomBytes(24).toString('base64url')
}

export function buildInviteHtml(opts: { orgName: string; inviterName: string; cardName: string; claimUrl: string }): string {
  const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">
    <h1 style="font-size:22px;margin:0 0 8px">You're on the ${esc(opts.orgName)} team</h1>
    <p style="color:#666;font-size:14px;margin:0 0 20px">
      ${esc(opts.inviterName)} set up a Cardtly card for you: <strong>${esc(opts.cardName)}</strong>. Claim it to sign in, keep your own details current, and share it in a tap.
    </p>
    <a href="${opts.claimUrl}" style="display:inline-block;background:linear-gradient(135deg,#00d4ff,#7c3aed,#ec4899);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 26px;border-radius:11px">Claim your card</a>
    <p style="color:#aaa;font-size:12px;margin:28px 0 0">Sent via Cardtly.</p>
  </div>`
}

// Sends (or resends) a team-card invite. Never throws: a failed email must not
// fail the action that created the card, or you get an uninvitable orphan.
export async function sendTeamInvite(opts: { to: string; orgName: string; inviterName: string; cardName: string; token: string }): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, error: 'email not configured' }
  try {
    const resend = new Resend(key)
    await resend.emails.send({
      from: FROM_EMAIL,
      to: opts.to,
      subject: `You're on the ${opts.orgName} team on Cardtly`,
      html: buildInviteHtml({ orgName: opts.orgName, inviterName: opts.inviterName, cardName: opts.cardName, claimUrl: `${APP_URL}/team/claim/${opts.token}` }),
    })
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'send failed' }
  }
}
