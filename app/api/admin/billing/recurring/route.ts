import { NextResponse } from 'next/server'
import { requireAdmin, adminDb, migrationMissing } from '@/lib/admin-api'
import { generateRecurringDrafts } from '@/lib/recurring-invoices'
import { advanceSchedule, nextAnniversary, type Cadence } from '@/lib/billing-docs'

// Recurring schedules, and the queue of drafts they produce.
//
// The schedule says WHERE the amount comes from rather than storing a copy of
// it. A 'seats' schedule reads the live count off the organisation when the
// draft is generated, so a team that added five people is billed for five more
// without anybody remembering to come here and edit anything. A stored seat
// count is a second copy, and a second copy goes stale.

export const runtime = 'nodejs'

const CADENCES = ['monthly', 'quarterly', 'annually']

export async function GET(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const db = adminDb()
  const { data: schedules, error } = await db
    .from('recurring_schedules').select('*').order('next_run_on')
  if (error) return migrationMissing('Recurring schedules')

  const [{ data: clients }, { data: orgs }] = await Promise.all([
    db.from('billing_clients').select('id, name'),
    db.from('organizations').select('id, name, max_seats'),
  ])
  const clientName = Object.fromEntries((clients || []).map((c: any) => [c.id, c.name]))
  const orgById = Object.fromEntries((orgs || []).map((o: any) => [o.id, o]))

  // The queue: everything a schedule has drafted and nobody has approved yet.
  const { data: pending } = await db
    .from('invoices').select('*').eq('status', 'draft').not('recurring_id', 'is', null)
    .order('due_at')

  return NextResponse.json({
    schedules: (schedules || []).map((s: any) => {
      const org = s.organization_id ? orgById[s.organization_id] : null
      const seatsNow = org ? Number(org.max_seats) || 0 : null
      return {
        ...s,
        client_name: clientName[s.client_id] || 'Unknown client',
        organization_name: org?.name || null,
        seats_now: seatsNow,
        // Surfaced rather than silently applied: the next draft will use the
        // new number, and somebody should know that before it lands.
        seats_changed: s.source === 'seats' && s.last_seats != null && seatsNow != null
          && Number(s.last_seats) !== seatsNow,
        next_amount_cents: s.source === 'seats' && seatsNow != null
          ? seatsNow * (Number(s.seat_price_cents) || 9700)
          : (Array.isArray(s.template) ? s.template : [])
              .reduce((n: number, l: any) => n + Math.round(Number(l?.qty ?? 1) * Number(l?.unit_price_cents ?? 0)), 0),
      }
    }),
    pending: (pending || []).map((i: any) => ({
      ...i,
      client_name: clientName[i.client_id] || 'Unknown client',
    })),
  })
}

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => ({}))

  // Generate on demand. Same function the cron calls, and the same idempotency
  // guard, so pressing it twice does not bill anybody twice.
  if (body?.action === 'run') {
    const result = await generateRecurringDrafts(adminDb())
    return NextResponse.json(result)
  }

  if (!body?.client_id) return NextResponse.json({ error: 'A schedule needs a client.' }, { status: 400 })
  if (!String(body?.name || '').trim()) return NextResponse.json({ error: 'Give the schedule a name.' }, { status: 400 })

  const source = body.source === 'seats' ? 'seats' : 'fixed'
  if (source === 'seats' && !body.organization_id) {
    return NextResponse.json({ error: 'A seat-based schedule needs an organisation to count.' }, { status: 400 })
  }

  const day = Math.min(31, Math.max(1, Math.round(Number(body.day_of_month) || 1)))
  const cadence: Cadence = CADENCES.includes(body.cadence) ? body.cadence : 'monthly'

  const db = adminDb()
  const { data, error } = await db.from('recurring_schedules').insert({
    client_id: body.client_id,
    organization_id: source === 'seats' ? body.organization_id : null,
    name: String(body.name).trim(),
    source,
    cadence,
    day_of_month: day,
    seat_price_cents: Math.round(Number(body.seat_price_cents) || 9700),
    lead_days: Math.min(60, Math.max(0, Math.round(Number(body.lead_days ?? 7)))),
    // The first run is the next anniversary from today, not today: a schedule
    // created on the 20th for a client billed on the 5th bills on the 5th.
    next_run_on: body.next_run_on || nextAnniversary(new Date(), day),
    template: source === 'fixed' ? (Array.isArray(body.template) ? body.template : []) : [],
    notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
    active: true,
  }).select('*').maybeSingle()

  if (error) {
    if (/relation .* does not exist/i.test(error.message || '')) return migrationMissing('Recurring schedules')
    return NextResponse.json({ error: error.message || 'Could not save the schedule' }, { status: 500 })
  }
  return NextResponse.json({ schedule: data })
}

export async function PATCH(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => ({}))
  if (!body?.id) return NextResponse.json({ error: 'Which schedule?' }, { status: 400 })

  const db = adminDb()
  const { data: existing } = await db
    .from('recurring_schedules').select('*').eq('id', body.id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'No such schedule' }, { status: 404 })

  const patch: Record<string, any> = { updated_at: new Date().toISOString() }
  if ('active' in body) patch.active = !!body.active
  if ('name' in body && String(body.name).trim()) patch.name = String(body.name).trim()
  if ('seat_price_cents' in body) patch.seat_price_cents = Math.round(Number(body.seat_price_cents) || 0)
  if ('lead_days' in body) patch.lead_days = Math.min(60, Math.max(0, Math.round(Number(body.lead_days))))
  if ('notes' in body) patch.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null
  if ('day_of_month' in body) {
    const day = Math.min(31, Math.max(1, Math.round(Number(body.day_of_month))))
    patch.day_of_month = day
    // Keep the next run on the same cycle as the new day, rather than leaving
    // it pointing at the old one.
    patch.next_run_on = nextAnniversary(new Date(), day)
  }
  if ('skip' in body && body.skip) {
    // Skip one cycle. For the month a client is on hold, or one already
    // invoiced by hand.
    patch.next_run_on = advanceSchedule(
      existing.next_run_on, (existing.cadence || 'monthly') as Cadence, existing.day_of_month || 1)
  }

  const { data, error } = await db
    .from('recurring_schedules').update(patch).eq('id', body.id).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message || 'Could not save' }, { status: 500 })
  return NextResponse.json({ schedule: data })
}

export async function DELETE(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Which schedule?' }, { status: 400 })

  const db = adminDb()
  // Invoices already raised keep their recurring_id and are untouched. Deleting
  // a schedule stops future drafts; it does not rewrite history.
  const { error } = await db.from('recurring_schedules').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message || 'Could not delete' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
