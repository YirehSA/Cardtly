'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Pencil, Trash2, Loader2, Building2, User, Phone, Mail, MapPin,
  CalendarPlus, Clock, Check, UserX, Ban, CalendarClock,
} from 'lucide-react'
import { fmtTime, fmtDuration } from '@/lib/calendar'
import {
  MEETING_OUTCOMES, meetingDuration, meetingEnd, statusMeta, outcomeMeta,
  type CalendarMeeting, type MeetingStatus, type MeetingOutcome,
} from '@/lib/rep-meetings'
import { isOverdue, Pill } from './shared'

// Everything about one meeting, and the two-tap way to write it up.
//
// The panel is portalled to document.body. A fixed overlay inside a transformed
// ancestor is positioned against that ancestor instead of the viewport, which is
// how the image lightbox on the public card ended up off-centre on a phone.

const QUICK: { id: MeetingStatus; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'done', label: 'Happened', icon: Check },
  { id: 'no_show', label: 'No show', icon: UserX },
  { id: 'cancelled', label: 'Cancelled', icon: Ban },
]

export default function MeetingDetail({
  meeting, now, canEdit, busy, skin, onClose, onEdit, onDelete, onQuickStatus, onQuickOutcome, icsHref,
}: {
  meeting: CalendarMeeting
  now: Date
  canEdit: boolean
  busy: string | null
  /** The --cal-* variables. Passed in explicitly because this panel is portalled
   *  to document.body and so sits OUTSIDE the wrapper that normally defines
   *  them - CSS variables inherit down the DOM tree, and a portal leaves it. */
  skin: React.CSSProperties
  onClose: () => void
  onEdit: (m: CalendarMeeting) => void
  onDelete: (m: CalendarMeeting) => void
  onQuickStatus: (m: CalendarMeeting, status: MeetingStatus) => void
  onQuickOutcome: (m: CalendarMeeting, outcome: MeetingOutcome) => void
  /** Only offered to the rep whose meeting it is. */
  icsHref?: string | null
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!mounted) return null

  const st = statusMeta(meeting.status)
  const oc = outcomeMeta(meeting.outcome)
  const start = new Date(meeting.scheduled_at)
  const end = meetingEnd(meeting)
  const overdue = isOverdue(meeting, now)

  return createPortal(
    <div className="fixed inset-0 z-[100] flex sm:justify-end" role="dialog" aria-modal="true"
      aria-label={`${meeting.company} meeting`} style={skin}>
      <button aria-label="Close" onClick={onClose}
        className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }} />

      <div
        className="relative ml-auto w-full sm:max-w-md h-full overflow-y-auto animate-cal-slide"
        style={{
          background: 'var(--cal-panel, var(--cal-surface))',
          borderLeft: '1px solid var(--cal-border)',
          color: 'var(--cal-text)',
        }}
      >
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0"
              style={{ background: st.colour + '22', border: `1px solid ${st.colour}55` }}>
              <Building2 className="w-4 h-4" style={{ color: st.colour }} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-lg font-bold leading-tight break-words">{meeting.company}</h2>
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                <Pill label={st.label} colour={st.colour} />
                {oc && <Pill label={oc.label} colour={oc.colour} />}
                {meeting.repName && <Pill label={meeting.repName} colour="#a855f7" />}
              </div>
            </div>
            <button onClick={onClose} aria-label="Close"
              className="w-9 h-9 rounded-xl grid place-items-center transition shrink-0"
              style={{ border: '1px solid var(--cal-border)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {overdue && (
            <p className="text-xs rounded-xl px-3 py-2.5 font-semibold"
              style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.35)', color: '#f59e0b' }}>
              This is still marked planned and the time has passed. What happened?
            </p>
          )}

          <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--cal-raised)' }}>
            <Row icon={CalendarClock} label={start.toLocaleDateString('en-ZA', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })} />
            <Row icon={Clock} label={`${fmtTime(start)} to ${fmtTime(end)} · ${fmtDuration(meetingDuration(meeting))}`} />
            {meeting.location && <Row icon={MapPin} label={meeting.location} />}
          </div>

          {(meeting.contact_name || meeting.contact_phone || meeting.contact_email) && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--cal-raised)' }}>
              {meeting.contact_name && <Row icon={User} label={meeting.contact_name} />}
              {meeting.contact_phone && (
                <Row icon={Phone} label={meeting.contact_phone} href={`tel:${meeting.contact_phone}`} />
              )}
              {meeting.contact_email && (
                <Row icon={Mail} label={meeting.contact_email} href={`mailto:${meeting.contact_email}`} />
              )}
            </div>
          )}

          {meeting.follow_up_on && (
            <p className="text-xs rounded-xl px-3 py-2.5 font-semibold"
              style={{ background: 'rgba(236,72,153,0.10)', border: '1px solid rgba(236,72,153,0.35)', color: '#ec4899' }}>
              Follow up on {meeting.follow_up_on}
            </p>
          )}

          {meeting.notes && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--cal-muted)' }}>
                Notes
              </p>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{meeting.notes}</p>
            </div>
          )}

          {canEdit && (
            <div className="space-y-3 pt-1">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--cal-muted)' }}>
                  Write it up
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {QUICK.map(({ id, label, icon: Icon }) => {
                    const meta = statusMeta(id)
                    const on = meeting.status === id
                    return (
                      <button key={id}
                        disabled={busy === `status-${meeting.id}`}
                        onClick={() => onQuickStatus(meeting, id)}
                        className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-bold transition disabled:opacity-40"
                        style={on
                          ? { background: meta.colour + '26', color: meta.colour, border: `1px solid ${meta.colour}` }
                          : { background: 'var(--cal-raised)', color: 'var(--cal-muted)', border: '1px solid transparent' }}>
                        <Icon className="w-3.5 h-3.5" />{label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Only once it has happened. An outcome on something that has not
                  taken place would be a claim about the future. */}
              {meeting.status !== 'planned' && meeting.status !== 'cancelled' && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--cal-muted)' }}>
                    And what came of it
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {MEETING_OUTCOMES.map(o => {
                      const on = meeting.outcome === o.id
                      return (
                        <button key={o.id}
                          disabled={busy === `outcome-${meeting.id}`}
                          onClick={() => onQuickOutcome(meeting, o.id)}
                          className="px-2.5 py-2 rounded-lg text-xs font-bold transition disabled:opacity-40"
                          style={on
                            ? { background: o.colour + '26', color: o.colour, border: `1px solid ${o.colour}` }
                            : { background: 'var(--cal-raised)', color: 'var(--cal-muted)', border: '1px solid transparent' }}>
                          {o.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap pt-2" style={{ borderTop: '1px solid var(--cal-border)' }}>
            {canEdit && (
              <button onClick={() => onEdit(meeting)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition"
                style={{ border: '1px solid rgba(168,85,247,0.4)', color: '#a855f7' }}>
                <Pencil className="w-3.5 h-3.5" />Edit
              </button>
            )}
            {icsHref && (
              <a href={icsHref} download
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition"
                style={{ border: '1px solid var(--cal-border)', color: 'var(--cal-text)' }}
                title="Download this meeting for Google Calendar, Outlook or your phone">
                <CalendarPlus className="w-3.5 h-3.5" />Add to my diary
              </a>
            )}
            {canEdit && (
              <button onClick={() => onDelete(meeting)} disabled={busy === `del-${meeting.id}`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition disabled:opacity-40 ml-auto"
                style={{ border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444' }}>
                {busy === `del-${meeting.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </button>
            )}
          </div>

          <p className="text-[10px]" style={{ color: 'var(--cal-muted)' }}>
            Logged {new Date(meeting.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
            {meeting.updated_at && meeting.updated_at !== meeting.created_at && (
              <> · last changed {new Date(meeting.updated_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</>
            )}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes cal-slide {
          from { transform: translateX(16px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .animate-cal-slide { animation: cal-slide 0.18s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .animate-cal-slide { animation: none; }
        }
      `}</style>
    </div>,
    document.body,
  )
}

function Row({ icon: Icon, label, href }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  href?: string
}) {
  const inner = (
    <>
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--cal-muted)' }} />
      <span className="text-sm break-words">{label}</span>
    </>
  )
  return href ? (
    <a href={href} className="flex items-center gap-2.5 hover:underline">{inner}</a>
  ) : (
    <div className="flex items-center gap-2.5">{inner}</div>
  )
}
