// Reading and writing outreach, server side.
//
// The same boundary as rep-calls-server: this never decides which rep a row
// belongs to. The caller passes repId, having established it from the session,
// and rep_id is never read out of a request body - that is how one rep ends up
// editing another's log.

import { isActivityKind, isActivityStatus, statusFitsKind, statusMeta, type ActivityKind } from './rep-activities'

export const MIGRATION_075_MISSING =
  'The outreach log is not switched on yet: migration 075 has not been run.'

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

export function parseActivityBody(body: any): ParseResult {
  const kind = body?.kind ?? 'email'
  if (!isActivityKind(kind)) return { ok: false, error: 'Unknown kind of activity.' }

  const company = String(body?.company ?? '').trim()
  if (!company) return { ok: false, error: 'Which company was this with?' }

  const when = body?.happened_at ? new Date(body.happened_at) : new Date()
  if (!Number.isFinite(when.getTime())) return { ok: false, error: 'That time does not look right.' }

  const status = body?.status ?? 'email_sent'
  if (!isActivityStatus(status)) return { ok: false, error: 'Unknown status.' }
  // Checked here rather than in SQL. The column accepts every status from every
  // kind, so nothing in the database stops "Bounced" being filed against a
  // networking evening - and the message a person needs to read is a sentence,
  // not a constraint violation.
  if (!statusFitsKind(status, kind as ActivityKind)) {
    return { ok: false, error: `"${statusMeta(status).label}" is not something a ${kind} activity can be.` }
  }

  let followUp: string | null = null
  if (body?.follow_up_on) {
    const raw = String(body.follow_up_on).trim()
    if (!DATE_ONLY.test(raw)) return { ok: false, error: 'The follow-up date does not look right.' }
    followUp = raw
  }

  return {
    ok: true,
    fields: {
      kind,
      company: company.slice(0, 160),
      contact_name: text(body?.contact_name, 120),
      email: text(body?.email, 160),
      subject: text(body?.subject, 300),
      happened_at: when.toISOString(),
      status,
      next_step: text(body?.next_step, 300),
      follow_up_on: followUp,
      notes: text(body?.notes, 4000),
      updated_at: new Date().toISOString(),
    },
  }
}

export type WriteResult =
  | { ok: true; id: string; row: any }
  | { ok: false; error: string; status: number }

export async function saveActivity(
  admin: any,
  opts: {
    id?: string | null
    repId: string
    fields: Record<string, any>
    /** Admin only. An update scoped by a rep_id the row does not carry matches
     *  nothing, and Postgres reports no error for updating nothing - so
     *  reassigning would look like it worked and would not have. */
    allowReassign?: boolean
  },
): Promise<WriteResult> {
  try {
    if (opts.id) {
      let q = admin.from('rep_activities').update(
        opts.allowReassign ? { ...opts.fields, rep_id: opts.repId } : opts.fields,
      ).eq('id', opts.id)
      // A rep may only touch their own rows, so the update is scoped by rep_id
      // as well as by id: someone else's id then matches nothing.
      if (!opts.allowReassign) q = q.eq('rep_id', opts.repId)
      const { data, error } = await q.select('*')

      if (error) {
        if (isMissingTable(error)) return { ok: false, error: MIGRATION_075_MISSING, status: 503 }
        return { ok: false, error: error.message || 'Could not save that.', status: 500 }
      }
      // Selecting the affected rows is what turns "matched nothing" into
      // something reportable, rather than a success message over no change.
      if (!data || data.length === 0) {
        return { ok: false, error: 'That entry no longer exists, or it is not yours to change.', status: 404 }
      }
      return { ok: true, id: data[0].id, row: data[0] }
    }

    const { data, error } = await admin
      .from('rep_activities')
      .insert({ ...opts.fields, rep_id: opts.repId })
      .select('*')
      .single()

    if (error) {
      if (isMissingTable(error)) return { ok: false, error: MIGRATION_075_MISSING, status: 503 }
      return { ok: false, error: error.message || 'Could not save that.', status: 500 }
    }
    if (!data?.id) return { ok: false, error: 'Saved, but no id came back.', status: 500 }
    return { ok: true, id: data.id, row: data }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Could not save that.', status: 500 }
  }
}

export async function deleteActivity(
  admin: any,
  opts: { id: string; repId: string },
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data, error } = await admin
    .from('rep_activities')
    .delete()
    .eq('id', opts.id)
    .eq('rep_id', opts.repId)
    .select('id')
  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_075_MISSING, status: 503 }
    return { ok: false, error: error.message || 'Could not delete that.', status: 500 }
  }
  // Deleting nothing is not a success.
  if (!data || data.length === 0) {
    return { ok: false, error: 'That entry no longer exists, or it is not yours to delete.', status: 404 }
  }
  return { ok: true }
}

/**
 * Read outreach.
 *
 * select('*') rather than a column list, for the reason the whole codebase now
 * does it: naming a column a pending migration has not added returns an EMPTY
 * result, which looks exactly like having logged nothing.
 */
export async function listActivities(
  admin: any,
  opts: { repId?: string } = {},
): Promise<{ ok: true; activities: any[] } | { ok: false; error: string; status: number }> {
  try {
    let q = admin.from('rep_activities').select('*').order('happened_at', { ascending: false })
    if (opts.repId) q = q.eq('rep_id', opts.repId)
    const { data, error } = await q
    if (error) {
      if (isMissingTable(error)) return { ok: false, error: MIGRATION_075_MISSING, status: 503 }
      return { ok: false, error: error.message, status: 500 }
    }
    return { ok: true, activities: data || [] }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Could not read the outreach log.', status: 500 }
  }
}
