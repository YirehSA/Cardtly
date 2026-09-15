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
//
// ════════════════════════════════════════════════════════════════════════════
// ARCHITECTURE RULE: `addons.context` IS PUBLIC. TREAT IT AS PUBLISHED.
// ════════════════════════════════════════════════════════════════════════════
//
// The card row is handed to a client component, so everything on it - addons
// included - is serialised into the HTML of the public card page. Anybody who
// views a card can read its Context configuration by viewing source. That is
// not a leak to be fixed; it is what has to be true for Context to run in the
// browser at all.
//
// So `addons.context` may hold PRESENTATION CONFIGURATION ONLY:
//
//   allowed      audience ids and labels, section ordering, hide rules, CTA
//                references to the card's own links, display settings
//
//   NEVER        API keys, tokens or credentials of any kind
//                private internal notes
//                prospect or customer information
//                confidential or customer-specific commercial terms
//                hidden pricing formulas or discount logic
//                private sales intelligence
//                unpublished security information
//                AI prompts containing any of the above
//
// THIS MATTERS MOST FOR WHAT COMES NEXT. Cardtly Knowledge and the AI phases
// are about company information, and some of that will be permissioned or
// commercially sensitive. None of it may travel this way. Sensitive or
// permissioned knowledge stays server-side and is reached through a route that
// can check who is asking - it does not get embedded in a public card payload
// because that was the convenient place to put it.
//
// A useful test before adding any field here: would you be comfortable if a
// competitor read it? If not, it does not belong in addons.

import { MAX_CUSTOM_LINKS } from '@/types/design'

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

/**
 * The highest link slot a CTA may point at.
 *
 * MAX_CUSTOM_LINKS, not the 14 this originally said. extractLinks in
 * types/database.ts walks link_1 to link_14, but the editor only ever exposes
 * LINK_SLOTS, which is 1 to 10, so slots 11 to 14 cannot be populated by
 * anybody and a CTA pointing at one would be a CTA pointing at nothing.
 * Imported rather than typed out so the two cannot drift.
 *
 * WHY THE SLOT IS SAFE TO REFERENCE AT ALL. It is a stored column identity,
 * link_3_title and link_3_url, not a position in a rendered list. The editor
 * binds each slot directly and there is no reordering UI, no drag handle and
 * no delete-and-compact anywhere in CardEditor: clearing slot 2 leaves slot 3
 * exactly where it was. So a CTA aimed at slot 3 keeps pointing at the same
 * configured link unless the owner deliberately edits slot 3 itself, which is
 * the owner changing their own card rather than the CTA drifting under them.
 */
export const MAX_LINK_INDEX = MAX_CUSTOM_LINKS

export type ContextCta =
  | { kind: 'link'; index: number; label: string | null }
  | { kind: 'booking'; index: null; label: string | null }

