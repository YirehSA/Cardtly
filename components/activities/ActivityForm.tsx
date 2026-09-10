'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Loader2, Trash2, Mail, Linkedin, Users } from 'lucide-react'
import { dateKey, timeKey, fromDateTimeParts } from '@/lib/calendar'
import {
  ACTIVITY_KINDS, statusesFor, statusFitsKind, defaultStatusFor, nextStatusForKind, kindMeta,
  type ActivityKind, type ActivityStatus, type LoggedActivity,
} from '@/lib/rep-activities'
import { inputClass, inputStyle, GRAD, useInk, INK } from '@/components/calendar/shared'

// One form for all three kinds of outreach. Same shape as CallForm, so somebody
// who has logged a call already knows this one.
//
// The kind is chosen first and at the top, because it changes what the rest of
// the form means: "Subject" is an email's subject line and a networking
// evening's name, and the statuses on offer are different for each.

const KIND_ICON: Record<ActivityKind, React.ReactNode> = {
  email: <Mail className="w-4 h-4" />,
  linkedin: <Linkedin className="w-4 h-4" />,
  networking: <Users className="w-4 h-4" />,
}

export interface ActivityFormState {
  id: string | null
  /** Only used where the caller has to say whose activity this is: the admin.
   *  A rep's own route takes the rep from their session and ignores it. */
  repId: string
  kind: ActivityKind
  company: string
  contact_name: string
  email: string
  subject: string
  date: string
  time: string
  status: ActivityStatus
  next_step: string
  follow_up_on: string
  notes: string
}

export function blankActivity(kind: ActivityKind = 'email', repId = ''): ActivityFormState {
  const now = new Date()
  return {
    id: null,
    repId,
    kind,
    company: '', contact_name: '', email: '', subject: '',
    // Now, because outreach is nearly always logged the moment it goes out.
    date: dateKey(now), time: timeKey(now),
    status: defaultStatusFor(kind),
    next_step: '', follow_up_on: '', notes: '',
  }
}

export function activityFormFrom(a: LoggedActivity): ActivityFormState {
  const d = new Date(a.happened_at)
  return {
    id: a.id,
    repId: a.rep_id,
    kind: a.kind,
    company: a.company,
    contact_name: a.contact_name || '',
    email: a.email || '',
    subject: a.subject || '',
    date: dateKey(d),
    time: timeKey(d),
    status: a.status,
    next_step: a.next_step || '',
    follow_up_on: a.follow_up_on || '',
    notes: a.notes || '',
  }
}

/** Changing the kind. The rule about which status survives lives in
 *  lib/rep-activities so it can be tested without a browser. */
export function withKind(f: ActivityFormState, kind: ActivityKind): ActivityFormState {
  return { ...f, kind, status: nextStatusForKind(f.status, kind) }
}

/** What goes over the wire. Date and time are combined as LOCAL time and sent
 *  as an instant, so 09:00 means 09:00 where the rep is standing. */
export function activityToBody(f: ActivityFormState): Record<string, any> {
  return {
    id: f.id,
    rep_id: f.repId || undefined,
    kind: f.kind,
    company: f.company,
    contact_name: f.contact_name,
    email: f.email,
    subject: f.subject,
    happened_at: fromDateTimeParts(f.date, f.time).toISOString(),
    status: f.status,
    next_step: f.next_step,
    follow_up_on: f.follow_up_on || null,
    notes: f.notes,
  }
}

/** Specific, not "invalid input". */
export function activityError(f: ActivityFormState, needsRep = false): string | null {
  if (!f.company.trim()) return 'Which company was this with?'
  if (!f.date) return 'When did this happen?'
  if (needsRep && !f.repId) return 'Choose which rep this belongs to.'
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) {
    return 'That email address does not look right.'
  }
  if (!statusFitsKind(f.status, f.kind)) {
    return `That status does not belong to a ${kindMeta(f.kind).short.toLowerCase()} activity.`
  }
  return null
}

/** What the free-text fields are called, per kind. The same column holds an
 *  email subject and the name of a networking evening, and asking for "Subject"
 *  at a property breakfast reads like a bug.
 *
 *  `presets` are the lines a rep types over and over. They are SUGGESTIONS on a
 *  text field, not a fixed list on a dropdown: a select would save the typing
 *  and take away the one-off subject, and the one-off is most of them. Picking
 *  one fills the field and it stays editable afterwards.
 *
 *  Networking has none on purpose. An event is called whatever the event is
 *  called, so a list of five would never contain the right answer. */
const WORDING: Record<ActivityKind, {
  subject: string; subjectHint: string; contact: string; verb: string; presets: string[]
}> = {
  email: {
    subject: 'Subject line', subjectHint: 'Intro to Cardtly - Digital Business Cards',
    contact: 'Who you wrote to', verb: 'Log email',
    presets: [
      'Intro to Cardtly - Digital Business Cards',
      'Cardtly Demo Request',
      'Cardtly Follow-Up',
      'Cardtly Proposal & Pricing',
      'Cardtly Partnership / Team Rollout',
    ],
  },
  linkedin: {
    subject: 'What you sent', subjectHint: 'Connection request with a note',
    contact: 'Who you connected with', verb: 'Log LinkedIn',
    presets: [
      'Connection request with a note',
      'Connection request without a note',
      'Intro message about Cardtly',
      'Follow-up message',
      'Demo / meeting request',
    ],
  },
  networking: {
    subject: 'Event', subjectHint: 'SA Property Networking (Online)',
    contact: 'Who you met', verb: 'Log networking',
    presets: [],
  },
}

