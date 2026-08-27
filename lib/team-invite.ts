import crypto from 'crypto'
import { Resend } from 'resend'
import { FROM_EMAIL } from '@/lib/email'

// The team invitation email, in one place.
//
// It was in two places, and they had already drifted. This file held a short
// template used by the department routes; app/api/team/invite/route.ts held a
// longer one with the feature list and a copy-and-paste fallback link. Two
// people invited to the same organisation received visibly different emails
// depending on which screen the admin happened to use.
//
// The longer template wins, because it is the one the main invite flow sends
// and the one with the fallback link. That does change the email the
// department routes send: same subject and same claim link, more body.
//
// sendTeamInvite keeps its original signature so those callers are untouched.

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com'

export function newInviteToken(): string {
  return crypto.randomBytes(24).toString('base64url')
}

export function claimUrlFor(token: string): string {
  return `${APP_URL}/team/claim/${token}`
}

export function buildInviteHtml(opts: {
  orgName: string
  inviterName: string
  cardName: string
  claimUrl: string
}): string {
  const { orgName, inviterName, cardName, claimUrl } = opts
  // Plain-styled email, inline CSS only (the Resend renderer strips
  // <style> tags in some clients). Brand colours via a gradient CTA button.
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111;background:#fff;line-height:1.5">
      <div style="text-align:center;margin-bottom:32px">
        <div style="display:inline-block;width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#00d4ff,#7c3aed,#ec4899);color:white;font-weight:900;font-size:22px;line-height:48px;text-align:center">C</div>
      </div>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:800">You're on the ${escapeHtml(orgName)} team</h1>
      <p style="margin:0 0 16px;color:#444">
        ${escapeHtml(inviterName)} has added you to <strong>${escapeHtml(orgName)}</strong> on Cardtly.
        Your digital business card (${escapeHtml(cardName)}) is already set up.
      </p>
      <p style="margin:0 0 24px;color:#444">
        Set up your account to:
      </p>
      <ul style="margin:0 0 24px;padding-left:20px;color:#444">
        <li style="margin:0 0 6px">Share your card with a tap, scan, or link</li>
        <li style="margin:0 0 6px">Save contacts from people you meet</li>
        <li style="margin:0 0 6px">Edit your personal info (photo, bio, phone)</li>
        <li style="margin:0 0 6px">Use the Cardtly app on your phone</li>
      </ul>
      <div style="text-align:center;margin:0 0 32px">
        <a href="${claimUrl}"
          style="display:inline-block;padding:14px 28px;border-radius:12px;background:linear-gradient(135deg,#00d4ff,#7c3aed,#ec4899);color:white;font-weight:700;font-size:15px;text-decoration:none">
          Set up your account
        </a>
      </div>
      <p style="margin:0 0 8px;color:#888;font-size:13px">Or copy and paste this link into your browser:</p>
      <p style="margin:0 0 24px;color:#444;font-size:13px;word-break:break-all">
        <a href="${claimUrl}" style="color:#7c3aed">${claimUrl}</a>
      </p>
      <p style="margin:24px 0 0;color:#888;font-size:12px;border-top:1px solid #eee;padding-top:16px">
        This invite was sent by your team admin. If you weren't expecting it, you can ignore this email.
      </p>
    </div>
  `
}

/**
 * Send one invitation.
 *
 * Returns rather than throws, because the bulk importer must be able to
 * continue after one bad address. A card whose invite email failed is still a
 * created card - the admin resends from the team screen - so losing the email
 * must never be reported as losing the card.
 */
export async function sendInviteEmail(opts: {
  to: string
  orgName: string
  inviterName: string
  cardName: string
  claimUrl: string
}): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { sent: false, error: 'Email is not configured' }
  try {
    await new Resend(key).emails.send({
      from: FROM_EMAIL,
      to: opts.to,
      subject: `You're on the ${opts.orgName} team on Cardtly`,
      html: buildInviteHtml(opts),
    })
    return { sent: true }
  } catch (e: any) {
    return { sent: false, error: e?.message || 'Could not send email' }
  }
}

/**
 * Original signature, kept for the department routes.
 *
 * Takes a token rather than a URL and reports { ok } rather than { sent }.
 * Not tidied to match sendInviteEmail: renaming it would touch three call
 * sites in app/api/department for no behavioural gain.
 */
export async function sendTeamInvite(opts: {
  to: string
  orgName: string
  inviterName: string
  cardName: string
  token: string
}): Promise<{ ok: boolean; error?: string }> {
  const { sent, error } = await sendInviteEmail({
    to: opts.to,
    orgName: opts.orgName,
    inviterName: opts.inviterName,
    cardName: opts.cardName,
    claimUrl: claimUrlFor(opts.token),
  })
  return { ok: sent, error }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
