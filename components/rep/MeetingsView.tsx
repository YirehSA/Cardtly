'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  CalendarClock, Plus, X, Loader2, Check, Trash2, Pencil,
  Building2, Phone, Mail, User,
} from 'lucide-react'
import {
  MEETING_STATUSES, MEETING_OUTCOMES, statusMeta, outcomeMeta,
  type RepMeeting, type MeetingStatus,
} from '@/lib/rep-meetings'

interface Form {
  id: string | null
  company: string
  contact_name: string
  contact_phone: string
  contact_email: string
  date: string
  time: string
  status: MeetingStatus
  outcome: string
  notes: string
}

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function localTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const blank = (): Form => ({
  id: null, company: '', contact_name: '', contact_phone: '', contact_email: '',
  date: localDate(new Date()), time: '09:00', status: 'planned', outcome: '', notes: '',
})

export default function MeetingsView({ repName, active, initial }: {
  repName: string
  active: boolean
  initial: RepMeeting[]
}) {
  const router = useRouter()
  const [meetings, setMeetings] = useState<RepMeeting[]>(initial)
  const [form, setForm] = useState<Form>(blank())
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  // Upcoming ascending (the next thing you have to do, first), past descending
  // (the most recent thing that happened, first). One list sorted one way puts
  // either next week or last month at the top, and neither is what you want.
  const { upcoming, past } = useMemo(() => {
    const now = Date.now()
    const up: RepMeeting[] = []
    const done: RepMeeting[] = []
    for (const m of meetings) {
      const isFuture = new Date(m.scheduled_at).getTime() >= now
      if (m.status === 'planned' && isFuture) up.push(m)
      else done.push(m)
    }
    up.sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))
    done.sort((a, b) => +new Date(b.scheduled_at) - +new Date(a.scheduled_at))
    return { upcoming: up, past: done }
  }, [meetings])

  function edit(m: RepMeeting) {
    const d = new Date(m.scheduled_at)
    setForm({
      id: m.id,
      company: m.company,
      contact_name: m.contact_name || '',
      contact_phone: m.contact_phone || '',
      contact_email: m.contact_email || '',
      date: localDate(d),
      time: localTime(d),
      status: m.status,
      outcome: m.outcome || '',
      notes: m.notes || '',
    })
    setOpen(true)
  }

  async function save() {
    if (!form.company.trim()) { toast.error('Which company are you seeing?'); return }
    setBusy('save')
    const scheduled = new Date(`${form.date}T${form.time || '09:00'}`)
    const res = await fetch('/api/rep/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: form.id,
        company: form.company,
        contact_name: form.contact_name,
        contact_phone: form.contact_phone,
        contact_email: form.contact_email,
        scheduled_at: scheduled.toISOString(),
        status: form.status,
        outcome: form.outcome || null,
        notes: form.notes,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok || data?.error) { toast.error(data?.error || 'Could not save that', { duration: 8000 }); return }
    toast.success(form.id ? 'Meeting updated' : 'Meeting added')
    setOpen(false)
    setForm(blank())
    router.refresh()
    // The server is the source of truth for the list, but refresh does not
    // repopulate props already held in state, so fetch it back.
    const fresh = await fetch('/api/rep/meetings').then(r => r.json()).catch(() => null)
    if (fresh?.meetings) setMeetings(fresh.meetings)
  }

  async function remove(m: RepMeeting) {
    if (!confirm(`Delete the ${m.company} meeting?\n\nThe notes go with it.`)) return
    setBusy(`del-${m.id}`)
    const res = await fetch('/api/rep/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id: m.id }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok || data?.error) { toast.error(data?.error || 'Could not delete that'); return }
    setMeetings(prev => prev.filter(x => x.id !== m.id))
    toast.success('Meeting deleted')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in pb-16">
      <div className="rounded-3xl border border-border overflow-hidden">
        <div className="p-6 sm:p-8" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.14), transparent 65%)' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-11 h-11 rounded-2xl grid place-items-center text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
              <CalendarClock className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <h1 className="font-display text-2xl font-bold leading-tight">My meetings</h1>
              <p className="text-muted-foreground text-sm">
                {repName} · {upcoming.length} coming up · {past.length} logged
              </p>
            </div>
            {active && (
              <button onClick={() => { setForm(blank()); setOpen(true) }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
                <Plus className="w-4 h-4" />New meeting
              </button>
            )}
          </div>
        </div>
      </div>

      {!active && (
        <p className="text-xs rounded-xl px-3 py-2.5" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}>
          This rep account is marked inactive, so you can read your meetings but not add to them.
        </p>
      )}

      {open && (
        <div className="rounded-3xl border bg-card p-5 space-y-3" style={{ borderColor: 'rgba(124,58,237,0.4)' }}>
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">{form.id ? 'Edit meeting' : 'New meeting'}</p>
            <button onClick={() => { setOpen(false); setForm(blank()) }} aria-label="Close"
              className="w-8 h-8 rounded-lg grid place-items-center hover:bg-muted transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Company *</label>
            <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
              placeholder="Sicon Group" className={INPUT} />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Who you are seeing</label>
              <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                placeholder="Name" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Phone</label>
              <input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                type="tel" placeholder="082..." className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Email</label>
              <input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                type="email" placeholder="name@company.co.za" className={INPUT} />
            </div>
          </div>

          <div className="grid sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Date *</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Time</label>
              <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Status</label>
              <select value={form.status} className={INPUT}
                onChange={e => {
                  const status = e.target.value as MeetingStatus
                  // Clearing the outcome when it goes back to planned keeps the
                  // form honest with what the server will store.
                  setForm(f => ({ ...f, status, outcome: status === 'planned' ? '' : f.outcome }))
                }}>
                {MEETING_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Outcome</label>
              <select value={form.outcome} disabled={form.status === 'planned'}
                onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}
                title={form.status === 'planned' ? 'Available once the meeting has happened' : undefined}
                className={INPUT + ' disabled:opacity-40'}>
                <option value="">—</option>
                {MEETING_OUTCOMES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={4} placeholder="What was discussed, what they need, what happens next."
              className={INPUT + ' resize-none'} />
          </div>

          <div className="flex justify-end">
            <button onClick={save} disabled={busy === 'save' || !form.company.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
              {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {form.id ? 'Save changes' : 'Add meeting'}
            </button>
          </div>
        </div>
      )}

      <List title="Coming up" empty="Nothing booked yet." items={upcoming} onEdit={edit} onDelete={remove} busy={busy} canEdit={active} />
      <List title="Logged" empty="No past meetings yet." items={past} onEdit={edit} onDelete={remove} busy={busy} canEdit={active} />
    </div>
  )
}

const INPUT = 'w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring transition'

function List({ title, empty, items, onEdit, onDelete, busy, canEdit }: {
  title: string
  empty: string
  items: RepMeeting[]
  onEdit: (m: RepMeeting) => void
  onDelete: (m: RepMeeting) => void
  busy: string | null
  canEdit: boolean
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <p className="text-xs font-bold uppercase tracking-widest mb-3 text-muted-foreground">{title} · {items.length}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map(m => {
            const s = statusMeta(m.status)
            const o = outcomeMeta(m.outcome)
            const when = new Date(m.scheduled_at)
            return (
              <div key={m.id} className="rounded-2xl border border-border p-3.5">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <p className="font-semibold text-sm">{m.company}</p>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                        style={{ background: s.colour + '22', color: s.colour, border: `1px solid ${s.colour}55` }}>
                        {s.label}
                      </span>
                      {o && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                          style={{ background: o.colour + '22', color: o.colour, border: `1px solid ${o.colour}55` }}>
                          {o.label}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {when.toLocaleString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {(m.contact_name || m.contact_phone || m.contact_email) && (
                      <div className="flex items-center gap-3 flex-wrap mt-1.5 text-[11px] text-muted-foreground">
                        {m.contact_name && <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{m.contact_name}</span>}
                        {m.contact_phone && <a href={`tel:${m.contact_phone}`} className="inline-flex items-center gap-1 hover:text-foreground"><Phone className="w-3 h-3" />{m.contact_phone}</a>}
                        {m.contact_email && <a href={`mailto:${m.contact_email}`} className="inline-flex items-center gap-1 hover:text-foreground"><Mail className="w-3 h-3" />{m.contact_email}</a>}
                      </div>
                    )}
                    {m.notes && (
                      <p className="text-xs mt-2 whitespace-pre-wrap leading-relaxed text-muted-foreground">{m.notes}</p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => onEdit(m)} aria-label="Edit meeting" title="Edit"
                        className="w-9 h-9 rounded-lg grid place-items-center hover:bg-muted text-muted-foreground transition">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDelete(m)} disabled={busy === `del-${m.id}`} aria-label="Delete meeting" title="Delete"
                        className="w-9 h-9 rounded-lg grid place-items-center hover:bg-red-500/10 text-red-400 transition disabled:opacity-40">
                        {busy === `del-${m.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
