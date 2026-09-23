// When a self-service cancellation should stop serving the card.
//
// The Terms promise cancellation "takes effect at the end of the period you
// have paid for", so this has to find that date, not approximate it. Kept pure
// and separate from the route so it can be tested without Paystack or a
// database: the route supplies the row and what Paystack said, this decides.

const MONTHS: Record<string, number> = {
  monthly: 1, month: 1,
  quarterly: 3, quarter: 3,
  annual: 12, annually: 12, yearly: 12, year: 12,
}

function valid(ms: number): boolean {
  return Number.isFinite(ms) && ms > 0
}

function addMonthsUtc(ms: number, months: number): number {
  const d = new Date(ms)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.getTime()
}

/**
 * The end of the period already paid for.
 *
 * 1. PAYSTACK'S next_payment_date, looked up BEFORE the subscription is
 *    disabled. It is the authority: it is the date Paystack would have charged
 *    again, which is exactly the end of what has been paid for. Several live
 *    subscriptions for one email is a data fault, and the latest date wins so
 *    that the fault never costs the customer days they paid for.
 *
 * 2. Otherwise, the last payment plus one billing cycle. charge.success
 *    rewrites the subscription row on every payment and records paid_at, so
 *    paid_at is the last charge; created_at is the same moment when paid_at is
 *    missing, because the row is re-created on each charge. This is the path a
 *    RETRY takes: if the first attempt disabled the subscription at Paystack but
 *    failed to record the date, Paystack no longer lists it as live and has no
 *    next date to give, and this is what still gets the date right.
 *
 * 3. Never earlier than now. A declined renewal leaves a next date in the past:
 *    that period was never paid for, so access ends immediately rather than
 *    being backdated. The payment grace window is a courtesy for paying late,
 *    not a period anyone paid for.
 */
export function cancellationEndsAt(
  row: { billing_cycle?: string | null; created_at?: string | null; metadata?: any },
  paystackNextDates: (string | null | undefined)[],
  now: Date = new Date(),
): string {
  const nowMs = now.getTime()

  const fromPaystack = paystackNextDates
    .map(d => (d ? new Date(d).getTime() : NaN))
    .filter(valid)
  if (fromPaystack.length > 0) {
    return new Date(Math.max(nowMs, ...fromPaystack)).toISOString()
  }

  const paidMs = new Date(row?.metadata?.paid_at || row?.created_at || '').getTime()
  if (valid(paidMs)) {
    const months = MONTHS[String(row?.billing_cycle || 'monthly').toLowerCase()] ?? 1
    return new Date(Math.max(nowMs, addMonthsUtc(paidMs, months))).toISOString()
  }

  // No date at all is not a state a charged row can be in - created_at is
  // always set. If it happens anyway, end now rather than invent a period.
  return new Date(nowMs).toISOString()
}
