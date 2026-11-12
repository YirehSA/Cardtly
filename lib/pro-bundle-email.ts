// The two emails a paid R999 package sends: one to Cardtly, saying plainly
// that this is the package and that a card has to be made and shipped, and one
// to the customer, saying what they bought and what happens next.
//
// Built here, apart from the code that sends them, so scripts/check-pro-bundle
// can render both and confirm that the package, the card details and the
// delivery address are all in them, and that nothing the customer typed can
// inject markup. Every value the customer typed is escaped.

import { esc } from './booking-email'
import { NFC_TIERS } from './nfc-pricing'
import { BUNDLE_NAME, BUNDLE_PRICE_RAND, bundleRenewalRand, type BundleOrder } from './pro-bundle'

export interface BuiltEmail { subject: string; html: string; text: string }

export interface BundleEmailInput {
  customerEmail: string
  /** null when the details did not come through; rawOrder is then shown. */
  order: BundleOrder | null
  rawOrder?: unknown
  /** The card the NFC chip must open, e.g. https://www.cardtly.com/card/thandi */
  cardUrl: string | null
  reference: string
  orderId: string | null
  paidOn: Date
  proUntil: Date
  renewal: { ok: true; code: string | null } | { ok: false; error: string }
}

const day = (d: Date) => d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Johannesburg' })
const oneLine = (v: string) => v.replace(/[\r\n]+/g, ' ').trim()
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function designLine(o: BundleOrder): string {
  const t = NFC_TIERS[o.tier]
  return `${t.label} (${t.summary.toLowerCase()})`
}

function addressLines(o: BundleOrder): string[] {
  return [o.address, o.city, `${o.province} ${o.postalCode}`, 'South Africa']
}

// ── Shared HTML pieces ─────────────────────────────────────────────────────

const wrap = (title: string, sub: string, body: string) =>
  '<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#111827;">'
  + '<div style="background:linear-gradient(135deg,#00d4ff,#7c3aed,#ec4899);padding:24px 28px;border-radius:12px 12px 0 0;">'
  + '<p style="margin:0 0 6px;color:rgba(255,255,255,0.85);font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">' + esc(sub) + '</p>'
  + '<h1 style="margin:0;color:#ffffff;font-size:22px;line-height:1.3;">' + esc(title) + '</h1></div>'
  + '<div style="background:#ffffff;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;font-size:14px;line-height:1.6;">'
  + body
  + '<p style="font-size:12px;color:#9ca3af;margin:28px 0 0;text-align:center;">Cardtly (Pty) Ltd · cardtly.com</p></div></div>'

const heading = (t: string) =>
  '<p style="margin:22px 0 8px;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">' + esc(t) + '</p>'

/** Rows of [label, value-as-HTML]. Values are already escaped by the caller. */
const table = (rows: [string, string][]) =>
  '<table style="width:100%;border-collapse:collapse;font-size:14px;">'
  + rows.map(([k, v]) =>
    '<tr><td style="padding:7px 12px 7px 0;color:#6b7280;vertical-align:top;width:150px;border-bottom:1px solid #f3f4f6;">' + esc(k) + '</td>'
    + '<td style="padding:7px 0;vertical-align:top;border-bottom:1px solid #f3f4f6;">' + v + '</td></tr>').join('')
  + '</table>'

const steps = (items: string[]) =>
  '<ol style="margin:8px 0 0;padding-left:20px;">' + items.map(i => '<li style="margin:4px 0;">' + i + '</li>').join('') + '</ol>'

// ── To Cardtly ─────────────────────────────────────────────────────────────

