// The server half of the Pro year + NFC card bundle (see lib/pro-bundle).
//
// HOW THE MONEY WORKS. Paystack cannot charge R999 now and R970 a year later
// on one plan: passing a plan to transaction/initialize overrides the amount.
// So the bundle is two things:
//   1. a one-off R999 card payment, carrying the card and delivery details in
//      its metadata, and
//   2. once that payment succeeds, a subscription on the ordinary yearly plan
//      (R970) whose first charge is a year away, on the card just used.
// From year two the customer is an ordinary yearly subscriber: renewals arrive
// as charge.success with no metadata and the webhook's recover-by-email branch
// keeps the row live, and cancelling works exactly as it does for anyone else.
//
// NOTHING IS WRITTEN BEFORE THE PAYMENT. The order lives in the Paystack
// metadata until the money arrives, so an abandoned checkout leaves no
// "awaiting payment" order behind for the customer or the admin to wonder about.
//
// ONCE ONLY. Both the return from checkout (/upgrade/verify) and the webhook
// complete the same payment, often within the same second. The unique
// nfc_orders.paystack_reference (migration 106) decides which of them is first:
// the first inserts the order and does everything else; the second finds the
// order there and only makes sure the subscription row exists.

import { Resend } from 'resend'
import { FROM_EMAIL } from '@/lib/email'
import { esc } from '@/lib/booking-email'
import { logSubscriptionChange } from '@/lib/subscription-audit'
import { isMissingColumn } from '@/lib/pg-errors'
import { PAYSTACK_PLAN_CODES, disableSubscriptionCodes, findActivePaystackSubs } from '@/lib/paystack'
import { NFC_TIERS } from '@/lib/nfc-pricing'
import {
  BUNDLE_ACTION, BUNDLE_PRICE_RAND, bundleRenewalDate, bundleRenewalRand, parseBundleOrder, type BundleOrder,
} from '@/lib/pro-bundle'

const PAYSTACK_API = 'https://api.paystack.co'
// Where NFC orders are announced, as in app/api/nfc/order.
const ADMIN_EMAIL = 'info@yireh.co.za'

/** R999 in cents, as Paystack counts it. */
export const BUNDLE_AMOUNT_CENTS = BUNDLE_PRICE_RAND * 100

const SUB_COLS = 'user_id, email, plan_id, status, billing_cycle, cancel_at, created_at, metadata'

/** Paystack sends metadata as an object, but a string has been seen too. */
export function txMetadata(tx: any): any {
  const m = tx?.metadata
  if (typeof m === 'string') { try { return JSON.parse(m) } catch { return {} } }
  return m || {}
}

export function isBundleTransaction(tx: any): boolean {
  return txMetadata(tx).action === BUNDLE_ACTION
}

/**
 * Why this person cannot buy the bundle right now, or null if they can.
 * Someone already paying for Pro would end up with two subscriptions billing
 * them, and a comped account has nothing to pay for.
 */
export function bundleBlockedReason(row: any): string | null {
  if (!row) return null
  if (row.metadata?.comped || row.billing_cycle === 'comp') {
    return 'Your Pro is already covered, so there is nothing to pay for. You can order an NFC card on its own from NFC Cards.'
  }
  const billed = String(row.plan_id || '').startsWith('paystack')
  if (billed && row.status === 'active' && !row.cancel_at) {
    return 'You already pay for Pro, so this would charge you twice. Order a card on its own from NFC Cards, or cancel your plan in Settings and choose the bundle when it ends.'
  }
  return null
}

async function latestSubscription(admin: any, userId: string) {
  const { data, error } = await admin.from('whop_subscriptions').select(SUB_COLS)
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data
}

/**
 * Start a bundle checkout: refuse anyone who should not buy it, then ask
 * Paystack for a payment page. Card payments only, because the renewal needs a
 * card it can charge again next year.
 */
