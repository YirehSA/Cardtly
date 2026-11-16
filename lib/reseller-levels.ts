// Reseller levels (Andre, 2026-11-16): "get the resellers to levels ... to
// boost their sales".
//
// THE LEVELS. Starter until 100 cards sold, then Bronze at 100, Silver at 250,
// Gold at 500 and Platinum at 1000.
//
// WHAT COUNTS. Every card ever sold (Andre's choice), so a level is never
// lost. A card is a seat a reseller gave a client. Each client counts at the
// most seats it ever had on the reseller's bill, read from
// reseller_seat_months, which only ever rises. A client that later shrinks,
// pauses, cancels or moves off the bill keeps counting at its highest.
//
// THE REWARDS, as Andre chose them: better prices are "coming soon" (no
// figures promised yet), a listing on cardtly.com from Bronze, and from Gold
// the leads Cardtly receives in the reseller's area plus card themes only
// their clients can use.
//
// Pure and client-safe: the Reseller page, the admin screen and the emails
// all read the same table. Guarded by scripts/check-reseller-levels.

export type LevelKey = 'starter' | 'bronze' | 'silver' | 'gold' | 'platinum'

export interface ResellerLevel {
  key: LevelKey
  name: string
  /** Cards sold to reach it. */
  from: number
  /** The badge colour. Readable on the dark and the light dashboard. */
  colour: string
  /** What this level adds, in the reseller's words. */
  rewards: string[]
}

export const PRICES_COMING_SOON = 'Better prices on seats and NFC cards (coming soon)'

export const RESELLER_LEVELS: readonly ResellerLevel[] = [
  {
    key: 'starter', name: 'Starter', from: 0, colour: '#64748b',
    rewards: ['Your own Cardtly card, free', 'Your Reseller page, clients and invoices'],
  },
  {
    key: 'bronze', name: 'Bronze', from: 100, colour: '#b4743c',
    rewards: ['Listed on cardtly.com as a Bronze reseller', PRICES_COMING_SOON],
  },
  {
    key: 'silver', name: 'Silver', from: 250, colour: '#8f98a3',
    rewards: ['Listed above Bronze resellers on cardtly.com', PRICES_COMING_SOON],
  },
  {
    key: 'gold', name: 'Gold', from: 500, colour: '#c9a227',
    rewards: [
      'Leads Cardtly receives in your area',
      'Exclusive card themes only your clients can use',
      PRICES_COMING_SOON,
    ],
  },
  {
    key: 'platinum', name: 'Platinum', from: 1000, colour: '#5fa8c4',
    rewards: [
      'First in line for leads in your area',
      'Top of the reseller listing on cardtly.com',
      PRICES_COMING_SOON,
    ],
  },
] as const

const clean = (n: unknown) => Math.max(0, Math.floor(Number(n) || 0))

export function levelByKey(key: unknown): ResellerLevel {
  return RESELLER_LEVELS.find(l => l.key === key) || RESELLER_LEVELS[0]
}

/** The level a total of cards sold has reached. */
export function levelFor(cardsSold: unknown): ResellerLevel {
  const n = clean(cardsSold)
  let at = RESELLER_LEVELS[0]
  for (const l of RESELLER_LEVELS) if (n >= l.from) at = l
  return at
}

export function levelRank(key: unknown): number {
  return Math.max(0, RESELLER_LEVELS.findIndex(l => l.key === key))
}

export interface LevelProgress {
  cardsSold: number
  level: ResellerLevel
  next: ResellerLevel | null
  /** Cards still to sell for the next level; 0 at Platinum. */
  toNext: number
  /** 0 to 100, through the current level towards the next. 100 at Platinum. */
  percent: number
}

export function levelProgress(cardsSold: unknown): LevelProgress {
  const n = clean(cardsSold)
  const level = levelFor(n)
  const next = RESELLER_LEVELS[levelRank(level.key) + 1] || null
  if (!next) return { cardsSold: n, level, next: null, toNext: 0, percent: 100 }
  const span = next.from - level.from
  return {
    cardsSold: n, level, next,
    toNext: next.from - n,
    percent: Math.min(100, Math.max(0, Math.floor(((n - level.from) / span) * 100))),
  }
}

/** One line for the reseller: where they are and what is next. */
export function progressLine(p: LevelProgress): string {
  const cards = (n: number) => `${n} card${n === 1 ? '' : 's'}`
  if (!p.next) return `${cards(p.cardsSold)} sold. You are at Platinum, the top level.`
  return `${cards(p.cardsSold)} sold. ${cards(p.toNext)} more to ${p.next.name}.`
}

/**
 * Cards ever sold per reseller, from reseller_seat_months rows: each client
 * at the most seats it ever had, added up. Rows of other resellers are kept
 * apart. Pure, so the check can feed it rows.
 */
export function cardsEverSoldFrom(rows: Array<{ reseller_id: string; organization_id: string; peak_seats: unknown }>): Record<string, number> {
  const best = new Map<string, number>()
  for (const r of rows || []) {
    if (!r?.reseller_id || !r?.organization_id) continue
    const k = `${r.reseller_id}|${r.organization_id}`
    best.set(k, Math.max(best.get(k) || 0, clean(r.peak_seats)))
  }
  const out: Record<string, number> = {}
  for (const [k, seats] of best) {
    const id = k.split('|')[0]
    out[id] = (out[id] || 0) + seats
  }
  return out
}
