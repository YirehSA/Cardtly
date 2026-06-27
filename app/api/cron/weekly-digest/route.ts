import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Weekly "your card this week" digest. Triggered by Vercel Cron (see
// vercel.json). For every card with activity in the last 7 days, emails
// the owner a short summary of views and new leads - a re-engagement
// nudge that makes Cardtly feel alive.
//
// Secured with CRON_SECRET: Vercel Cron sends it as a Bearer token.

export const maxDuration = 60

const FROM_EMAIL = 'Cardtly <noreply@cardtly.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com'

export async function GET(request: Request) {
  // Auth: only Vercel Cron (or someone with the secret) may run this.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  if (!url || !serviceKey || !resendKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  const admin = createAdminClient(url, serviceKey) as any
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Pull cards, the last-7-day view events, and last-7-day leads.
  const [{ data: cards }, { data: viewEvents }, { data: leads }, authUsers] = await Promise.all([
    admin.from('cards').select('id, name, slug, user_id'),
    admin.from('card_events').select('card_id').eq('event_type', 'view').gte('created_at', since),
    admin.from('contacts').select('card_id').gte('created_at', since),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const emailByUser: Record<string, string> = {}
  for (const u of authUsers?.data?.users || []) if (u.email) emailByUser[u.id] = u.email

  const views: Record<string, number> = {}
  for (const e of (viewEvents as any[]) || []) if (e.card_id) views[e.card_id] = (views[e.card_id] || 0) + 1
  const newLeads: Record<string, number> = {}
  for (const c of (leads as any[]) || []) if (c.card_id) newLeads[c.card_id] = (newLeads[c.card_id] || 0) + 1

  const resend = new Resend(resendKey)
  let sent = 0

  for (const card of (cards as any[]) || []) {
    const v = views[card.id] || 0
    const l = newLeads[card.id] || 0
    if (v === 0 && l === 0) continue // only email when there's something to report
    const to = emailByUser[card.user_id]
    if (!to) continue

    const firstName = (card.name || '').split(' ')[0] || 'there'
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject: `Your Cardtly week: ${v} view${v === 1 ? '' : 's'}${l ? `, ${l} new lead${l === 1 ? '' : 's'}` : ''}`,
        html: `
          <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">
            <h1 style="font-size:22px;margin:0 0 4px">Hi ${escapeHtml(firstName)}, here's your week</h1>
            <p style="color:#666;font-size:14px;margin:0 0 24px">What your Cardtly card did over the last 7 days.</p>
            <div style="display:flex;gap:12px;margin-bottom:24px">
              <div style="flex:1;background:#f6f6f6;border-radius:12px;padding:18px;text-align:center">
                <div style="font-size:32px;font-weight:800">${v}</div>
                <div style="font-size:12px;color:#888">card views</div>
              </div>
              <div style="flex:1;background:#f6f6f6;border-radius:12px;padding:18px;text-align:center">
                <div style="font-size:32px;font-weight:800">${l}</div>
                <div style="font-size:12px;color:#888">new ${l === 1 ? 'lead' : 'leads'}</div>
              </div>
            </div>
            ${l > 0
              ? `<a href="${APP_URL}/dashboard/contacts" style="display:inline-block;background:linear-gradient(135deg,#00d4ff,#7c3aed,#ec4899);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 26px;border-radius:11px">See your new leads</a>`
              : `<a href="${APP_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#00d4ff,#7c3aed,#ec4899);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 26px;border-radius:11px">Open your dashboard</a>`}
            <p style="color:#aaa;font-size:12px;margin:28px 0 0">You're getting this because your Cardtly card had activity this week. Sent via Cardtly.</p>
          </div>
        `,
      })
      sent++
    } catch {
      // Skip this one; keep going.
    }
  }

  return NextResponse.json({ ok: true, sent })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
