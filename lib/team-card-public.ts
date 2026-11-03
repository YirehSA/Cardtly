// The parts of a team_cards row that are not the card: the invite.
//
// invite_token is the whole of a claim. /api/team/claim takes a token and a
// password and makes an account for the invited address, signed in, with the
// card on it. invite_email is the address of somebody who may never have
// agreed to anything yet.
//
// Until 2026-11-03 both went out in public. The card page read team_cards with
// select('*') and handed the row to PublicCardView, a client component, so the
// token and the email of every unclaimed staff card were in its own page's
// HTML; and the anon key, which ships in every browser, could read both columns
// for every card. Anyone who opened an unclaimed staff card could have claimed
// it.
//
// Two fixes, each enough on its own for the HTML and together for the database:
//   1. anything that goes to a browser passes through publicTeamCard() first;
//   2. migration 101 takes these columns away from anon and authenticated, so
//      only the service role (server routes) can read them at all.
// scripts/check-team-card-privacy holds both in place.

export const TEAM_CARD_PRIVATE_COLUMNS = ['invite_token', 'invite_email', 'invite_sent_at'] as const

/** The row without its invite, for anything a browser will see. */
export function publicTeamCard<T>(row: T): T {
  if (!row || typeof row !== 'object') return row
  const out = { ...(row as Record<string, unknown>) }
  for (const c of TEAM_CARD_PRIVATE_COLUMNS) delete out[c]
  return out as T
}
