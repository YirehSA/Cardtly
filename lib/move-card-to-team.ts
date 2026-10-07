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
//   4. moves what the card collected: contacts, bookings, its view history
//      (team cards keep theirs in team_card_events), reports and Network
//      blocks, and any team or department look that follows it
//   5. deletes the personal card; its old-link redirects stay, unattached, so
//      a link from before a rename still lands on the same address
// If step 3 fails, step 2 is put back and nothing has changed. If anything in
// step 4 cannot be moved, the personal card is kept rather than deleted.
//
// WHAT A TEAM CARD HAS NO PLACE FOR. A personal card carries more than a team
// card can hold: extra phone numbers, links 11 to 20, link images, forty-odd
// social platforms, badges, branches. Measured on 2026-10-07, every personal
// card also carries seven editor settings blobs team cards have no column for.
// Those split two ways:
//   - SETTINGS (how it looked): dropped, and the card keeps its look through
//     color_theme, which does carry
//   - CONTENT (what a visitor sees): an AUTOMATIC move refuses to drop it
//     (requireLossless), because the owner would find it gone from their live
//     card with nobody having asked. An admin can still move it deliberately.
// Whatever is dropped is returned in `dropped`, values included, for the audit
// log: nothing leaves the database without a record of what it was.

type Db = any

// Never copied: identity, ownership and personal-card bookkeeping.
// view_count is rebuilt instead: copying it AND the view history would count
// every view twice, because a trigger on team_card_events bumps it per row.
const NOT_COPIED = new Set([
  'id', 'user_id', 'org_id', 'team_id', 'member_user_id', 'assigned_user_id',
  'is_primary', 'archived', 'slug', 'created_at', 'updated_at', 'view_count',
])

// team_cards' columns, read from the live schema on 2026-10-07. Used only to
// decide in advance whether an automatic move would drop content. A column
// added to both tables later and not added here reads as personal-only, which
// makes an automatic move refuse rather than lose something: the safe way to
// be out of date. The move itself does not trust this list - it offers every
// value and lets the database say what it lacks.
export const TEAM_CARD_COLUMNS = new Set(`
  id organization_id name title company email phone work_phone whatsapp website
  address bio linkedin_url twitter_url instagram_url profile_image_url
  company_logo_url certifications color_theme slug is_active link_1_title
  link_1_url link_2_title link_2_url link_3_title link_3_url link_4_title
  link_4_url link_5_title link_5_url created_at updated_at image_1_url
  image_2_url image_3_url image_4_url image_5_url facebook_url image_1_link
  image_2_link image_3_link image_4_link image_5_link image_6_url image_6_link
  user_id invite_email invite_token invite_sent_at claimed_at view_count
  allow_homepage_feature addons use_team_brand use_team_questionnaire
  department_id industry hide_from_network org_hide_from_network slug_person
  redirect_to_slug youtube tiktok link_6_title link_6_url link_7_title
  link_7_url link_8_title link_8_url link_9_title link_9_url link_10_title
  link_10_url image_7_url image_7_link image_8_url image_8_link image_9_url
  image_9_link image_10_url image_10_link image_1_title image_2_title
  image_3_title image_4_title image_5_title image_6_title image_7_title
  image_8_title image_9_title image_10_title hero_image_url
`.trim().split(/\s+/))

// Personal-only columns that only say how the card LOOKED. Losing them changes
// a detail of the look, never what the card says.
export const SETTINGS_ONLY = new Set([
  'visible_sections', 'signature_style', 'background_style', 'next_gen_mask_settings',
  'grand_settings', 'minimal_settings', 'email_signature_settings', 'design_variant_id',
  'profile_image_size', 'company_logo_size', 'company_logo_position', 'company_logo_x_pct',
  'company_logo_y_pct', 'company_logo_scale_pct', 'logo_position_id', 'logo_background_color',
  'logo_background_transparent', 'card_background_color', 'card_text_color', 'heading_color',
  'qr_code_color', 'qr_background_color', 'font_family', 'badges_title', 'branches_title',
  'phone_label', 'template_id', 'template_locked_fields', 'slug_prefix', 'slug_suffix',
  'slug_user_part', 'team_name',
])

/** A value somebody actually put there, as opposed to empty or untouched. */
function hasValue(v: unknown): boolean {
  if (v === null || v === undefined || v === false) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.keys(v as object).length > 0
  return true
}

/**
 * The CONTENT on this personal card that a team card has no place for: the
 * columns a visitor would see disappear. Empty means a move loses nothing
 * anybody would notice.
 */
export function contentThatWouldNotCarry(card: Record<string, any>): string[] {
  return Object.keys(card).filter(k =>
    !NOT_COPIED.has(k) && !TEAM_CARD_COLUMNS.has(k) && !SETTINGS_ONLY.has(k) && hasValue(card[k]))
}

