// Moving a team owner's PERSONAL card into their team, as one of its seats.
//
// WHY. A company's administrator usually makes their own card before the team
// exists, or before anybody tells them it should live inside it. It then sits
// outside the team as a seventh card on a six-seat plan, and - because a
// personal card is served by its owner's own subscription or trial, never by
// the team - it goes offline when their signup trial ends, while their company
// is paying. JETOUR Bryanston's administrator was the first (2026-10-07): six
// seats invoiced, the owner's card outside them, its trial ending a week later.
//
// WHAT IT DOES, in an order that can be undone at every step until the last:
//   1. checks it is the owner's card, the team has a free seat, and the owner
//      does not already hold a card in the team
//   2. moves the personal card off its link (a temporary slug), so the team
//      card can take the SAME link - anything printed or shared keeps working
//   3. creates the team card from the personal card's contents, claimed by the
//      owner, so it is theirs to edit and is served by the team
//   4. moves the contacts it captured and its bookings across
//   5. deletes the personal card, its view history and its old-link redirects
// If step 3 fails, step 2 is put back and nothing has changed.
//
// Columns are copied by name. The two tables share every field the editor
// writes; the personal one also carries a long tail of legacy columns the team
// table never had. Anything the team table refuses is dropped and REPORTED,
// never silently lost, so a non-empty value left behind is visible to whoever
// pressed the button.

type Db = any

// Never copied: identity, ownership and personal-card bookkeeping. Everything
// else with a value is offered to team_cards.
const NOT_COPIED = new Set([
  'id', 'user_id', 'org_id', 'team_id', 'member_user_id', 'assigned_user_id',
  'is_primary', 'archived', 'slug', 'created_at', 'updated_at',
])

export interface MoveResult {
  ok: boolean
  error?: string
  teamCardId?: string
  slug?: string
  contactsMoved?: number
  bookingsMoved?: number
  /** Columns that had a value on the personal card but do not exist on team cards. */
  notCarried?: string[]
}

const slugifyName = (s: string) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'card'

export async function movePersonalCardIntoTeam(db: Db, opts: { orgId: string; cardId: string }): Promise<MoveResult> {
  const { data: org } = await db.from('organizations')
    .select('id, name, admin_user_id, max_seats').eq('id', opts.orgId).maybeSingle()
  if (!org) return { ok: false, error: 'No such team.' }

  const { data: card } = await db.from('cards').select('*').eq('id', opts.cardId).maybeSingle()
  if (!card) return { ok: false, error: 'No such card.' }
  if (card.user_id !== org.admin_user_id) {
    return { ok: false, error: 'That card does not belong to this team’s owner.' }
  }
  // Parked by a move already under way (two tabs, or a page load racing the
  // admin button). The first one finishes it; this one stays out of the way.
  if (String(card.slug || '').includes('--moving-')) {
    return { ok: false, error: 'This card is already being moved.' }
  }

  const { data: teamCards } = await db.from('team_cards').select('id, user_id').eq('organization_id', org.id)
  if ((teamCards || []).some((t: any) => t.user_id === org.admin_user_id)) {
    return { ok: false, error: 'The owner already holds a card in this team.' }
  }
  const used = (teamCards || []).length
  if (used >= Number(org.max_seats || 0)) {
    return { ok: false, error: `All ${org.max_seats} seats are taken, so there is no seat for this card. Add a seat or remove a card first.` }
  }

  // 2. Free the link for the team card, keeping a way back.
  const originalSlug: string = card.slug
  const parkedSlug = `${originalSlug}--moving-${Date.now().toString(36)}`
  const { error: parkErr } = await db.from('cards').update({ slug: parkedSlug }).eq('id', card.id)
  if (parkErr) return { ok: false, error: `Could not free the card's link: ${parkErr.message}` }
  const unpark = () => db.from('cards').update({ slug: originalSlug }).eq('id', card.id)

  // 3. The team card. Only columns with a value are offered; any the team table
  // does not have are dropped one by one and reported.
  const fields: Record<string, any> = {}
  for (const [k, v] of Object.entries(card)) {
    if (NOT_COPIED.has(k)) continue
    if (v === null || v === undefined || v === '') continue
    fields[k] = v
  }
  Object.assign(fields, {
    organization_id: org.id,
    user_id: org.admin_user_id,
    claimed_at: new Date().toISOString(),
    is_active: true,
    slug: originalSlug,
    slug_person: slugifyName(card.name),
  })

  const notCarried: string[] = []
  let teamCard: any = null
  for (let attempt = 0; attempt < 60; attempt++) {
    const { data, error } = await db.from('team_cards').insert(fields).select('id, slug').maybeSingle()
    if (!error) { teamCard = data; break }
    // PostgREST: "Could not find the 'awards' column of 'team_cards' in the schema cache"
    const missing = String(error.message || '').match(/'([^']+)' column/)?.[1]
    if (missing && missing in fields && !['organization_id', 'user_id', 'slug'].includes(missing)) {
      delete fields[missing]
      notCarried.push(missing)
      continue
    }
    await unpark()
    return { ok: false, error: `Could not create the team card: ${error.message}` }
  }
  if (!teamCard) {
    await unpark()
    return { ok: false, error: 'Could not create the team card.' }
  }

  // 4. What the card collected goes with it.
  const { data: movedContacts } = await db.from('contacts')
    .update({ team_card_id: teamCard.id, card_id: null }).eq('card_id', card.id).select('id')
  // Bookings carry the card's id in card_id whichever kind of card it is (see
  // app/api/bookings/request), so they are re-pointed rather than split.
  let bookingsMoved = 0
  try {
    const { data: movedBookings, error: bErr } = await db.from('bookings')
      .update({ card_id: teamCard.id }).eq('card_id', card.id).select('id')
    if (!bErr) bookingsMoved = (movedBookings || []).length
  } catch { /* checked below */ }

  // Nothing the card collected may be lost with it. If a booking could not be
  // moved, keep the old card (on its parked link) rather than delete it.
  const [{ count: bookingsLeft }, { count: contactsLeft }] = await Promise.all([
    db.from('bookings').select('id', { count: 'exact', head: true }).eq('card_id', card.id),
    db.from('contacts').select('id', { count: 'exact', head: true }).eq('card_id', card.id),
  ])
  if (bookingsLeft || contactsLeft) {
    return {
      ok: true, teamCardId: teamCard.id, slug: teamCard.slug,
      contactsMoved: (movedContacts || []).length, bookingsMoved, notCarried,
      error: `Moved. ${contactsLeft || 0} contact(s) and ${bookingsLeft || 0} booking(s) could not be moved, so the old personal card was kept on an unused link instead of being deleted.`,
    }
  }

  // 5. The personal card goes. Its view history is not carried: the team card
  // starts its own count, which is what a card in a new home should do.
  await db.from('card_events').delete().eq('card_id', card.id)
  await db.from('slug_redirects').delete().eq('card_id', card.id)
  const { error: delErr } = await db.from('cards').delete().eq('id', card.id)
  if (delErr) {
    // The team card exists and serves the link; the leftover personal card is
    // only clutter, on a parked link nobody has. Report it rather than undo.
    return {
      ok: true, teamCardId: teamCard.id, slug: teamCard.slug,
      contactsMoved: (movedContacts || []).length, bookingsMoved, notCarried,
      error: `Moved, but the old personal card could not be removed (${delErr.message}). It is on an unused link and can be deleted by hand.`,
    }
  }

  return {
    ok: true, teamCardId: teamCard.id, slug: teamCard.slug,
    contactsMoved: (movedContacts || []).length, bookingsMoved, notCarried,
  }
}
