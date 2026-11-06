import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/rep-access'
import { auditLog } from '@/lib/admin-audit'
import {
  addProspect, assignProspects, bulkStatus, deleteProspects, listProspects, MIGRATION_105_MISSING, prospectActor,
  readPlaybook, savePlaybook, setProspectStatus, updateProspect,
} from '@/lib/prospects-server'

// A rep's prospects, or for an admin everyone's (lib/prospects-server draws that
// line). Nothing is emailed from here: marking a prospect writes the Activity
// log, and sending the email stays with the rep's own mail program.

export const dynamic = 'force-dynamic'

export async function GET() {
  const gate = await prospectActor()
  if ('error' in gate) return gate.error
  const { actor } = gate
  const admin = serviceClient()

  const res = await listProspects(admin, actor)
  if (res.error) return NextResponse.json({ error: res.error }, { status: 500 })

  const [{ data: reps }, playbook] = await Promise.all([
    actor.isAdmin ? admin.from('reps').select('id, name, active, phone').order('name') : Promise.resolve({ data: [] }),
    res.missing ? Promise.resolve(null) : readPlaybook(admin),
  ])

  return NextResponse.json({
    prospects: res.rows,
    missing: !!res.missing,
    message: res.missing ? MIGRATION_105_MISSING : undefined,
    playbook,
    reps: reps || [],
    me: { isAdmin: actor.isAdmin, repId: actor.repId, name: actor.repName, phone: actor.repPhone, canWrite: actor.canWrite, email: actor.email },
  })
}

const idList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0).slice(0, 2000) : []

export async function POST(request: Request) {
  const gate = await prospectActor()
  if ('error' in gate) return gate.error
  const { actor } = gate
  if (!actor.canWrite) return NextResponse.json({ error: 'This rep account is no longer active.' }, { status: 403 })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  const admin = serviceClient()

  const reply = (res: any) => {
    if (res?.error) return NextResponse.json({ error: res.error }, { status: res.status || 400 })
    return NextResponse.json({ success: true, ...res })
  }

  switch (body?.action) {
    case 'add':
      return reply(await addProspect(admin, actor, body.fields))
    case 'update':
      if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      return reply(await updateProspect(admin, actor, String(body.id), body.fields))
    case 'status':
      if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      return reply(await setProspectStatus(admin, actor, {
        id: String(body.id), status: body.status, channel: body.channel,
        follow_up_on: body.follow_up_on, meeting_at: body.meeting_at,
        ...('follow_up_note' in body ? { follow_up_note: body.follow_up_note } : {}),
      }))
    case 'bulk_status':
      return reply(await bulkStatus(admin, actor, idList(body.ids), body.status))
    case 'delete': {
      const ids = idList(body.ids)
      const res = await deleteProspects(admin, actor, ids)
      if (!('error' in res)) {
        await auditLog(admin, { actorUserId: actor.userId, actorEmail: actor.email, action: 'prospects_deleted', detail: { requested: ids.length, deleted: res.deleted } })
      }
      return reply(res)
    }
    case 'assign':
      return reply(await assignProspects(admin, actor, idList(body.ids), typeof body.rep_id === 'string' && body.rep_id ? body.rep_id : null))
    case 'save_playbook':
      return reply(await savePlaybook(admin, body))
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
