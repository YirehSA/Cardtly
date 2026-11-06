'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle, CalendarClock, Check, ChevronDown, ChevronUp, ClipboardList, Download, ExternalLink, FileSpreadsheet,
  FileText, Loader2, Mail, MailPlus, Phone, Plus, Search, Send, Trash2, Upload, X,
} from 'lucide-react'
import { inputClass, inputStyle, useInk, useMounted } from '@/components/calendar/shared'
import {
  companyKey, contactedCompanies, isDue, isoDay, isPersonalAddress, isSharedInbox, mailMergeList, mailtoFor,
  priorityLabel, PROSPECT_PRIORITIES, PROSPECT_STATUSES, statusInfo, summarise,
  type Channel, type Playbook, type Prospect, type ProspectStatus,
} from '@/lib/prospects'

// A rep's reseller prospecting, in place of the Excel workbooks.
//
// The same board for the rep (their own Activity log page) and the admin panel
// (Sales, Prospects): the API decides what each may see and change, and this only
// adds the rep picker for an admin.
//
// EVERY BUTTON HERE SAVES RETYPING. Changing a status writes the Email log, Call
// log or Calendar entry, so the rep does not do it twice. An export is whatever
// is on screen. A mail merge file comes with a one-click "mark them as sent".

type View = 'all' | 'email' | 'call' | 'due' | 'replies' | 'meetings' | 'closed'

const VIEWS: { id: View; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'email', label: 'To email' },
  { id: 'call', label: 'To call' },
  { id: 'due', label: 'Follow-ups due' },
  { id: 'replies', label: 'Replies' },
  { id: 'meetings', label: 'Meetings' },
  { id: 'closed', label: 'Closed' },
]

const PRIORITY_ORDER = ['high', 'medium', 'low', 'review', 'backup']
const PAGE = 50

const inView = (p: Prospect, view: View, today: string): boolean => {
  switch (view) {
    case 'email': return p.status === 'not_contacted' && !!p.email && !p.is_alternate
    case 'call': return !!p.phone && (p.status === 'not_contacted' || p.status === 'called_no_answer' || p.status === 'email_sent')
    case 'due': return isDue(p, today)
    case 'replies': return p.status === 'replied' || p.status === 'interested' || p.status === 'follow_up'
    case 'meetings': return p.status === 'meeting_booked'
    case 'closed': return p.status === 'signed' || p.status === 'not_interested' || p.status === 'bounced' || p.status === 'do_not_contact'
    default: return true
  }
}

const niceDate = (d: string | null) => {
  if (!d) return ''
  const t = new Date(`${d}T12:00:00`)
  return Number.isFinite(t.getTime()) ? t.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : d
}

interface Me { isAdmin: boolean; repId: string | null; name: string | null; phone: string | null; canWrite: boolean; email: string | null }
interface RepOption { id: string; name: string; active: boolean; phone: string | null }