export function bundleAdminEmail(i: BundleEmailInput): BuiltEmail {
  const o = i.order
  const who = o?.nameOnCard || i.customerEmail
  const subject = oneLine(`ACTION NEEDED: R${BUNDLE_PRICE_RAND} package paid (${BUNDLE_NAME}). Make and ship an NFC card for ${who}`)

  const todo = [
    `Send ${esc(i.customerEmail)} a proof of the card design${o ? ` (${esc(NFC_TIERS[o.tier].label)})` : ''}.`,
    'Print the card once they approve it.',
    i.cardUrl
      ? `Write the NFC chip to open <a href="${esc(i.cardUrl)}" style="color:#7c3aed;">${esc(i.cardUrl)}</a>.`
      : 'Write the NFC chip to open the customer\'s Cardtly card (no card link was recorded: check their account).',
    'Ship it to the address below, then mark the order <strong>Shipped</strong> in Admin, NFC orders, with the tracking number.',
  ]

  const renewalHtml = i.renewal.ok
    ? `R${bundleRenewalRand()} a year from ${esc(day(i.proUntil))}, until they cancel${i.renewal.code ? ` (Paystack ${esc(i.renewal.code)})` : ''}`
    : `<span style="color:#b91c1c;font-weight:bold;">NOT set up: ${esc(i.renewal.error)}.</span> Pro ends on ${esc(day(i.proUntil))}. Contact the customer about renewing before then, or create the yearly subscription for them in Paystack.`

  const body =
    '<div style="padding:16px 18px;background:#fef9c3;border:1px solid #eab308;border-radius:10px;">'
    + '<p style="margin:0;font-weight:bold;font-size:15px;">This is the R' + BUNDLE_PRICE_RAND + ' package: a year of Pro and an NFC card. The card has to be made and shipped.</p>'
    + steps(todo)
    + '<p style="margin:12px 0 0;font-weight:bold;color:#15803d;">Paid in full through Paystack. Do not send an invoice.</p>'
    + '</div>'
    + heading('The package')
    + table([
      ['Package', esc(BUNDLE_NAME)],
      ['Paid', `R${BUNDLE_PRICE_RAND} on ${esc(day(i.paidOn))}`],
      ['Pro', `Active now, until ${esc(day(i.proUntil))}`],
      ['Renewal', renewalHtml],
    ])
    + heading('The NFC card')
    + (o
      ? table([
        ['Name on card', esc(o.nameOnCard)],
        ['Job title', o.titleOnCard ? esc(o.titleOnCard) : '<span style="color:#9ca3af;">None</span>'],
        ['Design', esc(designLine(o))],
        ['Colour', esc(cap(o.colour))],
        ['Opens', i.cardUrl ? `<a href="${esc(i.cardUrl)}" style="color:#7c3aed;">${esc(i.cardUrl)}</a>` : '<span style="color:#b91c1c;">No card link recorded</span>'],
      ])
      : '<p style="color:#b91c1c;"><strong>The card details did not come through.</strong> What arrived: ' + esc(JSON.stringify(i.rawOrder ?? null)) + '</p>')
    + heading('Deliver to')
    + table([
      ['Customer', esc(i.customerEmail)],
      ['Address', o ? addressLines(o).map(esc).join('<br>') : '<span style="color:#b91c1c;">Missing, ask the customer</span>'],
    ])
    + '<p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Paystack reference ' + esc(i.reference) + (i.orderId ? ' · order ' + esc(i.orderId) : '') + '</p>'

  const text = [
    `ACTION NEEDED: R${BUNDLE_PRICE_RAND} package paid (${BUNDLE_NAME}).`,
    'The card has to be made and shipped. Paid in full through Paystack: do not send an invoice.',
    '',
    'What to do:',
    `1. Send ${i.customerEmail} a proof of the card design${o ? ` (${NFC_TIERS[o.tier].label})` : ''}.`,
    '2. Print the card once they approve it.',
    `3. Write the NFC chip to open ${i.cardUrl || "the customer's Cardtly card (no link recorded)"}.`,
    '4. Ship it, then mark the order Shipped in Admin, NFC orders, with the tracking number.',
    '',
    `Package: ${BUNDLE_NAME}`,
    `Paid: R${BUNDLE_PRICE_RAND} on ${day(i.paidOn)}`,
    `Pro: active until ${day(i.proUntil)}`,
    i.renewal.ok ? `Renewal: R${bundleRenewalRand()} a year from ${day(i.proUntil)}` : `Renewal: NOT set up (${i.renewal.error}). Pro ends on ${day(i.proUntil)}.`,
    '',
    ...(o ? [
      `Name on card: ${o.nameOnCard}`,
      `Job title: ${o.titleOnCard || 'None'}`,
      `Design: ${designLine(o)}`,
      `Colour: ${cap(o.colour)}`,
      `Deliver to: ${addressLines(o).join(', ')}`,
    ] : ['Card details did not come through: ' + JSON.stringify(i.rawOrder ?? null)]),
    '',
    `Paystack reference ${i.reference}${i.orderId ? `, order ${i.orderId}` : ''}`,
  ].join('\n')

  return { subject, html: wrap(`New R${BUNDLE_PRICE_RAND} package: ${BUNDLE_NAME}`, 'Paid · card to make and ship', body), text }
}

