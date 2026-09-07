import {
  documentTotals, effectiveVatRateBp, lineTotalCents,
  advanceSchedule, shouldGenerate, periodLabel, seatChange,
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

// ── Mid-cycle seat changes ────────────────────────────────────────────────

export interface AdjustResult {
  considered: number
  raised: number
  recorded: number
  problems: string[]
  changes: Array<{
    schedule: string; from: number; to: number
    direction: 'increase' | 'decrease' | 'none'
    chargeNowCents: number
  }>
}

/**
 * Seats that moved part way through a paid month.
 *
 * An INCREASE is charged pro rata straight away, because the seats went live
 * straight away and the model is prepaid. A DECREASE is not refunded: the month
 * is paid for and those seats stay usable until the anniversary, which is the
 * ordinary convention and avoids a credit note every time somebody leaves.
 * Either way the next monthly draft follows the new count on its own, because a
 * seats schedule reads the live number rather than a stored one.
 *
 * The idempotency here is the difficult part, and it is different from the
 * monthly generator's. That one has a natural key - this schedule, this due
 * date. This one runs DAILY against a count that can change at any moment, so
 * without a marker a jump from 10 to 15 seats would raise a correct pro-rata
 * invoice every single day until month end. last_adjusted_seats is that marker:
 * only the gap between the live count and it can produce a charge, and raising
 * one closes the gap. See migration 071.
 */
export async function adjustSeatChanges(
  admin: any,
  today = new Date(),
): Promise<AdjustResult> {
  const result: AdjustResult = { considered: 0, raised: 0, recorded: 0, problems: [], changes: [] }
  const todayIso = today.toISOString().slice(0, 10)

  const { data: schedules, error } = await admin
    .from('recurring_schedules').select('*').eq('active', true).eq('source', 'seats')
  if (error) {
    // The column arrives in 071. Saying so beats a stack trace in a cron log.
    result.problems.push(/last_adjusted_seats/.test(error.message || '')
      ? 'Seat adjustments need migration 071.'
      : `could not read schedules: ${error.message}`)
    return result
  }

  const { data: settings } = await admin
    .from('billing_settings').select('*').eq('id', true).maybeSingle()
  const vatRateBp = effectiveVatRateBp(settings?.vat_number, settings?.vat_rate_bp)

  for (const s of schedules || []) {
    result.considered++
    if (!s.organization_id) continue

    const seats = await seatsFor(admin, s.organization_id)
    if (seats === null) { result.problems.push(`${s.name}: organisation not found`); continue }

    // What we have already accounted for, by any route. Falls back to the
    // monthly figure for a schedule that predates 071.
    const baseline = s.last_adjusted_seats ?? s.last_seats
    if (baseline == null) {
      // Nothing billed yet, so there is no paid period to pro-rate against.
      // Record where we are so the first real change is measured from here.
      await admin.from('recurring_schedules')
        .update({ last_adjusted_seats: seats }).eq('id', s.id)
      continue
    }
    if (Number(baseline) === seats) continue

    // The period currently paid for: from the last invoice's due date up to the
    // next one. Taken from the invoice rather than recomputed, so it is the
    // period actually billed and not the period we think we billed.
    const { data: lastInvoice } = await admin
      .from('invoices').select('due_at')
      .eq('recurring_id', s.id).neq('status', 'cancelled')
      .order('due_at', { ascending: false }).limit(1)

    const periodStart = lastInvoice?.[0]?.due_at
    const periodEnd = s.next_run_on
    if (!periodStart || !periodEnd) {
      await admin.from('recurring_schedules')
        .update({ last_adjusted_seats: seats }).eq('id', s.id)
      continue
    }

    const change = seatChange({
      fromSeats: Number(baseline),
      toSeats: seats,
      seatPriceCents: Math.round(Number(s.seat_price_cents) || 9700),
      changeOn: todayIso,
      periodStart,
      periodEnd,
    })
    result.changes.push({
      schedule: s.name, from: Number(baseline), to: seats,
      direction: change.direction, chargeNowCents: change.chargeNowCents,
    })

    if (change.direction === 'increase' && change.chargeNowCents > 0) {
      const line: DocLine = {
        description:
          `Additional seats, ${baseline} to ${seats}, pro rata from ${todayIso} to ${periodEnd}`,
        qty: 1,
        unitPriceCents: change.chargeNowCents,
      }
      const totals = documentTotals([line], vatRateBp)

      const { data: invoice, error: iErr } = await admin.from('invoices').insert({
        client_id: s.client_id,
        recurring_id: s.id,
        status: 'draft',
        currency: 'ZAR',
        // Due immediately. This is a catch-up charge for seats already live,
        // not the next period, so it does not wait for an anniversary.
        due_at: todayIso,
        subtotal_cents: totals.subtotalCents,
        vat_rate_bp: totals.vatRateBp,
        vat_cents: totals.vatCents,
        total_cents: totals.totalCents,
        notes: `Seat change on ${s.name}. The monthly invoice from ${periodEnd} bills ${seats} seats.`,
      }).select('id').maybeSingle()

      if (iErr || !invoice) {
        // Do NOT close the gap: leaving last_adjusted_seats alone means the
        // next run tries again rather than losing the charge silently.
        result.problems.push(`${s.name}: could not raise the adjustment (${iErr?.message || 'unknown'})`)
        continue
      }

      await admin.from('invoice_lines').insert([{
        invoice_id: invoice.id, position: 0,
        description: line.description, qty: line.qty,
        unit_price_cents: line.unitPriceCents, line_total_cents: lineTotalCents(line),
      }])
      await admin.from('document_events').insert({
        doc_type: 'invoice', doc_id: invoice.id, event: 'seat_adjustment',
        meta: {
          schedule_id: s.id, schedule: s.name,
          from_seats: Number(baseline), to_seats: seats,
          period_start: periodStart, period_end: periodEnd,
          charge_cents: change.chargeNowCents,
        },
      })
      result.raised++
    } else {
      result.recorded++
    }

    // Only now, and only once the charge (if any) exists.
    await admin.from('recurring_schedules').update({
      last_adjusted_seats: seats,
      updated_at: new Date().toISOString(),
    }).eq('id', s.id)
  }

  return result
}