async function post(body: any) {
  const res = await fetch('/api/prospects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'That did not work. Please try again.')
  return data
}

async function download(body: any) {
  const res = await fetch('/api/prospects/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error || 'That export did not work.')
  }
  const name = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'Cardtly-prospects'
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export default function ProspectsBoard({ skin, adminView = false, initialRep = null, onCount }: {
  /** The --cal-* colours: the admin panel's dark set or the app's. */
  skin: React.CSSProperties
  adminView?: boolean
  /** Opened from a rep's row in admin, Reps. */
  initialRep?: string | null
  onCount?: (n: number) => void
}) {
  const mounted = useMounted()
  const inkFn = useInk()
  // The admin panel is always dark, whichever theme the dashboard is in.
  const ink = useCallback((b: string, d: string) => (adminView ? b : inkFn(b, d)), [adminView, inkFn])
  const dark = ink('d', 'l') === 'd'

  const [rows, setRows] = useState<Prospect[]>([])
  const [reps, setReps] = useState<RepOption[]>([])
  const [me, setMe] = useState<Me | null>(null)
  const [playbook, setPlaybook] = useState<Playbook | null>(null)
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState<string | null>(null)

  const [view, setView] = useState<View>('all')
  const [q, setQ] = useState('')
  const [list, setList] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [repFilter, setRepFilter] = useState(initialRep || '')
  const [limit, setLimit] = useState(PAGE)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openId, setOpenId] = useState<string | null>(null)

  const [prompt, setPrompt] = useState<{ p: Prospect; status: ProspectStatus; channel?: Channel } | null>(null)
  const [modal, setModal] = useState<'import' | 'email' | 'script' | 'add' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [mergeDone, setMergeDone] = useState<{ ids: string[]; leftOut: number } | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const today = isoDay(new Date())

  const load = useCallback(async () => {
    const data = await fetch('/api/prospects').then(r => r.json()).catch(() => null)
    if (!data || data.error) { setProblem(data?.error || 'Could not load the prospects.'); setLoading(false); return }
    setRows(data.prospects || [])
    setReps(data.reps || [])
    setMe(data.me || null)
    setPlaybook(data.playbook || null)
    setProblem(data.missing ? data.message : null)
    setLoading(false)
    onCount?.((data.prospects || []).length)
  }, [onCount])

  useEffect(() => { load() }, [load])
  useEffect(() => { setLimit(PAGE) }, [view, q, list, status, priority, repFilter])

  const scoped = useMemo(() => (repFilter ? rows.filter(r => r.rep_id === repFilter) : rows), [rows, repFilter])
  const summary = useMemo(() => summarise(scoped, today), [scoped, today])
  const lists = useMemo(() => [...new Set(scoped.flatMap(r => r.lists || []))].sort(), [scoped])
  const taken = useMemo(() => contactedCompanies(rows), [rows])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const out = scoped.filter(p => {
      if (!inView(p, view, today)) return false
      if (list && !(p.lists || []).includes(list)) return false
      if (status && p.status !== status) return false
      if (priority && p.priority !== priority) return false
      if (needle) {
        const hay = [p.company, p.contact_name, p.email, p.phone, p.role, p.sector, p.region, p.notes].join(' ').toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
    return out.sort((a, b) => {
      if (view === 'due') return (a.follow_up_on || '').localeCompare(b.follow_up_on || '')
      return PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) || a.company.localeCompare(b.company)
    })
  }, [scoped, view, today, list, status, priority, q])

  const replaceRow = (row: Prospect) => setRows(rs => rs.map(r => (r.id === row.id ? row : r)))

  const repFor = useCallback((p: Prospect) => {
    if (me?.repId && p.rep_id === me.repId) return { name: me.name, phone: me.phone }
    const r = reps.find(x => x.id === p.rep_id)
    return { name: r?.name || me?.name || '', phone: r?.phone || me?.phone || '' }
  }, [me, reps])

  // ── Actions ───────────────────────────────────────────────────────────────

  async function setStatusOf(p: Prospect, next: ProspectStatus, extra: Record<string, any> = {}) {
    setBusy(p.id)
    try {
      const data = await post({ action: 'status', id: p.id, status: next, ...extra })
      replaceRow(data.row)
      toast.success(data.logged ? `${statusInfo(next).label}. Added to your ${data.logged}.` : statusInfo(next).label)
    } catch (e: any) {
      toast.error(e.message, { duration: 8000 })
    }
    setBusy(null)
  }

  /** The two that need a date first. Everything else is one click. */
  function chooseStatus(p: Prospect, next: ProspectStatus, channel?: Channel) {
    if (next === p.status && next !== 'meeting_booked' && next !== 'follow_up') return
    if (next === 'meeting_booked' || next === 'follow_up') { setPrompt({ p, status: next, channel }); return }
    setStatusOf(p, next, channel ? { channel } : {})
  }

  async function saveFields(p: Prospect, fields: Record<string, any>) {
    try {
      const data = await post({ action: 'update', id: p.id, fields })
      replaceRow(data.row)
      return true
    } catch (e: any) {
      toast.error(e.message, { duration: 8000 })
      return false
    }
  }

  async function bulk(next: ProspectStatus, ids: string[] = [...selected]) {
    if (ids.length === 0) return
    setBusy('bulk')
    try {
      const data = await post({ action: 'bulk_status', ids, status: next })
      await load()
      setSelected(new Set())
      setMergeDone(null)
      const held = data.blocked ? ` ${data.blocked} left alone: bounced or do not contact.` : ''
      toast.success(`${data.changed} marked ${statusInfo(next).label.toLowerCase()}. ${data.logged} added to your log.${held}`, { duration: 7000 })
    } catch (e: any) {
      toast.error(e.message, { duration: 8000 })
    }
    setBusy(null)
  }

  async function removeRows(ids: string[]) {
    if (ids.length === 0) return
    if (!confirm(`Delete ${ids.length} prospect${ids.length === 1 ? '' : 's'}?\n\nThis cannot be undone. If someone asked not to be contacted, mark them Do not contact instead: that is what stops them being written to again from the next list.`)) return
    try {
      const data = await post({ action: 'delete', ids })
      await load()
      setSelected(new Set())
      toast.success(`${data.deleted} deleted.${data.deleted < ids.length ? ' Do-not-contact records stay, so they are never approached again.' : ''}`)
    } catch (e: any) {
      toast.error(e.message, { duration: 8000 })
    }
  }

  async function assign(ids: string[], repId: string) {
    try {
      await post({ action: 'assign', ids, rep_id: repId || null })
      await load()
      setSelected(new Set())
      toast.success('Moved')
    } catch (e: any) {
      toast.error(e.message, { duration: 8000 })
    }
  }

  const exportIds = selected.size ? [...selected] : shown.map(p => p.id)
  const scopeLabel = useMemo(() => {
    if (selected.size) return `${selected.size} selected`
    const bits = [VIEWS.find(v => v.id === view)?.label]
    if (list) bits.push(list)
    if (status) bits.push(statusInfo(status).label)
    if (priority) bits.push(`${priorityLabel(priority)} priority`)
    if (repFilter) bits.push(reps.find(r => r.id === repFilter)?.name)
    return bits.filter(Boolean).join(', ')
  }, [selected.size, view, list, status, priority, repFilter, reps])

  async function runExport(format: 'xlsx' | 'pdf' | 'merge') {
    setExportOpen(false)
    if (exportIds.length === 0) { toast.error('Nothing on screen to export.'); return }
    setBusy('export')
    try {
      const explicit = selected.size > 0
      await download({ format, ids: exportIds, scope: scopeLabel, explicit })
      if (format === 'merge') {
        // The same rule the server just used, so "mark as sent" is exactly who
        // was in the file.
        const wanted = new Set(exportIds)
        const merge = mailMergeList(rows.filter(r => wanted.has(r.id)), rows, explicit)
        setMergeDone({ ids: merge.send.map(p => p.id), leftOut: merge.leftOut.length })
      } else {
        toast.success('Downloaded')
      }
    } catch (e: any) {
      toast.error(e.message, { duration: 8000 })
    }
    setBusy(null)
  }

  const allShownTicked = shown.length > 0 && shown.slice(0, limit).every(p => selected.has(p.id))
  const canWrite = !!me?.canWrite

  if (!mounted || loading) {
    return (
      <div style={skin} className="h-64 rounded-2xl grid place-items-center" aria-busy>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--cal-muted)' }} />
      </div>
    )
  }

  const tiles: { label: string; n: number; view: View; hue: [string, string] }[] = [
    { label: 'Contacts', n: summary.total, view: 'all', hue: ['#0ea5e9', '#0369a1'] },
    { label: 'To email', n: scoped.filter(p => inView(p, 'email', today)).length, view: 'email', hue: ['#3b82f6', '#1d4ed8'] },
    { label: 'To call', n: scoped.filter(p => inView(p, 'call', today)).length, view: 'call', hue: ['#f59e0b', '#b45309'] },
    { label: 'Follow-ups due', n: summary.followUpsDue, view: 'due', hue: ['#ef4444', '#b91c1c'] },
    { label: 'Replies', n: summary.replied, view: 'replies', hue: ['#22c55e', '#15803d'] },
    { label: 'Meetings', n: summary.meetings, view: 'meetings', hue: ['#a855f7', '#7e22ce'] },
    { label: 'Signed', n: summary.signed, view: 'closed', hue: ['#34d399', '#047857'] },
  ]

  const btn = 'inline-flex items-center justify-center gap-1.5 px-3 min-h-[44px] rounded-xl text-sm font-semibold transition hover:opacity-90 disabled:opacity-50'
  const quiet: React.CSSProperties = { border: '1px solid var(--cal-border)', color: 'var(--cal-text)', background: 'var(--cal-surface)' }
  const selectStyle: React.CSSProperties = { ...inputStyle, colorScheme: dark ? 'dark' : 'light' }

  return (
    <div style={skin} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[220px] flex-1">
          <h2 className="font-display text-xl font-bold tracking-tight" style={{ color: 'var(--cal-text)' }}>Prospects</h2>
          <p className="text-sm" style={{ color: 'var(--cal-muted)' }}>
            Every reseller list in one place. Mark someone here and it goes in {adminView ? "the rep's" : 'your'} Activity log too, so nothing is typed twice.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite && (
            <button onClick={() => setModal('import')} className={btn} style={{ background: '#1d4ed8', color: '#fff' }}>
              <Upload className="w-4 h-4" />Import a list
            </button>
          )}
          {canWrite && (
            <button onClick={() => setModal('add')} className={btn} style={quiet}><Plus className="w-4 h-4" />Add one</button>
          )}
          <div className="relative">
            <button onClick={() => setExportOpen(o => !o)} disabled={busy === 'export'} className={btn} style={quiet} aria-expanded={exportOpen}>
              {busy === 'export' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}Export
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-64 rounded-xl p-1.5 z-30 shadow-xl" style={{ background: 'var(--cal-panel)', border: '1px solid var(--cal-border)' }}>
                <p className="px-2.5 py-1.5 text-[11px]" style={{ color: 'var(--cal-muted)' }}>
                  {exportIds.length} contact{exportIds.length === 1 ? '' : 's'}: {scopeLabel}
                </p>
                {[
                  { f: 'xlsx' as const, icon: <FileSpreadsheet className="w-4 h-4" />, label: 'Excel', sub: 'The whole record. Edit it and import it back.' },
                  { f: 'pdf' as const, icon: <FileText className="w-4 h-4" />, label: 'PDF', sub: 'To read or forward.' },
                  { f: 'merge' as const, icon: <MailPlus className="w-4 h-4" />, label: 'Mail merge file', sub: 'For Word or Outlook. Skips anyone who should not get it.' },
                ].map(o => (
                  <button key={o.f} onClick={() => runExport(o.f)} className="w-full flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-[var(--cal-hover)]" style={{ color: 'var(--cal-text)' }}>
                    <span className="mt-0.5">{o.icon}</span>
                    <span><span className="block text-sm font-semibold">{o.label}</span><span className="block text-[11px]" style={{ color: 'var(--cal-muted)' }}>{o.sub}</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setModal('email')} className={btn} style={quiet}><Send className="w-4 h-4" />Mail it</button>
          <button onClick={() => setModal('script')} className={btn} style={quiet}><ClipboardList className="w-4 h-4" />Script</button>
        </div>
      </div>

      {problem && (
        <div className="rounded-2xl border p-4 text-sm flex gap-2.5" style={{ borderColor: '#f59e0b55', background: '#f59e0b12', color: 'var(--cal-text)' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: ink('#f59e0b', '#b45309') }} />{problem}
        </div>
      )}

      {/* The figures his Campaign Overview tabs worked out with formulas. Each one
          is also the quickest way to the people it counts. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {tiles.map(t => {
          const on = view === t.view && t.label !== 'Signed'
          return (
            <button key={t.label} onClick={() => setView(t.view)} className="rounded-2xl p-3 text-left transition hover:opacity-90"
              style={{ background: on ? `${t.hue[0]}1a` : 'var(--cal-surface)', border: `1px solid ${on ? `${t.hue[0]}66` : 'var(--cal-border)'}` }}>
              <span className="block text-xl font-bold tabular-nums" style={{ color: ink(t.hue[0], t.hue[1]) }}>{t.n}</span>
              <span className="block text-xs" style={{ color: 'var(--cal-muted)' }}>{t.label}</span>
            </button>
          )
        })}
      </div>

      {mergeDone && (
        <div className="rounded-2xl border p-3 flex flex-wrap items-center gap-3" style={{ borderColor: '#3b82f655', background: '#3b82f612' }}>
          <p className="text-sm flex-1 min-w-[220px]" style={{ color: 'var(--cal-text)' }}>
            <strong>Mail merge file downloaded: {mergeDone.ids.length} contact{mergeDone.ids.length === 1 ? '' : 's'}.</strong>{' '}
            {mergeDone.leftOut > 0 && <span style={{ color: 'var(--cal-muted)' }}>{mergeDone.leftOut} left out, with the reasons on the second tab. </span>}
            Once it has gone out, mark them here and they go in the Email log.
          </p>
          <button disabled={busy === 'bulk' || !canWrite} onClick={() => bulk('email_sent', mergeDone.ids)} className={btn} style={{ background: '#1d4ed8', color: '#fff' }}>
            {busy === 'bulk' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Mark {mergeDone.ids.length} as sent
          </button>
          <button onClick={() => setMergeDone(null)} className="w-11 h-11 grid place-items-center rounded-xl" aria-label="Dismiss" style={{ color: 'var(--cal-muted)' }}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Which prospects">
        {VIEWS.map(v => {
          const on = view === v.id
          return (
            <button key={v.id} role="tab" aria-selected={on} onClick={() => setView(v.id)} className="px-3 min-h-[40px] rounded-xl text-sm font-semibold transition"
              style={{ background: on ? 'var(--cal-raised)' : 'transparent', border: `1px solid ${on ? 'var(--cal-text)' : 'var(--cal-border)'}`, color: on ? 'var(--cal-text)' : 'var(--cal-muted)' }}>
              {v.label}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(220px,2fr)_1fr_1fr_1fr_auto] gap-2 items-center">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--cal-muted)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search company, name, email or number" aria-label="Search prospects"
            className={`${inputClass} pl-9 min-h-[44px]`} style={inputStyle} />
        </div>
        <select value={list} onChange={e => setList(e.target.value)} aria-label="List" className={`${inputClass} min-h-[44px]`} style={selectStyle}>
          <option value="">All lists</option>
          {lists.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Status" className={`${inputClass} min-h-[44px]`} style={selectStyle}>
          <option value="">Any status</option>
          {PROSPECT_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value)} aria-label="Priority" className={`${inputClass} min-h-[44px]`} style={selectStyle}>
          <option value="">Any priority</option>
          {PROSPECT_PRIORITIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        {adminView ? (
          <select value={repFilter} onChange={e => setRepFilter(e.target.value)} aria-label="Rep" className={`${inputClass} min-h-[44px]`} style={selectStyle}>
            <option value="">All reps</option>
            {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        ) : <span className="hidden lg:block" />}
      </div>

      {selected.size > 0 && canWrite && (
        <div className="sticky top-2 z-20 rounded-2xl p-2.5 flex flex-wrap items-center gap-2 shadow-lg" style={{ background: 'var(--cal-panel)', border: '1px solid var(--cal-border)' }}>
          <span className="text-sm font-semibold px-1.5" style={{ color: 'var(--cal-text)' }}>{selected.size} ticked</span>
          <button disabled={busy === 'bulk'} onClick={() => bulk('email_sent')} className={btn} style={{ background: '#1d4ed8', color: '#fff' }}>
            {busy === 'bulk' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}Email sent
          </button>
          <select value="" disabled={busy === 'bulk'} aria-label="Set status" onChange={e => e.target.value && bulk(e.target.value as ProspectStatus)}
            className={`${inputClass} min-h-[44px] w-auto`} style={selectStyle}>
            <option value="">Set status</option>
            {PROSPECT_STATUSES.filter(s => s.id !== 'meeting_booked').map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {adminView && (
            <select value="" aria-label="Move to rep" onChange={e => e.target.value && assign([...selected], e.target.value)}
              className={`${inputClass} min-h-[44px] w-auto`} style={selectStyle}>
              <option value="">Move to rep</option>
              {reps.filter(r => r.active).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          <button onClick={() => removeRows([...selected])} className={btn} style={{ ...quiet, color: ink('#ef4444', '#b91c1c') }}><Trash2 className="w-4 h-4" />Delete</button>
          <button onClick={() => setSelected(new Set())} className={`${btn} ml-auto`} style={quiet}>Clear</button>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--cal-border)', background: 'var(--cal-surface)' }}>
          <p className="font-semibold" style={{ color: 'var(--cal-text)' }}>{rows.length === 0 ? 'No prospects yet' : 'Nobody matches that'}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--cal-muted)' }}>
            {rows.length === 0 ? 'Import a spreadsheet and they all come in at once. Any columns will do, as long as there is a company and an email or phone.' : 'Try another view, or clear the search.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--cal-border)', background: 'var(--cal-surface)' }}>
          <div className="flex items-center gap-3 px-3 py-2 text-xs" style={{ borderBottom: '1px solid var(--cal-border)', color: 'var(--cal-muted)' }}>
            {canWrite && (
              <input type="checkbox" aria-label="Tick everyone showing" checked={allShownTicked} className="w-4 h-4"
                onChange={() => setSelected(allShownTicked ? new Set() : new Set([...selected, ...shown.slice(0, limit).map(p => p.id)]))} />
            )}
            <span>{shown.length} showing{selected.size ? `, ${selected.size} ticked` : ''}</span>
            {shown.length > limit && canWrite && (
              <button className="underline" onClick={() => setSelected(new Set(shown.map(p => p.id)))}>Tick all {shown.length}</button>
            )}
          </div>
          {shown.slice(0, limit).map(p => (
            <ProspectRow key={p.id} p={p} open={openId === p.id} today={today} ink={ink} dark={dark}
              canWrite={canWrite} isAdmin={adminView} reps={reps} busy={busy === p.id}
              ticked={selected.has(p.id)} colleague={taken.has(companyKey(p.company)) && taken.get(companyKey(p.company)) !== p.id}
              playbook={playbook} me={repFor(p)}
              onTick={() => setSelected(s => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n })}
              onToggle={() => setOpenId(openId === p.id ? null : p.id)}
              onStatus={chooseStatus} onSave={saveFields}
              onDelete={() => removeRows([p.id])} onAssign={rep => assign([p.id], rep)} />
          ))}
        </div>
      )}

      {shown.length > limit && (
        <div className="text-center">
          <button onClick={() => setLimit(l => l + PAGE)} className={btn} style={quiet}>Show {Math.min(PAGE, shown.length - limit)} more of {shown.length - limit}</button>
        </div>
      )}

      {prompt && (
        <DatePrompt {...prompt} skin={skin} selectStyle={selectStyle} onClose={() => setPrompt(null)}
          onSave={async extra => { const { p, status: next, channel } = prompt; setPrompt(null); await setStatusOf(p, next, { ...(channel ? { channel } : {}), ...extra }) }} />
      )}
      {modal === 'import' && (
        <ImportModal skin={skin} reps={reps} isAdmin={adminView} defaultRep={repFilter || reps.find(r => r.active)?.id || ''} selectStyle={selectStyle} onClose={() => setModal(null)} onDone={load} />
      )}
      {modal === 'email' && (
        <EmailModal skin={skin} count={exportIds.length} ids={exportIds} scope={scopeLabel} defaultTo={me?.email || ''} onClose={() => setModal(null)} />
      )}
      {modal === 'script' && playbook && (
        <ScriptModal skin={skin} playbook={playbook} canWrite={canWrite} onClose={() => setModal(null)} onSaved={setPlaybook} />
      )}
      {modal === 'add' && (
        <AddModal skin={skin} reps={reps} isAdmin={adminView} defaultRep={repFilter} selectStyle={selectStyle} onClose={() => setModal(null)} onAdded={row => setRows(rs => [row, ...rs])} />
      )}
    </div>
  )
}

// ── One prospect ─────────────────────────────────────────────────────────────

function ProspectRow({
  p, open, today, ink, dark, canWrite, isAdmin, reps, busy, ticked, colleague, playbook, me,
  onTick, onToggle, onStatus, onSave, onDelete, onAssign,
}: {
  p: Prospect; open: boolean; today: string; ink: (b: string, d: string) => string; dark: boolean
  canWrite: boolean; isAdmin: boolean; reps: RepOption[]; busy: boolean; ticked: boolean; colleague: boolean
  playbook: Playbook | null; me: { name?: string | null; phone?: string | null }
  onTick: () => void; onToggle: () => void
  onStatus: (p: Prospect, s: ProspectStatus, c?: Channel) => void
  onSave: (p: Prospect, f: Record<string, any>) => Promise<boolean>
  onDelete: () => void; onAssign: (rep: string) => void
}) {
  const info = statusInfo(p.status)
  const due = isDue(p, today)
  const [emailedHint, setEmailedHint] = useState(false)
  const barred = p.status === 'do_not_contact' || p.status === 'bounced'
  const hue = ink(info.bright, info.deep)

  return (
    <div style={{ borderBottom: '1px solid var(--cal-border)', background: ticked ? 'var(--cal-raised)' : undefined }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
        {canWrite && <input type="checkbox" checked={ticked} onChange={onTick} className="w-4 h-4 flex-shrink-0" aria-label={`Tick ${p.company}`} />}

        <button onClick={onToggle} aria-expanded={open} className="flex-1 min-w-[190px] text-left">
          <span className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: 'var(--cal-text)' }}>{p.company}</span>
            {p.priority === 'high' && <Chip color={ink('#ef4444', '#b91c1c')}>High</Chip>}
            {p.priority === 'review' && <Chip color={ink('#f59e0b', '#b45309')}>Review</Chip>}
            {p.is_alternate && <Chip color={ink('#94a3b8', '#475569')}>Alternate</Chip>}
            {colleague && p.status === 'not_contacted' && <Chip color={ink('#f59e0b', '#b45309')}>Colleague contacted</Chip>}
          </span>
          <span className="block text-xs truncate" style={{ color: 'var(--cal-muted)' }}>
            {[p.contact_name, p.role].filter(Boolean).join(', ') || 'No name yet'}
          </span>
        </button>

        <div className="w-full sm:w-auto sm:min-w-[210px] sm:max-w-[260px] text-xs">
          {p.email && <span className="block truncate" style={{ color: 'var(--cal-text)' }}>{p.email}</span>}
          {p.phone && <a href={`tel:${p.phone.replace(/\s+/g, '')}`} className="block underline-offset-2 hover:underline" style={{ color: 'var(--cal-muted)' }}>{p.phone}</a>}
        </div>

        <div className="w-[92px] text-xs hidden md:block" style={{ color: due ? ink('#ef4444', '#b91c1c') : 'var(--cal-muted)' }}>
          {p.follow_up_on
            ? <span className={due ? 'font-semibold' : ''}><CalendarClock className="w-3 h-3 inline mr-1" />{niceDate(p.follow_up_on)}</span>
            : p.last_contact_on ? `Last ${niceDate(p.last_contact_on)}` : ''}
        </div>

        <select value={p.status} disabled={!canWrite || busy} aria-label={`Status of ${p.company}`}
          onChange={e => onStatus(p, e.target.value as ProspectStatus)}
          className="rounded-xl border text-xs font-semibold px-2 min-h-[40px] w-[150px]"
          style={{ background: `${info.bright}1a`, borderColor: `${info.bright}55`, color: hue, colorScheme: dark ? 'dark' : 'light' }}>
          {PROSPECT_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>

        <button onClick={onToggle} aria-label={open ? 'Close' : 'Open details'} className="w-9 h-9 grid place-items-center rounded-lg" style={{ color: 'var(--cal-muted)' }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {open && (
        <div className="px-3 pb-4 pt-1 space-y-3">
          {canWrite && (
            <div className="grid gap-2 sm:grid-cols-2">
              <QuickGroup label="Email" icon={<Mail className="w-3.5 h-3.5" />}>
                {p.email && !barred && playbook && (
                  <a href={mailtoFor(p, playbook, me)} onClick={() => setEmailedHint(true)} style={quickStyle('#1d4ed8', true)}>Write it</a>
                )}
                <Quick onClick={() => { setEmailedHint(false); onStatus(p, 'email_sent', 'email') }} on={p.status === 'email_sent'} disabled={barred}>Sent</Quick>
                <Quick onClick={() => onStatus(p, 'replied', 'email')} on={p.status === 'replied'}>Replied</Quick>
                <Quick onClick={() => onStatus(p, 'bounced', 'email')} on={p.status === 'bounced'}>Bounced</Quick>
              </QuickGroup>
              <QuickGroup label="Call" icon={<Phone className="w-3.5 h-3.5" />}>
                {p.phone && <a href={`tel:${p.phone.replace(/\s+/g, '')}`} style={quickStyle('#15803d', true)}>Call</a>}
                <Quick onClick={() => onStatus(p, 'called_no_answer', 'call')} on={p.status === 'called_no_answer'}>No answer</Quick>
                <Quick onClick={() => onStatus(p, 'interested', 'call')} on={p.status === 'interested'}>Spoke, interested</Quick>
                <Quick onClick={() => onStatus(p, 'follow_up', 'call')} on={p.status === 'follow_up'}>Call back</Quick>
                <Quick onClick={() => onStatus(p, 'meeting_booked', 'call')} on={p.status === 'meeting_booked'}>Meeting</Quick>
                <Quick onClick={() => onStatus(p, 'not_interested', 'call')} on={p.status === 'not_interested'}>Not interested</Quick>
              </QuickGroup>
            </div>
          )}

          {emailedHint && p.status !== 'email_sent' && (
            <div className="rounded-xl p-2.5 flex flex-wrap items-center gap-2 text-sm" style={{ background: '#3b82f612', border: '1px solid #3b82f655', color: 'var(--cal-text)' }}>
              <span className="flex-1 min-w-[180px]">Sent it? Mark it, and it goes in your Email log.</span>
              <Quick onClick={() => { setEmailedHint(false); onStatus(p, 'email_sent', 'email') }}>Yes, it went</Quick>
              <Quick onClick={() => setEmailedHint(false)}>Not yet</Quick>
            </div>
          )}

          <Warnings p={p} colleague={colleague} ink={ink} />

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Field label="Feedback and notes">
                <textarea defaultValue={p.notes || ''} rows={4} disabled={!canWrite} key={`n-${p.updated_at}`}
                  onBlur={e => { if ((e.target.value.trim() || null) !== (p.notes || null)) onSave(p, { notes: e.target.value }) }}
                  placeholder="What they said" className={inputClass} style={inputStyle} />
              </Field>
              <div className="grid grid-cols-[150px_1fr] gap-2">
                <Field label="Follow up on">
                  <input type="date" defaultValue={p.follow_up_on || ''} disabled={!canWrite} key={`f-${p.updated_at}`}
                    onChange={e => onSave(p, { follow_up_on: e.target.value || null })}
                    className={`${inputClass} min-h-[44px]`} style={{ ...inputStyle, colorScheme: dark ? 'dark' : 'light' }} />
                </Field>
                <Field label="About">
                  <input defaultValue={p.follow_up_note || ''} disabled={!canWrite} key={`fn-${p.updated_at}`} placeholder="Send the pricing"
                    onBlur={e => { if ((e.target.value.trim() || null) !== (p.follow_up_note || null)) onSave(p, { follow_up_note: e.target.value }) }}
                    className={`${inputClass} min-h-[44px]`} style={inputStyle} />
                </Field>
              </div>
            </div>

            <div className="space-y-2 text-xs" style={{ color: 'var(--cal-muted)' }}>
              {p.fit && <Info label="Why Cardtly fits">{p.fit}</Info>}
              {p.research_notes && <Info label="Research">{p.research_notes}</Info>}
              <Info label="Details">
                {[p.sector, p.region, p.phone_type, p.email_type, p.source_confidence].filter(Boolean).join(' · ') || 'None'}
              </Info>
              {(p.lists?.length || 0) > 0 && <Info label={p.lists.length === 1 ? 'List' : 'Lists'}>{p.lists.join(', ')}</Info>}
              <div className="flex flex-wrap gap-3">
                {[p.source_url, p.source_url_2].filter(Boolean).map((u, i) => (
                  <a key={i} href={/^https?:/i.test(u!) ? u! : `https://${u}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline underline-offset-2" style={{ color: 'var(--cal-text)' }}>
                    <ExternalLink className="w-3 h-3" />Source{i ? ' 2' : ''}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {canWrite && <EditDetails p={p} onSave={onSave} dark={dark} />}

          {canWrite && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Quick onClick={() => onStatus(p, 'do_not_contact')} on={p.status === 'do_not_contact'}>Do not contact</Quick>
              {isAdmin && (
                <select value={p.rep_id || ''} aria-label="Rep" onChange={e => onAssign(e.target.value)} className="rounded-xl border text-xs px-2 min-h-[40px]"
                  style={{ ...inputStyle, colorScheme: dark ? 'dark' : 'light' }}>
                  <option value="">No rep</option>
                  {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              )}
              <button onClick={onDelete} className="ml-auto inline-flex items-center gap-1 text-xs min-h-[40px] px-2" style={{ color: ink('#ef4444', '#b91c1c') }}>
                <Trash2 className="w-3.5 h-3.5" />Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** His sheets' own cautions, on the row where they matter rather than on a tab
 *  nobody reopens. */
function Warnings({ p, colleague, ink }: { p: Prospect; colleague: boolean; ink: (b: string, d: string) => string }) {
  const notes: string[] = []
  if (p.status === 'do_not_contact') notes.push('Do not contact. This address is kept only so that it is never approached again.')
  if (colleague && !['not_interested', 'do_not_contact'].includes(p.status)) notes.push('Someone else at this company has already been contacted. Do not approach them as a separate prospect.')
  if (p.is_alternate) notes.push('An alternate contact: the primary at this company goes first.')
  if (isPersonalAddress(p.email)) notes.push('This looks like a personal mailbox, not a company one. Check it is right to use before writing to it.')
  if (/recheck/i.test(p.source_confidence || '')) notes.push('An older source. Check the person still holds this role and the address is current.')
  if (p.email && isSharedInbox(p) && p.first_name) notes.push(`A shared inbox, so use a neutral greeting rather than "Hi ${p.first_name}".`)
  if (notes.length === 0) return null
  return (
    <div className="rounded-xl p-2.5 space-y-1 text-xs" style={{ background: '#f59e0b12', border: '1px solid #f59e0b44', color: 'var(--cal-text)' }}>
      {notes.map(n => (
        <p key={n} className="flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" style={{ color: ink('#f59e0b', '#b45309') }} />{n}</p>
      ))}
    </div>
  )
}

function EditDetails({ p, onSave, dark }: { p: Prospect; onSave: (p: Prospect, f: Record<string, any>) => Promise<boolean>; dark: boolean }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState<Record<string, string>>({})
  const start = () => {
    setF({
      company: p.company || '', contact_name: p.contact_name || '', first_name: p.first_name || '', role: p.role || '',
      email: p.email || '', phone: p.phone || '', sector: p.sector || '', region: p.region || '', priority: p.priority,
    })
    setOpen(true)
  }
  if (!open) return <button onClick={start} className="text-xs underline underline-offset-2" style={{ color: 'var(--cal-muted)' }}>Edit details</button>
  const labels: [string, string][] = [['company', 'Company'], ['contact_name', 'Contact name'], ['first_name', 'First name'], ['role', 'Role'], ['email', 'Email'], ['phone', 'Phone'], ['sector', 'Sector'], ['region', 'Region']]
  return (
    <div className="rounded-xl p-3 space-y-2" style={{ border: '1px solid var(--cal-border)' }}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {labels.map(([k, label]) => (
          <Field key={k} label={label}>
            <input value={f[k]} onChange={e => setF(x => ({ ...x, [k]: e.target.value }))} className={`${inputClass} min-h-[44px]`} style={inputStyle} />
          </Field>
        ))}
        <Field label="Priority">
          <select value={f.priority} onChange={e => setF(x => ({ ...x, priority: e.target.value }))} className={`${inputClass} min-h-[44px]`} style={{ ...inputStyle, colorScheme: dark ? 'dark' : 'light' }}>
            {PROSPECT_PRIORITIES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="flex gap-2">
        <Quick onClick={async () => { if (await onSave(p, f)) setOpen(false) }}>Save</Quick>
        <Quick onClick={() => setOpen(false)}>Cancel</Quick>
      </div>
    </div>
  )
}

// ── Small parts ──────────────────────────────────────────────────────────────

const quickStyle = (fill?: string, solid = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', minHeight: 36, padding: '0 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
  ...(solid ? { background: fill, color: '#fff' } : {}),
})

function Quick({ children, onClick, on, disabled }: { children: React.ReactNode; onClick: () => void; on?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="transition hover:opacity-80 disabled:opacity-40" aria-pressed={on}
      style={{ ...quickStyle(), border: `1px solid ${on ? 'var(--cal-text)' : 'var(--cal-border)'}`, color: 'var(--cal-text)', background: on ? 'var(--cal-raised)' : 'transparent' }}>
      {children}
    </button>
  )
}

function QuickGroup({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-2.5" style={{ border: '1px solid var(--cal-border)' }}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--cal-muted)' }}>{icon}{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

const Chip = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color, border: `1px solid ${color}66` }}>{children}</span>
)

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--cal-muted)' }}>{label}</span>
    {children}
  </label>
)

const Info = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="text-[11px] font-semibold" style={{ color: 'var(--cal-text)' }}>{label}</p>
    <p className="whitespace-pre-wrap leading-relaxed">{children}</p>
  </div>
)

