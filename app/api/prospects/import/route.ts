import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/rep-access'
import { auditLog } from '@/lib/admin-audit'
import { commitImport, listProspects, MIGRATION_105_MISSING, prospectActor, saToday } from '@/lib/prospects-server'
import { readWorkbook, SpreadsheetError, type ReadSheet } from '@/lib/xlsx-read'
import { collapse, listNameFromFile, parseWorkbook, planImport } from '@/lib/prospects-import'
import { parseDelimited } from '@/lib/csv-import'

// Bringing a rep's spreadsheet in.
//
// Two calls with the same file. mode=preview reads it and says what would happen
// (new, already here, with another rep) and writes nothing. mode=commit applies
// the sheets the person ticked. Nothing is held between the two, so an abandoned
// preview leaves nothing behind.

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_BYTES = 4 * 1024 * 1024

export async function POST(request: Request) {
  const gate = await prospectActor()
  if ('error' in gate) return gate.error
  const { actor } = gate
  if (!actor.canWrite) return NextResponse.json({ error: 'This rep account is no longer active.' }, { status: 403 })

  let form: FormData
  try { form = await request.formData() } catch { return NextResponse.json({ error: 'That upload did not arrive.' }, { status: 400 }) }
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a file first.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'That file is over 4 MB. Save it without pictures, or split it, and try again.' }, { status: 413 })

  let sheets: ReadSheet[]
  const buf = Buffer.from(await file.arrayBuffer())
  try {
    sheets = /\.(csv|txt|tsv)$/i.test(file.name)
      ? [{ name: 'Sheet1', hidden: false, rows: parseDelimited(buf.toString('utf8')) }]
      : readWorkbook(buf)
  } catch (e) {
    return NextResponse.json({ error: e instanceof SpreadsheetError ? e.message : 'That file could not be read. Save it as .xlsx or .csv and try again.' }, { status: 400 })
  }

  const today = saToday()
  const parsed = parseWorkbook(sheets, today)
  if (parsed.length === 0) {
    return NextResponse.json({ error: 'No contact list found in that file. It needs a Company column and an Email or Phone column.' }, { status: 400 })
  }

  // A rep's import is always theirs. Only an admin can load onto someone else.
  const requested = String(form.get('rep_id') || '')
  const repId = actor.isAdmin ? (requested || actor.repId) : actor.repId
  const listName = String(form.get('list') || '').trim().slice(0, 80) || listNameFromFile(file.name)

  const admin = serviceClient()
  const { rows: existing, missing, error } = await listProspects(admin, { ...actor, isAdmin: true })
  if (missing) return NextResponse.json({ error: MIGRATION_105_MISSING }, { status: 503 })
  if (error) return NextResponse.json({ error }, { status: 500 })

  const named = (rows: typeof parsed[number]['rows']) => rows.map(r => ({ ...r, lists: [...new Set([...r.lists, listName])] }))

  if (String(form.get('mode')) !== 'commit') {
    return NextResponse.json({
      listName,
      sheets: parsed.map(s => {
        const plan = planImport(named(s.rows), existing, repId)
        return {
          name: s.name,
          isList: s.isList,
          rows: s.rows.length,
          skipped: s.skipped,
          columns: s.columns.length,
          add: plan.create.length,
          update: plan.update.length,
          unchanged: plan.unchanged,
          otherRep: plan.otherRep,
        }
      }),
    })
  }

  let chosen: string[] = []
  try { chosen = JSON.parse(String(form.get('sheets') || '[]')) } catch { /* handled below */ }
  const picked = parsed.filter(s => chosen.includes(s.name))
  if (picked.length === 0) return NextResponse.json({ error: 'Tick at least one sheet to import.' }, { status: 400 })

  const res = await commitImport(admin, collapse(picked.flatMap(s => named(s.rows))), repId)
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })

  await auditLog(admin, {
    actorUserId: actor.userId, actorEmail: actor.email, action: 'prospects_imported',
    detail: { list: listName, sheets: picked.map(s => s.name), added: res.added, updated: res.updated },
  })
  return NextResponse.json({ success: true, ...res })
}
