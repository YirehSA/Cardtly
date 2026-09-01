'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Loader2, Trash2 } from 'lucide-react'
import { dateKey, timeKey, fromDateTimeParts } from '@/lib/calendar'
import { CALL_OUTCOMES, type LoggedCall, type CallOutcome } from '@/lib/rep-calls'
import { inputClass, inputStyle, GRAD } from '@/components/calendar/shared'

// One form, used for logging a call and for editing one, by a rep for
// themselves and by an admin on a rep's behalf. Same shape as MeetingForm, so
// somebody who has used one already knows this one.

export interface CallFormState {
  id: string | null
  /** Only used where the caller has to say whose call this is: the admin. A
   *  rep's own route takes the rep from their session and ignores this. */
  repId: string
  company: string
  contact_name: string
  phone: string
  date: string
  time: string
  outcome: CallOutcome
  follow_up_on: string
  notes: string
}

export function blankCall(repId = ''): CallFormState {
  const now = new Date()
  return {
    id: null, repId,
    company: '', contact_name: '', phone: '',
    // Now, because a call is nearly always logged the moment it ends.
    date: dateKey(now), time: timeKey(now),
    outcome: 'answered', follow_up_on: '', notes: '',
  }
}

export function callFormFrom(c: LoggedCall): CallFormState {
  const d = new Date(c.called_at)
  return {
    id: c.id,
    repId: c.rep_id,
    company: c.company,
    contact_name: c.contact_name || '',
    phone: c.phone || '',
    date: dateKey(d),
    time: timeKey(d),
    outcome: c.outcome,
    follow_up_on: c.follow_up_on || '',
    notes: c.notes || '',
  }
}

/** What goes over the wire. Date and time are combined as LOCAL time and sent
 *  as an instant, so 09:00 means 09:00 where the rep is standing. */
export function callToBody(f: CallFormState): Record<string, any> {
  return {
    id: f.id,
    rep_id: f.repId || undefined,
    company: f.company,
    contact_name: f.contact_name,
    phone: f.phone,
    called_at: fromDateTimeParts(f.date, f.time).toISOString(),
    outcome: f.outcome,
    follow_up_on: f.follow_up_on || null,
    notes: f.notes,
  }
}

/** Specific, not "invalid input". */
export function callError(f: CallFormState, needsRep: boolean): string | null {
  if (!f.company.trim()) return 'Which company did you call?'
  if (!f.date) return 'When was the call?'
  if (needsRep && !f.repId) return 'Choose which rep this call belongs to.'
  return null
}

export default function CallForm({
  form, setForm, busy, skin, reps, onClose, onSave, onDelete,
}: {
  form: CallFormState
  setForm: (f: CallFormState | ((f: CallFormState) => CallFormState)) => void
  busy: boolean
  /** Portalled, so the --cal-* variables have to be handed over. */
  skin: React.CSSProperties
  /** Passed by the admin only. A rep never chooses whose call it is. */
  reps?: { id: string; name: string }[] | null
  onClose: () => void
  onSave: () => void
  onDelete?: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!mounted) return null

  const needsRep = !!reps
  const problem = callError(form, needsRep)
  // The date only means something for the outcomes that imply one.
  const wantsCallback = form.outcome === 'callback' || form.outcome === 'voicemail' || form.outcome === 'no_answer'

  return createPortal(
    <div className="fixed inset-0 z-[110] overflow-y-auto" role="dialog" aria-modal="true"
      aria-label={form.id ? 'Edit call' : 'Log a call'} style={skin}>
      <button aria-label="Close" onClick={onClose}
        className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }} />

      <div className="relative min-h-full flex items-start sm:items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-lg rounded-3xl border p-5 space-y-3"
          style={{ background: 'var(--cal-panel, var(--cal-surface))', borderColor: 'var(--cal-border)', color: 'var(--cal-text)' }}>

          <div className="flex items-center justify-between">
            <p className="font-display font-bold">{form.id ? 'Edit call' : 'Log a call'}</p>
            <button onClick={onClose} aria-label="Close"
              className="w-9 h-9 rounded-xl grid place-items-center transition"
              style={{ border: '1px solid var(--cal-border)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {reps && (
            <Field label="Rep *">
              <select value={form.repId} onChange={e => setForm(f => ({ ...f, repId: e.target.value }))}
                className={inputClass} style={inputStyle}>
                <option value="">Choose a rep...</option>
                {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
          )}

          <Field label="Company *">
            <input value={form.company} autoFocus={!form.id}
              onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
              placeholder="Sicon Group" className={inputClass} style={inputStyle} />
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Who you spoke to">
              <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                placeholder="Name" className={inputClass} style={inputStyle} />
            </Field>
            <Field label="Number">
              <input value={form.phone} type="tel" inputMode="tel"
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="082..." className={inputClass} style={inputStyle} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date *">
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className={inputClass} style={inputStyle} />
            </Field>
            <Field label="Time">
              <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                className={inputClass} style={inputStyle} />
            </Field>
          </div>

          <Field label="How did it go? *">
            <select value={form.outcome} className={inputClass} style={inputStyle}
              onChange={e => setForm(f => ({ ...f, outcome: e.target.value as CallOutcome }))}>
              {CALL_OUTCOMES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>

          <Field label="Call back on">
            <input type="date" value={form.follow_up_on}
              onChange={e => setForm(f => ({ ...f, follow_up_on: e.target.value }))}
              className={inputClass} style={inputStyle} />
            <p className="text-xs mt-1" style={{ color: 'var(--cal-muted)' }}>
              {wantsCallback
                ? 'Set a date and this one shows up under Due to call back.'
                : 'Leave empty if there is nothing to chase.'}
            </p>
          </Field>

          <Field label="Notes">
            <textarea value={form.notes} rows={4}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="What was said, what they need, what happens next."
              className={inputClass} style={inputStyle} />
          </Field>

          <div className="flex items-center justify-between gap-3 pt-1">
            {form.id && onDelete ? (
              <button onClick={onDelete} disabled={busy}
                className="text-sm px-3 min-h-[44px] rounded-xl font-semibold inline-flex items-center gap-2 disabled:opacity-40"
                style={{ border: '1px solid var(--cal-border)', color: '#ef4444' }}>
                <Trash2 className="w-4 h-4" />Delete
              </button>
            ) : <span />}

            <div className="flex items-center gap-2">
              {problem && <p className="text-xs" style={{ color: '#f59e0b' }}>{problem}</p>}
              <button onClick={onSave} disabled={busy || !!problem}
                className="px-4 min-h-[44px] rounded-xl text-sm font-bold text-white inline-flex items-center gap-2 disabled:opacity-40"
                style={{ background: GRAD }}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {form.id ? 'Save' : 'Log call'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--cal-muted)' }}>{label}</span>
      {children}
    </label>
  )
}