function Modal({ skin, title, onClose, children, wide = false }: { skin: React.CSSProperties; title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    ref.current?.focus()
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ ...skin, background: 'rgba(0,0,0,0.55)' }} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl outline-none`}
        style={{ background: 'var(--cal-panel)', border: '1px solid var(--cal-border)', color: 'var(--cal-text)' }}>
        <div className="flex items-center justify-between gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid var(--cal-border)' }}>
          <h3 className="font-bold text-base">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 grid place-items-center rounded-lg" style={{ color: 'var(--cal-muted)' }}><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">{children}</div>
      </div>
    </div>
  )
}

const primary = 'inline-flex items-center justify-center gap-1.5 w-full px-4 min-h-[44px] rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50'
const PRIMARY_BG: React.CSSProperties = { background: '#1d4ed8' }

function DatePrompt({ p, status, skin, selectStyle, onClose, onSave }: {
  p: Prospect; status: ProspectStatus; channel?: Channel; skin: React.CSSProperties; selectStyle: React.CSSProperties
  onClose: () => void; onSave: (extra: Record<string, any>) => void
}) {
  const meeting = status === 'meeting_booked'
  const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDay(d) }
  const [date, setDate] = useState(p.follow_up_on || (meeting ? '' : addDays(3)))
  const [time, setTime] = useState('09:00')
  const [note, setNote] = useState(p.follow_up_note || '')
  const save = () => {
    if (meeting) {
      onSave({
        ...(date ? { meeting_at: new Date(`${date}T${time || '09:00'}:00`).toISOString() } : {}),
        follow_up_note: note || (date ? `Meeting at ${time}` : ''),
      })
    } else {
      onSave({ follow_up_on: date || null, follow_up_note: note })
    }
  }
  return (
    <Modal skin={skin} title={meeting ? `Meeting with ${p.company}` : `Follow up with ${p.company}`} onClose={onClose}>
      <p className="text-sm" style={{ color: 'var(--cal-muted)' }}>
        {meeting ? 'Give it a date and it goes straight on the calendar.' : 'It shows under Follow-ups due on the day.'}
      </p>
      {!meeting && (
        <div className="flex flex-wrap gap-1.5">
          {[['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7], ['In 2 weeks', 14]].map(([l, n]) => (
            <Quick key={l as string} on={date === addDays(n as number)} onClick={() => setDate(addDays(n as number))}>{l as string}</Quick>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${inputClass} min-h-[44px]`} style={selectStyle} /></Field>
        {meeting && <Field label="Time"><input type="time" value={time} onChange={e => setTime(e.target.value)} className={`${inputClass} min-h-[44px]`} style={selectStyle} /></Field>}
      </div>
      <Field label={meeting ? 'Note' : 'What for'}>
        <input value={note} onChange={e => setNote(e.target.value)} className={`${inputClass} min-h-[44px]`} style={inputStyle} placeholder={meeting ? 'On Teams, 20 minutes' : 'Send the pricing'} />
      </Field>
      <button onClick={save} className={primary} style={PRIMARY_BG}><Check className="w-4 h-4" />Save</button>
    </Modal>
  )
}

