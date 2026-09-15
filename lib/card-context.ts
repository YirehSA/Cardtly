// Cardtly Context: is it on for this card?
//
// TASK 1 OF PHASE 1. This file answers one question and deliberately nothing
// else. Task 2 gives the audience configuration meaning; here it is read but
// not interpreted, so the entitlement can be trusted before anything depends
// on it.
//
// THE RULE THIS FILE EXISTS TO ENFORCE. Context is an enhancement. A public
// card must render even if the Context configuration is missing, malformed,
// half-written by a future admin UI, or written by a version of Cardtly that
// does not exist yet. So every function here is TOTAL: it never throws, never
// awaits, never touches the database, and returns "off" for anything it does
// not positively recognise. Failing closed is the whole design.
//
// WHERE THE CONFIG LIVES. In the `addons` JSON that cards, team_cards and
// organizations already carry, alongside contactExchange and questionnaire.
// lib/addon-target.ts already resolves which of those three rows applies to a
// user, org first, so central corporate control comes free. No new table, no
// new column, no migration.

/**
 * MASTER SWITCH. Off for every card, everywhere, regardless of per-card
 * configuration, while Phase 1 is being built.
 *
 * A plain exported const rather than an environment variable, matching
 * PROMOS_ENABLED in lib/promos.ts. Flipping it needs a deploy, which is a
 * couple of minutes on Vercel and is the right trade: an env var read at
 * runtime would be one more thing that can be wrong in production, and this
 * switch exists precisely for the moment when something IS wrong.
 *
 * This is a backstop, not the safety mechanism. The safety mechanism is that
 * every function below fails closed on its own.
 */
export const CONTEXT_ENABLED = false

/** Where a Context came from, in precedence order: a visitor's own choice
 *  beats a sender's guess, which beats a configured default.
 *
 *  Declared here because the resolver (Task 3) and the analytics (Task 6) must
 *  agree on the spelling, and two hand-kept copies of a string list is how
 *  this repo has been bitten before (see the note at the top of
 *  lib/card-sources.ts). */
export const CONTEXT_SOURCES = ['visitor', 'sender', 'default'] as const
export type ContextSource = (typeof CONTEXT_SOURCES)[number]

// ── AGREED FOR TASK 6, NOT IMPLEMENTED HERE ───────────────────────────────
//
// The event tables carry no metadata column today: card_events is
// (id, card_id, event_type, link_title, country, city, device, browser, os,
// referrer, created_at) and team_card_events is the same minus country/city.
// Carrying an audience would mean abusing link_title, which the analytics UI
// renders as a link name, so Task 6 adds ONE nullable jsonb column to each
// table. Not a new table.
//
// When it lands, every Context event writes this exact shape, so the analytics
// stay queryable instead of becoming a bag of arbitrary JSON:
//
//   {
//     "context": {
//       "audience": "it",          // the audience id, as it appears in ?a=
//       "interest": "enterprise",  // optional, from the visitor selector
//       "source":   "sender",      // one of CONTEXT_SOURCES above
//       "version":  1              // bump when the shape changes
//     }
//   }
//
// `version` is there so a query written in Phase 1 can tell its own rows apart
// from Phase 3's without guessing. Recorded now, deliberately as a comment
// rather than as code, because Task 6 is where it gets built.

/**
 * The raw Context block as stored, handed on untouched for Task 2 to
 * interpret. Task 1 reads `enabled` and nothing more, so that the entitlement
 * is settled before the shape of an audience is argued about.
 */
export interface ContextEntitlement {
  /** True only when the master switch is on AND this card positively enables
   *  Context. Anything else, including any malformed input, is false. */
  enabled: boolean
  /** The untouched `addons.context` object when it is a plain object, else
   *  null. Task 2 reads audiences out of this; Task 1 does not look inside. */
  raw: Record<string, unknown> | null
}

const OFF: ContextEntitlement = { enabled: false, raw: null }