// ── To the customer ────────────────────────────────────────────────────────

export function bundleCustomerEmail(i: BundleEmailInput): BuiltEmail {
  const o = i.order
  const first = o?.nameOnCard.split(' ')[0] || ''
  const subject = `Your Cardtly package is confirmed: ${BUNDLE_NAME}`

  const renewalText = i.renewal.ok
    ? `Your Pro renews on ${day(i.proUntil)} at R${bundleRenewalRand()} a year, charged in South African rand to the card you paid with, until you cancel. You can cancel any time from Billing in your Cardtly settings: you are not charged again, and your card stays live until the end of the year you have paid for.`
    : `Your Pro runs until ${day(i.proUntil)}. We will contact you about renewing before then.`

  const body =
    '<p style="margin:0 0 12px;">' + (first ? 'Hi ' + esc(first) + ',' : 'Hi,') + '</p>'
    + '<p style="margin:0 0 4px;">Thank you for buying the Cardtly <strong>' + esc(BUNDLE_NAME) + '</strong> package. Your payment has gone through and your Pro is already switched on.</p>'
    + heading('Your package')
    + table([
      ['Package', `Cardtly Pro for 1 year + 1 NFC card, printed and delivered`],
      ['Paid', `R${BUNDLE_PRICE_RAND} on ${esc(day(i.paidOn))}`],
      ['Pro', `Active now, until ${esc(day(i.proUntil))}`],
    ])
    + heading('Your NFC card')
    + (o
      ? table([
        ['Name on card', esc(o.nameOnCard) + (o.titleOnCard ? '<br><span style="color:#6b7280;">' + esc(o.titleOnCard) + '</span>' : '')],
        ['Design', esc(designLine(o))],
        ['Colour', esc(cap(o.colour))],
        ['Delivery to', addressLines(o).map(esc).join('<br>')],
      ])
      : '<p>We have your order and will be in touch to confirm the card details.</p>')
    + heading('What happens next')
    + steps([
      'We email you a proof of your card design.',
      'Once you approve it, we print your card and set it to open your Cardtly card with a tap.',
      'We deliver it within 5 to 7 business days of your approval.',
    ])
    + '<p style="margin:18px 0 0;color:#4b5563;">' + esc(renewalText) + '</p>'
    + '<p style="margin:14px 0 0;color:#4b5563;">Questions about your card or your order? Just reply to this email.</p>'
    + '<p style="margin:14px 0 0;font-size:12px;color:#9ca3af;">Payment reference ' + esc(i.reference) + '</p>'

  const text = [
    first ? `Hi ${first},` : 'Hi,',
    '',
    `Thank you for buying the Cardtly ${BUNDLE_NAME} package. Your payment has gone through and your Pro is already switched on.`,
    '',
    'Your package',
    'Package: Cardtly Pro for 1 year + 1 NFC card, printed and delivered',
    `Paid: R${BUNDLE_PRICE_RAND} on ${day(i.paidOn)}`,
    `Pro: active now, until ${day(i.proUntil)}`,
    '',
    ...(o ? [
      'Your NFC card',
      `Name on card: ${o.nameOnCard}${o.titleOnCard ? `, ${o.titleOnCard}` : ''}`,
      `Design: ${designLine(o)}`,
      `Colour: ${cap(o.colour)}`,
      `Delivery to: ${addressLines(o).join(', ')}`,
      '',
    ] : []),
    'What happens next',
    '1. We email you a proof of your card design.',
    '2. Once you approve it, we print your card and set it to open your Cardtly card with a tap.',
    '3. We deliver it within 5 to 7 business days of your approval.',
    '',
    renewalText,
    '',
    'Questions about your card or your order? Just reply to this email.',
    `Payment reference ${i.reference}`,
  ].join('\n')

  return { subject, html: wrap('Your package is confirmed', `${BUNDLE_NAME} · R${BUNDLE_PRICE_RAND}`, body), text }
}
