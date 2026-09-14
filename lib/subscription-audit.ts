import { auditLog } from './admin-audit'

// Every change to a subscription, written down.
//
// This exists because of an afternoon spent working out which row had gone.
// A subscription was deleted by accident on 2026-09-14 and nothing anywhere
// recorded it: not the table, not admin_audit_log, not the org audit_logs.
// Finding the owner took Paystack comparisons, trial-date bucket arithmetic
// and finally asking Andre, when it should have been one query. Trial
// extensions were already logged; the thing that actually decides whether a
// card serves was not.
//
// WHAT IS LOGGED. Anything that changes entitlement: a grant, a payment
// activating, a status change, a cancellation, a deletion. What is NOT logged
// is bookkeeping that entitlement never reads - payment-reminders stamping
// past_due_email_sent_at writes to this table twice per reminder run and would
// bury the entries that matter.
//
// Never throws. auditLog already swallows its own failures, for the reason
// given there: the change has happened, and failing the request afterwards
// invites a retry of something destructive.

export type SubscriptionChange =
  | 'granted'    // an admin handed someone a plan
  | 'activated'  // a payment came good and turned into access
  | 'updated'    // status or plan moved, without being a grant or a cancel
  | 'cancelled'  // still a row, no longer serving
  | 'deleted'    // the row is gone

/** The fields worth keeping. The whole row would put an email and a receipt id
 *  into the log on every write, and the interesting part is always these. */
function shape(row: any): Record<string, any> | null {
  if (!row) return null
  return {
    plan_id: row.plan_id ?? null,
    status: row.status ?? null,
    subscription_tier: row.subscription_tier ?? null,
    billing_cycle: row.billing_cycle ?? null,
    seats: row.seats ?? null,
  }
}

export async function logSubscriptionChange(
  admin: any,
  entry: {
    change: SubscriptionChange
    /** Whose subscription it is, which is the thing you search on later. */
    userId: string | null
    email?: string | null
    /** Absent for anything a webhook or a cron did, which is the point of
     *  `source`: "nobody did this, Paystack did". */
    actorUserId?: string | null
    actorEmail?: string | null
    /** Where the change came from: admin, paystack_webhook, paystack_verify,
     *  account_delete, founder_remove. Without it, a deletion by an admin and
     *  one by a customer deleting their own account look identical. */
    source: string
    before?: any
    after?: any
    reason?: string
  },
): Promise<void> {
  await auditLog(admin, {
    actorUserId: entry.actorUserId ?? null,
    actorEmail: entry.actorEmail ?? null,
    action: `subscription_${entry.change}`,
    targetUserId: entry.userId,
    targetEmail: entry.email ?? null,
    detail: {
      source: entry.source,
      ...(entry.reason ? { reason: entry.reason } : {}),
      ...(entry.before !== undefined ? { before: shape(entry.before) } : {}),
      ...(entry.after !== undefined ? { after: shape(entry.after) } : {}),
    },
  })
}
