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
    const res = await fetch(`${PAYSTACK_API}/subscription?perPage=100`, { headers: { Authorization: `Bearer ${key}` } })
    const out = await res.json()
    if (!res.ok || !out?.status) return { ok: false, subs: [], error: out?.message || `Paystack list failed (${res.status})` }
    const subs: PaystackSub[] = (out.data || [])
      .filter((s: any) => s?.status === 'active')
      .map((s: any) => ({
        subscription_code: s.subscription_code,
        status: s.status,
        amount: s.amount,
        email: s.customer?.email,
        next_payment_date: s.next_payment_date ?? null,
      }))
    return { ok: true, subs }
  } catch (e: any) {
    return { ok: false, subs: [], error: e?.message || 'Could not reach Paystack' }
  }
}

// Every active subscription Paystack holds for an email address. This is the
// authority, because our own records cannot be trusted to have the code.
export async function findActivePaystackSubs(email: string): Promise<{ ok: boolean; subs: PaystackSub[]; error?: string }> {
  const key = secret()
  if (!key) return { ok: false, subs: [], error: 'PAYSTACK_SECRET_KEY is not configured' }
  if (!email) return { ok: true, subs: [] }

  try {
    const res = await fetch(`${PAYSTACK_API}/subscription?perPage=100`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    const out = await res.json()
    if (!res.ok || !out?.status) {
      return { ok: false, subs: [], error: out?.message || `Paystack list failed (${res.status})` }
    }
    const want = email.trim().toLowerCase()
    const subs: PaystackSub[] = (out.data || [])
      .filter((s: any) => s?.status === 'active' && String(s?.customer?.email || '').toLowerCase() === want)
      .map((s: any) => ({
        subscription_code: s.subscription_code,
        status: s.status,
        amount: s.amount,
        email: s.customer?.email,
        next_payment_date: s.next_payment_date ?? null,
      }))
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
