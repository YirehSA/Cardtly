// A client paid by EFT: everything that follows, in the order it has to happen.
//
// WHY THIS EXISTS (Andre, 2026-10-21: "We have to jump and change to so many
// screens to get the order right... It must be easy from receiving the payment
// to creating everything after that"). Before, a paid quote meant six screens:
// Quotes to make the invoice, Teams to make the team, Clients to link it,
// Invoices to set the months and issue, Payments to record the money (with the
// amount looked up in the bank), then Invoices again to email it. Doing them out
// of order failed quietly: a payment allocated before the client was linked to
// its team left a paid invoice and a team that never went live.
//
// The Payment received screen (components/admin/billing/PaymentFlow) asks the
// questions once and runs the steps below in this order. This file is the pure
// part: the order, and what a quote's lines say about seats and months. No
// database, so scripts/check-payment-flow can test it.

export interface LineLike { description: string; qty: number | string }

export interface TeamSuggestion {
  seats: number | null
  months: number | null
  /** Why, in words ("a yearly line"), so the screen can say where the numbers came from. */
  from: string | null
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** Lines that are the digital cards themselves, not NFC cards or delivery. */
function isSeatLine(description: string): boolean {
  const d = description.toLowerCase()
  if (/\bnfc\b|deliver|shipping|courier|print|setup fee|set-up fee/.test(d)) return false
  return /seat|digital business card|licen[cs]e|subscription|user|profile/.test(d)
}

/** A calendar month named in a line ("Digital Business Card - October"). */
function namedMonth(description: string): string | null {
  const words = description.toLowerCase().match(/[a-z]+/g) || []
  for (const w of words) {
    if (w.length < 3) continue
    const m = MONTHS.find(p => w.startsWith(p))
    // "may" only as the whole word: "mayor" and the like are not May.
    if (m && (m !== 'may' || w === 'may')) return m
  }
  return null
}

/**
 * What a quote or invoice says it is for: how many cards, for how long.
 *
 * Only a suggestion, shown filled in and editable. The wording of quote lines
 * is free text, so this reads the shapes Cardtly actually writes:
 *   "Digital Business Card - October / November / December", 6 each: 6 seats, 3 months
 *   "Number of Seats Required (Yearly)", 3: 3 seats, 12 months
 *   "... annual subscription paid upfront. Includes 12 months", 1: 1 seat, 12 months
 *   "Digital Business Card | Seats per month", 10: 10 seats, months unknown
 * and stays quiet (null) rather than guessing when it cannot tell.
 */
export function suggestTeam(lines: LineLike[]): TeamSuggestion {
  const seatLines = (lines || []).filter(l => l?.description && isSeatLine(l.description))
  if (!seatLines.length) return { seats: null, months: null, from: null }

  const qtys = seatLines.map(l => Math.floor(Number(l.qty))).filter(n => Number.isFinite(n) && n >= 1)
  const seats = qtys.length ? Math.max(...qtys) : null

  // One line per calendar month is the clearest signal there is.
  const named = new Set(seatLines.map(l => namedMonth(l.description)).filter(Boolean))
  if (named.size >= 2) return { seats, months: named.size, from: `${named.size} monthly lines` }

  const text = seatLines.map(l => l.description.toLowerCase()).join(' | ')
  const counted = /(\d{1,3})\s*(?:-\s*)?months?\b/.exec(text)
  if (counted) {
    const n = Number(counted[1])
    if (n >= 1 && n <= 120) return { seats, months: n, from: `"${counted[0]}"` }
  }
  if (/\b(year|yearly|annual|annually|12m)\b/.test(text)) return { seats, months: 12, from: 'a yearly line' }
  if (named.size === 1) return { seats, months: 1, from: 'one monthly line' }
  if (/month-to-month|per month|monthly/.test(text)) return { seats, months: 1, from: 'a monthly line' }
  return { seats, months: null, from: seats ? 'the seat line' : null }
}

export type StepId =
  | 'save_team'
  | 'link_client'
  | 'make_invoice'
  | 'set_months'
  | 'issue_invoice'
  | 'record_payment'
  | 'send_invoice'

export interface PlanInput {
  /** What was paid: a quote still to become an invoice, or an invoice. */
  source: 'quote' | 'draft_invoice' | 'invoice'
  /** The team: made now, changed (seats or billing), used as it is, or none at all. */
  team: 'new' | 'change' | 'keep' | 'none'
  /** The client is not linked to the team yet. */
  needsLink: boolean
  /** A prepaid period to put on the invoice (and it is not already there). */
  setMonths: boolean
  /** Email the paid invoice to the client at the end. */
  send: boolean
}

/**
 * The steps, in the only order that works.
 *
 * The team has to exist and the client has to be linked to it BEFORE the
 * prepaid period is set (the invoices route refuses a period for a client with
 * no team) and before the money is allocated (allocating is what marks the
 * invoice paid and switches the team on; done first, it switches nothing on).
 * The invoice has to be issued before money can be allocated to it, and the
 * email goes last so it shows the invoice as paid.
 */
export function planSteps(p: PlanInput): StepId[] {
  const steps: StepId[] = []
  if (p.team === 'new' || p.team === 'change') steps.push('save_team')
  if (p.team !== 'none' && p.needsLink) steps.push('link_client')
  if (p.source === 'quote') steps.push('make_invoice')
  if (p.team !== 'none' && p.setMonths) steps.push('set_months')
  if (p.source === 'quote' || p.source === 'draft_invoice') steps.push('issue_invoice')
  steps.push('record_payment')
  if (p.send) steps.push('send_invoice')
  return steps
}

/**
 * How a payment sits against what is owed.
 *
 * In full, short (part paid, the rest still owing), or over (the extra stays
 * on the client's account as unapplied cash, never forced onto the invoice).
 */
export function paymentFit(amountCents: number, owingCents: number):
  { kind: 'full' | 'short' | 'over'; allocateCents: number; differenceCents: number } {
  const amount = Math.max(0, Math.round(amountCents))
  const owing = Math.max(0, Math.round(owingCents))
  if (amount === owing) return { kind: 'full', allocateCents: amount, differenceCents: 0 }
  if (amount < owing) return { kind: 'short', allocateCents: amount, differenceCents: owing - amount }
  return { kind: 'over', allocateCents: owing, differenceCents: amount - owing }
}

/**
 * The document numbers written in a piece of text, made comparable:
 * "INV-2026-0012", "inv 2026 12" and "INV20260012" all read as inv-2026-12.
 * The number ends where the digits end, so invoice 12 never reads as invoice 1.
 */
function documentKeys(text: string): Array<{ prefix: string; year: string; n: number }> {
  const out: Array<{ prefix: string; year: string; n: number }> = []
  for (const m of String(text || '').toLowerCase().matchAll(/([a-z]+)[^a-z0-9]*(\d{4})[^a-z0-9]*(\d{1,6})(?!\d)/g)) {
    out.push({ prefix: m[1], year: m[2], n: Number(m[3]) })
  }
  return out
}

/** Does a bank reference point at this document? */
export function referenceMatches(reference: string, documentNumber: string | null | undefined): boolean {
  if (!documentNumber) return false
  const want = documentKeys(documentNumber)[0]
  if (!want) return false
  // endsWith, because a bank glues the payer's name on: "ACMEINV-2026-0012".
  return documentKeys(reference).some(k => k.year === want.year && k.n === want.n && k.prefix.endsWith(want.prefix))
}
