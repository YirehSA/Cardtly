'use client'

import { useState } from 'react'
import { UserCog, Loader2, Plus, X, Check, TrendingUp, Users as UsersIcon, Building2, Trash2 } from 'lucide-react'
import { Section, randFmt, fmtDate, inputClass, inputStyle, grad } from './shared'
import type { RepStats } from '@/lib/reps'

interface Form {
  repId: string | null
  name: string
  email: string
  phone: string
  target: string
  rate: string
  startedOn: string
  notes: string
  active: boolean
}

interface Props {
  reps: RepStats[]
  onSave: (f: Form) => Promise<boolean>
  onDelete: (rep: RepStats) => Promise<boolean>
  loading: string | null
}

const EMPTY: Form = { repId: null, name: '', email: '', phone: '', target: '250', rate: '10', startedOn: '', notes: '', active: true }

export default function RepsTab({ reps, onSave, onDelete, loading }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)

  function openEdit(r: RepStats) {
    setCreating(false)
    if (editing === r.id) { setEditing(null); return }
    setEditing(r.id)
    setForm({
      repId: r.id, name: r.name, email: r.email || '', phone: r.phone || '',
      target: String(r.target_cards), rate: String(r.commission_rand),
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
          <div className="rounded-xl border p-4 mb-4" style={{ borderColor: 'rgba(124,58,237,0.4)', background: 'rgba(124,58,237,0.06)' }}>
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
                      <button onClick={() => openEdit(r)}
                        className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition hover:bg-white/10"
                        style={{ border: '1px solid rgba(168,85,247,0.35)', color: '#a855f7' }}>
                        Edit
                      </button>
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

                  {expanded === r.id && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
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
        <label className="flex items-center gap-2 text-xs pb-2.5 cursor-pointer" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
          Active
        </label>
      </div>

      {target >= 0 && rate >= 0 && (
        <p className="text-[11px] rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.5)' }}>
          First {target} paying cards cover their basic and petrol, and earn no commission.
          From card {target + 1} they earn <strong className="text-white">R{rate} per card per month</strong>, for as long as that client keeps paying.
          At {target + 50} cards that is <strong className="text-white">{randFmt(50 * rate)}/month</strong>.
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
