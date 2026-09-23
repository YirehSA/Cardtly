import { logSubscriptionChange } from './subscription-audit'

// Moves a cancelled subscription to status 'cancelled' once its paid period
// has run out.
//
// NOT WHAT ENDS ACCESS. subscriptionState in lib/plan-server already stops a
// cancelled subscription serving the moment cancel_at passes, on the dashboard
// and on the public card alike. This is housekeeping for everything that reads
// status = 'active' as "subscribed" - the sitemap, the admin screens, the
// promotions report, the trial-reminder exclusion - so that within a day of
// the date they agree with it too.
//
// Rides on the daily trial-reminders cron, like payment-reminders, because
// Vercel's Hobby plan allows two cron jobs and both are taken. Isolated: a
// failure here is reported and never affects the reminders around it.

export async function expireCancelledSubscriptions(
  admin: any,
  dryRun = false,
): Promise<{ expired: number; considered: number; error?: string }> {
  try {
    const now = new Date().toISOString()
    const { data: due, error } = await admin
      .from('whop_subscriptions')
      .select('user_id, email, plan_id, status, subscription_tier, billing_cycle, seats, cancel_at')
      .in('status', ['active', 'past_due'])
      .not('cancel_at', 'is', null)
      .lte('cancel_at', now)

    if (error) return { expired: 0, considered: 0, error: error.message }
    const rows: any[] = due || []
    if (dryRun) return { expired: 0, considered: rows.length }

    let expired = 0
    for (const row of rows) {
      // Re-checked in the WHERE, not just trusted from the read above: a
      // payment landing between the two rewrites the row (charge.success
      // deletes and re-inserts it without cancel_at), and that customer has
      // just paid - they must not be cancelled on the strength of a stale read.
      const { data: updated } = await admin
        .from('whop_subscriptions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('user_id', row.user_id)
        .in('status', ['active', 'past_due'])
        .not('cancel_at', 'is', null)
        .lte('cancel_at', now)
        .select('user_id')
      if (!updated?.length) continue
      expired++
      await logSubscriptionChange(admin, {
        change: 'cancelled', userId: row.user_id, email: row.email,
        source: 'cron_subscription_expiry',
        reason: `Self-service cancellation reached its end date (${row.cancel_at}).`,
        before: row, after: { ...row, status: 'cancelled' },
      }).catch(() => {})
    }
    return { expired, considered: rows.length }
  } catch (e: any) {
    return { expired: 0, considered: 0, error: e?.message || 'unknown' }
  }
}
