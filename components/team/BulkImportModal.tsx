'use client'

import { useState, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { X, Upload, Loader2, AlertTriangle, Check, FileSpreadsheet } from 'lucide-react'
import {
  parseDelimited, detectColumns, looksLikeHeader, toRows, checkRows,
  summarise, STATUS_LABEL, routingHint, type CheckedRow, type ImportTarget,
} from '@/lib/csv-import'

// Import a spreadsheet of staff as team cards.
//
// The whole design is built around one rule: the admin sees exactly what will
// happen before any of it happens. Every row is shown with its outcome and the
// invitations are counted out loud, because sending 200 invitations off a
// mis-read file cannot be undone. There is no way to reach the import button
// without passing the preview.

const BATCH = 25

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

  function loadFile(file: File) {
    if (file.size > 2_000_000) { toast.error('That file is larger than 2MB. Split it and import in parts.'); return }
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
      const slice = queue.slice(i, i + BATCH).map(r => ({
        line: r.line, name: r.name, email: r.email, title: r.title, phone: r.phone, company: r.company,
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
                Paste straight out of Excel, or choose a CSV file. Cardtly reads columns named
                {' '}<strong className="text-foreground">name</strong> (or first and last name),
                {' '}<strong className="text-foreground">email</strong>, job title, phone and company.
              </p>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                <button onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition">
                  <Upload className="w-4 h-4" />Choose a file
                </button>
                <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f) }} />
                <span className="text-xs text-muted-foreground">CSV, tab separated, or semicolon separated</span>
              </div>

              <textarea
                value={text}
                onChange={e => { setText(e.target.value); setPhase('preview') }}
                rows={6}
                aria-label="Paste your spreadsheet here"
                placeholder={'Name\tEmail\tJob title\nThabo Nkosi\tthabo@company.co.za\tSite Manager'}
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
                            {r.departmentName
                              ? <span>{r.departmentName}</span>
                              : <span className="text-muted-foreground" title={routingHint(r.company, targets)}>
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
