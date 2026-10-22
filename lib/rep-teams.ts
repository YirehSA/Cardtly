// After sales: how a rep's teams are doing, and which ones need a call.
//
// Andre, 2026-10-22: "If a team rep is allocated to that team, I want the rep
// to be able to monitor the teams belonging to him. Their cards' views, have
// the team members accepted their invites, how are the cards doing. So if they
// are struggling, to reach out to them to see if they need help. Like an after
// service."
//
// This file is the judgement, kept apart from the reading (lib/rep-teams-server)
// so scripts/check-rep-teams can test it without a database. Every flag is a
// plain sentence a rep can act on, and "needs a call" means there is something
// concrete to call about, never just a low number on a team set up yesterday.

export const INVITE_WAIT_DAYS = 7      // an invite older than this is "not accepted"
export const QUIET_DAYS = 30           // the window the numbers cover
export const SETTLE_DAYS = 14          // a team or card younger than this is not judged on opens
export const OWNER_AWAY_DAYS = 30      // an owner gone this long may have stalled
export const RENEW_NOTICE_DAYS = 30    // a prepaid team this close to its date is due a renewal chat
export const TRIAL_NOTICE_DAYS = 7

export type CardStatus = 'accepted' | 'waiting' | 'not_invited'
export type Tone = 'red' | 'amber' | 'green'
export interface Flag { tone: 'red' | 'amber' | 'blue'; text: string }

export interface CardInput {
  id: string
  name: string | null
  isActive: boolean
  userId: string | null
  inviteEmail: string | null
  inviteSentAt: string | null
  claimedAt: string | null
  createdAt: string | null
  hasPhoto: boolean
  opens: number      // in the last QUIET_DAYS
  saves: number
  leads: number
  lastOpenAt: string | null
}

export interface TeamInput {
  createdAt: string | null
  live: boolean
  suspended: boolean
  billingPeriod: string | null
  paidUntil: string | null
  trialEndsAt: string | null
  maxSeats: number
  ownerSignedInAt: string | null
  cards: CardInput[]
}

export interface TeamHealth {
  tone: Tone
  flags: Flag[]
  numbers: {
    seats: number; made: number; accepted: number; waiting: number; notInvited: number
    opens: number; saves: number; leads: number; openedCards: number
  }
}

const DAY = 24 * 60 * 60 * 1000
const daysSince = (iso: string | null | undefined, now: Date): number | null => {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? Math.floor((now.getTime() - t) / DAY) : null
}
/** Whole days from today to a YYYY-MM-DD date: 0 is today, negative has passed. */
const daysUntil = (date: string | null | undefined, now: Date): number | null => {
  if (!date) return null
  const d = new Date(String(date).slice(0, 10) + 'T00:00:00')
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Number.isFinite(d.getTime()) ? Math.round((d.getTime() - today.getTime()) / DAY) : null
}
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const names = (cards: CardInput[], max = 3) => {
  const list = cards.map(c => c.name?.trim() || c.inviteEmail || 'a card')
  return list.length > max ? `${list.slice(0, max).join(', ')} and ${list.length - max} more` : list.join(', ')
}
const short = (date: string) => new Date(String(date).slice(0, 10) + 'T00:00:00')
  .toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })

/** Has the person this card is for taken it over? */
export function cardStatus(c: Pick<CardInput, 'userId' | 'claimedAt' | 'inviteSentAt'>): CardStatus {
  if (c.userId || c.claimedAt) return 'accepted'
  if (c.inviteSentAt) return 'waiting'
  // Made and run by the owner. Common, and fine: not every company wants
  // each person editing their own card.
  return 'not_invited'
}