export async function startBundleCheckout(
  admin: any,
  user: { id: string; email: string },
  order: BundleOrder,
  card: { id: string; slug: string | null } | null,
  appUrl: string,
): Promise<{ ok: true; url: string } | { ok: false; status: number; error: string }> {
  // Migration 106 adds the column that keeps a payment from creating two
  // orders. Without it, no bundle is sold at all.
  const probe = await admin.from('nfc_orders').select('paystack_reference').limit(1)
  if (isMissingColumn(probe.error)) {
    return { ok: false, status: 503, error: 'The bundle is not switched on yet. Please try again later.' }
  }
  if (probe.error) return { ok: false, status: 500, error: 'Could not start the payment. Please try again.' }

  const blocked = bundleBlockedReason(await latestSubscription(admin, user.id))
  if (blocked) return { ok: false, status: 409, error: blocked }

  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) return { ok: false, status: 500, error: 'Payments are not configured.' }

  const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: user.email,
      amount: BUNDLE_AMOUNT_CENTS,
      currency: 'ZAR',
      channels: ['card'],
      callback_url: `${appUrl}/upgrade/verify?plan=yearly&bundle=1&user_id=${user.id}`,
      metadata: {
        user_id: user.id,
        action: BUNDLE_ACTION,
        plan: 'yearly',
        card_id: card?.id || null,
        card_slug: card?.slug || null,
        order,
      },
    }),
  })
  const out = await res.json().catch(() => null)
  if (!res.ok || !out?.status || !out?.data?.authorization_url) {
    console.error('bundle initialize failed', res.status, out?.message)
    return { ok: false, status: 502, error: out?.message || 'Could not start the payment. Please try again.' }
  }
  return { ok: true, url: out.data.authorization_url }
}

/** The yearly subscription that takes over in a year, on the card just used. */
async function createRenewal(tx: any, startDate: Date): Promise<{ ok: true; code: string | null } | { ok: false; error: string }> {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) return { ok: false, error: 'PAYSTACK_SECRET_KEY is not configured' }
  const auth = tx?.authorization
  if (!auth?.authorization_code || auth.reusable === false) {
    return { ok: false, error: 'the card used cannot be charged again (authorization not reusable)' }
  }
  try {
    const res = await fetch(`${PAYSTACK_API}/subscription`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: tx?.customer?.customer_code || tx?.customer?.email,
        plan: PAYSTACK_PLAN_CODES.yearly,
        authorization: auth.authorization_code,
        start_date: startDate.toISOString(),
      }),
    })
    const out = await res.json().catch(() => null)
    if (!res.ok || !out?.status) return { ok: false, error: out?.message || `Paystack answered ${res.status}` }
    return { ok: true, code: out?.data?.subscription_code || null }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Could not reach Paystack' }
  }
}

const day = (d: Date) => d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Johannesburg' })

/**
 * Turn a successful bundle payment into Pro for a year, a paid card order and
 * next year's renewal. Safe to call more than once for the same payment.
 * Returns ok:false only when the caller should retry (the webhook answers 500
 * so Paystack sends it again).
 */
