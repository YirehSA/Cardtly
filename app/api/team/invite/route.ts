import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import crypto from 'crypto'
import { FROM_EMAIL } from '@/lib/email'

// POST /api/team/invite
// Body: { card_id: string, email: string, resend?: boolean }
//
// Issues (or re-issues) an invitation for a team card. Only the org
// admin can call this. Generates a random token, updates the card
// with invite_email/invite_token/invite_sent_at, and sends a
// branded email via Resend pointing to /team/claim/{token}.
//
// resend=true means the email is being re-issued for an existing
// invite (we reuse the existing token if it's still there).

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com'

export async function POST(request: Request) {
  // Auth: caller must be signed in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  let body: { card_id?: string; email?: string; resend?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { card_id, email, resend: isResend } = body
  if (!card_id || !email) {
    return NextResponse.json({ error: 'Missing card_id or email' }, { status: 400 })
  }
  const trimmedEmail = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // Load the card + verify the caller is the admin of the owning org
  const { data: card, error: cardErr } = await admin
    .from('team_cards')
    .select('id, name, organization_id, user_id, invite_token, claimed_at')
    .eq('id', card_id)
    .maybeSingle()

  if (cardErr || !card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  }
  if (card.claimed_at) {
    return NextResponse.json({ error: 'Card has already been claimed' }, { status: 409 })
  }

  const { data: org, error: orgErr } = await admin
    .from('organizations')
    .select('id, name, admin_user_id')
    .eq('id', card.organization_id)
    .eq('admin_user_id', user.id)
    .maybeSingle()

  if (orgErr || !org) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  // Resolve the inviting admin's name for the email body
  const { data: adminProfile } = await admin
    .from('profiles')
    .select('name')
    .eq('user_id', user.id)
    .maybeSingle()
  const inviterName = (adminProfile as any)?.name || user.email || 'A team admin'

  // Token reuse rule:
  //   * resend with the SAME email -> keep the existing token so the
  //     old email's link is still valid (no orphan link)
  //   * email CHANGED (admin fixing a typo or sending to a different
  //     person) -> generate a fresh token. That immediately
  //     invalidates the old email's link so whoever received it
  //     can't claim the card anymore.
  //   * first-time invite -> generate a fresh token.
  const previousEmail = (card as any).invite_email as string | null
  const emailChanged = !!previousEmail && previousEmail !== trimmedEmail
  const token = (isResend && card.invite_token && !emailChanged)
    ? card.invite_token as string
    : crypto.randomBytes(24).toString('base64url')

  // Update the card with invite details
  const { error: updErr } = await admin
    .from('team_cards')
    .update({
      invite_email: trimmedEmail,
      invite_token: token,
      invite_sent_at: new Date().toISOString(),
    } as any)
    .eq('id', card_id)

  if (updErr) {
    console.error('team invite update error', updErr)
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  // Send the invite email via Resend
  const claimUrl = `${APP_URL}/team/claim/${token}`
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: FROM_EMAIL,
        to: trimmedEmail,
        subject: `You're on the ${org.name} team on Cardtly`,
        html: buildInviteHtml({
          orgName: org.name,
          inviterName,
          cardName: card.name || 'your team card',
          claimUrl,
        }),
      })
    } catch (e) {
      console.error('team invite email failed', e)
      return NextResponse.json({ error: 'Could not send email' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, claim_url: claimUrl })
}

function buildInviteHtml(opts: {
  orgName: string
  inviterName: string
  cardName: string
  claimUrl: string
}): string {
  const { orgName, inviterName, cardName, claimUrl } = opts
  // Plain-styled email, inline CSS only (the Resend renderer strips
  // <style> tags in some clients). Brand colours via a gradient
  // CTA button.
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
