'use client'

import { useState } from 'react'
import { UserCog, Loader2, Plus, X, Check, TrendingUp, Users as UsersIcon, Building2, Trash2, CalendarRange, CalendarClock, Banknote } from 'lucide-react'
import { Section, randFmt, fmtDate, inputClass, inputStyle, grad } from './shared'
import type { RepStats } from '@/lib/reps'
import { statusMeta, outcomeMeta } from '@/lib/rep-meetings'

interface Form {
  repId: string | null
  name: string
  email: string
  phone: string
  target: string
  rate: string
  day: string
  startedOn: string
  notes: string
  active: boolean
}

interface Props {
  reps: RepStats[]
  onSave: (f: Form) => Promise<boolean>
  onDelete: (rep: RepStats) => Promise<boolean>
  onLinkLogin: (rep: RepStats) => Promise<boolean>
  onRecordPayout: (rep: RepStats, paid: boolean) => Promise<boolean>
  /** Jump to the Calendar tab with only this rep showing. The list below is fine
   *  for a glance; a diary is for looking at as a diary. */
  onOpenCalendar: (rep: RepStats) => void
  loading: string | null
}

const EMPTY: Form = { repId: null, name: '', email: '', phone: '', target: '250', rate: '10', day: '25', startedOn: '', notes: '', active: true }