export async function completeBundlePayment(
  admin: any,
  tx: any,
  source: 'paystack_webhook' | 'paystack_verify',
): Promise<{ ok: true; first: boolean } | { ok: false; error: string }> {
  const meta = txMetadata(tx)
  const userId: string | undefined = meta.user_id
  const reference: string | undefined = tx?.reference
  const email: string = tx?.customer?.email || ''

  if (!userId || !reference) return { ok: false, error: 'bundle payment without user_id or reference' }
  if (tx?.status && tx.status !== 'success') return { ok: false, error: `payment status ${tx.status}` }
  // The amount is checked, not trusted: metadata comes from our own checkout,
  // but a payment for the wrong amount must never become a year of Pro.
  if (Number(tx?.amount) !== BUNDLE_AMOUNT_CENTS || String(tx?.currency || 'ZAR').toUpperCase() !== 'ZAR') {
    console.error('bundle payment with an unexpected amount', reference, tx?.amount, tx?.currency)
    await logSubscriptionChange(admin, {
      change: 'updated', userId, email, source,
      reason: `Bundle payment ${reference} was ${tx?.amount} ${tx?.currency}, not ${BUNDLE_AMOUNT_CENTS} ZAR. Nothing activated; check it in Paystack.`,
    }).catch(() => {})
    return { ok: true, first: false }
  }

  const parsed = parseBundleOrder(meta.order)
  // The details were checked before checkout. If they no longer parse, still
  // honour the payment: activate Pro and send the admin what arrived.
  const order: BundleOrder | null = parsed.ok ? parsed.order : null

  const paidAt = new Date(tx?.paid_at || tx?.paidAt || Date.now())
  const renewsOn = bundleRenewalDate(paidAt)

  // A subscription still retrying a failed charge would bill this customer
  // again next month. Same rule as the webhook's charge.success: only the
  // failing ones. Asked BEFORE the order is written, so the gap between the
  // order (the lock) and the subscription row stays a few database calls wide
  // rather than a round trip to Paystack.
  let replaced: string[] = []
  if (email) {
    const live = await findActivePaystackSubs(email).catch(() => ({ ok: false, subs: [] as any[] }))
    if (live.ok) replaced = live.subs.filter((s: any) => s.status === 'attention').map((s: any) => s.subscription_code)
  }

  // 1. The order, which is also the once-only lock.
  const { data: inserted, error: orderErr } = await admin.from('nfc_orders').insert({
    user_id: userId,
    card_id: meta.card_id || null,
    card_slug: meta.card_slug || null,
    color: order?.colour || 'black',
    name_on_card: order?.nameOnCard || '(see the admin email)',
    title_on_card: order?.titleOnCard || null,
    shipping_address: order?.address || null,
    shipping_city: order?.city || null,
    shipping_province: order?.province || null,
    shipping_postal_code: order?.postalCode || null,
    quantity: 1,
    // Paid inside the R999, so the card itself carries no separate charge.
    amount: 0,
    design_tier: order?.tier || 'standard',
    status: 'paid',
    bundle: true,
    paystack_reference: reference,
  }).select('id').maybeSingle()

  const duplicate = orderErr && (orderErr as any).code === '23505'
  if (orderErr && !duplicate) {
    console.error('bundle order insert failed', orderErr)
    return { ok: false, error: `order insert failed: ${orderErr.message}` }
  }
  const first = !duplicate

  const rowFor = (extra: { cancel_at?: string | null; metadata?: Record<string, unknown> }) => ({
    user_id: userId,
    email,
    plan_id: 'paystack_yearly',
    subscription_tier: 'pro',
    billing_cycle: 'yearly',
    status: 'active',
    receipt_id: reference,
    membership_id: reference,
    seats: 1,
    cancel_at: extra.cancel_at ?? null,
    metadata: {
      bundle: true,
      bundle_reference: reference,
      nfc_order_id: inserted?.id || null,
      paystack_reference: reference,
      amount: tx.amount,
      currency: tx.currency || 'ZAR',
      paid_at: paidAt.toISOString(),
      period_end: renewsOn.toISOString(),
      ...(extra.metadata || {}),
    },
  })

  const prior = await latestSubscription(admin, userId)

  if (!first) {
    // The other caller got here first and is normally a moment away from
    // writing the row. Only if it still has not, a few seconds later, is it
    // taken to have stopped: then Pro goes on for the year paid for and ends
    // there, because whether a renewal exists is unknown. Writing straight
    // away instead could land after the first caller's row and put an end
    // date on a customer whose renewal is in fact set up.
    if (prior?.metadata?.bundle_reference === reference) return { ok: true, first: false }
    await new Promise(r => setTimeout(r, 4000))
    const again = await latestSubscription(admin, userId)
    if (again?.metadata?.bundle_reference === reference) return { ok: true, first: false }
    await admin.from('whop_subscriptions').delete().eq('user_id', userId)
    const { error } = await admin.from('whop_subscriptions').insert(rowFor({
      cancel_at: renewsOn.toISOString(), metadata: { renewal_unknown: true },
    }))
    if (error) return { ok: false, error: `subscription write failed: ${error.message}` }
    await logSubscriptionChange(admin, {
      change: 'activated', userId, email, source, before: prior,
      reason: `Bundle ${reference}: subscription row was missing after the order was recorded, written with the paid year only.`,
    }).catch(() => {})
    return { ok: true, first: false }
  }

  // 2. Pro for the year. Delete-then-insert, as every other activation does:
  // whop_subscriptions has no unique constraint on user_id. Failing
  // subscriptions found above are recorded on the row before they are
  // disabled, as the webhook does.
  await admin.from('whop_subscriptions').delete().eq('user_id', userId)
  const { error: rowErr } = await admin.from('whop_subscriptions').insert(rowFor({
    metadata: replaced.length ? { replaced_subscription_codes: replaced } : {},
  }))
  if (rowErr) {
    // The order is in, so a retry would take the "not first" path above and
    // still write this row. Answer so the webhook is sent again.
    console.error('bundle subscription write failed', rowErr)
    return { ok: false, error: `subscription write failed: ${rowErr.message}` }
  }

  if (replaced.length) {
    const off = await disableSubscriptionCodes(replaced)
    await logSubscriptionChange(admin, {
      change: 'updated', userId, email, source,
      reason: off.ok
        ? `Bundle paid after a failed charge: disabled ${off.cancelled.join(', ') || replaced.join(', ')} so the customer is not charged twice.`
        : `Bundle paid after a failed charge, but disabling ${replaced.join(', ')} FAILED (${off.error}). Disable it in Paystack by hand.`,
    }).catch(() => {})
  }

  // 3. Next year's renewal. If it cannot be set up, the year paid for still
  // stands and then ends, rather than Pro running on unpaid. The admin is told
  // so it can be set up by hand.
  const renewal = await createRenewal(tx, renewsOn)
  if (renewal.ok) {
    await admin.from('whop_subscriptions')
      .update({ metadata: { ...rowFor({}).metadata, ...(replaced.length ? { replaced_subscription_codes: replaced } : {}), paystack_subscription_code: renewal.code } })
      .eq('user_id', userId).eq('receipt_id', reference)
  } else {
    await admin.from('whop_subscriptions')
      .update({ cancel_at: renewsOn.toISOString(), metadata: { ...rowFor({}).metadata, renewal_failed: renewal.error } })
      .eq('user_id', userId).eq('receipt_id', reference)
  }

  await logSubscriptionChange(admin, {
    change: 'activated', userId, email, source, before: prior,
    reason: renewal.ok
      ? `Bundle R${BUNDLE_PRICE_RAND} paid (${reference}): Pro to ${renewsOn.toISOString().slice(0, 10)}, then yearly ${renewal.code || 'subscription'} at R${bundleRenewalRand()}.`
      : `Bundle R${BUNDLE_PRICE_RAND} paid (${reference}): Pro to ${renewsOn.toISOString().slice(0, 10)}. Renewal NOT set up (${renewal.error}), so it ends then unless set up by hand.`,
    after: { plan_id: 'paystack_yearly', status: 'active', subscription_tier: 'pro', billing_cycle: 'yearly', seats: 1 },
  }).catch(() => {})

  // 4. Tell the admin to print and ship, and the customer what they bought.
  await sendBundleEmails({ email, order, meta, reference, renewsOn, renewal }).catch(e => console.error('bundle emails failed', e))

  return { ok: true, first: true }
}

