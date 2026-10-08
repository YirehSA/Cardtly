// The team brand: fields that are shared across a team and controlled
// centrally by the org admin. Everything NOT in this list is personal
// (name, title, email, phone, whatsapp, profile_image_url) and stays
// editable per member.
//
// EVERY LOCK MEANS THE SAME THING (2026-10-08): locked, the item comes from
// the team look on every card wearing it, and is greyed out there for
// everybody. The one deliberate exception is the job title, which is per
// person by nature: locked, only an admin sets each one (see lib/team-locks).

export const BRAND_FIELDS = [
  'company',
  'company_logo_url',
  'website',
  'address',
  // The office number is the company's switchboard, like its address, so it
  // is part of the look (2026-10-08). It used to be personal, which made its
  // lock mean only "an admin types it in, card by card": JETOUR locked it
  // expecting every card to show the main card's number and found each card
  // still carrying, and an admin still typing, its own. Locked, it now comes
  // from the look on every card wearing it; open, a person's own number wins
  // and the look's fills in for anyone who has none.
  'work_phone',
  // The bio, ONLY when locked (LOCKED_ONLY_FIELDS). Its lock promised "the same
  // wording about the business on every card" while the look never carried
  // it, so locking it froze each card's own bio instead. Locked, it now comes
  // from the look. Left open it never fills a blank: the look's card is
  // somebody's own, usually written in the first person, and "As the Sales
  // Manager, I..." is not something to put on a colleague's card unasked.
  'bio',
  'color_theme',            // design: template, colours, fonts
  'linkedin_url',
  'twitter_url',
  'instagram_url',
  'facebook_url',
  'youtube',
  'tiktok',
  'link_1_title', 'link_1_url',
  'link_2_title', 'link_2_url',
  'link_3_title', 'link_3_url',
  'link_4_title', 'link_4_url',
  'link_5_title', 'link_5_url',
  'link_6_title', 'link_6_url',
  'link_7_title', 'link_7_url',
  'link_8_title', 'link_8_url',
  'link_9_title', 'link_9_url',
  'link_10_title', 'link_10_url',
  'certifications',
  // THE CAPTION TRAVELS WITH THE PHOTO. image_N_title arrived with migration
  // 087 and was not added here, which left it locked by the images group and
  // supplied by nothing: an org that set its gallery on the brand pushed ten
  // photos to forty cards and forty blank captions with them, with no member
  // able to type one. On Showroom the caption is the price, so the fleet went
  // out as stock photographs with no prices under them. Same shape as the
  // Vistly certifications defect - a field a lock closes and a brand never
  // fills is a field nobody can set.
  'image_1_url', 'image_1_link', 'image_1_title',
  'image_2_url', 'image_2_link', 'image_2_title',
  'image_3_url', 'image_3_link', 'image_3_title',
  'image_4_url', 'image_4_link', 'image_4_title',
  'image_5_url', 'image_5_link', 'image_5_title',
  'image_6_url', 'image_6_link', 'image_6_title',
  'image_7_url', 'image_7_link', 'image_7_title',
  'image_8_url', 'image_8_link', 'image_8_title',
  'image_9_url', 'image_9_link', 'image_9_title',
  'image_10_url', 'image_10_link', 'image_10_title',
  // The Showroom hero (migration 088). A photograph like the gallery, so it is
  // brand-managed and lockable with them, and excluded from the copyable look
  // below for the same reason they are.
  'hero_image_url',
] as const

export type BrandField = typeof BRAND_FIELDS[number]

/**
 * Look fields that apply only where the company has LOCKED them. Every other
 * look field also fills in a card that has left it blank; these never do.
 */
export const LOCKED_ONLY_FIELDS: ReadonlySet<string> = new Set(['bio'])

/**
 * The look copied when a new team card is started from an existing one.
 *
 * Everything the brand covers except the company name and the gallery: the name
 * comes from the organisation anyway, and somebody's photographs are theirs
 * rather than part of a house style.
 *
 * Derived from BRAND_FIELDS rather than listed again. The two places that copy
 * a card - adding one by hand and importing a spreadsheet - each had their own
 * copy of this list, both stopping at link 5, so a card with six links lost the
 * sixth the moment anyone copied it.
 */
