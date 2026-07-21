import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { FROM_EMAIL } from '@/lib/email'

// Welcoming the person we just set an enterprise team up for.
//
// Same mechanics as lib/password-reset.ts - generateLink({ type: 'recovery' })
// gives a hashed_token we put in our own /reset-password link, which works in
// any browser because there is no PKCE verifier tied to the one that asked.
// Different words, because "We received a request to reset your password" is
// nonsense to somebody who has never had one. They did not ask for anything;
// we signed them up.
export interface OwnerInviteResult {
  ok: boolean
  reason?: 'config' | 'generate' | 'send'
  error?: string
}

export async function sendTeamOwnerWelcome(
  email: string,
  orgName: string,
  seats: number,
  origin: string,
): Promise<OwnerInviteResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  if (!url || !serviceKey || !resendKey) {
    return { ok: false, reason: 'config', error: 'Email is not configured' }
  }

  const admin = createAdminClient(url, serviceKey) as any

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${origin}/reset-password` },
  })
  if (error || !data?.properties?.hashed_token) {
    return { ok: false, reason: 'generate', error: error?.message || 'Could not create the sign-in link' }
  }

  const link = `${origin}/reset-password?token_hash=${encodeURIComponent(data.properties.hashed_token as string)}&type=recovery`
  const safeOrg = esc(orgName)

  const resend = new Resend(resendKey)
  const { error: sendError } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `${orgName} is set up on Cardtly`,
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111;background:#ffffff">
        <h1 style="font-size:22px;margin:0 0 8px">${safeOrg} is ready</h1>
        <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 20px">
          We have set up your Cardtly team account with <strong>${seats} seat${seats === 1 ? '' : 's'}</strong>.
          Choose a password below and it is yours - you can add your people, set your company look, and start handing out cards.
        </p>
        <a href="${link}"
          style="display:inline-block;background:linear-gradient(135deg,#00d4ff,#7c3aed,#ec4899);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px">
          Choose your password
        </a>
        <p style="color:#999;font-size:13px;line-height:1.6;margin:24px 0 0">
          This link is valid for one hour and can be used once. If it expires, use "Forgot password" on the sign-in page with this address and you will get a fresh one.
        </p>
        <p style="color:#bbb;font-size:12px;margin:20px 0 0;word-break:break-all">
          Or paste this into your browser:<br>${link}
        </p>
      </div>
    `,
  })
  if (sendError) return { ok: false, reason: 'send', error: 'Could not send the email' }
  return { ok: true }
}

function esc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