async function sendBundleEmails(p: {
  email: string
  order: BundleOrder | null
  meta: any
  reference: string
  renewsOn: Date
  renewal: { ok: true; code: string | null } | { ok: false; error: string }
}) {
  if (!process.env.RESEND_API_KEY) return
  const resend = new Resend(process.env.RESEND_API_KEY)
  const o = p.order
  const tier = o ? NFC_TIERS[o.tier] : null
  const colour = o ? o.colour.charAt(0).toUpperCase() + o.colour.slice(1) : ''
  const shipTo = o ? `${o.address}, ${o.city}, ${o.province} ${o.postalCode}` : ''
  const head = (title: string) =>
    '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#00d4ff,#7c3aed,#ec4899);padding:24px;border-radius:12px 12px 0 0;"><h1 style="color:white;margin:0;font-size:22px;">' + title + '</h1></div><div style="background:#f8f8f8;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e5e5;border-top:none;font-size:14px;line-height:1.55;">'
  const foot = '<p style="font-size:12px;color:#999;margin-top:24px;text-align:center;">Cardtly (Pty) Ltd · cardtly.com</p></div></div>'
  const cardLines = o
    ? '<p><strong>Name on card:</strong> ' + esc(o.nameOnCard) + (o.titleOnCard ? ', ' + esc(o.titleOnCard) : '') + '<br><strong>Design:</strong> ' + esc(tier?.label) + '<br><strong>Colour:</strong> ' + esc(colour) + '<br><strong>Deliver to:</strong> ' + esc(shipTo) + '</p>'
    : '<p><strong>The card details did not come through.</strong> Raw: ' + esc(JSON.stringify(p.meta?.order ?? null)) + '</p>'

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `PAID R${BUNDLE_PRICE_RAND} bundle: NFC card for ${p.email}`,
    html: head('Paid: Pro year + NFC card')
      + '<p><strong>Customer:</strong> ' + esc(p.email) + '<br><strong>Paystack reference:</strong> ' + esc(p.reference) + '</p>'
      + cardLines
      + '<div style="margin-top:16px;padding:14px;background:#dcfce7;border:1px solid #22c55e;border-radius:8px;"><strong>Already paid. No invoice to send.</strong> Proof, print and ship. The order is in Admin under NFC orders as Paid.</div>'
      + (p.renewal.ok
        ? '<p style="margin-top:12px;">Renewal set up: yearly R' + bundleRenewalRand() + ' from ' + esc(day(p.renewsOn)) + (p.renewal.code ? ' (' + esc(p.renewal.code) + ')' : '') + '.</p>'
        : '<p style="margin-top:12px;color:#b91c1c;"><strong>Renewal NOT set up:</strong> ' + esc(p.renewal.error) + '. Pro ends on ' + esc(day(p.renewsOn)) + '. The customer has been told we will contact them about renewing before then, so please do, or create the yearly subscription for them in Paystack.</p>')
      + foot,
  })

  if (!p.email) return
  await resend.emails.send({
    from: FROM_EMAIL,
    to: p.email,
    subject: 'Your Cardtly Pro year and NFC card',
    html: head('Thank you. You are on Pro.')
      + `<p>We received your payment of <strong>R${BUNDLE_PRICE_RAND}</strong> for a year of Cardtly Pro and your NFC card.</p>`
      + `<p><strong>Pro is active until ${esc(day(p.renewsOn))}.</strong></p>`
      + cardLines
      + '<p>We will send you a proof of the card design before anything is printed, then deliver it within 5 to 7 business days of your approval.</p>'
      + (p.renewal.ok
        ? `<p style="color:#555;">From ${esc(day(p.renewsOn))} your subscription renews at R${bundleRenewalRand()} a year, charged in South African rand to the card you used today, until you cancel. Cancel any time from Billing in your settings: you are not charged again, and your card stays live until the end of the year you have paid for.</p>`
        : `<p style="color:#555;">Your year runs until ${esc(day(p.renewsOn))}. We will contact you about renewing before then.</p>`)
      + foot,
  })
}
