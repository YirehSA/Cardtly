// Outbound Paystack calls.
//
// Until now the only Paystack traffic was initialize/verify plus the inbound
// webhook. Nothing ever cancelled a subscription, so the admin's "Remove Pro"
// flipped our own row and left Paystack billing the customer every month for
// access they no longer had.
//
// Cancelling turned out to be harder than reading the DB suggests. Our
// whop_subscriptions rows do NOT reliably hold a subscription code: the
// verify path stores `subscription_code || reference`, and when Paystack
// creates the subscription asynchronously (after the first charge) that field
// ends up holding a transaction REFERENCE like "s936ojrozh". A reference
// cannot be cancelled. Both live subscriptions on the account are in exactly
// that state.
//
// So the code is treated as a hint, and the authority is Paystack itself,
// looked up by customer email.

const PAYSTACK_API = 'https://api.paystack.co'

export interface PaystackSub {
  subscription_code: string
  status: string
  amount: number
  email: string
  next_payment_date: string | null
}

export interface DisableResult {
  ok: boolean
  cancelled: string[]
  // "Nothing to cancel" is a success, and must be distinguishable from
  // "we tried and failed", because the caller treats them very differently.
  skipped?: 'none_found' | 'not_configured'
  error?: string
}

function secret(): string | null {
  return process.env.PAYSTACK_SECRET_KEY || null
}

// A Paystack subscription code always looks like SUB_xxxxxxxx. membership_id
// falls back to a transaction reference, which does not, so anything without
// the prefix is not a code and must not be passed to the disable endpoint.
export function subscriptionCodeOf(sub: any): string | null {
  const c = sub?.metadata?.paystack_subscription_code || sub?.membership_id || null
  return typeof c === 'string' && c.startsWith('SUB_') ? c : null
}

// A row Paystack might actually be billing, as opposed to a comp we granted.
// Deliberately does NOT require a stored code: the whole problem is that the
// code is usually missing, and "we have no code" must not read as "nothing to
// cancel".
export function isBillablePaystackSub(sub: any): boolean {
  if (!sub || sub.status !== 'active') return false
  if (sub.metadata?.comped) return false
  return String(sub.plan_id || '').startsWith('paystack')
}

const PER_PAGE = 100
// 100 per page, so this is 5 000 subscriptions. Reaching it means something is
// wrong; we fail loudly rather than return a truncated list, because in this
// file a short list reads as "nothing to cancel".
const MAX_PAGES = 50

function toSub(s: any): PaystackSub {
  return {
    subscription_code: s.subscription_code,
    status: s.status,
    amount: s.amount,
    email: s.customer?.email,
    next_payment_date: s.next_payment_date ?? null,
  }
}

