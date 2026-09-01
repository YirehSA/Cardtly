// Reading and writing calls, server side.
//
// Shared by the rep's own route and the admin route so the validation, the
// wording and the migration tolerance are identical. Like rep-meetings-server,
// the one thing it deliberately does NOT decide is which rep a row belongs to:
// the caller passes repId, having established it from the session (a rep) or
// from an explicit choice by an admin. rep_id is never read out of a request
// body here, because that is how one rep ends up editing another's log.

import { isCallOutcome } from './rep-calls'

export const MIGRATION_061_MISSING =
  'The call log is not switched on yet: migration 061 has not been run.'

function isMissingTable(error: any): boolean {
  return error?.code === '42P01'
}

const text = (v: unknown, max: number): string | null => {
  const s = String(v ?? '').trim()
  return s ? s.slice(0, max) : null
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export type ParseResult =
  | { ok: true; fields: Record<string, any> }
  | { ok: false; error: string }

export function parseCallBody(body: any): ParseResult {
  const company = String(body?.company ?? '').trim()
  if (!company) return { ok: false, error: 'Which company did you call?' }

  // Defaults to now, because that is when a call is almost always written down.
  const when = body?.called_at ? new Date(body.called_at) : new Date()
  if (!Number.isFinite(when.getTime())) return { ok: false, error: 'That time does not look right.' }

  const outcome = body?.outcome ?? 'answered'
  if (!isCallOutcome(outcome)) return { ok: false, error: 'Unknown outcome.' }

  let followUp: string | null = null
  if (body?.follow_up_on) {
    const raw = String(body.follow_up_on).trim()
    if (!DATE_ONLY.test(raw)) return { ok: false, error: 'The call-back date does not look right.' }
    followUp = raw
  }

  return {
    ok: true,
    fields: {
      company: company.slice(0, 160),
      contact_name: text(body?.contact_name, 120),
      phone: text(body?.phone, 40),
      called_at: when.toISOString(),
      outcome,
      follow_up_on: followUp,
      notes: text(body?.notes, 4000),
      updated_at: new Date().toISOString(),
    },
  }
}

export type WriteResult =
  | { ok: true; id: string; row: any }
  | { ok: false; error: string; status: number }

export async function saveCall(
  admin: any,
  opts: {
    id?: string | null
    repId: string
    fields: Record<string, any>
    /** Let this write move a call to a different rep. Admin only, and the same
     *  reason as saveMeeting: an update scoped by a rep_id the row does not
     *  carry matches nothing, and Postgres reports no error for updating
     *  nothing - so reassigning looked like it worked and did not. */
    allowReassign?: boolean
  },
): Promise<WriteResult> {
  try {
    if (opts.id) {
      let q = admin.from('rep_calls').update(
        opts.allowReassign ? { ...opts.fields, rep_id: opts.repId } : opts.fields,
      ).eq('id', opts.id)
      // A rep may only ever touch their own rows, so their update is scoped by
      // rep_id as well as by id: someone else's id then matches nothing.
      if (!opts.allowReassign) q = q.eq('rep_id', opts.repId)
      const { data, error } = await q.select('*')
      if (error) {
        if (isMissingTable(error)) return { ok: false, error: MIGRATION_061_MISSING, status: 503 }
        return { ok: false, error: error.message || 'Could not save that.', status: 500 }
      }
      // Selecting the affected rows is what turns "matched nothing" into
      // something reportable, rather than a success message over no change.
      if (!data || data.length === 0) {
        return { ok: false, error: 'That call no longer exists, or it is not yours to change.', status: 404 }
      }
      return { ok: true, id: opts.id, row: data[0] }
    }

    const { data, error } = await admin
      .from('rep_calls')
      .insert({ ...opts.fields, rep_id: opts.repId })
      .select('*')
      .single()
    if (error) {
      if (isMissingTable(error)) return { ok: false, error: MIGRATION_061_MISSING, status: 503 }
      return { ok: false, error: error.message || 'Could not save that.', status: 500 }
    }
    if (!data?.id) return { ok: false, error: 'Saved, but no id came back.', status: 500 }
    return { ok: true, id: data.id, row: data }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Could not save that.', status: 500 }
  }
}

export async function deleteCall(
  admin: any,
  opts: { id: string; repId: string },
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  // Scoped to the rep as well as the id, so an id belonging to someone else
  // matches nothing rather than deleting their call.
  const { data, error } = await admin
    .from('rep_calls')
    .delete()
    .eq('id', opts.id)
    .eq('rep_id', opts.repId)
    .select('id')
  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_061_MISSING, status: 503 }
    return { ok: false, error: error.message || 'Could not delete that.', status: 500 }
  }
  // Deleting nothing is not a success.
  if (!data || data.length === 0) {
    return { ok: false, error: 'That call no longer exists, or it is not yours to delete.', status: 404 }
  }
  return { ok: true }
}

/**
 * Read calls.
 *
 * select('*') rather than a column list, for the reason the whole codebase now
 * does it: naming a column a pending migration has not added returns an EMPTY
 * result, which looks exactly like having logged no calls.
 */
export async function listCalls(
  admin: any,
  opts: { repId?: string } = {},
): Promise<{ ok: true; calls: any[] } | { ok: false; error: string; status: number }> {
  try {
    let q = admin.from('rep_calls').select('*').order('called_at', { ascending: false })
    if (opts.repId) q = q.eq('rep_id', opts.repId)
    const { data, error } = await q
    if (error) {
      if (isMissingTable(error)) return { ok: false, error: MIGRATION_061_MISSING, status: 503 }
      return { ok: false, error: error.message, status: 500 }
    }
    return { ok: true, calls: data || [] }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Could not read the call log.', status: 500 }
  }
}
