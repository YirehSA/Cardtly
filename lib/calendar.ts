// Calendar arithmetic, done on the wall calendar.
//
// Everything here works in local time and steps by calendar units - never by
// adding milliseconds. Counting elapsed ms and dividing by 86,400,000 is how
// "60 days" once came out as 61 in this codebase: an hour change or a month
// boundary makes the arithmetic drift, and a calendar is entirely about the
// dates people see in front of them.
//
// No imports on purpose. This file is pure and can be compiled and run on its
// own, which is how the date maths gets tested.

export type CalendarView = 'month' | 'week' | 'day' | 'list'

export const MINUTES_PER_DAY = 1440

// Monday. A South African working week starts on Monday and every wall
// calendar here is printed that way, so a Sunday-first grid reads wrong.
export const WEEK_STARTS_ON = 1

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  // setDate handles month ends and any clock change for us: 31 Jan + 1 day is
  // 1 Feb, not "the 32nd".
  x.setDate(x.getDate() + n)
  return x
}

export function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60_000)
}

export function addMonths(d: Date, n: number): Date {
  // Anchored on the 1st. Going through setMonth on the 31st of January lands
  // you on 3 March, because February has no 31st - so the day is never carried.
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  // getDay() is 0 for Sunday, so on a Monday-first week Sunday is 6 days in.
  const shift = (x.getDay() - WEEK_STARTS_ON + 7) % 7
  return addDays(x, -shift)
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

/** Local calendar date as YYYY-MM-DD. Never toISOString, which is UTC and
 *  shifts the date either side of midnight. */
export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Local wall time as HH:MM. */
export function timeKey(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Minutes since local midnight. */
export function minutesInto(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

/** Parse a YYYY-MM-DD + HH:MM pair as LOCAL time. new Date('2026-07-30') alone
 *  is parsed as UTC by spec, which lands on the 29th in a negative offset and
 *  is a classic off-by-one-day. */
export function fromDateTimeParts(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = (time || '09:00').split(':').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0)
}

/** The 42 days a month grid shows: six full weeks from the Monday on or before
 *  the 1st. Always six rows, so the grid does not change height month to month
 *  and the page does not jump under your cursor. */
export function monthMatrix(anchor: Date): Date[] {
  const first = startOfWeek(startOfMonth(anchor))
  return Array.from({ length: 42 }, (_, i) => addDays(first, i))
}

export function weekMatrix(anchor: Date): Date[] {
  const first = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, i) => addDays(first, i))
}

/** The days a view covers. `to` is exclusive. List has no range: it is
 *  deliberately every meeting, whatever period the calendar is parked on. */
export function viewRange(view: CalendarView, anchor: Date): { from: Date; to: Date } | null {
  if (view === 'list') return null
  if (view === 'day') {
    const from = startOfDay(anchor)
    return { from, to: addDays(from, 1) }
  }
  if (view === 'week') {
    const from = startOfWeek(anchor)
    return { from, to: addDays(from, 7) }
  }
  const from = startOfWeek(startOfMonth(anchor))
  return { from, to: addDays(from, 42) }
}

/** Step one period forward or back. */
export function shiftAnchor(view: CalendarView, anchor: Date, direction: -1 | 1): Date {
  if (view === 'month') return addMonths(anchor, direction)
  if (view === 'week') return addDays(startOfWeek(anchor), direction * 7)
  if (view === 'day') return addDays(startOfDay(anchor), direction)
  return anchor
}

const LOCALE = 'en-ZA'

export function periodLabel(view: CalendarView, anchor: Date): string {
  if (view === 'list') return 'Every meeting'
  if (view === 'day') {
    return anchor.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }
  if (view === 'week') {
    const from = startOfWeek(anchor)
    const to = addDays(from, 6)
    // Assembled by hand rather than left to the locale, which zero-pads the day
    // when a month is present and does not when it is absent: asking it twice
    // for one label produced "27 Jul to 02 Aug 2026".
    const day = (d: Date) => String(d.getDate())
    const mon = (d: Date) => d.toLocaleDateString(LOCALE, { month: 'short' })
    const left = isSameMonth(from, to) ? day(from) : `${day(from)} ${mon(from)}`
    return `${left} to ${day(to)} ${mon(to)} ${to.getFullYear()}`
  }
  return anchor.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' })
}