export const COPYABLE_LOOK_FIELDS: string[] =
  BRAND_FIELDS.filter(f =>
    f !== 'company' &&
    // Somebody's own words, not part of a house style to start a card from.
    f !== 'bio' &&
    !f.startsWith('image_') &&
    // The Showroom hero is a photograph, so it belongs with the gallery on the
    // wrong side of this filter rather than with the colours and the logo. It
    // does not start with image_, so it has to be named or it would be the one
    // picture that follows a copied card around.
    f !== 'hero_image_url')

export function copyLook(source: Record<string, any> | null | undefined): Record<string, any> {
  const out: Record<string, any> = {}
  if (!source) return out
  for (const f of COPYABLE_LOOK_FIELDS) out[f] = source[f] ?? null
  return out
}

// Pull just the brand fields out of a card (used by "use my card as
// the brand").
export function extractBrand(card: Record<string, any>): Record<string, any> {
  const brand: Record<string, any> = {}
  for (const f of BRAND_FIELDS) {
    if (card[f] !== undefined) brand[f] = card[f]
  }
  return brand
}

/** Nothing worth showing: the brand should fill this in. A theme object or any
 *  other non-string value counts as set once it is there at all. */
function unset(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  return false
}

/**
 * Merge a team brand over a card.
 *
 * `locked` is the list of columns the company has taken control of, from
 * lockedColumnsFor. It decides who wins, and it is required rather than
 * optional so that adding a caller cannot quietly reintroduce the bug below.
 *
 *   locked        the brand always wins - that is what locking it means
 *   not locked    the card's own value wins, and the brand fills the gap when
 *                 the card has not set one
 *
 * Locks used to say only who could TYPE in a field, while this said who won on
 * screen, and the two disagreed. Cardtly leaves Address unlocked on purpose, so
 * a rep updated theirs, the editor accepted it, the row stored it - and the
 * public card went on showing the company address, because address is a brand
 * field. The edit was allowed and then silently thrown away at render.
 *
 * Tying them together is what makes the unlock mean something: a company
 * controls a field exactly when it has said so.
 */
export function mergeBrand<T extends Record<string, any>>(
  card: T,
  brand: Record<string, any> | null | undefined,
  locked: Iterable<string>,
): T {
  if (!brand || Object.keys(brand).length === 0) return card
  const lockedSet = new Set(locked)
  const merged: Record<string, any> = { ...card }
  for (const f of BRAND_FIELDS) {
    if (!(f in brand)) continue
    if (lockedSet.has(f) || (unset(card[f]) && !LOCKED_ONLY_FIELDS.has(f))) merged[f] = brand[f]
  }
  const framed = framingForShownCard(merged.color_theme, card, brand, merged, lockedSet)
  if (framed !== undefined) merged.color_theme = framed
  return merged as T
}

// ── IMAGE FRAMING FOLLOWS THE IMAGE, NOT THE DESIGN ─────────────────────────
//
// Where each photo is cropped from and how far it is zoomed (imageFocus and
// imageZoom in the design JSON) are stored inside color_theme, so they used to
// be locked with the DESIGN: a team that locked its design locked every staff
// member out of framing their own profile photo, gallery and hero, and the look
// replaced their framing on the card anyway (Andre, 2026-10-08: "the zoom must
// only be locked if the main card locked the Hero image"). Now each image's
// framing goes with that image's own lock:
//
//   hero  -> 'hero' lock (hero_image_url)     logo -> 'logo' lock
//   1..10 -> 'images' lock (image_N_url)      photo -> never: always the person's
//
// Locked image: the image comes from the look, so its framing does too. Open
// image: the person's own framing, whatever the design lock says - except
// where the image shown is the look's own (filled into a blank) and they have
// not framed it, when the look's framing goes with it.

const FRAMING_FIELDS = ['imageFocus', 'imageZoom'] as const