/** A plain object, not an array and not null. Arrays are objects in JS and a
 *  config written as [] would otherwise walk straight through. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Read the Context entitlement out of a card's `addons`.
 *
 * Accepts genuinely anything, because the argument comes from a JSON column
 * that a future admin UI, a migration, or a hand-edit in the Supabase
 * dashboard can put anything into.
 *
 * `enabled` must be the literal boolean true. The string "true", 1, and "yes"
 * are all treated as off ON PURPOSE: a card quietly switching on because
 * somebody typed a truthy string into a JSON field is exactly the class of
 * surprise this feature cannot afford.
 */
export function readContextEntitlement(addons: unknown): ContextEntitlement {
  if (!CONTEXT_ENABLED) return OFF
  if (!isPlainObject(addons)) return OFF

  const ctx = addons.context
  if (!isPlainObject(ctx)) return OFF
  if (ctx.enabled !== true) return OFF

  return { enabled: true, raw: ctx }
}

/** The boolean on its own, for call sites that do not need the config. */
export function isContextEnabled(addons: unknown): boolean {
  return readContextEntitlement(addons).enabled
}

// ══ TASK 2: the configuration model ═══════════════════════════════════════
//
// Everything below turns the untrusted `raw` above into a validated, normal
// shape. Same rule as the entitlement: total, never throws, and a bad part is
// dropped rather than being allowed to take the card down.

/**
 * THE SIX PHASE 1 AUDIENCES. Machine ids, and PERMANENT.
 *
 * These appear in shared URLs as ?a=it, which means they end up in WhatsApp
 * messages, email signatures, printed QR codes and written NFC tags. Renaming
 * one orphans every link already carrying it, exactly as the note at the top
 * of lib/card-sources.ts describes for its own ids. DO NOT CASUALLY RENAME AN
 * ID ONCE IT HAS BEEN SHARED. Display labels are free to change at any time,
 * which is the whole reason id and label are separate.
 *
 * Six rather than the ten originally sketched, because these are the six with
 * genuinely different content rules behind them. Owner/CEO maps to executive.
 * Operations and Finance arrive when they have a different experience to
 * offer rather than as placeholders. There is deliberately no `other`: if no
 * audience matches, the right answer is the standard card.
 */
export const CONTEXT_AUDIENCE_IDS = [
  'executive',
  'it',
  'sales',
  'marketing',
  'hr',
  'procurement',
] as const
export type ContextAudienceId = (typeof CONTEXT_AUDIENCE_IDS)[number]

/**
 * WHAT CONTEXT IS ALLOWED TO TOUCH, and nothing else.
 *
 * These are the three content blocks BottomSection renders, and BottomSection
 * is rendered by all fifteen templates - fifteen call sites for fifteen
 * template ids. That is why the list is these three and not more: the hero,
 * the name, the photo and the bio are laid out separately by each template, so
 * reordering them would mean fifteen implementations and fifteen ways to break
 * a card.
 *
 * AN ALLOW-LIST, NOT A BLOCK-LIST, and that is the safeguard. Everything a
 * card needs to function - the person's name, photo, title, company, the
 * contact actions, Save Contact, contact exchange, share, the report link, and
 * the Context controls themselves - is unreachable because it is simply not
 * expressible here. There is no blocklist to keep up to date and no way for a
 * future section to be accidentally exposed: a new block is protected until
 * somebody deliberately adds its key to this array.
 *
 * Context personalises which content is shown first. It cannot dismantle the
 * business card underneath.
 */
export const CONTEXT_SECTIONS = ['certifications', 'links', 'gallery'] as const
export type ContextSection = (typeof CONTEXT_SECTIONS)[number]

/**
 * The audience's call to action.
 *
 * REFERENCES SOMETHING THE CARD ALREADY HAS. It never stores a URL of its own,
 * and that is a security decision rather than a tidiness one: a Context-owned
 * {label, url} would be a brand new place a URL can be injected onto a public
 * card, needing its own validation, its own open-redirect thinking and its own
 * review. Pointing at an existing link index cannot introduce a destination,
 * because the owner already put that URL on their own card and the card
 * already renders it.
 *
 *   link    -> promote one of the card's own links (extractLinks, 1 to 14)
 *   booking -> the existing BookingTrigger the card already renders
 *
 * `label` overrides the wording only. "Book Technical Demo" pointing at the
 * link the owner called "Schedule a call" is the entire feature.
 */