interface PreviewSheet { name: string; isList: boolean; rows: number; skipped: number; add: number; update: number; unchanged: number; otherRep: number }

function ImportModal({ skin, reps, isAdmin, defaultRep, selectStyle, onClose, onDone }: {
  skin: React.CSSProperties; reps: RepOption[]; isAdmin: boolean; defaultRep: string; selectStyle: React.CSSProperties
  onClose: () => void; onDone: () => Promise<void> | void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [sheets, setSheets] = useState<PreviewSheet[] | null>(null)
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [listName, setListName] = useState('')
  const [rep, setRep] = useState(defaultRep)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async (mode: 'preview' | 'commit', chosen?: File) => {
    const form = new FormData()
    form.set('file', chosen || file!)
    form.set('mode', mode)
    if (listName) form.set('list', listName)
    if (rep) form.set('rep_id', rep)
    if (mode === 'commit') form.set('sheets', JSON.stringify([...ticked]))
    const res = await fetch('/api/prospects/import', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || 'That import did not work.')
    return data
  }

  const pick = async (f: File | null) => {
    setError(null)
    setSheets(null)
    setFile(f)
    if (!f) return
    setBusy(true)
    try {
      const data = await send('preview', f)
      setSheets(data.sheets)
      setListName(data.listName)
      setTicked(new Set(data.sheets.filter((s: PreviewSheet) => s.isList).map((s: PreviewSheet) => s.name)))
    } catch (e: any) {
      setError(e.message)
    }
    setBusy(false)
  }

  const commit = async () => {
    setBusy(true)
    setError(null)
    try {
      const data = await send('commit')
      await onDone()
      toast.success(`${data.added} added, ${data.updated} updated, ${data.unchanged} already here.${data.otherRep ? ` ${data.otherRep} left with another rep.` : ''}`, { duration: 8000 })
      onClose()
    } catch (e: any) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <Modal skin={skin} title="Import a list" onClose={onClose} wide>
      <p className="text-sm" style={{ color: 'var(--cal-muted)' }}>
        Any Excel file or CSV with a company and an email or phone column. Anyone already on the list keeps their history and only gains what is new, so importing the same file twice is safe.
      </p>
      <input type="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt" aria-label="Spreadsheet" onChange={e => pick(e.target.files?.[0] || null)}
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-2 file:text-sm file:font-semibold" style={{ color: 'var(--cal-text)' }} />
      {isAdmin && (
        <Field label="Whose list is this?">
          <select value={rep} onChange={e => setRep(e.target.value)} className={`${inputClass} min-h-[44px]`} style={selectStyle}>
            <option value="">No rep yet</option>
            {reps.filter(r => r.active).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
      )}
      {busy && <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--cal-muted)' }}><Loader2 className="w-4 h-4 animate-spin" />Working</p>}
      {error && <p role="alert" className="text-sm rounded-xl px-3 py-2" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--cal-text)' }}>{error}</p>}
      {sheets && (
        <>
          <Field label="Call this list">
            <input value={listName} onChange={e => setListName(e.target.value)} className={`${inputClass} min-h-[44px]`} style={inputStyle} />
          </Field>
          <div className="space-y-1.5">
            {sheets.map(s => (
              <label key={s.name} className="flex items-start gap-2.5 rounded-xl p-2.5 cursor-pointer" style={{ border: '1px solid var(--cal-border)' }}>
                <input type="checkbox" className="w-4 h-4 mt-0.5" checked={ticked.has(s.name)}
                  onChange={() => setTicked(t => { const n = new Set(t); if (n.has(s.name)) n.delete(s.name); else n.add(s.name); return n })} />
                <span className="text-sm flex-1">
                  <span className="font-semibold">{s.name}</span>
                  <span className="block text-xs" style={{ color: 'var(--cal-muted)' }}>
                    {s.add} new, {s.update} to update, {s.unchanged} already here
                    {s.otherRep ? `, ${s.otherRep} with another rep` : ''}
                    {s.skipped ? `, ${s.skipped} skipped (no company, email or phone)` : ''}
                    {!s.isList ? '. Looks like a copy or a summary of the list, so it is not ticked.' : ''}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <button onClick={commit} disabled={busy || ticked.size === 0} className={primary} style={PRIMARY_BG}><Upload className="w-4 h-4" />Import</button>
        </>
      )}
    </Modal>
  )
}

function EmailModal({ skin, count, ids, scope, defaultTo, onClose }: {
  skin: React.CSSProperties; count: number; ids: string[]; scope: string; defaultTo: string; onClose: () => void
}) {
  const [to, setTo] = useState(defaultTo)
  const [message, setMessage] = useState('')
  const [xlsx, setXlsx] = useState(true)
  const [pdf, setPdf] = useState(true)
  const [busy, setBusy] = useState(false)
  const send = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/prospects/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'email', ids, scope, to, message, formats: [...(xlsx ? ['xlsx'] : []), ...(pdf ? ['pdf'] : [])] }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'That did not send.')
      toast.success('Sent')
      onClose()
    } catch (e: any) {
      toast.error(e.message, { duration: 8000 })
      setBusy(false)
    }
  }
  return (
    <Modal skin={skin} title="Mail this list" onClose={onClose}>
      <p className="text-sm" style={{ color: 'var(--cal-muted)' }}>{count} contact{count === 1 ? '' : 's'}: {scope}. It holds people&apos;s contact details, so only send it within Cardtly.</p>
      <Field label="To (up to five, separated by commas)">
        <input value={to} onChange={e => setTo(e.target.value)} className={`${inputClass} min-h-[44px]`} style={inputStyle} inputMode="email" autoComplete="off" />
      </Field>
      <Field label="Message (optional)">
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} className={inputClass} style={inputStyle} />
      </Field>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2 min-h-[44px]"><input type="checkbox" checked={xlsx} onChange={e => setXlsx(e.target.checked)} className="w-4 h-4" />Excel</label>
        <label className="flex items-center gap-2 min-h-[44px]"><input type="checkbox" checked={pdf} onChange={e => setPdf(e.target.checked)} className="w-4 h-4" />PDF</label>
      </div>
      <button onClick={send} disabled={busy || !to.trim() || (!xlsx && !pdf) || count === 0} className={primary} style={PRIMARY_BG}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Send
      </button>
    </Modal>
  )
}

