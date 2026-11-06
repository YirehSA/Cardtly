import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRepForUser, serviceClient } from '@/lib/rep-access'
import { isAdminUser } from '@/lib/admin-check'
import { isMissingTable } from '@/lib/pg-errors'
import { parseActivityBody, saveActivity } from '@/lib/rep-activities-server'
import { parseCallBody, saveCall } from '@/lib/rep-calls-server'
import { parseMeetingBody, saveMeeting } from '@/lib/rep-meetings-server'
import {
  channelFor, isBarred, isProspectPriority, isProspectStatus, logEntryFor, PLAYBOOK_DEFAULTS, wasContacted,
  type Channel, type Playbook, type Prospect, type ProspectStatus,
} from '@/lib/prospects'
import { collapse, planImport, type Incoming } from '@/lib/prospects-import'

// Who may touch which prospects, and every write to them.
//
// THE BOUNDARY IS THE SAME AS THE ACTIVITY LOG'S. A rep works their own rows and
// no one else's: every read and write goes through scoped(), and rep_id is never
// taken from a rep's request. An admin (Andre, Tio) sees everyone's. An inactive
// rep keeps read access and stops being able to change anything.
//
// MARKING A PROSPECT IS LOGGING IT. This is the point of the feature: a status
// change writes the Email log, Call log or Calendar entry itself, through the
// same savers those screens use, so it counts in the same figures and nobody
// types it twice. A log failure never loses the status change.

export const MIGRATION_105_MISSING = 'Prospects are not switched on yet: migration 105 has not been run.'

/** A slip corrected within this long replaces its log entries rather than adding
 *  to them, so a mis-click does not inflate the figures a rep is measured on. */
const SLIP_WINDOW_MS = 10 * 60 * 1000

export interface ProspectActor {
  userId: string
  email: string | null
  isAdmin: boolean
  repId: string | null
  repName: string | null
  repPhone: string | null
  /** May change anything at all. An inactive rep may only look. */
  canWrite: boolean
}

export async function prospectActor(): Promise<{ actor: ProspectActor } | { error: NextResponse }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) }

  const admin = serviceClient()
  const [isAdmin, rep] = await Promise.all([
    isAdminUser(user.id),
    getRepForUser(admin, user.id, user.email),
  ])
  if (!isAdmin && !rep) return { error: NextResponse.json({ error: 'Not authorized' }, { status: 403 }) }

  let repPhone: string | null = null
  if (rep) {
    const { data } = await admin.from('reps').select('phone').eq('id', rep.id).maybeSingle()
    repPhone = data?.phone || null
  }
  return {
    actor: {
      userId: user.id,
      email: user.email || null,
      isAdmin,
      repId: rep?.id || null,
      repName: rep?.name || null,
      repPhone,
      canWrite: isAdmin || !!rep?.active,
    },
  }
}

/** Limits a query to what this actor may touch. Every read and write goes here. */
export function scoped(q: any, actor: ProspectActor): any {
  return actor.isAdmin ? q : q.eq('rep_id', actor.repId)
}

/** Today in South Africa. The servers run on UTC, so before 02:00 UTC's date is
 *  still yesterday's and a call logged at 01:00 would land on the wrong day. */
export const saToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date())

const PAGE = 1000

export async function listProspects(admin: any, actor: ProspectActor): Promise<{ rows: Prospect[]; missing?: boolean; error?: string }> {
  const rows: Prospect[] = []
  // PostgREST caps a response at 1000 rows, so it reads in pages.
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await scoped(admin.from('rep_prospects').select('*'), actor)
      .order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, from + PAGE - 1)
    if (error) {
      if (isMissingTable(error)) return { rows: [], missing: true }
      return { rows: [], error: 'Could not read the prospects.' }
    }
    rows.push(...(data || []))
    if (!data || data.length < PAGE) break
  }
  return { rows }
}

export async function readPlaybook(admin: any): Promise<Playbook> {
  const { data } = await admin.from('rep_playbook').select('*').eq('id', true).maybeSingle()
  return {
    script: data?.script || '',
    email_subject: data?.email_subject || PLAYBOOK_DEFAULTS.email_subject,
    email_body: data?.email_body || PLAYBOOK_DEFAULTS.email_body,
  }
}