/** The card column holding the image a framing key belongs to. */
export function framingImageColumn(key: string): string | null {
  if (key === 'hero') return 'hero_image_url'
  if (key === 'logo') return 'company_logo_url'
  if (key === 'photo') return 'profile_image_url'
  if (/^\d+$/.test(key)) return `image_${key}_url`
  return null
}

/** Whether an image lock takes a framing key out of the person's hands. */
export function framingGoverned(key: string, locked: ReadonlySet<string>): boolean {
  const col = framingImageColumn(key)
  return !!col && col !== 'profile_image_url' && locked.has(col)
}

function parseTheme(v: unknown): Record<string, any> | null {
  if (typeof v !== 'string') return null
  try {
    const o = JSON.parse(v)
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null
  } catch {
    return null
  }
}

/** The framing on a card wearing the look. undefined: leave color_theme as is. */
function framingForShownCard(
  shownTheme: unknown,
  card: Record<string, any>,
  brand: Record<string, any>,
  merged: Record<string, any>,
  locked: ReadonlySet<string>,
): string | undefined {
  const shown = parseTheme(shownTheme)
  // A legacy theme that is not JSON ('blue') carries no framing to settle.
  if (!shown) return undefined
  const own = parseTheme(card.color_theme) || {}
  const look = parseTheme(brand.color_theme) || {}
  for (const field of FRAMING_FIELDS) {
    const next: Record<string, any> = {}
    const keys = new Set([...Object.keys(own[field] || {}), ...Object.keys(look[field] || {})])
    for (const k of keys) {
      const col = framingImageColumn(k)
      const imageIsLooks = !!col && col in brand && merged[col] === brand[col]
      const mine = own[field]?.[k]
      const v = framingGoverned(k, locked) ? look[field]?.[k]
        : mine !== undefined ? mine
        : imageIsLooks ? look[field]?.[k]
        : undefined
      if (v !== undefined) next[k] = v
    }
    if (Object.keys(next).length) shown[field] = next
    else delete shown[field]
  }
  return JSON.stringify(shown)
}

/**
 * What a STAFF MEMBER's save may do to the design JSON: their own framing for
 * every image they can still change, the stored framing for every image locked
 * to them, and - when the design itself is locked to them - nothing else. Used
 * by /api/team/card/save before the design lock would otherwise throw the
 * whole design, framing included, away.
 *
 * Returns the theme to store, or undefined when there is nothing to store.
 */
export function withMemberFraming(
  submitted: unknown,
  existing: unknown,
  locked: ReadonlySet<string>,
): string | undefined {
  const sent = parseTheme(submitted)
  const stored = parseTheme(existing)
  if (!sent) return undefined
  const designLocked = locked.has('color_theme')
  // Design locked over a theme that is not JSON: leave it alone rather than
  // replace the card's look with a theme holding nothing but framing.
  if (designLocked && !stored && existing) return undefined
  const base: Record<string, any> = designLocked ? { ...(stored || {}) } : { ...sent }
  for (const field of FRAMING_FIELDS) {
    const next: Record<string, any> = {}
    const keys = new Set([...Object.keys(sent[field] || {}), ...Object.keys(stored?.[field] || {})])
    for (const k of keys) {
      const v = framingGoverned(k, locked) ? stored?.[field]?.[k] : sent[field]?.[k]
      if (v !== undefined) next[k] = v
    }
    if (Object.keys(next).length) base[field] = next
    else delete base[field]
  }
  return JSON.stringify(base)
}

// The effective team brand for a card, cascading department over org.
//
// A department only sets what it wants to differ from the rest of the company
// (its colours, its logo), so its brand is merged OVER the org brand: the
// department wins on the keys it sets, and inherits the org for the rest. A
// card with no department, or a department with an empty brand, resolves to
// exactly the org brand as before.
export function resolveTeamBrand(
  orgBrand: Record<string, any> | null | undefined,
  deptBrand: Record<string, any> | null | undefined,
): Record<string, any> {
  const org = orgBrand || {}
  const dept = deptBrand || {}
  // Shallow merge is correct: both are flat maps of brand fields, and dept
  // keys should override org keys one for one.
  return { ...org, ...dept }
}
