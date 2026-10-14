import { CARD_SOURCES } from './card-sources'

// A team's numbers for one month, and starting a team's numbers again.
//
// Both asked for by a Cardtly rep who sets companies up (2026-10-14): the
// views, taps and scans made while testing every card during setup showed up
// as the company's own activity, and the only way to tell a company how its
// team was doing was to read the screen to them - there was no report to send.
//
// Shared by the owner's Team analytics page (app/api/team/analytics) and by
// Cardtly admin (app/api/admin), so both reset and report the same way.

type Db = any

const DAY_MS = 24 * 60 * 60 * 1000
// South Africa has one time zone and no daylight saving: a month is counted
// from midnight SAST, so "September" means what the customer means by it.
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000

/** 'YYYY-MM' to the month's start and end instants, counted in SAST. */
export function monthBounds(month: string): { start: Date; end: Date; label: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month || '')
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2])
  if (mo < 1 || mo > 12 || y < 2024 || y > 2100) return null
  const start = new Date(Date.UTC(y, mo - 1, 1) - SAST_OFFSET_MS)
  const end = new Date(Date.UTC(y, mo, 1) - SAST_OFFSET_MS)
  const label = new Date(Date.UTC(y, mo - 1, 15)).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return { start, end, label }
}

/** The last `n` months, newest first, as { value: 'YYYY-MM', label }. */
export function recentMonths(n: number, now = new Date()): { value: string; label: string }[] {
  const sast = new Date(now.getTime() + SAST_OFFSET_MS)
  const out: { value: string; label: string }[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(sast.getUTCFullYear(), sast.getUTCMonth() - i, 1))
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    out.push({ value, label: monthBounds(value)!.label + (i === 0 ? ' (so far)' : '') })
  }
  return out
}

/**
 * Every row a query matches, a page at a time. PostgREST stops at 1000 rows,
 * and a busy team's month is more than that; ordered by id so the pages do
 * not overlap or skip.
 */
async function allRows(db: Db, table: string, columns: string, filter: (q: any) => any, cap = 50000): Promise<any[]> {
  const out: any[] = []
  for (let from = 0; from < cap; from += 1000) {
    const { data, error } = await filter(db.from(table).select(columns)).order('id', { ascending: true }).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data || []))
    if ((data || []).length < 1000) break
  }
  return out
}

export interface TeamReportRow {
  id: string
  name: string
  title: string | null
  department: string | null
  slug: string | null
  opens: number
  /** Distinct visitors among the opens, where the visitor could be told apart. */
  people: number
  taps: number
  saves: number
  shares: number
  leads: number
  /** Arrivals by channel, keyed by CARD_SOURCES label. */
  sources: Record<string, number>
}

export interface TeamReport {
  orgName: string
  month: string
  monthLabel: string
  generatedAt: string
  seats: number
  rows: TeamReportRow[]
  byDay: { date: string; opens: number; taps: number; saves: number; leads: number }[]
  totals: { opens: number; people: number; taps: number; saves: number; shares: number; leads: number; activeCards: number }
  sourceLabels: string[]
}

