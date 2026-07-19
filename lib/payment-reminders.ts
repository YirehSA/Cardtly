import { Resend } from 'resend'
import { FROM_EMAIL } from './email'
import { renderPaymentFailedEmail } from './billing-email-templates'
import { PAYMENT_GRACE_DAYS } from './plan-server'

const DAY_MS = 24 * 60 * 60 * 1000

// "Your payment failed" emails, one per past-due episode.
//
// Rides along on the daily trial-reminders cron rather than taking a cron slot
// of its own: Vercel's Hobby plan allows two, and both are already spoken for.
// It runs last and never affects the trial reminders above it.
//
// The grace window (migration 041) keeps a card serving for a week after a
// failed charge. Without this, the only sign of that countdown was a banner in
// the dashboard - and the person whose card is about to go dark is exactly the
// one who might not log in that week.
export async function sendPaymentFailedEmails(
  admin: any,
  resendKey: string,
  dryRun = false
): Promise<{
  sent: number
  failed: number
  considered: number
  recipients?: Array<{ to: string; daysLeft: number }>
  error?: string
}> {
  try {
    const { data: subs, error } = await admin
      .from('whop_subscriptions')
      .select('user_id, email, past_due_since')
      .eq('status', 'past_due')
      .is('past_due_email_sent_at', null)
      .not('past_due_since', 'is', null)

    if (error) return { sent: 0, failed: 0, considered: 0, error: error.message }
    if (!subs?.length) return { sent: 0, failed: 0, considered: 0 }

    const userIds = subs.map((s: any) => s.user_id)
    const [{ data: profiles }, { data: cards }] = await Promise.all([
      admin.from('profiles').select('user_id, name').in('user_id', userIds),
      admin.from('cards').select('user_id, slug, is_primary').in('user_id', userIds),
    ])
    const nameOf = new Map((profiles || []).map((p: any) => [p.user_id, p.name]))
    const slugOf = new Map<string, string | null>()
    for (const c of cards || []) {
      if (!slugOf.has(c.user_id) || c.is_primary) slugOf.set(c.user_id, c.slug ?? null)
    }

    const queue: Array<{ userId: string; to: string; firstName: string; slug: string | null; daysLeft: number }> = []
    for (const s of subs) {
      if (!s.email) continue
      const startedMs = new Date(s.past_due_since).getTime()
      if (!Number.isFinite(startedMs)) continue
      const msLeft = startedMs + PAYMENT_GRACE_DAYS * DAY_MS - Date.now()
      // Past the window already: the card is down and this copy, which says it
      // is still live, would be wrong. The trial_expired path is the one that
      // handles "it is off" messaging.
      if (msLeft <= 0) continue
      queue.push({
        userId: s.user_id,
        to: s.email,
        firstName: String(nameOf.get(s.user_id) || '').split(' ')[0] || 'there',
        slug: slugOf.get(s.user_id) ?? null,
        daysLeft: Math.max(1, Math.ceil(msLeft / DAY_MS)),
      })
    }

    if (dryRun) {
      return {
        sent: 0,
        failed: 0,
        considered: queue.length,
        recipients: queue.map(q => ({ to: q.to, daysLeft: q.daysLeft })),
      }
    }

    const resend = new Resend(resendKey)
    let sent = 0
    let failed = 0

    for (const q of queue) {
      // Claim before sending, and only if still unclaimed, so two overlapping
      // runs cannot both email the same person. Same shape as the trial
      // reminders' insert-to-claim.
      const { data: claimed } = await admin
        .from('whop_subscriptions')
        .update({ past_due_email_sent_at: new Date().toISOString() })
        .eq('user_id', q.userId)
        .is('past_due_email_sent_at', null)
        .select('user_id')
      if (!claimed?.length) continue

      try {
        const { subject, html } = renderPaymentFailedEmail(q)
        await resend.emails.send({ from: FROM_EMAIL, to: q.to, subject, html })
        sent++
      } catch {
        // Release so tomorrow tries again. Missing someone's only warning is
        // worse than a rare duplicate.
        await admin
          .from('whop_subscriptions')
          .update({ past_due_email_sent_at: null })
          .eq('user_id', q.userId)
        failed++
      }
    }

    return { sent, failed, considered: queue.length }
  } catch (e: any) {
    return { sent: 0, failed: 0, considered: 0, error: e?.message || 'unknown' }
  }
}
