'use client'

import { useState } from 'react'
import { Building2, Loader2, AlertTriangle, Check } from 'lucide-react'
import { Section, StatusPill, randFmt, fmtDate, inputClass, inputStyle, grad } from './shared'
import type { AdminOrgRow } from '@/lib/admin-data'

const SEAT_PRICE = 97
const SELF_SERVE_CAP = 20

interface Props {
  orgs: AdminOrgRow[]
  onSave: (org: AdminOrgRow, name: string, seats: number) => Promise<boolean>
  loading: string | null
}

// Teams had no home at all before: an org appeared as a suffix on its owner's
// row and as a count tile, and seat utilisation was invisible. You could not
// answer "is this 50-seat team actually using its seats?" without SQL.
export default function TeamsTab({ orgs, onSave, loading }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<{ name: string; seats: string }>({ name: '', seats: '' })

  function open(o: AdminOrgRow) {
    if (editing === o.id) { setEditing(null); return }
    setEditing(o.id)
    // Seed from the org being edited. The old stepper was one shared
    // useState(5) that never read the org, so opening a 50-seat team showed
    // "5" next to a label saying "currently 50 seats" and saving wiped 45.
    setForm({ name: o.name, seats: String(o.maxSeats) })
  }

  const totalSeats = orgs.reduce((n, o) => n + o.maxSeats, 0)
  const totalClaimed = orgs.reduce((n, o) => n + o.cardsClaimed, 0)

  return (
    <div className="space-y-4">
      <Section
        title="Teams"
        sub={`${orgs.length} ${orgs.length === 1 ? 'org' : 'orgs'} · ${totalSeats} seats sold · ${totalClaimed} claimed by a person`}
      >
        {orgs.length === 0 ? (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No teams yet.</p>
        ) : (
          <div className="space-y-2">
            {orgs.map(o => {
              const idle = o.maxSeats - o.cardsCreated
              const busy = loading === `org-${o.adminUserId}`
              const open_ = editing === o.id
              return (
                <div key={o.id} className="rounded-xl border" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                  <button onClick={() => open(o)} className="w-full text-left p-3.5 flex items-center gap-3 flex-wrap">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(236,72,153,0.14)', border: '1px solid rgba(236,72,153,0.3)' }}>
                      <Building2 className="w-4 h-4" style={{ color: '#f472b6' }} />
                    </div>

                    <div className="flex-1 min-w-[180px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-white text-sm">{o.name}</p>
                        {o.isEnterprise && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                            title={`Above the ${SELF_SERVE_CAP}-seat self-serve cap. Paystack is not billing this; it should be on debit order.`}
                            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)' }}>
                            Enterprise
                          </span>
                        )}
                        {o.billingPeriod === 'comp' && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                            style={{ background: 'rgba(14,165,233,0.15)', color: '#0ea5e9', border: '1px solid rgba(14,165,233,0.4)' }}>
                            Comped
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{o.adminEmail || o.adminUserId.slice(0, 8)}</p>
                    </div>

                    {/* Seat utilisation, which used to be invisible. used_seats
                        exists in the table but nothing maintains it, so these
                        are counted from the actual team_cards rows. */}
                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-center">
                        <p className="font-bold text-white text-sm">{o.maxSeats}</p>
                        <p style={{ color: 'rgba(255,255,255,0.35)' }}>bought</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-sm" style={{ color: o.cardsCreated > o.maxSeats ? '#ef4444' : '#fff' }}>{o.cardsCreated}</p>
                        <p style={{ color: 'rgba(255,255,255,0.35)' }}>created</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-sm" style={{ color: '#22c55e' }}>{o.cardsClaimed}</p>
                        <p style={{ color: 'rgba(255,255,255,0.35)' }}>claimed</p>
                      </div>
                      <div className="text-center min-w-[64px]">
                        <p className="font-bold text-sm" style={{ color: o.billingPeriod === 'comp' ? 'rgba(255,255,255,0.35)' : '#22c55e' }}>
                          {o.billingPeriod === 'comp' ? '-' : randFmt(o.monthlyRand)}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.35)' }}>/month</p>
                      </div>
                    </div>
                  </button>

                  {open_ && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      {idle > 0 && (
                        <p className="text-xs mb-3 rounded-lg px-3 py-2"
                          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}>
                          Paying for {o.maxSeats} seats, only {o.cardsCreated} card{o.cardsCreated === 1 ? '' : 's'} created. {idle} seat{idle === 1 ? '' : 's'} idle.
                        </p>
                      )}
                      <div className="flex gap-3 flex-wrap items-end">
                        <div className="flex-1 min-w-[180px]">
                          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Team name</label>
                          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className={inputClass} style={inputStyle} />
                        </div>
                        <div className="w-28">
                          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Seats</label>
                          {/* A number field, not a ±1 stepper. Going 5 -> 50 used
                              to be 45 clicks. */}
                          <input type="number" min={1} value={form.seats}
                            onChange={e => setForm(f => ({ ...f, seats: e.target.value }))}
                            className={inputClass} style={inputStyle} />
                        </div>
                        <div className="text-xs pb-2.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {Number(form.seats) > 0 && (
                            <>
                              <span className="font-bold text-white">{randFmt(Number(form.seats) * SEAT_PRICE)}</span>/month
                              {Number(form.seats) > SELF_SERVE_CAP && (
                                <span className="block mt-0.5" style={{ color: '#f59e0b' }}>
                                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                                  Above {SELF_SERVE_CAP} seats: Enterprise, bill by debit order
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        <button
                          disabled={busy || !form.name.trim() || !(Number(form.seats) >= 1)}
                          onClick={async () => {
                            const ok = await onSave(o, form.name.trim(), Number(form.seats))
                            if (ok) setEditing(null)
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                          style={{ background: grad }}>
                          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Save
                        </button>
                      </div>
                      <p className="text-[11px] mt-2.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        Created {fmtDate(o.createdAt)}. Reducing seats below {o.cardsCreated} will block this team from adding cards.
                      </p>
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