export function teamHealth(t: TeamInput, now = new Date()): TeamHealth {
  const flags: Flag[] = []
  const active = t.cards.filter(c => c.isActive)
  const age = daysSince(t.createdAt, now)
  const settled = age === null || age >= SETTLE_DAYS

  const accepted = t.cards.filter(c => cardStatus(c) === 'accepted')
  const waiting = t.cards.filter(c => cardStatus(c) === 'waiting')
  const notInvited = t.cards.filter(c => cardStatus(c) === 'not_invited')
  const opens = active.reduce((n, c) => n + c.opens, 0)
  const saves = active.reduce((n, c) => n + c.saves, 0)
  const leads = active.reduce((n, c) => n + c.leads, 0)
  const openedCards = active.filter(c => c.opens > 0).length

  // ── Cards not working at all ────────────────────────────────────────────
  if (t.suspended) flags.push({ tone: 'red', text: 'Suspended by Cardtly. Their cards show a notice instead of the card.' })
  if (!t.live && !t.suspended) {
    flags.push({
      tone: 'red',
      text: t.billingPeriod === 'prepaid' && !t.paidUntil
        ? 'Not live yet: their invoice has not been paid, so the cards are offline.'
        : 'Not live, so their cards are offline.',
    })
  }

  // ── Money dates worth a call before they arrive ─────────────────────────
  if (t.billingPeriod === 'prepaid' && t.paidUntil) {
    const left = daysUntil(t.paidUntil, now)
    if (left !== null && left < 0) flags.push({ tone: 'red', text: `Paid up to ${short(t.paidUntil)}, which has passed. Time for the renewal.` })
    else if (left !== null && left <= RENEW_NOTICE_DAYS) flags.push({ tone: 'amber', text: `Paid up to ${short(t.paidUntil)}, ${plural(left, 'day')} away. A good time to talk renewal.` })
  }
  if (t.billingPeriod === 'trial' && t.trialEndsAt) {
    const left = daysUntil(t.trialEndsAt, now)
    if (left !== null && left < 0) flags.push({ tone: 'red', text: `Their trial ended on ${short(t.trialEndsAt)}.` })
    else if (left !== null && left <= TRIAL_NOTICE_DAYS) flags.push({ tone: 'amber', text: `Their trial ends on ${short(t.trialEndsAt)}.` })
  }

  // ── Setting up ──────────────────────────────────────────────────────────
  if (t.cards.length === 0) {
    if (age !== null && age >= 3) flags.push({ tone: 'red', text: `No cards made yet, ${plural(age, 'day')} after the team was set up.` })
    else flags.push({ tone: 'blue', text: 'Just set up. No cards made yet.' })
  } else if (t.maxSeats > t.cards.length && (age === null || age >= 7)) {
    const empty = t.maxSeats - t.cards.length
    flags.push({ tone: 'amber', text: `${empty} of ${t.maxSeats} seats not used yet. They may need help adding their people.` })
  }

  const late = waiting.filter(c => (daysSince(c.inviteSentAt, now) ?? 0) >= INVITE_WAIT_DAYS)
  const fresh = waiting.filter(c => !late.includes(c))
  if (late.length) flags.push({ tone: 'amber', text: `${plural(late.length, 'invite')} not accepted after a week: ${names(late)}.` })
  if (fresh.length) flags.push({ tone: 'blue', text: `${plural(fresh.length, 'invite')} sent this week, not accepted yet.` })

  // ── Are the cards being used? ───────────────────────────────────────────
  if (t.live && active.length) {
    // Judged only on cards old enough to have been handed out.
    const judged = active.filter(c => {
      const a = daysSince(c.createdAt, now)
      return a === null || a >= SETTLE_DAYS
    })
    const quiet = judged.filter(c => c.opens === 0)
    if (settled && judged.length && quiet.length === judged.length) {
      flags.push({ tone: 'red', text: `None of their cards has been opened in ${QUIET_DAYS} days. They may not be sharing them.` })
    } else if (quiet.length) {
      flags.push({ tone: 'amber', text: `${quiet.length} of ${judged.length} cards not opened in ${QUIET_DAYS} days: ${names(quiet)}.` })
    }
  }

  // ── Is anybody looking after it? ────────────────────────────────────────
  const away = daysSince(t.ownerSignedInAt, now)
  if (t.ownerSignedInAt === null && (age === null || age >= 7)) {
    flags.push({ tone: 'amber', text: 'The owner has never signed in.' })
  } else if (away !== null && away >= OWNER_AWAY_DAYS) {
    flags.push({ tone: 'amber', text: `The owner last signed in ${plural(away, 'day')} ago.` })
  }

  const noPhoto = active.filter(c => !c.hasPhoto)
  if (noPhoto.length) flags.push({ tone: 'blue', text: `${plural(noPhoto.length, 'card')} without a photo: ${names(noPhoto)}.` })

  const tone: Tone = flags.some(f => f.tone === 'red') ? 'red' : flags.some(f => f.tone === 'amber') ? 'amber' : 'green'
  // Worst first, so the top line is the reason to call.
  const rank = { red: 0, amber: 1, blue: 2 }
  flags.sort((a, b) => rank[a.tone] - rank[b.tone])

  return {
    tone,
    flags,
    numbers: {
      seats: t.maxSeats, made: t.cards.length, accepted: accepted.length, waiting: waiting.length,
      notInvited: notInvited.length, opens, saves, leads, openedCards,
    },
  }
}

export const TONE_META: Record<Tone, { label: string; colour: string }> = {
  red: { label: 'Needs a call', colour: '#ef4444' },
  amber: { label: 'Keep an eye on', colour: '#f59e0b' },
  green: { label: 'Doing well', colour: '#22c55e' },
}
