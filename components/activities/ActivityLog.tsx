'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Search, X, Download, Mail, Linkedin, Users, Inbox, Plus } from 'lucide-react'
import {
  ACTIVITY_KINDS, ACTIVITY_STATUSES, statusMeta, kindMeta, filterActivities,
  activitiesToCsv, dayKey,
  type ActivityKind, type ActivityStatus, type LoggedActivity,
} from '@/lib/rep-activities'
import { Pill, inputClass, inputStyle, useInk, INK } from '@/components/calendar/shared'
import ActivityForm, {
  blankActivity, activityFormFrom, activityToBody, type ActivityFormState,
} from './ActivityForm'

// The list under a tab: emails on one, LinkedIn and networking on the other.
//
// The period, the figures and the follow-up banner are the page's, not this
// component's - they are the same on every tab and they are set above. What
// belongs here is narrowing what is already on screen, and editing a row.

const KIND_ICON: Record<ActivityKind, React.ReactNode> = {
  email: <Mail className="w-4 h-4" />,
  linkedin: <Linkedin className="w-4 h-4" />,
  networking: <Users className="w-4 h-4" />,
}

export default function ActivityLog({
  activities, allInTab, kinds, endpoint, skin, canWrite = true, onRefresh, periodName,
  reps = null, repId = null,
}: {
  /** Already narrowed to the period by the page above. */
  activities: LoggedActivity[]
  /** Every activity in this tab, period ignored. Only used to tell "nothing
   *  logged yet" apart from "nothing this month", which are different problems
   *  with different answers. */
  allInTab: LoggedActivity[]
  /** Which kinds this tab covers. Email is one; Networking is LinkedIn and
   *  networking together, because a connection made at an event and one made on
   *  LinkedIn are the same job. */
  kinds: readonly ActivityKind[]
  endpoint: string
  skin: React.CSSProperties
  canWrite?: boolean
  onRefresh: () => Promise<void> | void
  /** For the export filename, so a downloaded file says what is in it. */
  periodName: string
  /** Admin only: lets an activity be filed against any rep, and turns on the
   *  Rep column. Its presence is what puts the Rep field in the form. */
  reps?: { id: string; name: string }[] | null
  /** Admin only: which rep the log is narrowed to, or null for everyone. */
  repId?: string | null
}) {
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<ActivityKind | null>(null)
  const [status, setStatus] = useState<ActivityStatus | null>(null)
  const [form, setForm] = useState<ActivityFormState | null>(null)
  const [busy, setBusy] = useState(false)
  const ink = useInk()
  // Amber on white is 2.0:1, so the one thing on this screen that means "you
  // are late" was the least readable thing on it. See useInk.
  const overdueInk = ink(INK.amber.bright, INK.amber.deep)
  const dateInk = ink(INK.sky.bright, INK.sky.deep)

  // Narrowed to one rep before anything else, so the search, the filters and
  // the export all agree about whose log is on screen.
  const scoped = useMemo(
    () => (repId ? activities.filter(a => a.rep_id === repId) : activities),
    [activities, repId])

  const shown = useMemo(
    () => filterActivities(scoped, search, kind, status),
    [scoped, search, kind, status])

  // Only the statuses that can actually occur in this tab, so the Email log
  // does not offer to filter by "Attended".
  const statusOptions = useMemo(
    () => ACTIVITY_STATUSES.filter(s => kinds.some(k => (s.kinds as readonly string[]).includes(k))),
    [kinds])

  async function post(body: Record<string, any>, okMsg: string) {
    setBusy(true)
    const res = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok || data?.error) { toast.error(data?.error || 'That did not work', { duration: 8000 }); return }
    toast.success(okMsg)
    await onRefresh()
    setForm(null)
  }

  function exportCsv() {
    if (shown.length === 0) { toast.error('Nothing to export in this view'); return }
    const blob = new Blob([activitiesToCsv(shown)], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `activity-${periodName.toLowerCase().replace(/\s+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success(`${shown.length} ${shown.length === 1 ? 'row' : 'rows'} exported`)
  }

  return (
    <div className="space-y-3">
      {/* Search, then the two narrowing filters, then export. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--cal-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Contacts, companies, notes..."
            aria-label="Search this log"
            className={`${inputClass} pl-9`} style={inputStyle} />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg grid place-items-center">
              <X className="w-3.5 h-3.5" style={{ color: 'var(--cal-muted)' }} />
            </button>
          )}
        </div>

        {/* Only when the tab actually holds more than one kind. A dropdown with
            one real choice in it is furniture. */}
        {kinds.length > 1 && (
          <select value={kind || ''} aria-label="Filter by type"
            onChange={e => setKind((e.target.value || null) as ActivityKind | null)}
            className={`${inputClass} flex-1 min-w-[150px]`} style={inputStyle}>
            <option value="">All activity</option>
            {ACTIVITY_KINDS.filter(k => kinds.includes(k.id)).map(k => (
              <option key={k.id} value={k.id}>{k.short}</option>
            ))}
          </select>
        )}

        <select value={status || ''} aria-label="Filter by status"
          onChange={e => setStatus((e.target.value || null) as ActivityStatus | null)}
          className={`${inputClass} flex-1 min-w-[150px]`} style={inputStyle}>
          <option value="">All statuses</option>
          {statusOptions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>

        <button onClick={exportCsv}
          className="px-3 min-h-[44px] rounded-xl text-sm font-semibold inline-flex items-center gap-2"
          style={{ border: '1px solid var(--cal-border)', color: 'var(--cal-text)' }}>
          <Download className="w-4 h-4" />Export
        </button>

        {/* The rep gets Quick log buttons above the tabs; the admin panel has
            no room for a strip of them, so the add button lives here. Opens on
            this tab's own kind, which is the one they are looking at. */}
        {reps && canWrite && (
          <button onClick={() => setForm(blankActivity(kind || kinds[0], repId || ''))}
            className="px-4 min-h-[44px] rounded-xl text-sm font-bold text-white inline-flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #0369a1, #6d28d9, #be185d)' }}>
            <Plus className="w-4 h-4" />Log activity
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--cal-border)' }}>
          <Inbox className="w-7 h-7 mx-auto mb-3" style={{ color: 'var(--cal-muted)' }} />
          <p className="font-semibold mb-1">
            {allInTab.length === 0 ? 'Nothing logged here yet' : 'Nothing in this view'}
          </p>
          <p className="text-sm" style={{ color: 'var(--cal-muted)' }}>
            {allInTab.length === 0
              ? 'Log it the moment you press send and the follow-ups look after themselves.'
              : 'Try another month, fewer words, or a different status.'}
          </p>
        </div>
      ) : (
        <>
          {/* A real table from sm up. Below it there is no room for seven
              columns, so the same fields stack with their own labels rather
              than running together behind a bullet. */}
          <div className="hidden sm:block rounded-2xl border overflow-x-auto"
            style={{ borderColor: 'var(--cal-border)' }}>
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--cal-raised)' }}>
                  <Th>Date &amp; time</Th><Th>Type</Th><Th>Contact / company</Th>
                  <Th>Subject / notes</Th><Th>Status</Th><Th>Next step</Th>
                  {reps && <Th>Rep</Th>}
                </tr>
              </thead>
              <tbody>
                {shown.map(a => {
                  const sm = statusMeta(a.status)
                  const km = kindMeta(a.kind)
                  const overdue = !!a.follow_up_on && a.follow_up_on <= dayKey(new Date())
                    && a.status !== 'meeting_booked' && a.status !== 'not_interested'
                  return (
                    <tr key={a.id}
                      onClick={() => canWrite && setForm(activityFormFrom(a))}
                      className={canWrite ? 'cursor-pointer transition hover:opacity-80' : ''}
                      style={{ borderTop: '1px solid var(--cal-border)' }}>
                      <Td muted>{when(a.happened_at)}</Td>
                      <Td>
                        <span className="inline-grid place-items-center w-8 h-8 rounded-lg"
                          title={km.short}
                          style={{ background: km.colour + '22', color: km.colour }}>
                          {KIND_ICON[a.kind]}
                        </span>
                        <span className="sr-only">{km.short}</span>
                      </Td>
                      <Td>
                        <span className="font-semibold block">{a.company}</span>
                        {a.contact_name && (
                          <span className="text-xs" style={{ color: 'var(--cal-muted)' }}>{a.contact_name}</span>
                        )}
                      </Td>
                      <Td muted={!a.subject} title={a.notes || ''}>
                        <span className="line-clamp-2 max-w-[30ch] inline-block align-top">
                          {a.subject || a.notes || '-'}
                        </span>
                      </Td>
                      <Td><Pill label={sm.label} colour={sm.colour} /></Td>
                      <Td>
                        {a.next_step || a.follow_up_on
                          ? <span style={{ color: overdue ? overdueInk : 'var(--cal-text)', fontWeight: overdue ? 600 : 400 }}>
                            {a.next_step || 'Follow up'}
                            {a.follow_up_on && (
                              <span className="block text-xs" style={{ color: overdue ? overdueInk : 'var(--cal-muted)' }}>
                                {overdue ? `Due ${a.follow_up_on}` : a.follow_up_on}
                              </span>
                            )}
                          </span>
                          : <span style={{ color: 'var(--cal-muted)' }}>-</span>}
                      </Td>
                      {reps && <Td muted={!a.repName}>{a.repName || '-'}</Td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <ul className="sm:hidden space-y-2">
            {shown.map(a => {
              const sm = statusMeta(a.status)
              const km = kindMeta(a.kind)
              const overdue = !!a.follow_up_on && a.follow_up_on <= dayKey(new Date())
                && a.status !== 'meeting_booked' && a.status !== 'not_interested'
              return (
                <li key={a.id}>
                  <button onClick={() => canWrite && setForm(activityFormFrom(a))} disabled={!canWrite}
                    className="w-full text-left rounded-2xl border p-3 space-y-1.5 disabled:cursor-default"
                    style={{ borderColor: 'var(--cal-border)', background: 'var(--cal-surface)' }}>
                    <div className="flex items-start gap-3">
                      <span className="w-9 h-9 rounded-xl grid place-items-center flex-shrink-0"
                        style={{ background: km.colour + '22', color: km.colour }}>
                        {KIND_ICON[a.kind]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{a.company}</p>
                        <p className="text-xs" style={{ color: 'var(--cal-muted)' }}>{when(a.happened_at)}</p>
                      </div>
                      <Pill label={sm.label} colour={sm.colour} />
                    </div>
                    <Row label="Contact" value={a.contact_name} />
                    <Row label={a.kind === 'networking' ? 'Event' : 'Subject'} value={a.subject} />
                    <Row label="Notes" value={a.notes} />
                    <Row label="Next step" value={a.next_step} />
                    {reps && <Row label="Rep" value={a.repName} />}
                    {a.follow_up_on && (
                      <Row label="Follow up"
                        value={overdue ? `Due ${a.follow_up_on}` : a.follow_up_on}
                        tone={overdue ? overdueInk : dateInk} />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {form && (
        <ActivityForm
          form={form} setForm={setForm as any} busy={busy} skin={skin} reps={reps}
          onClose={() => setForm(null)}
          onSave={() => post(activityToBody(form), form.id ? 'Activity updated' : 'Activity logged')}
          onDelete={form.id
            ? () => {
              if (!confirm('Delete this entry?\n\nThe note goes with it.')) return
              // rep_id goes along for the admin route, which cannot take it
              // from a session. The rep route ignores it and uses their own.
              post({ action: 'delete', id: form.id, rep_id: form.repId || undefined }, 'Entry deleted')
            }
            : undefined}
        />
      )}
    </div>
  )
}

/** Opened by the page above, from the Quick log buttons. Exported so the
 *  workspace does not need a second copy of the save-and-refresh dance. */
export { blankActivity }

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left text-xs font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap"
      style={{ color: 'var(--cal-muted)' }}>{children}</th>
  )
}

function Td({ children, bold, muted, title }: {
  children: React.ReactNode; bold?: boolean; muted?: boolean; title?: string
}) {
  return (
    <td className="px-3 py-2 align-top" title={title}
      style={{ fontWeight: bold ? 600 : 400, color: muted ? 'var(--cal-muted)' : 'var(--cal-text)' }}>
      {children}
    </td>
  )
}

/** One labelled line on a phone, where the table cannot go. */
function Row({ label, value, tone }: { label: string; value?: string | null; tone?: string }) {
  if (!value) return null
  return (
    <p className="text-sm flex gap-2">
      <span className="flex-shrink-0 w-[68px]" style={{ color: 'var(--cal-muted)' }}>{label}</span>
      <span className="min-w-0 flex-1" style={{ color: tone || 'var(--cal-text)', fontWeight: tone ? 600 : 400 }}>{value}</span>
    </p>
  )
}

/** Today and yesterday by name, anything older by date. A log is read from the
 *  top, and "today 10:24" is what a rep is actually looking for. */
function when(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const time = d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })
  const today = dayKey(new Date())
  const key = dayKey(d)
  if (key === today) return `Today ${time}`
  const y = new Date(); y.setDate(y.getDate() - 1)
  if (key === dayKey(y)) return `Yesterday ${time}`
  return `${d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })} ${time}`
}
