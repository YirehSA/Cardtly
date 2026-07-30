// Reading and writing meetings, server side.
//
// Shared by the rep's own route and the admin route so the validation rules,
// the error wording and the migration tolerance are identical. The one thing
// this file deliberately does NOT decide is which rep a row belongs to: the
// caller passes repId, having established it from the session (a rep) or from
// an explicit choice by an admin. rep_id is never read out of a request body
// here, because that is how one rep ends up editing another's notes.

import {
  isMeetingStatus, isMeetingOutcome,
  DEFAULT_DURATION_MINUTES,
} from './rep-meetings'

/** Columns that arrive with migration 048. Applied by hand after the deploy, so
 *  between the two there is a window where the code knows about columns the
 *  table has not got yet. */
const LATE_COLUMNS = ['duration_minutes', 'location', 'follow_up_on'] as const

export const MIGRATION_047_MISSING = 'Meetings are not switched on yet: migration 047 has not been run.'

function isMissingTable(error: any): boolean {
  return error?.code === '42P01'
}

function isMissingColumn(error: any): boolean {
  return error?.code === '42703' || /column .* does not exist/i.test(String(error?.message || ''))
}

const text = (v: unknown, max: number): string | null => {
  const s = String(v ?? '').trim()
  return s ? s.slice(0, max) : null
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export type ParseResult =
  | { ok: true; fields: Record<string, any> }
  | { ok: false; error: string }

export function parseMeetingBody(body: any): ParseResult {
  const company = String(body?.company ?? '').trim()
  if (!company) return { ok: false, error: 'Which company are you seeing?' }
  if (!body?.scheduled_at) return { ok: false, error: 'When is the meeting?' }

  const when = new Date(body.scheduled_at)
  if (!Number.isFinite(when.getTime())) return { ok: false, error: 'That date does not look right.' }

  const status = body?.status ?? 'planned'
  if (!isMeetingStatus(status)) return { ok: false, error: 'Unknown status.' }

  // An outcome only makes sense once the meeting has happened. Storing one
  // against a planned meeting would put "signed up" on something that has not
  // taken place yet.
  let outcome: string | null = body?.outcome || null
  if (outcome && !isMeetingOutcome(outcome)) return { ok: false, error: 'Unknown outcome.' }
  if (status === 'planned') outcome = null

  // Clamped rather than rejected: a length is a convenience, and refusing to
  // save the whole meeting over it would be out of proportion. The DB check
  // constraint uses the same 5 to 1440 range.
  const rawDuration = Number(body?.duration_minutes)
  const duration = Number.isFinite(rawDuration) && rawDuration > 0
    ? Math.min(1440, Math.max(5, Math.round(rawDuration)))
    : DEFAULT_DURATION_MINUTES

  let followUp: string | null = null
  if (body?.follow_up_on) {
    const raw = String(body.follow_up_on).trim()
    if (!DATE_ONLY.test(raw)) return { ok: false, error: 'The follow-up date does not look right.' }
    followUp = raw
  }

  return {
    ok: true,
    fields: {
      company: company.slice(0, 160),
      contact_name: text(body?.contact_name, 120),
      contact_phone: text(body?.contact_phone, 40),
      contact_email: text(body?.contact_email, 160),
      scheduled_at: when.toISOString(),
      status,
      outcome,
      notes: text(body?.notes, 4000),
      duration_minutes: duration,
      location: text(body?.location, 200),
      follow_up_on: followUp,
      updated_at: new Date().toISOString(),
    },
  }
}

export type WriteResult =
  | { ok: true; id: string; degraded: boolean }
  | { ok: false; error: string; status: number }

/**
 * Insert or update one meeting.
 *
 * If migration 048 has not been run, the first write fails on the unknown
 * columns. Rather than showing the rep a database error for a feature they can
 * see on their screen, the newer columns are dropped and the write is retried -
 * and `degraded` comes back true so the caller can say plainly that the length
 * and location were not saved. Failing loudly there but succeeding on the parts
 * that CAN be stored beats losing the whole meeting.
 */
export async function saveMeeting(
  admin: any,
  opts: {
    id?: string | null
    repId: string
    fields: Record<string, any>
    /**
     * Let this write move a meeting to a different rep. Only an admin may:
     * they are the one looking at everybody and the one who can say "that was
     * actually Sipho's meeting".
     *
     * It also fixes a silent no-op. An update scoped by .eq('rep_id', repId)
     * with a repId the row does not carry matches nothing, and Postgres reports
     * no error for updating nothing - so reassigning through the admin form
     * showed "Meeting updated" and changed absolutely nothing.
     */
    allowReassign?: boolean
  },
): Promise<WriteResult> {
  const attempt = async (fields: Record<string, any>) => {
    if (opts.id) {
      let q = admin.from('rep_meetings').update(
        opts.allowReassign ? { ...fields, rep_id: opts.repId } : fields,
      ).eq('id', opts.id)
      // A rep may only ever touch their own rows, so their update is scoped by
      // rep_id as well as by id: someone else's id then matches nothing.
      if (!opts.allowReassign) q = q.eq('rep_id', opts.repId)
      const { data, error } = await q.select('id')
      // Selecting the affected rows is what turns "matched nothing" into
      // something we can report, rather than a success message over no change.
      if (!error && (!data || data.length === 0)) {
        return { error: { code: 'NO_ROWS', message: 'That meeting no longer exists, or it is not yours to change.' }, id: undefined }
      }
      return { error, id: opts.id }
    }
    const { data, error } = await admin
      .from('rep_meetings')
      .insert({ ...fields, rep_id: opts.repId })
      .select('id')
      .single()
    return { error, id: data?.id as string | undefined }
  }

  let res = await attempt(opts.fields)
  let degraded = false

  if (res.error && isMissingColumn(res.error)) {
    const stripped = { ...opts.fields }
    for (const c of LATE_COLUMNS) delete stripped[c]
    res = await attempt(stripped)
    degraded = true
  }

  if (res.error) {
    if (isMissingTable(res.error)) return { ok: false, error: MIGRATION_047_MISSING, status: 503 }
    if ((res.error as any).code === 'NO_ROWS') {
      return { ok: false, error: res.error.message, status: 404 }
    }
    return { ok: false, error: res.error.message || 'Could not save that.', status: 500 }
  }
  if (!res.id) return { ok: false, error: 'Saved, but no id came back.', status: 500 }
  return { ok: true, id: res.id, degraded }
}

export async function deleteMeeting(
  admin: any,
  opts: { id: string; repId: string },
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  // Scoped to the rep as well as the id, so an id belonging to someone else
  // matches nothing rather than deleting their meeting.
  const { data, error } = await admin
    .from('rep_meetings')
    .delete()
    .eq('id', opts.id)
    .eq('rep_id', opts.repId)
    .select('id')
  if (error) {
    if (isMissingTable(error)) return { ok: false, error: MIGRATION_047_MISSING, status: 503 }
    return { ok: false, error: error.message || 'Could not delete that.', status: 500 }
  }
  // Deleting nothing is not a success. Without this the row could belong to
  // another rep and the UI would still say "Meeting deleted".
  if (!data || data.length === 0) {
    return { ok: false, error: 'That meeting no longer exists, or it is not yours to delete.', status: 404 }
  }
  return { ok: true }
}

/**
 * Read meetings.
 *
 * select('*') rather than a column list on purpose: naming duration_minutes
 * before migration 048 exists would fail the whole query and return an EMPTY
 * calendar, which looks exactly like having no meetings. A star select returns
 * whatever the table currently has, and the readers all cope with the newer
 * fields being absent.
 */
export async function listMeetings(
  admin: any,
  opts: { repId?: string } = {},
): Promise<{ ok: true; meetings: any[] } | { ok: false; error: string; status: number }> {
  try {
    let q = admin.from('rep_meetings').select('*').order('scheduled_at', { ascending: false })
    if (opts.repId) q = q.eq('rep_id', opts.repId)
    const { data, error } = await q
    if (error) {
      if (isMissingTable(error)) return { ok: false, error: MIGRATION_047_MISSING, status: 503 }
      return { ok: false, error: error.message, status: 500 }
    }
    return { ok: true, meetings: data || [] }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Could not read meetings.', status: 500 }
  }
}
