'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Loader2 } from 'lucide-react'
import {
  addDays, dateKey, timeKey, fromDateTimeParts, fmtDuration,
} from '@/lib/calendar'
import {
  MEETING_STATUSES, MEETING_OUTCOMES, DURATION_CHOICES,
  DEFAULT_DURATION_MINUTES, meetingDuration,
  type CalendarMeeting, type MeetingStatus,
} from '@/lib/rep-meetings'
import { inputClass, inputStyle, GRAD } from './shared'

// One form, used for booking and for writing up, by a rep for themselves and by
// an admin on a rep's behalf.

export interface MeetingFormState {
  id: string | null
  /** Only used where the caller has to say whose meeting this is: the admin. A
   *  rep's own route takes the rep from their session and ignores this. */
  repId: string
  company: string
  contact_name: string
  contact_phone: string
  contact_email: string
  date: string
  time: string
  duration: number
  location: string
  status: MeetingStatus
  outcome: string
  follow_up_on: string
  notes: string
}

export function blankForm(when?: Date, repId = ''): MeetingFormState {
  const d = when || new Date()
  return {
    id: null, repId,
    company: '', contact_name: '', contact_phone: '', contact_email: '',
    date: dateKey(d),
    time: when ? timeKey(d) : '09:00',
    duration: DEFAULT_DURATION_MINUTES,
    location: '', status: 'planned', outcome: '', follow_up_on: '', notes: '',
  }
}

export function formFromMeeting(m: CalendarMeeting): MeetingFormState {
  const d = new Date(m.scheduled_at)
  return {
    id: m.id,
    repId: m.rep_id,
    company: m.company,
    contact_name: m.contact_name || '',
    contact_phone: m.contact_phone || '',
    contact_email: m.contact_email || '',
    date: dateKey(d),
    time: timeKey(d),
    duration: meetingDuration(m),
    location: m.location || '',
    status: m.status,
    outcome: m.outcome || '',
    follow_up_on: m.follow_up_on || '',
    notes: m.notes || '',
  }
}

/** What goes over the wire. The date and time are combined as LOCAL time and
 *  then sent as an instant, so 09:00 means 09:00 where the rep is standing. */
export function formToBody(f: MeetingFormState): Record<string, any> {
  return {
    id: f.id,
    rep_id: f.repId || undefined,
    company: f.company,
    contact_name: f.contact_name,
    contact_phone: f.contact_phone,
    contact_email: f.contact_email,
    scheduled_at: fromDateTimeParts(f.date, f.time).toISOString(),
    duration_minutes: f.duration,
    location: f.location,
    status: f.status,
    outcome: f.outcome || null,
    follow_up_on: f.follow_up_on || null,
    notes: f.notes,
  }
}

/** Specific, not "invalid input". A form that says only "error" leaves you
 *  guessing which of nine fields it meant. */
export function formError(f: MeetingFormState, needsRep: boolean): string | null {
  if (!f.company.trim()) return 'Which company are you seeing?'
  if (!f.date) return 'Pick a date for the meeting.'
  if (needsRep && !f.repId) return 'Choose which rep this meeting belongs to.'
  if (f.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contact_email.trim())) {
    return 'That email address does not look right.'
  }
  return null
}