export function shortDayNames(): string[] {
  // Derived from a real week rather than hard-coded, so it follows
  // WEEK_STARTS_ON and the locale instead of drifting from them.
  const base = startOfWeek(new Date(2026, 0, 5)) // a Monday
  return Array.from({ length: 7 }, (_, i) =>
    addDays(base, i).toLocaleDateString(LOCALE, { weekday: 'short' }))
}

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** "1h 30m", "45m", "2h". */
export function fmtDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (h === 0) return `${rest}m`
  if (rest === 0) return `${h}h`
  return `${h}h ${rest}m`
}

// ── Overlap layout ─────────────────────────────────────────────────────────
//
// Two meetings at the same time have to sit side by side, not on top of each
// other. Items are grouped into clusters that actually overlap, lanes are
// handed out greedily inside each cluster, and the width is divided by the
// lanes that cluster needed - so one double-booked morning does not squeeze
// the whole day into thin slivers.

export interface Span {
  startMin: number
  endMin: number
}

export interface Placed<T> extends Span {
  item: T
  lane: number
  lanes: number
}

const MIN_BLOCK_MINUTES = 20

export function layoutColumn<T>(items: T[], span: (t: T) => Span): Placed<T>[] {
  const spans = items.map(item => {
    const s = span(item)
    const startMin = Math.max(0, Math.min(MINUTES_PER_DAY, s.startMin))
    // A zero-length meeting would be invisible and unclickable, so every block
    // gets a floor for layout purposes only.
    const endMin = Math.min(MINUTES_PER_DAY, Math.max(s.endMin, startMin + MIN_BLOCK_MINUTES))
    return { item, startMin, endMin }
  })
  spans.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

  const out: Placed<T>[] = []
  let cluster: Array<{ item: T; startMin: number; endMin: number; lane: number }> = []
  let clusterEnd = -1
  let laneEnds: number[] = []

  const flush = () => {
    const lanes = Math.max(1, laneEnds.length)
    for (const c of cluster) out.push({ ...c, lanes })
    cluster = []
    laneEnds = []
    clusterEnd = -1
  }

  for (const s of spans) {
    // A gap with nothing running means the previous pile-up is finished and the
    // next one starts over at full width.
    if (cluster.length > 0 && s.startMin >= clusterEnd) flush()
    let lane = laneEnds.findIndex(end => end <= s.startMin)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(s.endMin)
    } else {
      laneEnds[lane] = s.endMin
    }
    cluster.push({ ...s, lane })
    clusterEnd = Math.max(clusterEnd, s.endMin)
  }
  if (cluster.length > 0) flush()

  return out
}

/** The hours a time grid has to show. Starts at the working day and stretches
 *  to cover anything booked outside it - an 06:30 breakfast meeting must not be
 *  scrolled off the top of its own calendar. */
export function hourBounds(spans: Span[], defaultStart = 7, defaultEnd = 18): { startHour: number; endHour: number } {
  let startHour = defaultStart
  let endHour = defaultEnd
  for (const s of spans) {
    startHour = Math.min(startHour, Math.floor(s.startMin / 60))
    endHour = Math.max(endHour, Math.ceil(s.endMin / 60))
  }
  startHour = Math.max(0, Math.min(startHour, 23))
  endHour = Math.min(24, Math.max(endHour, startHour + 1))
  return { startHour, endHour }
}

// ── Colour per rep ─────────────────────────────────────────────────────────
//
// Derived from the id rather than stored, so a rep gets a stable colour the
// moment they exist with nothing to configure and nothing to keep in step.

const REP_PALETTE = [
  '#0ea5e9', '#a855f7', '#22c55e', '#f59e0b', '#ec4899',
  '#14b8a6', '#8b5cf6', '#84cc16', '#f97316', '#06b6d4',
]

export function repColour(id: string | null | undefined): string {
  if (!id) return REP_PALETTE[0]
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return REP_PALETTE[Math.abs(h) % REP_PALETTE.length]
}
