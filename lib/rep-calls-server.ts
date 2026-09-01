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

function isMissingColumn(error: any): boolean {
  return error?.code === '42703' || /column .* does not exist/i.test(String(error?.message || ''))
}

/** Columns that arrive after the table does. email came with migration 062,
 *  applied by hand, so between the deploy and the migration the form offers a
 *  field the table has not got. */
const LATE_COLUMNS = ['email'] as const

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
      email: text(body?.email, 160),
      called_at: when.toISOString(),
      outcome,
      follow_up_on: followUp,
      notes: text(body?.notes, 4000),
      updated_at: new Date().toISOString(),
    },
  }
}

export type WriteResult =
  | { ok: true; id: string; row: any; degraded: boolean }
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
  const attempt = async (fields: Record<string, any>) => {
    if (opts.id) {
      let q = admin.from('rep_calls').update(
        opts.allowReassign ? { ...fields, rep_id: opts.repId } : fields,
      ).eq('id', opts.id)
      // A rep may only ever touch their own rows, so their update is scoped by
      // rep_id as well as by id: someone else's id then matches nothing.
      if (!opts.allowReassign) q = q.eq('rep_id', opts.repId)
      const { data, error } = await q.select('*')
      // Selecting the affected rows is what turns "matched nothing" into
      // something reportable, rather than a success message over no change.
      if (!error && (!data || data.length === 0)) {
        return { error: { code: 'NO_ROWS', message: 'That call no longer exists, or it is not yours to change.' }, row: null }
      }
      return { error, row: data?.[0] || null }
    }
    const { data, error } = await admin
      .from('rep_calls')
      .insert({ ...fields, rep_id: opts.repId })
      .select('*')
      .single()
    return { error, row: data || null }
  }

  try {
    let res = await attempt(opts.fields)
    let degraded = false

    // Drop what the table has not got yet and save the rest, rather than
    // failing the whole write. Somebody logging a call between two others
    // should not lose it because migration 062 has not been run.
    if (res.error && isMissingColumn(res.error)) {
      const stripped = { ...opts.fields }
      for (const c of LATE_COLUMNS) delete stripped[c]
      res = await attempt(stripped)
      degraded = true
    }

    if (res.error) {
      if (isMissingTable(res.error)) return { ok: false, error: MIGRATION_061_MISSING, status: 503 }
      if ((res.error as any).code === 'NO_ROWS') {
        return { ok: false, error: (res.error as any).message, status: 404 }
      }
      return { ok: false, error: (res.error as any).message || 'Could not save that.', status: 500 }
    }
    if (!res.row?.id) return { ok: false, error: 'Saved, but no id came back.', status: 500 }
    return { ok: true, id: res.row.id, row: res.row, degraded }
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