export default function ActivityForm({
  form, setForm, busy, skin, reps, onClose, onSave, onDelete,
}: {
  form: ActivityFormState
  setForm: (f: ActivityFormState | ((f: ActivityFormState) => ActivityFormState)) => void
  busy: boolean
  /** Portalled, so the --cal-* variables have to be handed over. */
  skin: React.CSSProperties
  /** Passed by the admin only. A rep never chooses whose activity it is. */
  reps?: { id: string; name: string }[] | null
  onClose: () => void
  onSave: () => void
  onDelete?: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const ink = useInk()
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!mounted) return null

  const needsRep = !!reps
  const problem = activityError(form, needsRep)
  const words = WORDING[form.kind]
  const options = statusesFor(form.kind)

  return createPortal(
    <div className="fixed inset-0 z-[110] overflow-y-auto" role="dialog" aria-modal="true"
      aria-label={form.id ? 'Edit activity' : 'Log activity'} style={skin}>
      <button aria-label="Close" onClick={onClose}
        className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }} />

      <div className="relative min-h-full flex items-start sm:items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-lg rounded-3xl border p-5 space-y-3"
          style={{ background: 'var(--cal-panel, var(--cal-surface))', borderColor: 'var(--cal-border)', color: 'var(--cal-text)' }}>

          <div className="flex items-center justify-between">
            <p className="font-display font-bold">{form.id ? 'Edit activity' : 'Log activity'}</p>
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

          {/* First, because it changes what everything under it means. */}
          <fieldset>
            <legend className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--cal-muted)' }}>
              What kind of outreach *
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {ACTIVITY_KINDS.map(k => {
                const on = form.kind === k.id
                return (
                  <button key={k.id} type="button" onClick={() => setForm(f => withKind(f, k.id))}
                    aria-pressed={on}
                    className="min-h-[48px] rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition"
                    style={{
                      // 14, not 1f. The admin panel sits a shade lighter than
                      // the dashboard, and at 12% the chip's own tint lifted
                      // the background enough to put its blue label at 4.37:1.
                      // The border carries the selected state anyway.
                      background: on ? k.colour + '14' : 'transparent',
                      border: `1px solid ${on ? k.colour + '99' : 'var(--cal-border)'}`,
                      // The label takes the deep hue on a light panel. `solid`
                      // is the same value the filled buttons use.
                      color: on ? ink(k.colour, k.solid) : 'var(--cal-muted)',
                    }}>
                    {KIND_ICON[k.id]}
                    <span className="hidden xs:inline sm:inline">{k.short}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <Field label="Company *">
            <input value={form.company} autoFocus={!form.id}
              onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
              placeholder="Growthpoint Properties" className={inputClass} style={inputStyle} />
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={words.contact}>
              <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                placeholder="Name" className={inputClass} style={inputStyle} />
            </Field>
            <Field label="Email">
              <input value={form.email} type="email" inputMode="email"
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="name@company.co.za" className={inputClass} style={inputStyle} />
            </Field>
          </div>

          <Field label={words.subject}>
            {/* A datalist, so the field is still a text field. The list is keyed
                by kind: switching from Email to LinkedIn has to swap the
                suggestions with the label, or a rep gets email subjects offered
                against a connection request. */}
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder={words.subjectHint} className={inputClass} style={inputStyle}
              list={words.presets.length ? `activity-presets-${form.kind}` : undefined}
              autoComplete="off" />
            {words.presets.length > 0 && (
              <datalist id={`activity-presets-${form.kind}`}>
                {words.presets.map(o => <option key={o} value={o} />)}
              </datalist>
            )}
          </Field>

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

          <Field label="Where it stands *">
            <select value={form.status} className={inputClass} style={inputStyle}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as ActivityStatus }))}>
              {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>

          {/* Two columns for one idea, deliberately. The words are what a person
              reads back next week; the date is what the follow-up list can
              actually find. "Follow up mid-September" in a text field is
              invisible to every query there will ever be. */}
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Next step">
              <input value={form.next_step} onChange={e => setForm(f => ({ ...f, next_step: e.target.value }))}
                placeholder="Book a demo" className={inputClass} style={inputStyle} />
            </Field>
            <Field label="Follow up on">
              <input type="date" value={form.follow_up_on}
                onChange={e => setForm(f => ({ ...f, follow_up_on: e.target.value }))}
                className={inputClass} style={inputStyle} />
            </Field>
          </div>
          <p className="text-xs -mt-1" style={{ color: 'var(--cal-muted)' }}>
            Put a date here and it appears under Due to follow up until it is booked or turned down.
          </p>

          <Field label="Notes">
            <textarea value={form.notes} rows={3}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="What you said, what they need, what happens next."
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
              {problem && (
                <p className="text-xs" style={{ color: ink(INK.amber.bright, INK.amber.deep) }}>{problem}</p>
              )}
              <button onClick={onSave} disabled={busy || !!problem}
                className="px-4 min-h-[44px] rounded-xl text-sm font-bold text-white inline-flex items-center gap-2 disabled:opacity-40"
                style={{ background: GRAD }}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {form.id ? 'Save' : words.verb}
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