export async function savePlaybook(admin: any, body: any): Promise<{ error?: string }> {
  const { error } = await admin.from('rep_playbook').upsert({
    id: true,
    script: String(body?.script ?? '').slice(0, 20000),
    email_subject: String(body?.email_subject ?? '').slice(0, 300),
    email_body: String(body?.email_body ?? '').slice(0, 8000),
    updated_at: new Date().toISOString(),
  })
  return error ? { error: 'Could not save that.' } : {}
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const text = (v: unknown, max: number): string | null => {
  const s = String(v ?? '').trim()
  return s ? s.slice(0, max) : null
}

const EDIT_LIMITS: Record<string, number> = {
  company: 200, contact_name: 160, first_name: 80, role: 160, phone: 40, sector: 120, region: 120,
  fit: 2000, research_notes: 8000, notes: 8000, follow_up_note: 300,
}

/** The fields a person may type into, checked. Status has its own path below,
 *  because it is the one that logs. */
function editableFields(body: any): { fields: Record<string, any> } | { error: string } {
  const fields: Record<string, any> = {}
  for (const [k, max] of Object.entries(EDIT_LIMITS)) {
    if (k in (body || {})) fields[k] = text(body[k], max)
  }
  if ('company' in (body || {}) && !fields.company) return { error: 'A prospect needs a company name.' }
  if ('email' in (body || {})) {
    const e = text(body.email, 320)?.toLowerCase() ?? null
    if (e && !EMAIL.test(e)) return { error: 'That email address does not look right.' }
    fields.email = e
  }
  if ('priority' in (body || {})) {
    if (!isProspectPriority(body.priority)) return { error: 'Unknown priority.' }
    fields.priority = body.priority
  }
  if ('follow_up_on' in (body || {})) {
    const d = text(body.follow_up_on, 10)
    if (d && !DATE_ONLY.test(d)) return { error: 'The follow-up date does not look right.' }
    fields.follow_up_on = d
  }
  return { fields }
}

const DUPLICATE = '23505'

export async function addProspect(admin: any, actor: ProspectActor, body: any) {
  const parsed = editableFields(body)
  if ('error' in parsed) return { error: parsed.error, status: 400 }
  if (!parsed.fields.company) return { error: 'A prospect needs a company name.', status: 400 }
  if (!parsed.fields.email && !parsed.fields.phone) return { error: 'Add an email address or a phone number, so there is a way to reach them.', status: 400 }

  // A rep's prospect is theirs. Only an admin can put one on somebody else's list.
  const repId = actor.isAdmin ? (typeof body?.rep_id === 'string' && body.rep_id ? body.rep_id : actor.repId) : actor.repId
  const first = parsed.fields.first_name || (parsed.fields.contact_name ? parsed.fields.contact_name.split(/\s+/)[0] : null)
  const { data, error } = await admin.from('rep_prospects')
    .insert({ ...parsed.fields, first_name: first, rep_id: repId, lists: ['Added by hand'] })
    .select('*').single()
  if (error) {
    if (error.code === DUPLICATE) return { error: 'That email address is already on the list.', status: 409 }
    if (isMissingTable(error)) return { error: MIGRATION_105_MISSING, status: 503 }
    return { error: 'Could not add that.', status: 500 }
  }
  return { row: data as Prospect }
}

export async function updateProspect(admin: any, actor: ProspectActor, id: string, body: any) {
  const parsed = editableFields(body)
  if ('error' in parsed) return { error: parsed.error, status: 400 }
  const { data, error } = await scoped(admin.from('rep_prospects')
    .update({ ...parsed.fields, updated_at: new Date().toISOString() }).eq('id', id), actor).select('*')
  if (error) {
    if (error.code === DUPLICATE) return { error: 'That email address is already on the list.', status: 409 }
    return { error: 'Could not save that.', status: 500 }
  }
  // Selecting the rows is what turns "matched nothing" into something reportable.
  if (!data?.length) return { error: 'That prospect no longer exists, or it is not yours to change.', status: 404 }
  return { row: data[0] as Prospect }
}

interface LogItem { table: 'rep_activities' | 'rep_calls' | 'rep_meetings'; id: string }

async function removeLogs(admin: any, items: LogItem[]) {
  for (const item of items) {
    await admin.from(item.table).delete().eq('id', item.id)
  }
}

/** Writes the Activity log entry for a status, through the screens' own savers. */
async function writeLog(admin: any, p: Prospect, status: ProspectStatus, channel: Channel): Promise<LogItem | null> {
  const entry = logEntryFor(status, channel)
  if (!entry || !p.rep_id) return null
  if (entry.table === 'activity') {
    const parsed = parseActivityBody({
      kind: 'email', company: p.company, contact_name: p.contact_name, email: p.email,
      status: entry.status, subject: 'Reseller prospect',
    })
    if (!parsed.ok) return null
    const res = await saveActivity(admin, { repId: p.rep_id, fields: parsed.fields })
    return res.ok ? { table: 'rep_activities', id: res.id } : null
  }
  const parsed = parseCallBody({
    company: p.company, contact_name: p.contact_name, phone: p.phone, email: p.email, outcome: entry.outcome,
  })
  if (!parsed.ok) return null
  const res = await saveCall(admin, { repId: p.rep_id, fields: parsed.fields })
  return res.ok ? { table: 'rep_calls', id: res.id } : null
}

export interface StatusInput {
  id: string
  status: unknown
  channel?: unknown
  /** A follow-up date, for Follow up. */
  follow_up_on?: unknown
  follow_up_note?: unknown
  /** The meeting's date and time, for Meeting booked. Puts it on the calendar. */
  meeting_at?: unknown
}

export async function setProspectStatus(admin: any, actor: ProspectActor, input: StatusInput) {
  if (!isProspectStatus(input.status)) return { error: 'Unknown status.', status: 400 }
  const status = input.status

  const { data: found, error: readErr } = await scoped(admin.from('rep_prospects').select('*').eq('id', input.id), actor).maybeSingle()
  if (readErr) return { error: 'Could not read that prospect.', status: 500 }
  if (!found) return { error: 'That prospect no longer exists, or it is not yours to change.', status: 404 }
  const p = found as Prospect & { last_log?: { at?: string; items?: LogItem[] } | null }

  const followOn = text(input.follow_up_on, 10)
  if (followOn && !DATE_ONLY.test(followOn)) return { error: 'The follow-up date does not look right.', status: 400 }

  let meetingAt: Date | null = null
  if (input.meeting_at) {
    meetingAt = new Date(String(input.meeting_at))
    if (!Number.isFinite(meetingAt.getTime())) return { error: 'That meeting time does not look right.', status: 400 }
  }

  const channel: Channel = input.channel === 'email' || input.channel === 'call' ? input.channel : channelFor(status, p)
  const today = saToday()
  const changed = status !== p.status
  const items: LogItem[] = []
  let logged: string | null = null

  // A correction, not a second event. Set "Email sent" by mistake, fix it two
  // minutes later: one thing happened, and the log should say one thing.
  const previous = p.last_log
  const withinSlip = !!previous?.at && Date.now() - new Date(previous.at).getTime() < SLIP_WINDOW_MS
  if (changed && withinSlip && previous?.items?.length) await removeLogs(admin, previous.items)

  if (changed) {
    const item = await writeLog(admin, p, status, channel)
    if (item) {
      items.push(item)
      logged = item.table === 'rep_calls' ? 'Call log' : 'Email log'
    }
  }

  // Meeting booked with a time goes on the calendar as a real meeting.
  if (status === 'meeting_booked' && meetingAt && p.rep_id) {
    const parsed = parseMeetingBody({
      company: p.company, contact_name: p.contact_name, contact_phone: p.phone, contact_email: p.email,
      scheduled_at: meetingAt.toISOString(), status: 'planned', notes: text(input.follow_up_note, 2000),
    })
    if (parsed.ok) {
      const res = await saveMeeting(admin, { repId: p.rep_id, fields: parsed.fields })
      if (res.ok) {
        items.push({ table: 'rep_meetings', id: res.id })
        logged = 'Calendar'
      }
    }
  }

  const patch: Record<string, any> = {
    status,
    last_channel: changed && logEntryFor(status, channel) ? channel : p.last_channel,
    updated_at: new Date().toISOString(),
  }
  if (status === 'email_sent' && !p.emailed_on) patch.emailed_on = today
  if (changed && wasContacted(status) && status !== 'follow_up') patch.last_contact_on = today
  if (changed && status === 'bounced') patch.last_contact_on = today
  if (followOn) patch.follow_up_on = followOn
  if (meetingAt) patch.follow_up_on = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(meetingAt)
  if ('follow_up_note' in input) patch.follow_up_note = text(input.follow_up_note, 300)
  if (changed) patch.last_log = items.length ? { at: new Date().toISOString(), items } : null

  const { data, error } = await scoped(admin.from('rep_prospects').update(patch).eq('id', p.id), actor).select('*')
  if (error || !data?.length) return { error: 'Could not save that.', status: 500 }
  return { row: data[0] as Prospect, logged }
}

/**
 * One status on many rows, for "I have just sent these fifty". Meeting booked is
 * refused: each needs its own time. Marking a bounced or do-not-contact address
 * as emailed is refused row by row and reported, because that email must not go.
 */
export async function bulkStatus(admin: any, actor: ProspectActor, ids: string[], statusRaw: unknown) {
  if (!isProspectStatus(statusRaw)) return { error: 'Unknown status.', status: 400 }
  const status = statusRaw
  if (status === 'meeting_booked') return { error: 'A meeting needs its own date and time, so set those one at a time.', status: 400 }

  const { rows, error } = await listProspects(admin, actor)
  if (error) return { error, status: 500 }
  const wanted = new Set(ids)
  const picked = rows.filter(r => wanted.has(r.id))
  const blocked = status === 'email_sent' ? picked.filter(isBarred) : []
  const go = picked.filter(r => r.status !== status && !blocked.includes(r))
  const today = saToday()

  // Written in one insert per table. Fifty separate round trips for a mail merge
  // would run into the function's time limit.
  const activities: any[] = []
  const calls: any[] = []
  for (const p of go) {
    if (!p.rep_id) continue
    const channel = channelFor(status, p)
    const entry = logEntryFor(status, channel)
    if (entry?.table === 'activity') {
      const parsed = parseActivityBody({ kind: 'email', company: p.company, contact_name: p.contact_name, email: p.email, status: entry.status, subject: 'Reseller prospect' })
      if (parsed.ok) activities.push({ ...parsed.fields, rep_id: p.rep_id })
    } else if (entry?.table === 'call') {
      const parsed = parseCallBody({ company: p.company, contact_name: p.contact_name, phone: p.phone, email: p.email, outcome: entry.outcome })
      if (parsed.ok) calls.push({ ...parsed.fields, rep_id: p.rep_id })
    }
  }
  if (activities.length) {
    const { error: e } = await admin.from('rep_activities').insert(activities)
    if (e) console.error('prospect bulk: activity log failed', e.code, e.message)
  }
  if (calls.length) {
    const { error: e } = await admin.from('rep_calls').insert(calls)
    if (e) console.error('prospect bulk: call log failed', e.code, e.message)
  }

  const now = new Date().toISOString()
  for (let i = 0; i < go.length; i += 200) {
    const chunk = go.slice(i, i + 200).map(r => r.id)
    const patch: Record<string, any> = { status, updated_at: now, last_log: null }
    if (status === 'email_sent' || status === 'replied' || status === 'bounced') patch.last_channel = 'email'
    if (status === 'called_no_answer') patch.last_channel = 'call'
    if (wasContacted(status) && status !== 'follow_up') patch.last_contact_on = today
    const { error: e } = await scoped(admin.from('rep_prospects').update(patch).in('id', chunk), actor)
    if (e) return { error: 'Could not save all of those.', status: 500 }
    if (status === 'email_sent') {
      await scoped(admin.from('rep_prospects').update({ emailed_on: today }).in('id', chunk).is('emailed_on', null), actor)
    }
  }
  return { changed: go.length, blocked: blocked.length, logged: activities.length + calls.length }
}

/**
 * Removing prospects. A rep cannot delete a do-not-contact row: that row is what
 * stops the address being written to again when it turns up on the next list.
 * An admin can, for a person who has asked to be erased altogether.
 */
export async function deleteProspects(admin: any, actor: ProspectActor, ids: string[]) {
  let q = scoped(admin.from('rep_prospects').delete({ count: 'exact' }).in('id', ids), actor)
  if (!actor.isAdmin) q = q.neq('status', 'do_not_contact')
  const { error, count } = await q
  if (error) return { error: 'Could not delete those.', status: 500 }
  return { deleted: count ?? 0 }
}

export async function assignProspects(admin: any, actor: ProspectActor, ids: string[], repId: string | null) {
  if (!actor.isAdmin) return { error: 'Only an admin can move prospects between reps.', status: 403 }
  const { error } = await admin.from('rep_prospects').update({ rep_id: repId, updated_at: new Date().toISOString() }).in('id', ids)
  if (error) return { error: 'Could not move those.', status: 500 }
  return { moved: ids.length }
}

/**
 * Applies an import. Rows are checked against the WHOLE table, not just this
 * rep's, because the email address is unique across all reps.
 */
export async function commitImport(admin: any, rows: Incoming[], repId: string | null) {
  const actorAll = { isAdmin: true } as ProspectActor
  const { rows: existing, missing, error } = await listProspects(admin, actorAll)
  if (missing) return { error: MIGRATION_105_MISSING, status: 503 }
  if (error) return { error, status: 500 }

  const plan = planImport(collapse(rows), existing, repId)
  for (let i = 0; i < plan.create.length; i += 200) {
    const chunk = plan.create.slice(i, i + 200).map(r => ({ ...r, rep_id: repId }))
    const { error: e } = await admin.from('rep_prospects').insert(chunk)
    if (e) {
      console.error('prospect import failed', e.code, e.message)
      return { error: 'Could not save those contacts.', status: 500 }
    }
  }
  for (const u of plan.update) {
    const { error: e } = await admin.from('rep_prospects').update({ ...u.patch, updated_at: new Date().toISOString() }).eq('id', u.id)
    if (e) console.error('prospect import update failed', e.code, e.message)
  }
  return { added: plan.create.length, updated: plan.update.length, unchanged: plan.unchanged, otherRep: plan.otherRep }
}