function ScriptModal({ skin, playbook, canWrite, onClose, onSaved }: {
  skin: React.CSSProperties; playbook: Playbook; canWrite: boolean; onClose: () => void; onSaved: (p: Playbook) => void
}) {
  const [f, setF] = useState<Playbook>(playbook)
  const [editing, setEditing] = useState(!playbook.script)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try {
      await post({ action: 'save_playbook', ...f })
      onSaved(f)
      setEditing(false)
      toast.success('Saved')
    } catch (e: any) {
      toast.error(e.message, { duration: 8000 })
    }
    setBusy(false)
  }
  return (
    <Modal skin={skin} title="Call script and email" onClose={onClose} wide>
      {!editing ? (
        <>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{f.script || 'No script yet.'}</p>
          <div className="rounded-xl p-3 text-sm" style={{ border: '1px solid var(--cal-border)' }}>
            <p className="font-semibold mb-1">{f.email_subject}</p>
            <p className="whitespace-pre-wrap" style={{ color: 'var(--cal-muted)' }}>{f.email_body}</p>
          </div>
          {canWrite && <button onClick={() => setEditing(true)} className={primary} style={PRIMARY_BG}>Edit</button>}
        </>
      ) : (
        <>
          <Field label="Call script">
            <textarea value={f.script} onChange={e => setF(x => ({ ...x, script: e.target.value }))} rows={10} className={inputClass} style={inputStyle} />
          </Field>
          <Field label="Email subject">
            <input value={f.email_subject} onChange={e => setF(x => ({ ...x, email_subject: e.target.value }))} className={`${inputClass} min-h-[44px]`} style={inputStyle} />
          </Field>
          <Field label="Email">
            <textarea value={f.email_body} onChange={e => setF(x => ({ ...x, email_body: e.target.value }))} rows={7} className={inputClass} style={inputStyle} />
          </Field>
          <p className="text-xs" style={{ color: 'var(--cal-muted)' }}>
            The Write it button fills in [Greeting], [First name], [Company Name], [Your name] and [Your phone]. [Greeting] follows the rule on your sheets: Hi and a name for a person&apos;s own address, Hello for a shared inbox.
          </p>
          <button onClick={save} disabled={busy} className={primary} style={PRIMARY_BG}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Save</button>
        </>
      )}
    </Modal>
  )
}