/** One team's numbers for one month. */
export async function buildTeamReport(db: Db, org: { id: string; name: string; max_seats?: number | null }, month: string): Promise<TeamReport> {
  const bounds = monthBounds(month)
  if (!bounds) throw new Error('That is not a month.')
  const startIso = bounds.start.toISOString()
  const endIso = bounds.end.toISOString()

  const [{ data: cards }, { data: depts }] = await Promise.all([
    db.from('team_cards').select('id, name, title, slug, department_id, is_active').eq('organization_id', org.id),
    db.from('departments').select('id, organization_id, name').eq('organization_id', org.id),
  ])
  const allCards = (cards || []) as any[]
  const ids = allCards.map(c => c.id)
  const deptName = Object.fromEntries(((depts || []) as any[]).map(d => [d.id, d.name]))

  const [events, contacts] = ids.length
    ? await Promise.all([
        allRows(db, 'team_card_events', 'id, team_card_id, event_type, visitor_hash, created_at',
          q => q.in('team_card_id', ids).gte('created_at', startIso).lt('created_at', endIso)),
        allRows(db, 'contacts', 'id, team_card_id, created_at',
          q => q.in('team_card_id', ids).gte('created_at', startIso).lt('created_at', endIso)),
      ])
    : [[], []]

  const sourceByType = Object.fromEntries(CARD_SOURCES.map(s => [s.eventType, s.label]))
  const blankSources = () => Object.fromEntries(CARD_SOURCES.map(s => [s.label, 0])) as Record<string, number>

  const rowById: Record<string, TeamReportRow> = {}
  const visitors: Record<string, Set<string>> = {}
  const anonymousOpens: Record<string, number> = {}
  for (const c of allCards) {
    rowById[c.id] = {
      id: c.id, name: c.name || 'Unnamed', title: c.title || null,
      department: c.department_id ? deptName[c.department_id] || null : null, slug: c.slug || null,
      opens: 0, people: 0, taps: 0, saves: 0, shares: 0, leads: 0, sources: blankSources(),
    }
    visitors[c.id] = new Set()
    anonymousOpens[c.id] = 0
  }

  // The day an event belongs to, in SAST.
  const dayOf = (iso: string) => new Date(new Date(iso).getTime() + SAST_OFFSET_MS).toISOString().slice(0, 10)
  const days: Record<string, { opens: number; taps: number; saves: number; leads: number }> = {}
  for (let t = bounds.start.getTime(); t < bounds.end.getTime(); t += DAY_MS) {
    days[dayOf(new Date(t).toISOString())] = { opens: 0, taps: 0, saves: 0, leads: 0 }
  }

  for (const e of events) {
    const r = rowById[e.team_card_id]
    if (!r) continue
    const d = days[dayOf(e.created_at)]
    if (e.event_type === 'view') {
      r.opens++
      if (d) d.opens++
      if (e.visitor_hash) visitors[e.team_card_id].add(e.visitor_hash)
      else anonymousOpens[e.team_card_id]++
    } else if (e.event_type === 'link_click') {
      r.taps++
      if (d) d.taps++
    } else if (e.event_type === 'contact_save') {
      r.saves++
      if (d) d.saves++
    } else if (e.event_type === 'share') {
      r.shares++
    } else if (sourceByType[e.event_type]) {
      r.sources[sourceByType[e.event_type]]++
    }
  }
  for (const c of contacts) {
    const r = rowById[c.team_card_id]
    if (!r) continue
    r.leads++
    const d = days[dayOf(c.created_at)]
    if (d) d.leads++
  }
  // An open with no visitor fingerprint cannot be matched to another, so it
  // counts as one person: the honest upper bound rather than a guess.
  for (const id of ids) rowById[id].people = visitors[id].size + anonymousOpens[id]

  // Every card that was active, plus any inactive one that still had activity.
  const rows = Object.values(rowById)
    .filter(r => allCards.find(c => c.id === r.id)?.is_active !== false || r.opens || r.leads)
    .sort((a, b) => (b.opens - a.opens) || (b.leads - a.leads) || a.name.localeCompare(b.name))

  const sum = (k: 'opens' | 'people' | 'taps' | 'saves' | 'shares' | 'leads') => rows.reduce((n, r) => n + r[k], 0)
  return {
    orgName: org.name,
    month,
    monthLabel: bounds.label,
    generatedAt: new Date().toISOString(),
    seats: Number(org.max_seats || 0),
    rows,
    byDay: Object.entries(days).map(([date, v]) => ({ date, ...v })),
    totals: {
      opens: sum('opens'), people: sum('people'), taps: sum('taps'), saves: sum('saves'),
      shares: sum('shares'), leads: sum('leads'),
      activeCards: rows.filter(r => r.opens > 0).length,
    },
    sourceLabels: CARD_SOURCES.map(s => s.label),
  }
}

/**
 * Start a team's analytics again from zero: every recorded open, tap and scan
 * on its cards is deleted and the all-time view counts go back to 0. Pass a
 * card id to reset that one card only.
 *
 * CONTACTS ARE NOT TOUCHED. A lead is a real person who left their details,
 * not a number, and a test one can be deleted on its own from the contacts
 * list. Irreversible, so the callers confirm first and write an audit entry.
 */
export async function resetTeamAnalytics(db: Db, orgId: string, cardId?: string | null): Promise<{ cards: number; eventsDeleted: number }> {
  let q = db.from('team_cards').select('id').eq('organization_id', orgId)
  if (cardId) q = q.eq('id', cardId)
  const { data: cards, error } = await q
  if (error) throw new Error(error.message)
  const ids = ((cards || []) as any[]).map(c => c.id)
  if (!ids.length) return { cards: 0, eventsDeleted: 0 }

  // Counted first so the caller can say what went. Then deleted in slices of
  // card ids, which keeps each request's filter a sensible size.
  const { count } = await db.from('team_card_events').select('id', { count: 'exact', head: true }).in('team_card_id', ids)
  for (let i = 0; i < ids.length; i += 100) {
    const slice = ids.slice(i, i + 100)
    const { error: delErr } = await db.from('team_card_events').delete().in('team_card_id', slice)
    if (delErr) throw new Error(`Could not clear the analytics: ${delErr.message}`)
    const { error: upErr } = await db.from('team_cards').update({ view_count: 0 }).in('id', slice)
    if (upErr) throw new Error(`Cleared the analytics, but could not reset the view counts: ${upErr.message}`)
  }
  return { cards: ids.length, eventsDeleted: count || 0 }
}