export default function MeetingForm({
  form, setForm, busy, skin, reps, onClose, onSave,
}: {
  form: MeetingFormState
  setForm: (f: MeetingFormState | ((f: MeetingFormState) => MeetingFormState)) => void
  busy: boolean
  /** Portalled, so the --cal-* variables have to be handed over. */
  skin: React.CSSProperties
  /** Passed by the admin only. A rep never chooses whose meeting it is. */
  reps?: { id: string; name: string }[] | null
  onClose: () => void
  onSave: () => void
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
  const problem = formError(form, needsRep)

  return createPortal(
    <div className="fixed inset-0 z-[110] overflow-y-auto" role="dialog" aria-modal="true"
      aria-label={form.id ? 'Edit meeting' : 'New meeting'} style={skin}>
      <button aria-label="Close" onClick={onClose}
        className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }} />

      <div className="relative min-h-full flex items-start sm:items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-lg rounded-3xl border p-5 space-y-3"
          style={{ background: 'var(--cal-panel, var(--cal-surface))', borderColor: 'var(--cal-border)', color: 'var(--cal-text)' }}>

          <div className="flex items-center justify-between">
            <p className="font-display font-bold">{form.id ? 'Edit meeting' : 'New meeting'}</p>
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

          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Who you are seeing">
              <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                placeholder="Name" className={inputClass} style={inputStyle} />
            </Field>
            <Field label="Phone">
              <input value={form.contact_phone} type="tel" inputMode="tel"
                onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                placeholder="082..." className={inputClass} style={inputStyle} />
            </Field>
            <Field label="Email">
              <input value={form.contact_email} type="email" inputMode="email"
                onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                placeholder="name@company.co.za" className={inputClass} style={inputStyle} />
            </Field>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Date *">
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className={inputClass} style={inputStyle} />
            </Field>
            <Field label="Time">
              <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                className={inputClass} style={inputStyle} />
            </Field>
            <Field label="How long">
              <select value={form.duration} onChange={e => setForm(f => ({ ...f, duration: Number(e.target.value) }))}
                className={inputClass} style={inputStyle}>
                {DURATION_CHOICES.map(d => <option key={d} value={d}>{fmtDuration(d)}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Where">
            <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="Their offices, Sandton · or a Teams link" className={inputClass} style={inputStyle} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select value={form.status} className={inputClass} style={inputStyle}
                onChange={e => {
                  const status = e.target.value as MeetingStatus
                  // Clearing the outcome when it goes back to planned keeps the
                  // form honest with what the server will store.
                  setForm(f => ({ ...f, status, outcome: status === 'planned' ? '' : f.outcome }))
                }}>
                {MEETING_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Outcome">
              <select value={form.outcome} disabled={form.status === 'planned'}
                title={form.status === 'planned' ? 'Available once the meeting has happened' : undefined}
                onChange={e => {
                  const outcome = e.target.value
                  setForm(f => ({
                    ...f,
                    outcome,
                    // A follow-up with no date is a reminder nobody gets
                    // reminded by, so suggest one week out.
                    follow_up_on: outcome === 'follow_up' && !f.follow_up_on
                      ? dateKey(addDays(new Date(), 7))
                      : f.follow_up_on,
                  }))
                }}
                className={inputClass + ' disabled:opacity-40'} style={inputStyle}>
                <option value="">Not recorded</option>
                {MEETING_OUTCOMES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Follow up on" hint="Leave empty if there is nothing to chase">
            <div className="flex gap-2">
              <input type="date" value={form.follow_up_on}
                onChange={e => setForm(f => ({ ...f, follow_up_on: e.target.value }))}
                className={inputClass} style={inputStyle} />
              {form.follow_up_on && (
                <button onClick={() => setForm(f => ({ ...f, follow_up_on: '' }))}
                  className="px-3 rounded-xl text-xs font-bold shrink-0 transition"
                  style={{ border: '1px solid var(--cal-border)', color: 'var(--cal-muted)' }}>
                  Clear
                </button>
              )}
            </div>
          </Field>

          <Field label="Notes">
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={4} placeholder="What was discussed, what they need, what happens next."
              className={inputClass + ' resize-none'} style={inputStyle} />
          </Field>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[11px]" style={{ color: problem ? '#f59e0b' : 'var(--cal-muted)' }}>
              {problem || 'Ready to save.'}
            </p>
            <button onClick={onSave} disabled={busy || !!problem}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40 shrink-0"
              style={{ background: GRAD }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {form.id ? 'Save changes' : 'Add meeting'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--cal-muted)' }}>
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] mt-1" style={{ color: 'var(--cal-muted)' }}>{hint}</p>}
    </div>
  )
}