// Walks every page of /subscription.
//
// This used to be a single ?perPage=100 with no paging, which silently capped
// the answer at the first 100 subscriptions. Everything here treats a missing
// subscription as "nothing to cancel", so past 100 subscribers that cap would
// have quietly reintroduced the exact bug this file exists to prevent: a
// cancellation reporting success while the customer kept being billed.
async function fetchSubscriptionPages(key: string, extraQuery = ''): Promise<{ ok: boolean; rows: any[]; error?: string }> {
  const rows: any[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(`${PAYSTACK_API}/subscription?perPage=${PER_PAGE}&page=${page}${extraQuery}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    const out = await res.json()
    if (!res.ok || !out?.status) {
      return { ok: false, rows, error: out?.message || `Paystack list failed (${res.status})` }
    }
    const batch: any[] = out.data || []
    rows.push(...batch)

    const pageCount = Number(out?.meta?.pageCount) || 1
    if (batch.length === 0 || page >= pageCount) return { ok: true, rows }
    if (page === MAX_PAGES) {
      return { ok: false, rows, error: `More than ${MAX_PAGES * PER_PAGE} subscriptions to page through` }
    }
  }
  return { ok: true, rows }
}

// Every active subscription on the account, with its real amount.
//
// The amount matters: a Paystack subscription locks in the plan price at
// creation, so the two live ones still bill R65 from when the plan was R65,
// even though the plan is R97 today. Deriving MRR from our own price constant
// would overstate it. Paystack is the only honest source.
export async function listActivePaystackSubs(): Promise<{ ok: boolean; subs: PaystackSub[]; error?: string }> {
  const key = secret()
  if (!key) return { ok: false, subs: [], error: 'PAYSTACK_SECRET_KEY is not configured' }
  try {
    const all = await fetchSubscriptionPages(key)
    if (!all.ok) return { ok: false, subs: [], error: all.error }
    return { ok: true, subs: all.rows.filter((s: any) => s?.status === 'active').map(toSub) }
  } catch (e: any) {
    return { ok: false, subs: [], error: e?.message || 'Could not reach Paystack' }
  }
}

// Every active subscription Paystack holds for an email address. This is the
// authority, because our own records cannot be trusted to have the code.
//
// Resolves the customer first and asks Paystack for that customer's
// subscriptions, rather than listing everyone's and filtering by email here.
// It is one small request instead of a full scan, and it cannot be defeated by
// the subscriber count growing.
export async function findActivePaystackSubs(email: string): Promise<{ ok: boolean; subs: PaystackSub[]; error?: string }> {
  const key = secret()
  if (!key) return { ok: false, subs: [], error: 'PAYSTACK_SECRET_KEY is not configured' }
  if (!email) return { ok: true, subs: [] }

  try {
    const lookup = await fetch(`${PAYSTACK_API}/customer/${encodeURIComponent(email.trim())}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    // No such customer is a real answer: they have never paid us, so there is
    // nothing to cancel. Any other failure is NOT an answer and must say so,
    // or the caller will read it as "no subscription" and delete regardless.
    if (lookup.status === 404) return { ok: true, subs: [] }
    const found = await lookup.json()
    if (!lookup.ok || !found?.status) {
      return { ok: false, subs: [], error: found?.message || `Paystack customer lookup failed (${lookup.status})` }
    }
    const customerId = found?.data?.id
    if (!customerId) return { ok: false, subs: [], error: 'Paystack returned no customer id' }

    const all = await fetchSubscriptionPages(key, `&customer=${encodeURIComponent(String(customerId))}`)
    if (!all.ok) return { ok: false, subs: [], error: all.error }

    // Still match on email: ?customer= is the filter, but this is the field the
    // caller is actually reasoning about, and it costs nothing to confirm.
    const want = email.trim().toLowerCase()
    const subs = all.rows
      .filter((s: any) => s?.status === 'active' && String(s?.customer?.email || '').toLowerCase() === want)
      .map(toSub)
    return { ok: true, subs }
  } catch (e: any) {
    return { ok: false, subs: [], error: e?.message || 'Could not reach Paystack' }
  }
}

// Disable one subscription. Needs BOTH the code and an email_token, and the
// token only comes from fetching the subscription, so this is two calls.
async function disableOne(code: string, key: string): Promise<{ ok: boolean; error?: string; alreadyOff?: boolean }> {
  const lookup = await fetch(`${PAYSTACK_API}/subscription/${encodeURIComponent(code)}`, {
    headers: { Authorization: `Bearer ${key}` },
  })
  const found = await lookup.json()
  if (!lookup.ok || !found?.status) {
    return { ok: false, error: found?.message || `lookup failed (${lookup.status})` }
  }
  if (found?.data?.status && found.data.status !== 'active') return { ok: true, alreadyOff: true }

  const token = found?.data?.email_token
  if (!token) return { ok: false, error: 'Paystack returned no email_token' }

  const res = await fetch(`${PAYSTACK_API}/subscription/disable`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, token }),
  })
  const out = await res.json()
  if (!res.ok || !out?.status) return { ok: false, error: out?.message || `disable failed (${res.status})` }
  return { ok: true }
}

// Cancel every active Paystack subscription for a customer.
//
// `hintCode` is our stored code if we happen to have a real one. It is only a
// hint: the email lookup is what actually finds them, because our stored value
// is usually a transaction reference.
export async function cancelSubscriptionsFor(email: string, hintCode?: string | null): Promise<DisableResult> {
  const key = secret()
  if (!key) return { ok: false, cancelled: [], skipped: 'not_configured', error: 'PAYSTACK_SECRET_KEY is not configured' }

  const found = await findActivePaystackSubs(email)
  if (!found.ok) return { ok: false, cancelled: [], error: found.error }

  const codes = new Set(found.subs.map(s => s.subscription_code))
  if (hintCode && hintCode.startsWith('SUB_')) codes.add(hintCode)
  if (codes.size === 0) return { ok: true, cancelled: [], skipped: 'none_found' }

  const cancelled: string[] = []
  for (const code of codes) {
    const r = await disableOne(code, key)
    if (!r.ok) return { ok: false, cancelled, error: `${code}: ${r.error}` }
    if (!r.alreadyOff) cancelled.push(code)
  }
  return { ok: true, cancelled }
}