function AddModal({ skin, reps, isAdmin, defaultRep, selectStyle, onClose, onAdded }: {
  skin: React.CSSProperties; reps: RepOption[]; isAdmin: boolean; defaultRep: string; selectStyle: React.CSSProperties
  onClose: () => void; onAdded: (row: Prospect) => void
}) {
  const [f, setF] = useState({ company: '', contact_name: '', role: '', email: '', phone: '', sector: '', region: '', priority: 'medium', notes: '' })
  const [rep, setRep] = useState(defaultRep || reps.find(r => r.active)?.id || '')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<any>) => setF(x => ({ ...x, [k]: e.target.value }))
  const save = async () => {
    setBusy(true)
    try {
      const data = await post({ action: 'add', fields: { ...f, rep_id: rep } })
      onAdded(data.row)
      toast.success('Added')
      onClose()
    } catch (e: any) {
      toast.error(e.message, { duration: 8000 })
      setBusy(false)
    }
  }
  return (
    <Modal skin={skin} title="Add a prospect" onClose={onClose}>
      <Field label="Company"><input value={f.company} onChange={set('company')} className={`${inputClass} min-h-[44px]`} style={inputStyle} autoFocus /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Contact name"><input value={f.contact_name} onChange={set('contact_name')} className={`${inputClass} min-h-[44px]`} style={inputStyle} /></Field>
        <Field label="Role"><input value={f.role} onChange={set('role')} className={`${inputClass} min-h-[44px]`} style={inputStyle} /></Field>
        <Field label="Email"><input value={f.email} onChange={set('email')} type="email" className={`${inputClass} min-h-[44px]`} style={inputStyle} /></Field>
        <Field label="Phone"><input value={f.phone} onChange={set('phone')} type="tel" className={`${inputClass} min-h-[44px]`} style={inputStyle} /></Field>
        <Field label="Sector"><input value={f.sector} onChange={set('sector')} className={`${inputClass} min-h-[44px]`} style={inputStyle} /></Field>
        <Field label="Priority">
          <select value={f.priority} onChange={set('priority')} className={`${inputClass} min-h-[44px]`} style={selectStyle}>
            {PROSPECT_PRIORITIES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      {isAdmin && (
        <Field label="Rep">
          <select value={rep} onChange={e => setRep(e.target.value)} className={`${inputClass} min-h-[44px]`} style={selectStyle}>
            <option value="">No rep yet</option>
            {reps.filter(r => r.active).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
      )}
      <button onClick={save} disabled={busy || !f.company.trim() || (!f.email.trim() && !f.phone.trim())} className={primary} style={PRIMARY_BG}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Add
      </button>
    </Modal>
  )
}
