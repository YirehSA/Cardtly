'use client'

import { useState, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { X, Upload, Loader2, AlertTriangle, Check, FileSpreadsheet } from 'lucide-react'
import {
  parseDelimited, detectColumns, looksLikeHeader, toRows, checkRows,
  summarise, STATUS_LABEL, routingHint, rowsToCsv, type CheckedRow, type ImportTarget,
} from '@/lib/csv-import'

// Import a spreadsheet of staff as team cards.
//
// The whole design is built around one rule: the admin sees exactly what will
// happen before any of it happens. Every row is shown with its outcome and the
// invitations are counted out loud, because sending 200 invitations off a
// mis-read file cannot be undone. There is no way to reach the import button
// without passing the preview.

const BATCH = 25

// The worked example shown above the paste box: every column Cardtly reads,
// with values that look like a real South African staff list.
//
// Company and Department are two columns, not one.
//
// They used to be a single column, because routing read r.company and
// "business unit", "division" and "branch" were all aliases of it. That made
// a group with a Sales in two different businesses impossible to express: the
// bare name was ambiguous and refused, and naming the company was refused too
// because cards attach to departments. Two columns is also simply how a staff
// list comes out of any HR system, so it needs no explaining.
type ExampleKey = 'name' | 'email' | 'title' | 'phone' | 'company' | 'department'

function exampleColumns(routes: boolean): Array<{ header: string; key: ExampleKey; optional?: boolean }> {
  const base: Array<{ header: string; key: ExampleKey; optional?: boolean }> = [
    { header: 'Name', key: 'name' },
    { header: 'Email', key: 'email' },
    { header: 'Job title', key: 'title', optional: true },
    { header: 'Phone', key: 'phone', optional: true },
    { header: 'Company', key: 'company', optional: true },
  ]
  // Only shown to a team that has departments to route into. A flat team has
  // nowhere to put it, and a column that cannot do anything is a column
  // somebody will still try to fill in.
  return routes
    ? [...base, { header: 'Department', key: 'department', optional: true }]
    : base
}

function exampleRows(routes: boolean): Array<Record<ExampleKey, string>> {
  return [
    {
      name: 'Thabo Nkosi', email: 'thabo@company.co.za', title: 'Site Manager',
      phone: '082 123 4567',
      company: routes ? 'Vistio' : 'TBCo Roofing',
      department: 'Site Management',
    },
    {
      name: 'Sarah Botha', email: 'sarah@company.co.za', title: 'Sales Director',
      phone: '083 987 6543',
      company: routes ? 'Cardtly' : 'TBCo Roofing',
      department: 'Sales',
    },
  ]
}

// One ExcelJS cell to plain text.
//
// A cell value is not always a string: a formula arrives as { result }, a
// hyperlinked email as { text, hyperlink }, styled text as { richText }, and
// a date as a Date. String() on any of those writes "[object Object]" into
// the column, which then fails validation with nothing explaining why.
function cellText(v: any): string {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (Array.isArray(v.richText)) return v.richText.map((t: any) => t?.text || '').join('').trim()
  if (typeof v.text === 'string') return v.text.trim()
  if ('result' in v) return cellText(v.result)
  if ('error' in v) return ''
  return String(v).trim()
}

type Props = {
  orgId: string
  orgName: string
  seatsAvailable: number
  /** Existing cards, offered as the source of branding for the new ones. */
  cards: Array<{ id: string; name: string | null }>
  /**
   * Everyone already on the team. The preview has to know, or it promises to
   * add someone who is already here and the server then silently skips them -
   * the admin reads "12 will be added", sees 9 appear, and has no idea why.
   */
  existingEmails: string[]
  /**
   * Departments the spreadsheet's business-unit column can route people into.
   * Empty for a team with no structure, in which case nothing is routed and
   * the preview shows no routing column at all.
   */
  targets: ImportTarget[]
  onClose: () => void
  onDone: () => void
}

type Phase = 'paste' | 'preview' | 'running' | 'done'

type RowResult = {
  line: number
  email: string
  name: string
  outcome: 'created' | 'created_no_email' | 'skipped' | 'failed'
  reason?: string
}

export default function BulkImportModal({ orgId, orgName, seatsAvailable, cards, existingEmails, targets, onClose, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>('paste')
  const [text, setText] = useState('')
  const [sendInvites, setSendInvites] = useState(true)
  const [copyFromId, setCopyFromId] = useState(cards[0]?.id || '')
  const [done, setDone] = useState(0)
  const [results, setResults] = useState<RowResult[]>([])
  // Reading a workbook pulls in ExcelJS and parses a zip, so on a big staff
  // list it is long enough that a silent button looks broken.
  const [readingFile, setReadingFile] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => {
    if (!text.trim()) return null
    const grid = parseDelimited(text)
    if (grid.length === 0) return null
    const hasHeader = looksLikeHeader(grid[0])
    const map = detectColumns(hasHeader ? grid[0] : [])
    const rows = toRows(grid, map, hasHeader)
    return { grid, hasHeader, map, rows, checked: checkRows(rows, existingEmails, seatsAvailable, targets) }
  }, [text, seatsAvailable, existingEmails, targets])

  const stats = parsed ? summarise(parsed.checked) : null
  const ready = stats?.ready || 0

  // A real .xlsx is a zip, so reading it as text yields binary rubbish and a
  // preview full of nonsense. People export a staff list from Excel or HR and
  // upload exactly that file, so it is read properly instead.
  async function loadXlsx(file: File) {
    setReadingFile(true)
    try {
      // The prebuilt browser bundle, loaded only when somebody actually picks
      // a workbook, so it stays out of the team dashboard's initial bundle.
      // @ts-expect-error - the dist bundle has no bundled types
      const ExcelJS = (await import('exceljs/dist/exceljs.min.js')).default
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await file.arrayBuffer())

      // The first worksheet with anything in it. A workbook whose first tab is
      // a blank cover sheet is common enough to be worth skipping past.
      const sheet = wb.worksheets.find((s: any) => s.rowCount > 0) || wb.worksheets[0]
      if (!sheet) { toast.error('That workbook has no sheets in it'); return }

      const rows: string[][] = []
      sheet.eachRow((row: any) => {
        const cells: string[] = []
        // values is 1-based and sparse; index by column so a blank cell keeps
        // its position and does not shift every later column left by one.
        for (let c = 1; c <= sheet.columnCount; c++) {
          cells.push(cellText(row.getCell(c).value))
        }
        rows.push(cells)
      })

      if (rows.length === 0) { toast.error('That sheet is empty'); return }
      if (wb.worksheets.length > 1) {
        toast.success(`Read "${sheet.name}". Other sheets were ignored.`)
      }
      setText(rowsToCsv(rows))
      setPhase('preview')
    } catch {
      toast.error('Could not read that spreadsheet. Save it as CSV and try again.')
    } finally {
      setReadingFile(false)
    }
  }

  function loadFile(file: File) {
    if (file.size > 2_000_000) { toast.error('That file is larger than 2MB. Split it and import in parts.'); return }
    if (/\.xlsx?$/i.test(file.name)) { loadXlsx(file); return }
    const reader = new FileReader()
    reader.onload = () => { setText(String(reader.result || '')); setPhase('preview') }
    reader.onerror = () => toast.error('Could not read that file')
    reader.readAsText(file)
  }

  async function run() {
    if (!parsed) return
    const queue = parsed.checked.filter(r => r.status === 'ready')
    if (queue.length === 0) return

    setPhase('running')
    setDone(0)
    const all: RowResult[] = []

    for (let i = 0; i < queue.length; i += BATCH) {
      // department travels with the row.
      //
      // It did not, and the server re-derives routing from these fields rather
      // than trusting departmentId - so the department column was read here,
      // shown in the preview, and then never sent, leaving the server to fall
      // back to the company column and route nowhere. Two halves of one wire,
      // each correct on its own.
      const slice = queue.slice(i, i + BATCH).map(r => ({
        line: r.line, name: r.name, email: r.email, title: r.title, phone: r.phone,
        company: r.company, department: r.department,
        departmentId: r.departmentId ?? null,
      }))
      try {
        const res = await fetch('/api/team/bulk-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: orgId, rows: slice, send_invites: sendInvites, copy_from_id: copyFromId || undefined }),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error || 'Import failed')
          // Stop rather than plough on: whatever went wrong will go wrong
          // again on the next batch, and a half-finished import is easier to
          // reason about than one that failed 20 times.
          break
        }
        all.push(...(data.results || []))
      } catch {
        toast.error('Lost connection during the import')
        break
      }
      setDone(Math.min(i + BATCH, queue.length))
      setResults([...all])
    }

    setResults(all)
    setPhase('done')
    onDone()
  }

  const createdCount = results.filter(r => r.outcome === 'created').length
  const noEmailCount = results.filter(r => r.outcome === 'created_no_email').length
  const failedCount = results.filter(r => r.outcome === 'failed').length

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 sm:p-8">
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl my-auto">

        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-bold">Import people from a spreadsheet</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">

          {(phase === 'paste' || phase === 'preview') && (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Upload an Excel file (.xlsx), choose a CSV, or paste straight out of a spreadsheet.
                Cardtly reads columns named
                {' '}<strong className="text-foreground">name</strong> (or first and last name),
                {' '}<strong className="text-foreground">email</strong>, job title, phone and company
                {targets.length > 0 && <>, plus <strong className="text-foreground">business unit</strong> to file each person into the right team</>}.
              </p>

              {/* Said once, up front. Without this a full team pastes a list,
                  every row comes back rejected, and nothing on screen connects
                  that to the seat count. */}
              {seatsAvailable <= 0 && (
                <div className="mb-4 rounded-xl border p-3 flex items-start gap-2.5"
                  style={{ borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.1)' }}>
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#f59e0b' }} />
                  <div className="text-xs">
                    <p className="font-bold" style={{ color: '#f59e0b' }}>Every seat is taken</p>
                    <p className="text-muted-foreground mt-0.5">
                      You can still paste your list and check it reads correctly, but nothing can be
                      created until there is room. Add seats under Billing, or remove someone who has left.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 mb-3">
                <button onClick={() => fileRef.current?.click()}
                  disabled={readingFile}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition disabled:opacity-50">
                  {readingFile
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Reading</>
                    : <><Upload className="w-4 h-4" />Choose a file</>}
                </button>
                <input ref={fileRef} type="file" className="hidden"
                  accept=".xlsx,.xls,.csv,.tsv,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) loadFile(f)
                    // Cleared so picking the same file twice fires onChange
                    // again, which it otherwise does not after a failed read.
                    e.target.value = ''
                  }} />
                <span className="text-xs text-muted-foreground">Excel (.xlsx), CSV, tab or semicolon separated</span>
              </div>

              {/* A worked example as a real table.
                  This was a placeholder inside the textarea with tab
                  characters between the values. A tab advances to the next tab
                  stop rather than to a column, so the header and the row under
                  it never lined up, and it only ever showed three of the six
                  columns Cardtly actually reads - so phone, company and the
                  business unit looked unsupported. A table lines up because it
                  is a table, and it can show every column. */}
              <div className="mb-3 rounded-xl border border-border overflow-hidden">
                <p className="text-xs font-semibold px-3 py-2 border-b border-border bg-muted/40">
                  What your spreadsheet should look like
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/20">
                        {exampleColumns(targets.length > 0).map(c => (
                          <th key={c.header}
                            className="text-left font-bold px-3 py-2 whitespace-nowrap border-b border-border">
                            {c.header}
                            {c.optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      {exampleRows(targets.length > 0).map((row, i) => (
                        <tr key={i} className={i > 0 ? 'border-t border-border/60' : ''}>
                          {exampleColumns(targets.length > 0).map(c => (
                            <td key={c.header} className="px-3 py-2 whitespace-nowrap">{row[c.key]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-muted-foreground px-3 py-2 border-t border-border leading-relaxed">
                  Only <strong className="text-foreground">Name</strong> and{' '}
                  <strong className="text-foreground">Email</strong> are required, and the order of the
                  columns does not matter. Headings can be worded differently: &ldquo;Surname&rdquo; with
                  &ldquo;First name&rdquo; instead of one Name, &ldquo;Cell&rdquo; or &ldquo;Contact
                  number&rdquo; for the phone
                  {targets.length > 0
                    ? <>, and &ldquo;Business unit&rdquo;, &ldquo;Division&rdquo; or &ldquo;Team&rdquo; for the department.
                      Each person is filed into that team automatically. If two of your businesses both
                      have a department with the same name, the <strong className="text-foreground">Company</strong> column
                      is what tells them apart. You will see exactly where every row is going before anything is created.</>
                    : '.'}
                </p>
              </div>

              <textarea
                value={text}
                onChange={e => { setText(e.target.value); setPhase('preview') }}
                rows={6}
                aria-label="Paste your spreadsheet here"
                placeholder="Paste your rows here, or use Choose a file above."
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
            </>
          )}

          {parsed && phase === 'preview' && (
            <div className="mt-5">
              {!parsed.hasHeader && (
                <div className="flex gap-2.5 items-start rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 mb-4">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    No header row was recognised, so the first line is being treated as a person.
                    If your file has headings, check they are named something like Name and Email.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm mb-3">
                <span><strong className="text-foreground">{ready}</strong> will be added</span>
                {stats && stats.skipped > 0 && (
                  <span className="text-muted-foreground">{stats.skipped} skipped</span>
                )}
                <span className="text-muted-foreground">{seatsAvailable} seat{seatsAvailable === 1 ? '' : 's'} free</span>
              </div>

              <div className="max-h-64 overflow-y-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="text-left font-medium text-xs uppercase tracking-wide text-muted-foreground px-3 py-2">Name</th>
                      <th className="text-left font-medium text-xs uppercase tracking-wide text-muted-foreground px-3 py-2">Email</th>
                      {targets.length > 0 && (
                        <th className="text-left font-medium text-xs uppercase tracking-wide text-muted-foreground px-3 py-2">Goes to</th>
                      )}
                      <th className="text-left font-medium text-xs uppercase tracking-wide text-muted-foreground px-3 py-2">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.checked.map((r: CheckedRow) => (
                      <tr key={`${r.line}-${r.email}`} className="border-t border-border">
                        <td className="px-3 py-1.5">{r.name || <span className="text-muted-foreground">-</span>}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{r.email || '-'}</td>
                        {targets.length > 0 && (
                          <td className="px-3 py-1.5">
                            {/* The company as well as the department. Two
                                businesses in a group can each have a "Sales",
                                and a preview that says only "Sales" cannot
                                tell you which one this person is about to
                                land in - which is the whole question. */}
                            {r.departmentName
                              ? (() => {
                                const t = targets.find(x => x.id === r.departmentId)
                                return t?.parentName
                                  ? <span><span className="text-muted-foreground">{t.parentName} › </span>{t.name}</span>
                                  : <span>{r.departmentName}</span>
                              })()
                              : <span className="text-amber-600 dark:text-amber-400" title={routingHint(r.company, targets)}>
                                  Nowhere
                                </span>}
                          </td>
                        )}
                        <td className="px-3 py-1.5">
                          <span className={r.status === 'ready' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                            {STATUS_LABEL[r.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={sendInvites} onChange={e => setSendInvites(e.target.checked)} className="mt-0.5" />
                  <span>
                    Email an invitation to each person
                    <span className="block text-xs text-muted-foreground">
                      {sendInvites
                        ? `${ready} email${ready === 1 ? '' : 's'} will be sent now.`
                        : 'Cards are created now, you invite them later.'}
                    </span>
                  </span>
                </label>

                {cards.length > 0 && (
                  <label className="text-sm">
                    Copy branding from
                    <select value={copyFromId} onChange={e => setCopyFromId(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-background text-sm">
                      <option value="">Do not copy</option>
                      {cards.map(c => <option key={c.id} value={c.id}>{c.name || 'Untitled card'}</option>)}
                    </select>
                  </label>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mt-5">
                <button onClick={run} disabled={ready === 0}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
                  {ready === 0 ? 'Nothing to import' : `Add ${ready} ${ready === 1 ? 'person' : 'people'}${sendInvites ? ' and invite them' : ''}`}
                </button>
                <button onClick={() => { setText(''); setPhase('paste') }}
                  className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition">
                  Clear
                </button>
              </div>
            </div>
          )}

          {phase === 'running' && (
            <div className="py-10 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium">Adding people to {orgName}</p>
              <p className="text-sm text-muted-foreground mt-1">{done} of {ready} done</p>
              <div className="h-1.5 bg-muted rounded-full mt-4 max-w-xs mx-auto overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${ready ? (done / ready) * 100 : 0}%`, background: 'linear-gradient(90deg, #00d4ff, #7c3aed, #ec4899)' }} />
              </div>
              <p className="text-xs text-muted-foreground mt-4">Leave this open until it finishes.</p>
            </div>
          )}

          {phase === 'done' && (
            <div className="py-6">
              <div className="flex items-center gap-2 mb-4">
                <Check className="w-5 h-5 text-green-500" />
                <p className="font-bold">{createdCount} card{createdCount === 1 ? '' : 's'} created</p>
              </div>

              {noEmailCount > 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">
                  {noEmailCount} card{noEmailCount === 1 ? ' was' : 's were'} created but the invitation could not be
                  sent. The cards are on the team, so resend from the card itself rather than importing again.
                </p>
              )}
              {failedCount > 0 && (
                <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                  {failedCount} row{failedCount === 1 ? '' : 's'} could not be added. Listed below.
                </p>
              )}

              {(failedCount > 0 || noEmailCount > 0) && (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-border mt-3">
                  <table className="w-full text-sm">
                    <tbody>
                      {results.filter(r => r.outcome === 'failed' || r.outcome === 'created_no_email').map(r => (
                        <tr key={`${r.line}-${r.email}`} className="border-t border-border first:border-t-0">
                          <td className="px-3 py-1.5">{r.name}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.email}</td>
                          <td className="px-3 py-1.5 text-xs text-muted-foreground">{r.reason || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button onClick={onClose}
                className="mt-5 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
                Done
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