export interface ContextAudience {
  /** URL-safe and permanent. See CONTEXT_AUDIENCE_IDS. */
  id: string
  /**
   * Whether this audience may actually execute. ALWAYS PRESENT after parsing,
   * even though it is optional in stored data. See parseEnabled.
   *
   * A disabled audience KEEPS EVERY OTHER SETTING. Switching IT off and back
   * on next week must return the same label, the same order, the same hidden
   * sections and the same CTA, because to the owner that is one switch rather
   * than a delete and a rebuild. Storing the configuration and refusing to run
   * it is the only way to promise that.
   */
  enabled: boolean
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

/** Longest display label for an audience or a CTA button. Exported so the
 *  owner's editor can stop them at the same point the parser would, rather
 *  than accepting something the save silently shortens. */
export const MAX_CONTEXT_LABEL = 60
const MAX_LABEL = MAX_CONTEXT_LABEL

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

/**
 * ABSENT AND MALFORMED ARE DIFFERENT THINGS, which is the same principle the
 * resolver is built on and it applies here for the same reason.
 *
 *   key absent  -> ENABLED   authored before this field existed
 *   true        -> ENABLED
 *   false       -> DISABLED
 *   anything    -> DISABLED  fail closed, configuration kept
 *
 * ABSENT IS THE KEY BEING MISSING, nothing else. An explicit null is a value
 * somebody wrote, not a field nobody wrote, so it reads as malformed and
 * disables. Only a genuinely untouched config gets the legacy reading.
 *
 * ABSENT MEANS ENABLED, and it has to. Every Context config authored before
 * this field existed was written under a model where an audience being in the
 * list WAS it being on. Reading those as disabled would switch off working
 * cards to suit a schema change, which is not a thing a schema change is
 * allowed to do.
 *
 * MALFORMED MEANS DISABLED, NOT DROPPED. "true", 1 and "false" are all a
 * configuration we cannot interpret, and the parser's standing rule is to
 * neutralise a bad FIELD rather than throw away the whole audience - the same
 * treatment an invalid CTA already gets. Disabling is the fail-closed reading
 * because the audience then cannot execute, and dropping the audience would
 * destroy the label, order, hide and CTA that this entire change exists to
 * preserve. The owner sees it switched off in the dashboard and can switch it
 * back on, which is a recoverable state rather than a silent deletion.
 *
 * No truthy coercion anywhere. 1 is not true and "false" is not false.
 */
function parseEnabled(raw: Record<string, unknown>): boolean {
  if (!('enabled' in raw)) return true
  return raw.enabled === true
}

function parseAudience(v: unknown): ContextAudience | null {
  if (!isPlainObject(v)) return null

  const id = str(v.id)
  if (!id || !AUDIENCE_ID_RE.test(id)) return null

  const rawLabel = str(v.label)
  const label = rawLabel && rawLabel.length <= MAX_LABEL ? rawLabel : id

  const hide = sectionList(v.hide)
  // A SECTION MAY BE BOTH ORDERED AND HIDDEN, and hiding still wins.
  //
  // This used to strip hidden sections out of `order`, which was tidier and
  // quietly lost something the owner cares about: where the section sits. Hide
  // the gallery, come back next week, switch it visible again, and it had
  // moved to the bottom, because its position had been normalised away at save
  // time. The owner never asked for it to move. They asked for it to be
  // hidden.
  //
  // Nothing about the public card changes. orderSections removes hidden
  // sections from the available list BEFORE it applies this order, so a hidden
  // section named here matches nothing and is never rendered. Hiding wins
  // where hiding has always won, at render, rather than by editing the
  // owner's stored arrangement behind their back.
  const order = sectionList(v.order)

  return { id, enabled: parseEnabled(v), label, order, hide, cta: parseCta(v.cta) }
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
  const usable = new Set<string>()
  const seen = new Set<string>()
  for (const entry of list.slice(0, MAX_AUDIENCES * 4)) {
    if (audiences.length >= MAX_AUDIENCES) break
    const a = parseAudience(entry)
    if (!a || seen.has(a.id)) continue
    seen.add(a.id)
    if (a.enabled) usable.add(a.id)
    audiences.push(a)
  }

  // Only ever an id that actually survived AND can actually run. Never
  // invented, never repaired.
  //
  // A DISABLED DEFAULT IS CLEARED RATHER THAN KEPT. "Use Executive when nobody
  // has said who they are" and "Executive is switched off" cannot both be
  // true, and of the two the switch is the more recent instruction. Keeping a
  // default that can never fire would mean the dashboard showing a setting
  // that does nothing, which is the kind of thing an owner only discovers by
  // wondering why their card never personalises.
  const wanted = str(raw.defaultAudience)
  const defaultAudience = wanted && usable.has(wanted) ? wanted : null

  return { audiences, defaultAudience }
}

/**
 * THE CONFIGURATION AS IT MAY ACTUALLY RUN. Disabled audiences are removed
 * entirely rather than marked, so nothing downstream has to remember to check.
 *
 * This is the whole of the disabled-audience runtime behaviour, and it is
 * deliberately all of it. The resolver is untouched: an audience that is not
 * in the list cannot be selected by a visitor, cannot be resolved from ?a=,
 * and cannot be a default, and an explicit ?a=it that finds nothing already
 * falls to the standard card rather than the default through the existing
 * absent-versus-invalid rule. Disabling an audience is exactly as if it had
 * never been configured, for one page view, while the configuration itself
 * sits untouched in the database.
 */
export function effectiveContextConfig(config: ContextConfig): ContextConfig {
  try {
    const audiences = (Array.isArray(config?.audiences) ? config.audiences : []).filter(a => a && a.enabled)
    const ids = new Set(audiences.map(a => a.id))
    const defaultAudience = config?.defaultAudience && ids.has(config.defaultAudience) ? config.defaultAudience : null
    return { audiences, defaultAudience }
  } catch {
    return EMPTY_CONFIG
  }
}

/** Entitlement and configuration together, which is what the resolver wants.
 *  Disabled cards get an empty config, so a caller that forgets to check
 *  `enabled` still renders the standard card. */
export function readCardContext(addons: unknown): { enabled: boolean; config: ContextConfig } {
  const ent = readContextEntitlement(addons)
  if (!ent.enabled) return { enabled: false, config: EMPTY_CONFIG }
  // EFFECTIVE, not stored. A disabled audience physically cannot reach the
  // public card through this function, so no renderer, selector or resolver
  // has to remember to filter one out.
  return { enabled: true, config: effectiveContextConfig(parseContextConfig(ent.raw)) }
}

/**
 * THE OWNER'S STORED CONFIGURATION. For the dashboard and the save API only.
 * NEVER for rendering a public card.
 *
 * Two things make this different from readCardContext, and both are the point:
 *
 * 1. IT IGNORES THE PLATFORM SWITCH. CONTEXT_ENABLED governs whether Context
 *    EXECUTES in public, not whether a customer may configure it. We need to
 *    build, save and preview configuration on Cardtly-owned beta cards while
 *    every public card in the country still renders standard, and a
 *    configuration screen that goes blank because of a platform flag makes
 *    that impossible.
 *
 * 2. IT KEEPS DISABLED AUDIENCES, and it parses the config even when the
 *    add-on itself is switched off. Turning Context off is not deleting it.
 *    The returned `enabled` is the CUSTOMER's switch, addons.context.enabled,
 *    which is a different question from whether the platform is serving the
 *    feature yet.
 */
export function readStoredContext(addons: unknown): { enabled: boolean; config: ContextConfig } {
  try {
    if (!isPlainObject(addons)) return { enabled: false, config: EMPTY_CONFIG }
    const ctx = addons.context
    if (!isPlainObject(ctx)) return { enabled: false, config: EMPTY_CONFIG }
    return { enabled: ctx.enabled === true, config: parseContextConfig(ctx) }
  } catch {
    return { enabled: false, config: EMPTY_CONFIG }
  }
}

// ══ TASK 9: what the owner is allowed to save ═════════════════════════════
//
// THE PARSER STAYS GENERIC, THE SAVE ROUTE STAYS NARROW, and the two are
// deliberately not the same rule.
//
// parseContextConfig accepts any id matching AUDIENCE_ID_RE because a stored
// card may one day carry `quantity-surveyors`, and a public card must keep
// rendering configuration that a later version of Cardtly wrote. Loosening a
// reader later is easy; discovering that the reader you shipped refuses
// tomorrow's data is not.
//
// The owner-facing save route is the opposite job. During the beta the UI
// offers exactly six audiences, so anything else arriving at the API is either
// a bug or somebody posting past the interface, and letting that through would
// mint public ids nobody has designed, supported or agreed to keep forever.
// Audience ids are permanent once they are in a shared link, so the cheapest
// moment to say no is before the first one is stored.

/** The ids the Phase 1 owner interface offers. Not a parser limit. */
export function isSupportedAudienceId(id: unknown): boolean {
  return typeof id === 'string' && (CONTEXT_AUDIENCE_IDS as readonly string[]).includes(id)
}

/** What gets written to addons.context. */
export interface StoredContext {
  enabled: boolean
  audiences: ContextAudience[]
  defaultAudience: string | null
}

export type ContextSaveResult =
  | { ok: true; stored: StoredContext }
  | { ok: false; error: string }

/**
 * Turn what the owner's editor posted into exactly what may be stored.
 *
 * MALFORMED IS CANONICALISED, UNSUPPORTED IS REFUSED, and the difference
 * matters. A broken section name or a CTA pointing at link 99 is the parser's
 * ordinary business: it drops the bad part, keeps the rest, and the owner sees
 * the canonical result come back. A well-formed audience id that Cardtly does
 * not offer is not something to quietly tidy away, because quietly dropping
 * half of what somebody asked to save is how a settings screen starts lying.
 * It is answered with an error naming the id.
 *
 * The result is validated through the SAME parser the public card reads with,
 * so "saved" and "what the card will do" cannot drift apart.
 */
export function canonicaliseContextForSave(input: unknown): ContextSaveResult {
  try {
    if (!isPlainObject(input)) return { ok: false, error: 'Context configuration must be an object' }

    // Checked against the RAW list, before parsing, because the parser would
    // happily keep an unsupported id and we want to refuse it rather than
    // store it.
    const list = Array.isArray(input.audiences) ? input.audiences : []
    for (const entry of list) {
      if (!isPlainObject(entry)) continue
      const id = typeof entry.id === 'string' ? entry.id.trim() : ''
      // Not a usable id at all: the parser drops it, which is the right
      // treatment for corruption. Only a well-formed but unoffered id is an
      // instruction we have to refuse.
      if (!id || !AUDIENCE_ID_RE.test(id)) continue
      if (!isSupportedAudienceId(id)) {
        return { ok: false, error: `Audience "${id}" is not available yet` }
      }
    }

    const config = parseContextConfig(input)
    return {
      ok: true,
      stored: {
        // The CUSTOMER's switch. Strict true, same as everywhere else.
        enabled: input.enabled === true,
        audiences: config.audiences,
        defaultAudience: config.defaultAudience,
      },
    }
  } catch {
    return { ok: false, error: 'Context configuration could not be read' }
  }
}

/**
 * Put a saved Context into an existing addons object WITHOUT touching
 * anything else in it.
 *
 * A pure function rather than a spread inside the route, so that "saving
 * Context cannot disturb contact exchange, the questionnaire or the badge" is
 * something a guard can assert and a mutation can break, instead of a habit
 * that holds until somebody refactors the route.
 *
 * A non-object `existing` yields an addons object containing only context,
 * which is the correct reading of a card that had no add-ons at all.
 */
export function mergeContextAddon(existing: unknown, stored: StoredContext): Record<string, unknown> {
  const base = isPlainObject(existing) ? existing : {}
  return { ...base, context: stored }
}

// ══ TASK 3: the resolver ══════════════════════════════════════════════════
//
// One deterministic decision, taken from values somebody else has already
// extracted. No database, no I/O, no URL parsing, no rendering, no analytics.
// Pure in and pure out, so it can be reasoned about and tested exhaustively.

export interface ResolvedContext {
  audience: ContextAudience
  source: ContextSource
}

/**
 * Which audience, if any, applies to this visitor.
 *
 * THE RULE THAT MATTERS, and it is product behaviour rather than
 * implementation detail: ABSENT context and INVALID context are different
 * things and must not behave the same.
 *
 *   absent   nobody said anything, so the owner's preferred default applies
 *   invalid  somebody DID say something and it does not resolve
 *
 * `defaultAudience` means "there was no audience information, use the owner's
 * preferred experience". It is emphatically NOT a recovery mechanism for a
 * stale or unknown explicit request. If a link was sent saying ?a=finance and
 * Finance no longer exists on that card, showing Executive would be answering
 * a question nobody asked, and answering it wrongly to somebody the sender
 * specifically meant to address as Finance.
 *
 * So: once ANY explicit audience is supplied, the default is out of play. The
 * fallback becomes the standard card, which is always truthful.
 *
 *   valid visitor                        -> visitor
 *   invalid visitor, valid sender        -> sender   (the sender's intent survives)
 *   invalid visitor, no/invalid sender   -> null     (standard card, NOT default)
 *   no visitor, valid sender             -> sender
 *   no visitor, invalid sender           -> null     (standard card, NOT default)
 *   nothing supplied, valid default      -> default
 *   nothing supplied, no/invalid default -> null
 *
 * Relevant when we know. Standard when we do not. Never a guess.
 *
 * An empty or whitespace-only value counts as ABSENT rather than invalid: a
 * bare `?a=` carries no intent to honour or to refuse, so it should not lock
 * the owner out of their own default.
 */
export function resolveContext(input: {
  config: ContextConfig
  /** The visitor's own choice, already extracted. */
  visitorAudience?: string | null
  /** The audience the sender put in the link, already extracted. */
  senderAudience?: string | null
}): ResolvedContext | null {
  try {
    const config = input?.config
    const audiences = Array.isArray(config?.audiences) ? config.audiences : []
    if (audiences.length === 0) return null

    const find = (id: unknown): ContextAudience | null => {
      if (typeof id !== 'string') return null
      const wanted = id.trim()
      if (!wanted) return null
      return audiences.find(a => a && a.id === wanted) || null
    }

    // Supplied means "a non-empty string was given", whether or not it
    // resolves. This is the flag that takes the default out of play.
    const supplied = (v: unknown) => typeof v === 'string' && v.trim().length > 0

    const visitor = find(input.visitorAudience)
    if (visitor) return { audience: visitor, source: 'visitor' }

    const sender = find(input.senderAudience)
    if (sender) return { audience: sender, source: 'sender' }

    // THE LINE THAT MAKES INVALID DIFFERENT FROM ABSENT. Something explicit
    // was asked for and could not be honoured, so the honest answer is the
    // standard card rather than a different audience.
    if (supplied(input.visitorAudience) || supplied(input.senderAudience)) return null

    const fallback = find(config?.defaultAudience)
    if (fallback) return { audience: fallback, source: 'default' }

    return null
  } catch {
    // Same backstop as the parser, for the same reason: this decision sits on
    // the path that renders a public card, and no input should be able to
    // make that card unavailable.
    return null
  }
}

/**
 * WHAT AN ADMIN PREVIEW IS SHOWING. Task 9e.
 *
 * EXPLICIT MODE, NEVER AN ABSENT VALUE. It would have been less code to say
 * "no forced audience means standard", and that is a trap with a fuse on it:
 * absent already means "resolve normally" everywhere else in this file, so the
 * day CONTEXT_ENABLED goes true a preview asking for Standard would quietly
 * start running the resolver and showing the owner's default audience instead
 * of their unpersonalised card. Standard has to be a thing somebody SAID, not
 * a thing nobody said.
 *
 * `audiences` is what the visitor's own selector would offer, which is the
 * ENABLED ones. The previewed audience itself may be disabled: an owner has to
 * be able to look at Procurement before switching it on. That is an admin
 * simulation and changes nothing about what is publicly resolvable, because
 * this value only ever arrives as a React prop.
 *
 * THERE IS NO PATH FROM PUBLIC INPUT TO HERE. No query parameter, no request
 * body and no API maps to this type. A visitor still gets visitor choice, then
 * sender, then default, then standard, decided by resolveContext.
 */
export type CardPreviewContext =
  | { mode: 'standard'; audiences: readonly ContextAudience[] }
  | { mode: 'audience'; audience: ContextAudience; audiences: readonly ContextAudience[] }

// ══ TASK 4: reading the sender's audience out of the URL ══════════════════
//
// EXTRACTION PRESERVES, RESOLUTION JUDGES. This function's entire job is to
// answer "did the URL explicitly carry an audience, and what did it say". It
// deliberately knows nothing about the six ids, nothing about this card's
// configured audiences, and nothing about defaultAudience. resolveContext
// decides whether the value means anything.
//
// That separation is what makes the absent-versus-invalid rule work. If this
// dropped values it did not recognise, ?a=finance would arrive looking exactly
// like no parameter at all, the default would apply, and a link deliberately
// addressed to Finance would quietly show Executive. The whole point is that
// it must not.
//
// It does NOT lowercase. ?a=IT arrives as "IT" and the resolver rejects it,
// for the same reason the parser refuses to repair a malformed id: silently
// rewriting an explicit identifier somebody put in a link is how you end up
// honouring a request nobody made.

/** Beyond this, the value cannot be a real audience and is only a transport
 *  problem. See readSenderAudience for why truncating here is safe. */
const MAX_AUDIENCE_PARAM = 64

/** The query parameter name. Deliberately short and sitting beside the
 *  existing ?s= source marker, which lib/card-sources.ts documents as
 *  permanent once printed. ?a= carries the same commitment. */
export const CONTEXT_PARAM = 'a'

/**
 * The audience a sender put in a link, or null if they did not put one there.
 *
 * Accepts the shapes this actually arrives in. Today the card is rendered by a
 * client component and the source marker is read from window.location.search,
 * so a raw search string is the real path. A URLSearchParams and a Next
 * searchParams record are accepted too, so a future server-side read needs no
 * rewrite and no second implementation to keep in step.
 *
 * DUPLICATES TAKE THE FIRST. ?a=it&a=sales is "it". If a link went out saying
 * ?a=it, appending another parameter to it should not silently replace the
 * sender's intent. This is also what URLSearchParams.get does, but it is done
 * explicitly and tested rather than inherited, because a record-shaped
 * searchParams gives an array instead and would otherwise behave differently.
 *
 * EMPTY AND WHITESPACE ARE ABSENT, not invalid. A bare ?a= carries no intent
 * to honour or refuse, so it must not lock an owner out of their own default.
 *
 * ABSURD LENGTH IS TRUNCATED RATHER THAN DROPPED, and truncating is provably
 * safe: a valid id is at most 24 characters, and anything truncated here is
 * exactly MAX_AUDIENCE_PARAM characters, so truncation can never manufacture a
 * value that resolves. Dropping it to null would have been worse - a 50,000
 * character value is explicit, and turning it into "absent" would hand the
 * visitor the default audience.
 */
export function readSenderAudience(
  search: string | URLSearchParams | Record<string, unknown> | null | undefined,
): string | null {
  try {
    if (search == null) return null

    let raw: unknown = null

    if (typeof search === 'string') {
      raw = new URLSearchParams(search).get(CONTEXT_PARAM)
    } else if (typeof URLSearchParams !== 'undefined' && search instanceof URLSearchParams) {
      raw = search.get(CONTEXT_PARAM)
    } else if (typeof search === 'object') {
      // Next's searchParams record: string | string[] | undefined.
      const v = (search as Record<string, unknown>)[CONTEXT_PARAM]
      raw = Array.isArray(v) ? v[0] : v
    }

    if (typeof raw !== 'string') return null
    if (raw.trim().length === 0) return null

    return raw.length > MAX_AUDIENCE_PARAM ? raw.slice(0, MAX_AUDIENCE_PARAM) : raw
  } catch {
    // A malformed query string is never a reason to fail a card view. Same
    // rule, and the same wording, as CardTracker's own try/catch.
    return null
  }
}

// ══ TASK 6: event metadata ════════════════════════════════════════════════
//
// The two Context events, and the validator that stands between a public
// visitor's browser and a jsonb column.
//
// NOTHING PERSONAL GOES IN HERE. Metadata describes the interaction, not the
// person: which audience was active and where it came from. A name, an email,
// a phone number or a free-text message belongs in contacts, which has consent
// and a privacy notice attached to it. The allow-list below is what enforces
// that - an unrecognised key is dropped rather than stored, so a future call
// site cannot quietly start posting personal data into analytics.

/** Fired once when a resolved Context is actually applied for a visitor. */
export const CONTEXT_EVENT_VIEWED = 'context_viewed'
/** Fired when the Context's recommended action is clicked. */
export const CONTEXT_EVENT_CTA_CLICKED = 'context_cta_clicked'
export const CONTEXT_EVENT_TYPES = [CONTEXT_EVENT_VIEWED, CONTEXT_EVENT_CTA_CLICKED] as const

/** The shape version inside the context payload. Bumped when the MEANING of
 *  these fields changes, so a query written today can tell its own rows from a
 *  later phase's without guessing. */
export const CONTEXT_METADATA_VERSION = 1

/** Serialised metadata longer than this is refused. Context metadata is a few
 *  dozen bytes; a kilobyte leaves generous room for a future namespace while
 *  making it impossible to push documents through an analytics event. */
export const MAX_METADATA_BYTES = 1024

const MAX_INTEREST = 40

/** What Cardtly will store for a Context event. */
export interface ContextMetadata {
  context: {
    audience: string
    source: ContextSource
    version: number
    interest?: string
  }
}

/** Build the payload for an event. `interest` is omitted entirely when absent
 *  rather than stored as null, so a row only carries fields that mean
 *  something. */
export function contextMetadata(resolved: ResolvedContext, interest?: string | null): ContextMetadata {
  const payload: ContextMetadata['context'] = {
    audience: resolved.audience.id,
    source: resolved.source,
    version: CONTEXT_METADATA_VERSION,
  }
  const t = typeof interest === 'string' ? interest.trim() : ''
  if (t) payload.interest = t.slice(0, MAX_INTEREST)
  return { context: payload }
}

/**
 * Validate metadata arriving from a public browser, at the API boundary.
 *
 * Returns the cleaned object, or NULL for anything it does not positively
 * recognise. Null means "store no metadata"; it never means "reject the
 * event". A malformed payload must not cost the owner an ordinary card view,
 * which is the whole reason this returns rather than throws.
 *
 * AN ALLOW-LIST AT EVERY LEVEL. Only the `context` namespace is accepted, and
 * inside it only audience, source, version and interest. Every other key is
 * dropped, including any that look like personal data. A future namespace such
 * as `connection` is a deliberate addition here, never something a client can
 * introduce by posting it.
 */
export function sanitiseEventMetadata(input: unknown): ContextMetadata | null {
  try {
    if (!isPlainObject(input)) return null

    // Size first, before looking at the contents, so a huge payload is refused
    // rather than walked.
    let serialised: string
    try {
      serialised = JSON.stringify(input)
    } catch {
      return null // circular, or otherwise not real JSON
    }
    if (!serialised || serialised.length > MAX_METADATA_BYTES) return null

    const ctx = input.context
    if (!isPlainObject(ctx)) return null

    // Audience: the same format the parser enforces, because this is the same
    // identifier and a value that could never resolve should never be stored.
    const audience = typeof ctx.audience === 'string' ? ctx.audience.trim() : ''
    if (!audience || !AUDIENCE_ID_RE.test(audience)) return null

    // Source: one of the three, spelled once in CONTEXT_SOURCES.
    const source = typeof ctx.source === 'string' ? ctx.source.trim() : ''
    if (!(CONTEXT_SOURCES as readonly string[]).includes(source)) return null

    // Version: the literal number this build writes. A client claiming to be a
    // future version is refused rather than trusted.
    if (ctx.version !== CONTEXT_METADATA_VERSION) return null

    const out: ContextMetadata['context'] = {
      audience,
      source: source as ContextSource,
      version: CONTEXT_METADATA_VERSION,
    }

    // Optional, and dropped rather than rejected if unusable.
    if (typeof ctx.interest === 'string') {
      const t = ctx.interest.trim()
      if (t && t.length <= MAX_INTEREST) out.interest = t
    }

    return { context: out }
  } catch {
    return null
  }
}

// ══ TASK 8: what travels with a contact ═══════════════════════════════════
//
// THE DISTINCTION THIS WHOLE SECTION EXISTS FOR. A sender writing ?a=it means
// "Andre thinks this person is relevant to IT". It does NOT mean the visitor
// said "I am IT". Neither does a configured default. Only a visitor choosing
// from the selector is self-declared, and only that may be recorded as
// qualification about the person.
//
// So `selectedAudience` appears ONLY for source 'visitor'. A sender or default
// Context records what was active and nothing more. Storing an assumption as
// though it were a stated fact is how a CRM quietly fills up with things
// nobody ever said.
//
// The LABEL is snapshotted alongside the id because it is what the visitor
// actually saw at the moment they submitted. If the owner later renames "IT"
// to "Technology / IT", the historical record should not silently change its
// wording - and the Contacts dashboard has no access to the card's Context
// config, so without the label it could only show a raw machine id.

export interface ContactContextMetadata {
  context: {
    /** Self-declared. Present ONLY when the visitor chose it themselves. */
    selectedAudience?: string
    /** The wording the visitor saw when they submitted. */
    selectedLabel?: string
    /** What was actually applied at the moment of exchange. */
    activeAudience: string
    activeSource: ContextSource
    version: number
  }
}

/**
 * Build the metadata that accompanies a Contact Exchange, or null when there
 * is nothing truthful to record.
 *
 * `resolved` is the visitor's ACTIVE context - their own selection where they
 * made one, otherwise the sender's or the default. Full Profile mode does not
 * change this: hiding the transform is "show me everything for a moment", not
 * "forget what I told you", so a visitor who chose Procurement and then opened
 * the full profile still exchanges as Procurement.
 */
export function contactContextMetadata(resolved: ResolvedContext | null): ContactContextMetadata | null {
  try {
    if (!resolved?.audience?.id) return null
    const ctx: ContactContextMetadata['context'] = {
      activeAudience: resolved.audience.id,
      activeSource: resolved.source,
      version: CONTEXT_METADATA_VERSION,
    }
    if (resolved.source === 'visitor') {
      ctx.selectedAudience = resolved.audience.id
      const label = (resolved.audience.label || '').trim()
      if (label && label.length <= 60) ctx.selectedLabel = label
    }
    return { context: ctx }
  } catch {
    return null
  }
}

/**
 * Validate contact metadata at the API boundary, same discipline as the
 * analytics validator: allow-list only, null for anything unrecognised, and
 * null never rejects the contact itself. A lead is worth more than its
 * attribution.
 */
export function sanitiseContactMetadata(input: unknown): ContactContextMetadata | null {
  try {
    if (!isPlainObject(input)) return null
    let serialised: string
    try { serialised = JSON.stringify(input) } catch { return null }
    if (!serialised || serialised.length > MAX_METADATA_BYTES) return null

    const c = input.context
    if (!isPlainObject(c)) return null

    const activeAudience = typeof c.activeAudience === 'string' ? c.activeAudience.trim() : ''
    if (!activeAudience || !AUDIENCE_ID_RE.test(activeAudience)) return null

    const activeSource = typeof c.activeSource === 'string' ? c.activeSource.trim() : ''
    if (!(CONTEXT_SOURCES as readonly string[]).includes(activeSource)) return null

    if (c.version !== CONTEXT_METADATA_VERSION) return null

    const out: ContactContextMetadata['context'] = {
      activeAudience,
      activeSource: activeSource as ContextSource,
      version: CONTEXT_METADATA_VERSION,
    }

    // SELF-DECLARATION IS ONLY HONOURED FOR A VISITOR. A client claiming a
    // selectedAudience alongside source 'sender' is claiming the visitor said
    // something they did not, so it is dropped rather than trusted.
    if (activeSource === 'visitor' && typeof c.selectedAudience === 'string') {
      const sel = c.selectedAudience.trim()
      if (sel && AUDIENCE_ID_RE.test(sel)) {
        out.selectedAudience = sel
        if (typeof c.selectedLabel === 'string') {
          const lbl = c.selectedLabel.trim()
          if (lbl && lbl.length <= 60) out.selectedLabel = lbl
        }
      }
    }

    return { context: out }
  } catch {
    return null
  }
}

/**
 * Re-check client-submitted contact metadata against what this card is
 * ACTUALLY configured to offer, and take the label from the configuration
 * rather than from the browser.
 *
 * WHY THE SYNTACTIC CHECK WAS NOT ENOUGH. sanitiseContactMetadata proves a
 * value LOOKS like an audience id. It cannot know whether this card has such
 * an audience, and it has no idea what that audience is called. The browser is
 * public and anonymous: anybody can POST to this endpoint. Without this step a
 * caller could submit selectedAudience "it" with selectedLabel
 * "CEO - VIP CUSTOMER", or an audience of "astronaut", and Cardtly would store
 * arbitrary attacker-authored text as though it were qualification the visitor
 * declared and the owner configured.
 *
 * So there are two levels and both are required before anything is persisted:
 *
 *   syntactic  does it look like an id            (sanitiseContactMetadata)
 *   semantic   does THIS card actually offer it   (here)
 *
 * THE LABEL IS ALWAYS DERIVED, NEVER ACCEPTED. Whatever the client sent is
 * discarded and replaced with the configured label. There is therefore no path
 * from arbitrary public API text into the owner's Contacts screen at all,
 * which is a stronger guarantee than relying on React to escape it.
 *
 * DROPPING IS PREFERRED TO REJECTING. An unknown audience loses its
 * attribution; it never costs the lead. Returning null here means "save the
 * contact with no Context", never "refuse the contact".
 */
export function canonicaliseContactMetadata(
  meta: ContactContextMetadata | null,
  config: ContextConfig | null,
): ContactContextMetadata | null {
  try {
    const ctx = meta?.context
    if (!ctx) return null
    const audiences = Array.isArray(config?.audiences) ? config.audiences : []
    if (!audiences.length) return null

    // The active audience must exist on this card, or there is nothing
    // truthful to record about what was shown.
    const active = audiences.find(a => a && a.id === ctx.activeAudience)
    if (!active) return null

    const out: ContactContextMetadata['context'] = {
      activeAudience: active.id,
      activeSource: ctx.activeSource,
      version: CONTEXT_METADATA_VERSION,
    }

    // Self-declaration only for a visitor, only for an audience that exists,
    // and only when it agrees with what was active - a client claiming to have
    // selected one audience while a different one was applied is describing
    // something that cannot have happened.
    if (ctx.activeSource === 'visitor' && ctx.selectedAudience) {
      const selected = audiences.find(a => a && a.id === ctx.selectedAudience)
      if (selected && selected.id === active.id) {
        out.selectedAudience = selected.id
        // FROM THE CONFIG, never from the request.
        const label = (selected.label || '').trim()
        if (label) out.selectedLabel = label
      }
    }

    return { context: out }
  } catch {
    return null
  }
}

// ══ TASK 5: the presentation transform ════════════════════════════════════
//
// THE STANDARD CARD IS THE SOURCE OF TRUTH. These functions take what the card
// would normally render and return a different VIEW of it. They never build
// content, never fetch, and never touch the card's data. With no context they
// return the standard arrangement unchanged, which is what makes the
// no-context path provably identical to what shipped before Context existed -
// and what will make "View Full Profile" instant later, since it is just
// dropping the transform rather than re-fetching anything.

/** The order BottomSection has always rendered these in. Exported so the
 *  component and the guard cannot disagree about what "standard" means. */
export const STANDARD_SECTION_ORDER: readonly ContextSection[] = ['certifications', 'links', 'gallery']

/**
 * Which sections to render, in which order.
 *
 * `available` is the list the card would normally show: sections with content,
 * already filtered by the component's own guards. Context can reorder and
 * remove from that list. It can never ADD one, so a context cannot conjure a
 * gallery onto a card that has no images.
 *
 * With no context, the input is returned unchanged.
 *
 * Sections named in `order` come first, in that order. Anything not named
 * keeps its standard relative position after them, so a config that mentions
 * only `links` promotes links and leaves the rest alone rather than silently
 * dropping them.
 *
 * HIDING IS PRESENTATION ONLY. This returns a list of keys. The caller still
 * holds all of the card's data, untouched, which is the point: the gallery a
 * context hides is still in memory and comes straight back when the transform
 * stops being applied.
 */
export function orderSections(
  available: readonly ContextSection[],
  context: ResolvedContext | null,
): ContextSection[] {
  try {
    const list = Array.isArray(available) ? available.filter(s => !!s) : []
    const audience = context?.audience
    if (!audience) return [...list]

    const hide = Array.isArray(audience.hide) ? audience.hide : []
    const kept = list.filter(s => !hide.includes(s))

    const wanted = Array.isArray(audience.order) ? audience.order : []
    const promoted = wanted.filter(s => kept.includes(s))
    const rest = kept.filter(s => !promoted.includes(s))
    return [...promoted, ...rest]
  } catch {
    // Never let an arrangement decision cost somebody their card.
    return Array.isArray(available) ? [...available] : []
  }
}

/** What the CTA should actually render as, once checked against the card. */
export type ResolvedCta =
  | { kind: 'link'; label: string; url: string }
  | { kind: 'booking'; label: string }

/**
 * Turn an audience's CTA into something renderable, or null.
 *
 * A DEAD CTA IS NOT SHOWN, AND DOES NOT BREAK THE AUDIENCE. If the CTA points
 * at link slot 3 and the owner has since cleared slot 3, this returns null:
 * the ordering and hiding for that audience still apply, there is simply no
 * recommended action. A context is not worth failing over a missing button.
 *
 * The CTA is ADDITIVE. It recommends a next step and never stands in for the
 * card's own actions - call, WhatsApp, email, Save Contact and the rest are
 * rendered by other parts of the card entirely and are not reachable from
 * here.
 */
export function resolveContextCta(
  context: ResolvedContext | null,
  links: readonly { index: number; title: string; url: string }[],
  bookingAvailable: boolean,
): ResolvedCta | null {
  try {
    const cta = context?.audience?.cta
    if (!cta) return null

    if (cta.kind === 'booking') {
      if (!bookingAvailable) return null
      return { kind: 'booking', label: cta.label || 'Book a meeting' }
    }

    if (cta.kind === 'link') {
      const target = (Array.isArray(links) ? links : []).find(l => l && l.index === cta.index)
      // The slot was cleared, or never filled. No CTA, audience unaffected.
      if (!target || !target.url) return null
      return { kind: 'link', label: cta.label || target.title || 'Find out more', url: target.url }
    }

    return null
  } catch {
    return null
  }
}
