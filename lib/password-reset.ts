import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Sends a password-reset email using the token_hash flow rather than
// supabase-js resetPasswordForEmail. Why:
//
//   resetPasswordForEmail uses PKCE, which stores a code verifier in
//   the browser that requested the reset. The link then only works in
//   that same browser. It breaks when:
//     - the admin triggers the reset (server-side, no browser verifier)
//     - the user requests on desktop but clicks the link on their phone
//   ...producing "Password update requires reauthentication" because
//   the recovery session never gets established and updateUser runs on
//   a stale/non-recovery session.
//
// generateLink({ type: 'recovery' }) returns a hashed_token we can put
// in our own link (/reset-password?token_hash=...&type=recovery). The
// reset page calls verifyOtp({ type: 'recovery', token_hash }), which
// establishes a true recovery session anywhere - no verifier needed.
//
// We email it ourselves via Resend so it's branded and we control the
// link, and it works the same whether a user or an admin triggered it.

const FROM_EMAIL = 'Cardtly <noreply@cardtly.com>'

export interface SendResetResult {
  ok: boolean
  // 'no_user' is treated as success by callers so we never reveal
  // whether an email is registered.
  reason?: 'no_user' | 'config' | 'generate' | 'send'
  error?: string
}

export async function sendPasswordResetEmail(email: string, origin: string): Promise<SendResetResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  if (!url || !serviceKey || !resendKey) {
    return { ok: false, reason: 'config', error: 'Email is not configured' }
  }

  const admin = createAdminClient(url, serviceKey) as any

  // redirectTo is where Supabase would send them after its own verify
  // endpoint; we don't use that path (we verify on /reset-password via
  // token_hash), but generateLink wants it set.
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${origin}/reset-password` },
  })

  if (error || !data?.properties?.hashed_token) {
    // User-not-found and similar: don't leak existence. Caller returns
    // a generic success so the form behaves identically either way.
    const msg = (error?.message || '').toLowerCase()
    if (msg.includes('not found') || msg.includes('no user') || msg.includes('unable')) {
      return { ok: false, reason: 'no_user' }
    }
    return { ok: false, reason: 'generate', error: error?.message || 'Could not create reset link' }
  }

  const tokenHash = data.properties.hashed_token as string
  const resetUrl = `${origin}/reset-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`

  const resend = new Resend(resendKey)
  const { error: sendError } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Reset your Cardtly password',
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">
        <h1 style="font-size:22px;margin:0 0 8px">Reset your password</h1>
        <p style="color:#555;font-size:15px;line-height:1.5;margin:0 0 24px">
          We received a request to reset the password for your Cardtly account. Click the button below to choose a new one. This link is valid for one hour and can be used once.
        </p>
        <a href="${resetUrl}"
          style="display:inline-block;background:linear-gradient(135deg,#00d4ff,#7c3aed,#ec4899);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px">
          Choose a new password
        </a>
        <p style="color:#999;font-size:13px;line-height:1.5;margin:24px 0 0">
          If you didn't request this, you can safely ignore this email - your password won't change.
        </p>
        <p style="color:#bbb;font-size:12px;margin:24px 0 0;word-break:break-all">
          Or paste this link into your browser:<br>${resetUrl}
        </p>
      </div>
    `,
  })

  if (sendError) {
    return { ok: false, reason: 'send', error: 'Could not send the email' }
  }
  return { ok: true }
}