/** Plain-language names for the content columns, for messages to a person. */
export function describeColumns(cols: string[]): string {
  const label = (c: string) => {
    if (c === 'phone_numbers') return 'extra phone numbers'
    if (/^link_\d+_image_url$/.test(c)) return 'link images'
    if (/^link_\d+_(title|url)$/.test(c)) return 'links 11 to 20'
    if (/^profile_image_\d_url$/.test(c)) return 'extra profile photos'
    if (/^image_\d+_link_url$/.test(c)) return 'gallery links'
    if (c.startsWith('social_share_')) return 'the share preview'
    return c.replace(/_/g, ' ')
  }
  return [...new Set(cols.map(label))].join(', ')
}

export interface MoveResult {
  ok: boolean
  error?: string
  teamCardId?: string
  slug?: string
  contactsMoved?: number
  bookingsMoved?: number
  eventsMoved?: number
  /** Columns that had a value on the personal card but do not exist on team cards. */
  notCarried?: string[]
  /** Their values, for the audit log. Never sent to a browser. */
  dropped?: Record<string, any>
  /** Set when an automatic move refused: the content it would have dropped. */
  wouldLose?: string[]
}

const slugifyName = (s: string) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'card'

const EVENT_PAGE = 500

/**
 * Copy a personal card's view history onto its team card. team_card_events has
 * no country or city columns, so those ride along in metadata rather than
 * being lost. Paged, because PostgREST stops at 1000 rows and an owner's card
 * can have far more.
 */
async function copyViewHistory(db: Db, cardId: string, teamCardId: string): Promise<{ ok: boolean; copied: number; error?: string }> {
  let copied = 0
  for (let from = 0; ; from += EVENT_PAGE) {
    const { data, error } = await db.from('card_events').select('*').eq('card_id', cardId)
      .order('id', { ascending: true }).range(from, from + EVENT_PAGE - 1)
    if (error) return { ok: false, copied, error: error.message }
    const rows = data || []
    if (rows.length) {
      const { error: insErr } = await db.from('team_card_events').insert(rows.map((e: any) => {
        const where = { ...(e.country ? { country: e.country } : {}), ...(e.city ? { city: e.city } : {}) }
        const meta = e.metadata && typeof e.metadata === 'object' ? e.metadata : {}
        return {
          team_card_id: teamCardId,
          event_type: e.event_type,
          link_title: e.link_title ?? null,
          device: e.device ?? null,
          browser: e.browser ?? null,
          os: e.os ?? null,
          referrer: e.referrer ?? null,
          created_at: e.created_at,
          visitor_hash: e.visitor_hash ?? null,
          metadata: Object.keys(where).length ? { ...meta, ...where } : (e.metadata ?? null),
        }
      }))
      if (insErr) return { ok: false, copied, error: insErr.message }
      copied += rows.length
    }
    if (rows.length < EVENT_PAGE) return { ok: true, copied }
  }
}

/** Point any team or department look that follows the personal card at the team card. */
async function repointBrandSources(db: Db, ownerId: string, cardId: string, teamCardId: string): Promise<number> {
  const follows = (v: any) => v && v.table === 'cards' && v.id === cardId
  const next = { table: 'team_cards', id: teamCardId }
  let n = 0
  // select('*') for the reason lib/brand-source gives: naming a column a hand-
  // applied migration has not added returns nothing, which would look like
  // nothing to repoint.
  const { data: orgs } = await db.from('organizations').select('*').eq('admin_user_id', ownerId)
  for (const o of orgs || []) {
    if (follows(o.brand_source)) {
      const { error } = await db.from('organizations').update({ brand_source: next }).eq('id', o.id)
      if (!error) n++
    }
    const { data: depts } = await db.from('departments').select('*').eq('organization_id', o.id)
    for (const d of depts || []) {
      if (!follows(d.brand_source)) continue
      const { error } = await db.from('departments').update({ brand_source: next }).eq('id', d.id)
      if (!error) n++
    }
  }
  return n
}

