import { prepaidPeriodEnd } from './org-billing'
import { settleOwnerCard } from './owner-team-card'

// A prepaid invoice, once fully paid, switches its team on and adds its months.
//
// The client pays an invoice that carries prepaid_months (3, 6, 12, 36...).
// The invoice's billing client links to an organisation; that organisation
// becomes a 'prepaid' team, goes live (business_plan_active), and its
// paid_until moves out by the invoice's months from whichever is later, today
// or the date already paid up to.
//
// EXACTLY ONCE. A payment can be re-allocated, deleted and allocated again, and
// every one of those re-runs the status check that calls this. The invoice is
// CLAIMED first - prepaid_applied_at set only where it is still null - and
// only the call that wins the claim touches the team. A second call, or two at
// once, finds nothing to claim and does nothing.
//
// It does not reverse. A payment deleted after its period was applied leaves
// the period in place: taking a paying client's cards offline on a bookkeeping
// correction would be worse than the rare manual fix, and the event recorded
// here says exactly what was added and when.

export interface PrepaidResult {
  applied: boolean
  reason?: string
  organizationId?: string
  paidUntil?: string
  months?: number
}

export async function applyPrepaidPeriod(db: any, invoiceId: string, today = new Date()): Promise<PrepaidResult> {
  const { data: invoice, error } = await db
    .from('invoices')
    .select('id, number, client_id, prepaid_months, prepaid_applied_at')
    .eq('id', invoiceId)
    .maybeSingle()
  // Before migration 091 the columns do not exist. Nothing to apply.
  if (error || !invoice) return { applied: false, reason: error ? 'prepaid columns not readable' : 'no such invoice' }
  const months = Number(invoice.prepaid_months)
  if (!Number.isFinite(months) || months < 1) return { applied: false, reason: 'not a prepaid invoice' }
  if (invoice.prepaid_applied_at) return { applied: false, reason: 'already applied' }

  const { data: client } = await db
    .from('billing_clients').select('organization_id').eq('id', invoice.client_id).maybeSingle()
  const orgId = client?.organization_id
  if (!orgId) return { applied: false, reason: 'the client is not linked to a team' }

  const { data: org } = await db
    .from('organizations').select('id, name, paid_until').eq('id', orgId).maybeSingle()
  if (!org) return { applied: false, reason: 'the linked team no longer exists' }

  // The claim. Only one caller gets a row back.
  const { data: claimed } = await db
    .from('invoices')
    .update({ prepaid_applied_at: new Date().toISOString() })
    .eq('id', invoice.id)
    .is('prepaid_applied_at', null)
    .select('id')
  if (!claimed?.length) return { applied: false, reason: 'already applied' }

  const paidUntil = prepaidPeriodEnd(org.paid_until, months, today)
  const { error: orgErr } = await db
    .from('organizations')
    .update({
      billing_period: 'prepaid',
      business_plan_active: true,
      paid_until: paidUntil,
      updated_at: new Date().toISOString(),
    })
    .eq('id', org.id)

  if (orgErr) {
    // Release the claim so the next status check tries again, rather than
    // leaving a paid invoice that says it was applied when it was not.
    await db.from('invoices').update({ prepaid_applied_at: null }).eq('id', invoice.id)
    return { applied: false, reason: `could not update the team: ${orgErr.message}` }
  }

  await db.from('document_events').insert({
    doc_type: 'invoice', doc_id: invoice.id, event: 'prepaid_period_applied', actor: null,
    meta: { organization_id: org.id, team: org.name, months, previous_paid_until: org.paid_until ?? null, paid_until: paidUntil },
  })

  // The team is live now, so its owner's own card belongs in it as a seat
  // (lib/owner-team-card). Never throws; the payment is the real work here.
  await settleOwnerCard(db, org.id)

  return { applied: true, organizationId: org.id, paidUntil, months }
}
