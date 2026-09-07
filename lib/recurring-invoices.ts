import {
  documentTotals, effectiveVatRateBp, lineTotalCents,
  advanceSchedule, shouldGenerate, periodLabel,
  type Cadence, type DocLine,
} from './billing-docs'

// The monthly drafts.
//
// This creates DRAFTS and never sends anything. Approval is a person pressing
// a button, which was the requirement and is also the only safe design: an
// automated system that emails invoices is one bad seat count away from
// billing thirty clients the wrong amount before anybody notices.
//
// IDEMPOTENCY IS THE WHOLE PROBLEM. It rides on a daily cron that can run
// twice, be retried, or be triggered by hand from the admin screen while the
// cron is mid-flight. Billing a client twice for the same month is the single
// worst thing this code could do, so the guard is a lookup on the natural key -
// this schedule, this due date - and not a flag, a timestamp or a lock.

export interface GenerateResult {
  considered: number
  created: number
  skipped: number
  seatChanges: Array<{ schedule: string; from: number | null; to: number }>
  problems: string[]
}

/** Seats billed = what the organisation contracted for, which is max_seats.
 *
 *  Not used_seats: lib/admin-data notes that nothing maintains it, and a client
 *  who bought twenty seats and filled twelve owes for twenty. Billing occupancy
 *  would quietly cut the bill every time somebody left. */
async function seatsFor(admin: any, organizationId: string): Promise<number | null> {
  const { data } = await admin
    .from('organizations').select('max_seats').eq('id', organizationId).maybeSingle()
  if (!data) return null
  const n = Number(data.max_seats)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

export async function generateRecurringDrafts(
  admin: any,
  today = new Date(),
): Promise<GenerateResult> {
  const result: GenerateResult = { considered: 0, created: 0, skipped: 0, seatChanges: [], problems: [] }

  const { data: schedules, error } = await admin
    .from('recurring_schedules').select('*').eq('active', true)
  if (error) {
    result.problems.push(`could not read schedules: ${error.message}`)
    return result
  }

  const { data: settings } = await admin
    .from('billing_settings').select('*').eq('id', true).maybeSingle()
  const vatRateBp = effectiveVatRateBp(settings?.vat_number, settings?.vat_rate_bp)

  for (const s of schedules || []) {
    result.considered++
    const cadence = (s.cadence || 'monthly') as Cadence
    const day = Number(s.day_of_month) || 1

    if (!shouldGenerate(s.next_run_on, Number(s.lead_days ?? 7), today)) {
      result.skipped++
      continue
    }

    // The natural key. Cheaper than any locking scheme and correct even when
    // two runs overlap, because the second one finds the first one's work.
    const { data: already } = await admin
      .from('invoices').select('id')
      .eq('recurring_id', s.id).eq('due_at', s.next_run_on).limit(1)
    if (already?.length) {
      result.skipped++
      continue
    }

    let lines: DocLine[] = []
    let seats: number | null = null

    if (s.source === 'seats') {
      if (!s.organization_id) {
        result.problems.push(`${s.name}: set to bill by seats but has no organisation`)
        continue
      }
      seats = await seatsFor(admin, s.organization_id)
      if (seats === null) {
        result.problems.push(`${s.name}: organisation not found, so no seat count`)
        continue
      }
      if (seats === 0) {
        // Not an error, and not a zero invoice either. An org with no seats is
        // one that has wound down, and sending it R0.00 every month is worse
        // than sending nothing.
        result.problems.push(`${s.name}: no seats, so nothing was raised`)
        result.skipped++
        continue
      }
      if (s.last_seats != null && Number(s.last_seats) !== seats) {
        result.seatChanges.push({ schedule: s.name, from: Number(s.last_seats), to: seats })
      }
      lines = [{
        description: `Cardtly Pro, ${seats} seat${seats === 1 ? '' : 's'} (${periodLabel(s.next_run_on, cadence, day)})`,
        qty: seats,
        unitPriceCents: Math.round(Number(s.seat_price_cents) || 9700),
      }]
    } else {
      const template = Array.isArray(s.template) ? s.template : []
      lines = template
        .map((l: any) => ({
          description: String(l?.description ?? '').trim(),
          qty: Number(l?.qty ?? 1),
          unitPriceCents: Math.round(Number(l?.unit_price_cents ?? 0)),
        }))
        .filter((l: DocLine) => l.description && Number.isFinite(l.qty) && Number.isFinite(l.unitPriceCents))
      if (!lines.length) {
        result.problems.push(`${s.name}: fixed schedule with no template lines`)
        continue
      }
    }

    const totals = documentTotals(lines, vatRateBp)

    const { data: invoice, error: iErr } = await admin.from('invoices').insert({
      client_id: s.client_id,
      recurring_id: s.id,
      status: 'draft',
      currency: 'ZAR',
      // The anniversary this covers. A subscription is prepaid, so the due date
      // is the day the period STARTS, not a term after issue.
      due_at: s.next_run_on,
      subtotal_cents: totals.subtotalCents,
      vat_rate_bp: totals.vatRateBp,
      vat_cents: totals.vatCents,
      total_cents: totals.totalCents,
      notes: s.notes || null,
    }).select('id').maybeSingle()

    if (iErr || !invoice) {
      result.problems.push(`${s.name}: could not create the draft (${iErr?.message || 'unknown'})`)
      continue
    }

    await admin.from('invoice_lines').insert(lines.map((l, position) => ({
      invoice_id: invoice.id, position,
      description: l.description, qty: l.qty,
      unit_price_cents: l.unitPriceCents, line_total_cents: lineTotalCents(l),
    })))

    // Advanced only AFTER the draft exists. The other order loses a month for a
    // client if the insert fails, and loses it silently.
    await admin.from('recurring_schedules').update({
      next_run_on: advanceSchedule(s.next_run_on, cadence, day),
      last_seats: seats,
      updated_at: new Date().toISOString(),
    }).eq('id', s.id)

    await admin.from('document_events').insert({
      doc_type: 'invoice', doc_id: invoice.id, event: 'drafted_from_schedule',
      meta: {
        schedule_id: s.id, schedule: s.name, due_at: s.next_run_on,
        seats, total_cents: totals.totalCents,
      },
    })

    result.created++
  }

  return result
}
