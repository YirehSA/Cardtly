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