export const CONTEXT_CTA_KINDS = ['link', 'booking'] as const
export type ContextCtaKind = (typeof CONTEXT_CTA_KINDS)[number]

/** Matches extractLinks in types/database.ts, which walks link_1 to link_14. */
export const MAX_LINK_INDEX = 14

export type ContextCta =
  | { kind: 'link'; index: number; label: string | null }
  | { kind: 'booking'; index: null; label: string | null }

export interface ContextAudience {
  /** URL-safe and permanent. See CONTEXT_AUDIENCE_IDS. */
  id: string
  /** Free to change. Falls back to the id when absent or unusable. */
  label: string
  /** Sections in the order they should appear. Deduplicated, unknown keys
   *  dropped. Sections not named here keep their normal relative order after
   *  the ones that are. */
  order: ContextSection[]
  /** Sections to leave out entirely for this audience. */
  hide: ContextSection[]
  cta: ContextCta | null
}

export interface ContextConfig {
  audiences: ContextAudience[]
  /** Only ever an id that survived parsing. Never invented. */
  defaultAudience: string | null
}

const EMPTY_CONFIG: ContextConfig = { audiences: [], defaultAudience: null }

/**
 * AUDIENCE ID FORMAT. Strict, because these go in URLs.
 *
 * Lowercase ASCII, starting with a letter, then letters, digits and hyphens.
 * Two to twenty-four characters - long enough for a real custom audience like
 * `quantity-surveyors` and short enough to stay readable in a WhatsApp link.
 *
 * No spaces, no uppercase, no underscores, no Unicode, no percent-encoding, no
 * dots or slashes. A malformed id is DROPPED, never rewritten: silently
 * turning "IT Manager" into "it-manager" would mint a public identifier the
 * owner never chose and never saw.
 */
const AUDIENCE_ID_RE = /^[a-z][a-z0-9-]{1,23}$/

/**
 * How many audiences one card may define.
 *
 * Phase 1 ships six. The full role list sketched for later is ten. Twenty
 * leaves room for genuinely custom audiences - a construction group might want
 * architects, main contractors and quantity surveyors alongside the standard
 * roles - while staying far below anything that could make parsing a public
 * card measurable work.
 *
 * This is a guard against a malformed or hostile configuration, not a product
 * limit anybody should ever meet. Audiences past the limit are dropped, not
 * an error: twenty working audiences beats a blank card.
 */
export const MAX_AUDIENCES = 20

const MAX_LABEL = 60

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s ? s : null
}

/** A section key, or null. Unknown keys are dropped, which is what keeps every
 *  protected part of the card unreachable. */
function section(v: unknown): ContextSection | null {
  const s = str(v)
  return s && (CONTEXT_SECTIONS as readonly string[]).includes(s) ? (s as ContextSection) : null
}

/** Section list: drops unknowns, drops duplicates, keeps first occurrence,
 *  and caps at the number of sections that exist so a list of ten thousand
 *  "links" entries cannot be used to make the parser work. */
function sectionList(v: unknown): ContextSection[] {
  if (!Array.isArray(v)) return []
  const out: ContextSection[] = []
  for (const item of v.slice(0, CONTEXT_SECTIONS.length * 4)) {
    const s = section(item)
    if (s && !out.includes(s)) out.push(s)
  }
  return out
}

