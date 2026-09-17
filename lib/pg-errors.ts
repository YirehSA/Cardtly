/**
 * "That column is not there yet."
 *
 * This codebase ships code before its migration on purpose, so a route that
 * writes a new column has to tell "the migration has not run here" apart from
 * a real fault, and say something useful rather than returning 500.
 *
 * THE TRAP THIS EXISTS FOR. The answer depends on whether you are reading or
 * writing, which is not obvious and cost a production incident:
 *
 *   SELECT   Postgres raises undefined_column and the code is 42703.
 *   INSERT,  PostgREST validates the payload against its own schema cache and
 *   UPDATE   refuses it BEFORE any SQL is sent, so Postgres never sees the
 *            statement and never raises anything. The code is PGRST204 and the
 *            message is "Could not find the 'x' column of 'y' in the schema
 *            cache".
 *
 * Verified against the live database rather than assumed, by writing a column
 * that does not exist: select gave 42703, insert and update both gave PGRST204.
 *
 * So a write guarded only by 42703 does nothing at all. /api/analytics was
 * written that way and would have returned 500 on every card view until
 * migration 086 ran; /api/account/primary-card was written that way and its
 * "not switched on yet" message could never fire.
 *
 * Message matching is here too because several call sites already do it by
 * hand, and their patterns only match the Postgres wording: "column x does not
 * exist" looks nothing like "Could not find the 'x' column".
 */
export function isMissingColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: unknown; message?: unknown }

  if (e.code === 'PGRST204') return true   // insert or update
  if (e.code === '42703') return true      // select

  const message = typeof e.message === 'string' ? e.message : ''
  return /column .* does not exist/i.test(message)
    || /could not find the '.*' column/i.test(message)
}

/** The table itself is missing: 42P01, undefined_table. A different question
 *  from the column one, and several callers ask both at once. */
export function isMissingTable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: unknown; message?: unknown }
  if (e.code === '42P01') return true
  const message = typeof e.message === 'string' ? e.message : ''
  return /relation .* does not exist/i.test(message)
}