export async function movePersonalCardIntoTeam(
  db: Db,
  opts: { orgId: string; cardId: string; requireLossless?: boolean },
): Promise<MoveResult> {
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

  // An automatic move never takes content off somebody's live card.
  const wouldLose = contentThatWouldNotCarry(card)
  if (opts.requireLossless && wouldLose.length) {
    return {
      ok: false, wouldLose,
      error: `Not moved automatically: the card has ${describeColumns(wouldLose)}, which a team card has no place for. Move it from Admin, Teams if losing that is fine.`,
    }
  }

  // 2. Free the link for the team card, keeping a way back.
  const originalSlug: string = card.slug
  const parkedSlug = `${originalSlug}--moving-${Date.now().toString(36)}`
  const { error: parkErr } = await db.from('cards').update({ slug: parkedSlug }).eq('id', card.id)
  if (parkErr) return { ok: false, error: `Could not free the card's link: ${parkErr.message}` }
  const unpark = () => db.from('cards').update({ slug: originalSlug }).eq('id', card.id)

  // 3. The team card. Every column with a value is offered; any the team table
  // does not have is dropped one by one and reported, with its value.
  const fields: Record<string, any> = {}
  for (const [k, v] of Object.entries(card)) {
    if (NOT_COPIED.has(k)) continue
    // Empty is left to the team table's default. false is a value (a switch
    // somebody turned off), so it is offered.
    if (v !== false && !hasValue(v)) continue
    fields[k] = v
  }
  // A vanity redirect onto its own link would send the card round in a loop.
  if (fields.redirect_to_slug === originalSlug) delete fields.redirect_to_slug
  Object.assign(fields, {
    organization_id: org.id,
    user_id: org.admin_user_id,
    claimed_at: new Date().toISOString(),
    is_active: true,
    slug: originalSlug,
    slug_person: slugifyName(card.name),
  })

  const notCarried: string[] = []
  const dropped: Record<string, any> = {}
  let teamCard: any = null
  for (let attempt = 0; attempt < 200; attempt++) {
    const { data, error } = await db.from('team_cards').insert(fields).select('id, slug').maybeSingle()
    if (!error) { teamCard = data; break }
    // PostgREST: "Could not find the 'awards' column of 'team_cards' in the schema cache"
    const missing = String(error.message || '').match(/'([^']+)' column/)?.[1]
    if (missing && missing in fields && !['organization_id', 'user_id', 'slug'].includes(missing)) {
      dropped[missing] = fields[missing]
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
  // Reports and Network blocks name exactly one of the two card kinds (a check
  // constraint), so both columns change in the one update.
  for (const t of ['card_reports', 'network_blocks']) {
    try { await db.from(t).update({ card_id: null, team_card_id: teamCard.id }).eq('card_id', card.id) } catch { /* checked below */ }
  }
  const events = await copyViewHistory(db, card.id, teamCard.id)
  if (!events.ok) {
    // The team card is brand new, so everything on it came from this copy.
    // Take the partial copy back off; the personal card keeps the original.
    await db.from('team_card_events').delete().eq('team_card_id', teamCard.id)
  } else if (typeof card.view_count === 'number') {
    // The trigger counted the copied views; the personal card's own count is
    // the all-time figure, including any from before events were kept.
    await db.from('team_cards').update({ view_count: card.view_count }).eq('id', teamCard.id)
  }
  await repointBrandSources(db, org.admin_user_id, card.id, teamCard.id)

  const base = {
    teamCardId: teamCard.id, slug: teamCard.slug,
    contactsMoved: (movedContacts || []).length, bookingsMoved,
    eventsMoved: events.ok ? events.copied : 0, notCarried, dropped,
  }

  // Nothing the card collected may be lost with it. If anything could not be
  // moved, keep the old card (on its parked link) rather than delete it.
  const left = async (t: string) =>
    (await db.from(t).select('id', { count: 'exact', head: true }).eq('card_id', card.id)).count || 0
  const [bookingsLeft, contactsLeft, reportsLeft, blocksLeft] = await Promise.all(
    ['bookings', 'contacts', 'card_reports', 'network_blocks'].map(left))
  if (bookingsLeft || contactsLeft || reportsLeft || blocksLeft || !events.ok) {
    const what = [
      contactsLeft ? `${contactsLeft} contact(s)` : '',
      bookingsLeft ? `${bookingsLeft} booking(s)` : '',
      reportsLeft || blocksLeft ? `${reportsLeft + blocksLeft} report(s) or block(s)` : '',
      events.ok ? '' : `its view history (${events.error})`,
    ].filter(Boolean).join(', ')
    return {
      ok: true, ...base,
      error: `Moved, but ${what} could not be moved, so the old personal card was kept on an unused link instead of being deleted.`,
    }
  }

  // 5. The personal card goes. Its view history now lives on the team card.
  // Old-link redirects are kept but unattached: they redirect by slug, and the
  // team card holds the same slug, so a link from before a rename still works.
  await db.from('card_events').delete().eq('card_id', card.id)
  await db.from('slug_redirects').update({ card_id: null }).eq('card_id', card.id)
  // A rate-limit log of contact-form posts; it outlives the card it names.
  try { await db.from('contact_submissions').update({ card_id: null }).eq('card_id', card.id) } catch { /* the delete reports it */ }
  const { error: delErr } = await db.from('cards').delete().eq('id', card.id)
  if (delErr) {
    // The team card exists and serves the link; the leftover personal card is
    // only clutter, on a parked link nobody has. Report it rather than undo.
    return {
      ok: true, ...base,
      error: `Moved, but the old personal card could not be removed (${delErr.message}). It is on an unused link and can be deleted by hand.`,
    }
  }

  return { ok: true, ...base }
}