export default function RepsTab({ reps, onSave, onDelete, onLinkLogin, onRecordPayout, onOpenCalendar, loading }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [meetingsOpen, setMeetingsOpen] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)

  function openEdit(r: RepStats) {
    setCreating(false)
    if (editing === r.id) { setEditing(null); return }
    setEditing(r.id)
    setForm({
      repId: r.id, name: r.name, email: r.email || '', phone: r.phone || '',
      target: String(r.target_cards), rate: String(r.commission_rand), day: String(r.commission_day ?? 25),
      startedOn: r.started_on || '', notes: r.notes || '', active: r.active,
    })
  }

  const totalCommission = reps.filter(r => r.active).reduce((n, r) => n + r.commissionRand, 0)
  const totalBook = reps.filter(r => r.active).reduce((n, r) => n + r.bookMrrRand, 0)

  return (
    <div className="space-y-4">
      <Section
        title="Sales reps"
        sub={reps.length
          ? `${reps.filter(r => r.active).length} active · their book is worth ${randFmt(totalBook)}/month · commission owed ${randFmt(totalCommission)}/month`
          : 'None yet'}
        right={
          <button onClick={() => { setEditing(null); setCreating(c => !c); setForm(EMPTY) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition hover:opacity-90"
            style={{ background: grad }}>
            {creating ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {creating ? 'Cancel' : 'New rep'}
          </button>
        }
      >
        {creating && (
          <div className="rounded-xl border p-4 mb-4" style={{ borderColor: 'hsl(var(--accent) / 0.4)', background: 'hsl(var(--accent) / 0.06)' }}>
            <RepForm form={form} setForm={setForm} busy={loading === 'rep-save'}
              onSave={async () => { const ok = await onSave(form); if (ok) { setCreating(false); setForm(EMPTY) } }} />
          </div>
        )}

        {reps.length === 0 && !creating ? (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            No reps yet. Add one, then link their clients from the Users and Teams tabs.
          </p>
        ) : (
          <div className="space-y-2">
            {reps.map(r => {
              const pct = r.target > 0 ? Math.min(100, Math.round((r.payingCards / r.target) * 100)) : 100
              const over = r.billableCards > 0
              return (
                <div key={r.id} className="rounded-xl border" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                  <div className="p-3.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(168,85,247,0.14)', border: '1px solid rgba(168,85,247,0.3)' }}>
                        <UserCog className="w-4 h-4" style={{ color: '#a855f7' }} />
                      </div>
                      <div className="flex-1 min-w-[160px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-white text-sm">{r.name}</p>
                          {!r.active && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>Inactive</span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {r.email || 'no email'}{r.started_on ? ` · since ${fmtDate(r.started_on)}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <div className="text-center">
                          <p className="font-bold text-sm" style={{ color: over ? '#22c55e' : '#fff' }}>{r.payingCards}</p>
                          <p style={{ color: 'rgba(255,255,255,0.35)' }}>paying</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-sm" style={{ color: '#a855f7' }}>{r.trialCards}</p>
                          <p style={{ color: 'rgba(255,255,255,0.35)' }}>on trial</p>
                        </div>
                        <div className="text-center min-w-[74px]">
                          <p className="font-bold text-sm" style={{ color: over ? '#22c55e' : 'rgba(255,255,255,0.3)' }}>
                            {randFmt(r.commissionRand)}
                          </p>
                          <p style={{ color: 'rgba(255,255,255,0.35)' }}>commission</p>
                        </div>
                      </div>
                    </div>

                    {/* Progress to target. The number that decides whether she
                        gets paid anything at all this month. */}
                    <div className="mt-3">
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: over ? '#22c55e' : grad }} />
                      </div>
                      <p className="text-[11px] mt-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {over ? (
                          <>
                            <TrendingUp className="w-3 h-3 inline mr-1" style={{ color: '#22c55e' }} />
                            <span style={{ color: '#22c55e' }}>{r.billableCards} card{r.billableCards === 1 ? '' : 's'} over target</span>
                            {' '}&middot; {r.billableCards} &times; R{r.commission_rand} = <strong className="text-white">{randFmt(r.commissionRand)}/month</strong> while they stay active
                          </>
                        ) : (
                          <>
                            {r.payingCards} of {r.target} paying cards &middot; <strong className="text-white">{r.shortBy} more</strong> before commission starts
                            {r.trialCards > 0 && <> &middot; {r.trialCards} on trial could close the gap</>}
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <button onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                        className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition hover:bg-white/10"
                        style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>
                        {expanded === r.id ? 'Hide' : `Clients (${r.clients.length})`}
                      </button>
                      <button onClick={() => setMeetingsOpen(meetingsOpen === r.id ? null : r.id)}
                        className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition hover:bg-white/10"
                        style={{ border: '1px solid rgba(14,165,233,0.35)', color: '#0ea5e9' }}>
                        {meetingsOpen === r.id ? 'Hide' : `Meetings (${r.meetings.length})`}
                      </button>
                      <button onClick={() => onOpenCalendar(r)}
                        title={`Open ${r.name}'s calendar`}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-semibold transition hover:bg-white/10"
                        style={{ border: '1px solid rgba(14,165,233,0.35)', color: '#0ea5e9' }}>
                        <CalendarClock className="w-3 h-3" />Calendar
                      </button>
                      <button onClick={() => openEdit(r)}
                        className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition hover:bg-white/10"
                        style={{ border: '1px solid rgba(168,85,247,0.35)', color: '#a855f7' }}>
                        Edit
                      </button>
                      {/* A rep with no login cannot log a meeting at all, so
                          this is the first thing to fix on a new rep. */}
                      {r.user_id ? (
                        <span className="text-[11px] self-center px-2 py-1 rounded-md"
                          style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                          Has a login
                        </span>
                      ) : (
                        <button onClick={() => onLinkLogin(r)}
                          disabled={loading === `replink-${r.id}` || !r.email}
                          title={r.email ? `Create or link a Cardtly login for ${r.email}` : 'Add an email address to this rep first'}
                          className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition hover:bg-white/10 disabled:opacity-40"
                          style={{ border: '1px solid rgba(34,197,94,0.35)', color: '#22c55e' }}>
                          {loading === `replink-${r.id}` ? 'Working...' : 'Give them a login'}
                        </button>
                      )}
                      <span className="ml-auto text-[11px] self-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        Book: {randFmt(r.bookMrrRand)}/mo
                      </span>
                    </div>
                  </div>

                  {editing === r.id && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      <RepForm form={form} setForm={setForm} busy={loading === 'rep-save'}
                        onSave={async () => { const ok = await onSave(form); if (ok) setEditing(null) }} />

                      {/* Destructive, so it lives in the panel rather than on
                          the row where the flag sits. Deactivating keeps the
                          attribution; deleting throws it away. */}
                      <div className="mt-3 pt-3 border-t flex items-center gap-3 flex-wrap" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <button
                          disabled={loading === `rep-del-${r.id}`}
                          onClick={async () => { const ok = await onDelete(r); if (ok) setEditing(null) }}
                          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-semibold transition hover:bg-white/10 disabled:opacity-40"
                          style={{ border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444' }}>
                          {loading === `rep-del-${r.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Delete rep
                        </button>
                        <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {r.clients.length > 0
                            ? `Unassigns ${r.clients.length} client${r.clients.length === 1 ? '' : 's'} and loses who signed them. Untick Active instead to keep the record.`
                            : 'No clients linked, so nothing is lost.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {meetingsOpen === r.id && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      {r.meetings.length === 0 ? (
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {r.user_id
                            ? 'No meetings logged yet.'
                            : 'No login yet, so they have no way to log a meeting.'}
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {r.meetings.map(m => {
                            const st = statusMeta(m.status)
                            const oc = outcomeMeta(m.outcome)
                            return (
                              <div key={m.id} className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold text-white">{m.company}</span>
                                  {m.contact_name && (
                                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{m.contact_name}</span>
                                  )}
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                    style={{ background: st.colour + '22', color: st.colour, border: `1px solid ${st.colour}55` }}>
                                    {st.label}
                                  </span>
                                  {oc && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                      style={{ background: oc.colour + '22', color: oc.colour, border: `1px solid ${oc.colour}55` }}>
                                      {oc.label}
                                    </span>
                                  )}
                                  <span className="ml-auto text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                    {fmtDate(m.scheduled_at)}
                                  </span>
                                </div>
                                {m.notes && (
                                  <p className="text-[11px] mt-1.5 whitespace-pre-wrap leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                    {m.notes}
                                  </p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {expanded === r.id && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      {/* This period, and the button that freezes it. The
                          figure cannot be recomputed later (no subscription
                          history), so recording is the only record there is. */}
                      <div className="rounded-lg p-3 mb-3" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)' }}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                            <CalendarRange className="w-3.5 h-3.5 inline mr-1.5" style={{ color: '#22c55e' }} />
                            Period <strong className="text-white">{r.period.label}</strong> &middot; closes in {r.period.daysLeft} day{r.period.daysLeft === 1 ? '' : 's'}
                            <br />
                            <span style={{ color: 'rgba(255,255,255,0.45)' }}>
                              {r.billableCards} card{r.billableCards === 1 ? '' : 's'} over {r.target} &times; R{r.commission_rand} = </span>
                            <strong style={{ color: '#22c55e' }}>{randFmt(r.commissionRand)}</strong>
                            <span style={{ color: 'rgba(255,255,255,0.45)' }}> owed now</span>
                          </div>
                          {r.paidThisPeriod ? (
                            <span className="text-xs px-2.5 py-1.5 rounded-lg font-semibold" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                              <Check className="w-3 h-3 inline mr-1" />Recorded for this period
                            </span>
                          ) : (
                            <div className="flex gap-1.5">
                              <button onClick={() => onRecordPayout(r, false)} disabled={loading === `payout-${r.id}`}
                                className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition hover:bg-white/10 disabled:opacity-40"
                                style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}>
                                Record only
                              </button>
                              <button onClick={() => onRecordPayout(r, true)} disabled={loading === `payout-${r.id}`}
                                className="text-xs px-2.5 py-1.5 rounded-lg font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                                style={{ background: '#22c55e' }}>
                                {loading === `payout-${r.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Banknote className="w-3 h-3 inline mr-1" />}
                                Mark paid
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          Recording freezes this figure. It cannot be recalculated later, because we do not keep a history of who was paying on a given date.
                        </p>
                      </div>

                      {r.payouts.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[11px] font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Past periods</p>
                          <div className="space-y-1">
                            {r.payouts.map(p => (
                              <div key={p.id} className="flex items-center gap-2.5 text-xs rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <span className="text-white">{fmtDate(p.period_start)} &ndash; {fmtDate(p.period_end)}</span>
                                <span style={{ color: 'rgba(255,255,255,0.35)' }}>{p.billable_cards} over target</span>
                                <span className="ml-auto font-bold" style={{ color: '#22c55e' }}>{randFmt(p.commission_rand)}</span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                                  style={p.paid_at ? { background: 'rgba(34,197,94,0.15)', color: '#22c55e' } : { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                                  {p.paid_at ? 'paid' : 'unpaid'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {r.clients.length === 0 ? (
                        <p className="text-xs py-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          Nobody linked yet. Assign clients from the Users and Teams tabs.
                        </p>
                      ) : (
                        <div className="space-y-1 mt-2">
                          {r.clients.map(c => (
                            <div key={c.kind + c.id} className="flex items-center gap-2.5 text-xs rounded-lg px-2.5 py-1.5"
                              style={{ background: 'rgba(255,255,255,0.02)' }}>
                              {c.kind === 'team'
                                ? <Building2 className="w-3 h-3 flex-shrink-0" style={{ color: '#f472b6' }} />
                                : <UsersIcon className="w-3 h-3 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />}
                              <span className="text-white flex-1 truncate">{c.label}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                                style={{
                                  background: c.state === 'paying' ? 'rgba(34,197,94,0.14)' : c.state === 'trial' ? 'rgba(168,85,247,0.14)' : c.state === 'expired' ? 'rgba(239,68,68,0.14)' : 'rgba(14,165,233,0.14)',
                                  color: c.state === 'paying' ? '#22c55e' : c.state === 'trial' ? '#a855f7' : c.state === 'expired' ? '#ef4444' : '#0ea5e9',
                                }}>
                                {c.state}
                              </span>
                              <span className="tabular-nums w-20 text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                {c.cards ? `${c.cards} card${c.cards === 1 ? '' : 's'}` : c.trialCards ? `${c.trialCards} pending` : '0'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}

function RepForm({ form, setForm, onSave, busy }: {
  form: Form; setForm: (f: Form | ((f: Form) => Form)) => void; onSave: () => void; busy: boolean
}) {
  const target = Number(form.target)
  const rate = Number(form.rate)
  return (
    <div className="space-y-3">
      <div className="flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-[150px]">
          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Name</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} style={inputStyle} />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Email</label>
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputClass} style={inputStyle} />
        </div>
        <div className="w-32">
          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Started</label>
          <input type="date" value={form.startedOn} onChange={e => setForm(f => ({ ...f, startedOn: e.target.value }))} className={inputClass} style={inputStyle} />
        </div>
      </div>

      <div className="flex gap-3 flex-wrap items-end">
        <div className="w-28">
          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Target cards</label>
          <input type="number" min={0} value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} className={inputClass} style={inputStyle} />
        </div>
        <div className="w-32">
          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>R per card over</label>
          <input type="number" min={0} value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} className={inputClass} style={inputStyle} />
        </div>
        <div className="w-32">
          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Period day</label>
          <input type="number" min={1} max={28} value={form.day} onChange={e => setForm(f => ({ ...f, day: e.target.value }))} className={inputClass} style={inputStyle} />
        </div>
        <label className="flex items-center gap-2 text-xs pb-2.5 cursor-pointer" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
          Active
        </label>
      </div>

      {target >= 0 && rate >= 0 && (
        <p className="text-[11px] rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.5)' }}>
          First {target} paying cards cover their basic and petrol, and earn no commission.
          From card {target + 1} they earn <strong className="text-white">R{rate} per card per month</strong>, for as long as that client keeps paying.
          At {target + 50} cards that is <strong className="text-white">{randFmt(50 * rate)}/month</strong>. Period runs the {ordinal(Number(form.day) || 25)} to the {ordinal(Number(form.day) || 25)}.
        </p>
      )}

      <div>
        <label className="text-[11px] font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Notes</label>
        <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inputClass} style={inputStyle}
          placeholder="Package, area, anything worth remembering" />
      </div>

      <button disabled={busy || !form.name.trim()} onClick={onSave}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
        style={{ background: grad }}>
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        Save rep
      </button>
    </div>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