function parseCta(v: unknown): ContextCta | null {
  if (!isPlainObject(v)) return null
  const kind = str(v.kind)
  const label = str(v.label)
  const safeLabel = label && label.length <= MAX_LABEL ? label : null

  if (kind === 'booking') return { kind: 'booking', index: null, label: safeLabel }

  if (kind === 'link') {
    // Integer only. 3.5, "3", NaN and Infinity are all a misconfiguration
    // rather than a link, and a CTA pointing at link 0 or link 99 points at
    // nothing the card can render.
    const i = v.index
    if (typeof i !== 'number' || !Number.isInteger(i) || i < 1 || i > MAX_LINK_INDEX) return null
    return { kind: 'link', index: i, label: safeLabel }
  }

  return null
}

function parseAudience(v: unknown): ContextAudience | null {
  if (!isPlainObject(v)) return null

  const id = str(v.id)
  if (!id || !AUDIENCE_ID_RE.test(id)) return null

  const rawLabel = str(v.label)
  const label = rawLabel && rawLabel.length <= MAX_LABEL ? rawLabel : id

  const hide = sectionList(v.hide)
  // A section cannot be both ordered and hidden. Hiding wins: it is the more
  // specific instruction, and the alternative is showing a section the owner
  // explicitly asked to leave out.
  const order = sectionList(v.order).filter(s => !hide.includes(s))

  return { id, label, order, hide, cta: parseCta(v.cta) }
}

/**
 * Turn the raw `addons.context` into a config that is safe to render from.
 *
 * Every failure mode degrades rather than throwing:
 *
 *   unknown config          -> empty config
 *   malformed audience      -> that audience dropped, the rest kept
 *   unknown section key     -> that reference dropped
 *   invalid CTA             -> cta null, audience kept if otherwise valid
 *   invalid default         -> defaultAudience null
 *   duplicate ids           -> first valid wins, later ones dropped
 *   no valid audiences      -> empty config, nothing to personalise
 *
 * An empty config is not an error. It means Context has nothing to say about
 * this visitor, and the caller shows the standard card.
 *
 * DUPLICATE IDS KEEP THE FIRST. Two reasons. It matches how ?a=it will be
 * resolved, first match wins, so the parser and the resolver cannot disagree.
 * And it is stable under append: adding an audience to the end of the list can
 * never change the meaning of a link already in somebody's WhatsApp history.
 * Discarding both copies would silently remove a working audience, which is
 * the more surprising outcome.
 */
export function parseContextConfig(raw: unknown): ContextConfig {
  // THE UNEXPECTED-EXCEPTION BACKSTOP. Everything inside degrades on purpose
  // and should never throw, so this catch should never fire. It is here
  // because "should never" is not a guarantee and a public card is not the
  // place to find out: reading a property can itself throw if the value is not
  // the plain JSON we expect, which is precisely what the guard for this
  // function caught. Anything unforeseen becomes the standard card.
  try {
    return parseContextConfigUnsafe(raw)
  } catch {
    return EMPTY_CONFIG
  }
}

function parseContextConfigUnsafe(raw: unknown): ContextConfig {
  if (!isPlainObject(raw)) return EMPTY_CONFIG

  const list = raw.audiences
  if (!Array.isArray(list)) return EMPTY_CONFIG

  const audiences: ContextAudience[] = []
  const seen = new Set<string>()
  for (const entry of list.slice(0, MAX_AUDIENCES * 4)) {
    if (audiences.length >= MAX_AUDIENCES) break
    const a = parseAudience(entry)
    if (!a || seen.has(a.id)) continue
    seen.add(a.id)
    audiences.push(a)
  }

  // Only ever an id that actually survived. Never invented, never repaired.
  const wanted = str(raw.defaultAudience)
  const defaultAudience = wanted && seen.has(wanted) ? wanted : null

  return { audiences, defaultAudience }
}

/** Entitlement and configuration together, which is what Task 3's resolver
 *  will want. Disabled cards get an empty config, so a caller that forgets to
 *  check `enabled` still renders the standard card. */
export function readCardContext(addons: unknown): { enabled: boolean; config: ContextConfig } {
  const ent = readContextEntitlement(addons)
  if (!ent.enabled) return { enabled: false, config: EMPTY_CONFIG }
  return { enabled: true, config: parseContextConfig(ent.raw) }
}
