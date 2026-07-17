'use client'

import { useState, useMemo } from 'react'
import { Building2, Loader2, AlertTriangle, Check, Plus, X, CalendarClock, Banknote, PauseCircle, PlayCircle, Flag, ExternalLink, MailQuestion, UserCheck, Layers, UserCog, Palette } from 'lucide-react'
import { Section, randFmt, fmtDate, inputClass, inputStyle, grad } from './shared'
import { ORG_BILLING_MODES, BILLING_MODE_META, MAX_SELF_SERVE_SEATS, SEAT_PRICE_RAND, orgMonthlyRand, type OrgBillingMode } from '@/lib/org-billing'
import type { AdminOrgRow, AdminUserRow } from '@/lib/admin-data'
import type { RepStats } from '@/lib/reps'

interface Form {
  userId: string
  name: string
  seats: string
  mode: OrgBillingMode
  notes: string
  trialEndsAt: string
}

interface Props {
  orgs: AdminOrgRow[]
  users: AdminUserRow[]
  teamCards: any[]
  reps: RepStats[]
  onSave: (form: Form) => Promise<boolean>
  onAssignRep: (orgId: string, repId: string | null) => Promise<boolean>
  onMarkCollected: (orgId: string) => Promise<boolean>
  onSuspend: (orgId: string, suspended: boolean, message: string | null) => Promise<boolean>
  onDept: (action: string, body: Record<string, any>, key: string, msg: string) => Promise<boolean>
  loading: string | null
}

// Teams had no home at all before: an org appeared as a suffix on its owner's
// row and as a count tile, seat utilisation was invisible, and there was
// nowhere to say how a team is billed, so every one of them defaulted to
// "monthly" and reported revenue nobody collects.
export default function TeamsTab({ orgs, users, teamCards, reps, onSave, onAssignRep, onMarkCollected, onSuspend, onDept, loading }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<Form>({ userId: '', name: '', seats: '5', mode: 'monthly', notes: '', trialEndsAt: '' })

  function openEdit(o: AdminOrgRow) {
    setCreating(false)
    if (editing === o.id) { setEditing(null); return }
    setEditing(o.id)
    // Seed from the org being edited. The old stepper was one shared
    // useState(5) that never read the org, so opening a 50-seat team showed
    // "5" next to a label saying "currently 50 seats", and saving wiped 45.
    setForm({ userId: o.adminUserId, name: o.name, seats: String(o.maxSeats), mode: o.billingMode, notes: o.billingNotes || '', trialEndsAt: o.trialEndsAt ? o.trialEndsAt.slice(0, 10) : '' })
  }

  function openCreate() {
    setEditing(null)
    setCreating(c => !c)
    setForm({ userId: '', name: '', seats: '5', mode: 'monthly', notes: '', trialEndsAt: '' })
  }

  const revenue = orgs.filter(o => o.isRevenue).reduce((n, o) => n + o.monthlyRand, 0)
  const totalSeats = orgs.reduce((n, o) => n + o.maxSeats, 0)

  return (
    <div className="space-y-4">
      <Section
        title="Teams"
        sub={`${orgs.length} orgs · ${totalSeats} seats · ${randFmt(revenue)}/month actually billed`}
        right={
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition hover:opacity-90"
            style={{ background: grad }}>
            {creating ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {creating ? 'Cancel' : 'New team'}
          </button>
        }
      >
        {creating && (
          <div className="rounded-xl border p-4 mb-4" style={{ borderColor: 'rgba(124,58,237,0.4)', background: 'rgba(124,58,237,0.06)' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: '#a78bfa' }}>
              New team. The owner must already have a Cardtly account: they administer the team and invite the rest.
            </p>
            <TeamForm form={form} setForm={setForm} users={users} showUserPicker
              busy={loading === `org-${form.userId}`}
              onSave={async () => { const ok = await onSave(form); if (ok) setCreating(false) }} />
          </div>
        )}

        {orgs.length === 0 && !creating ? (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No teams yet.</p>
        ) : (
          <div className="space-y-2">
            {orgs.map(o => {
              const idle = o.maxSeats - o.cardsCreated
              const busy = loading === `org-${o.adminUserId}`
              const meta = BILLING_MODE_META[o.billingMode]
              return (
                <div key={o.id} className="rounded-xl border" style={{ borderColor: o.suspendedAt ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)', background: o.suspendedAt ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-stretch">
                  <button onClick={() => openEdit(o)} className="flex-1 min-w-0 text-left p-3.5 flex items-center gap-3 flex-wrap">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(236,72,153,0.14)', border: '1px solid rgba(236,72,153,0.3)' }}>
                      <Building2 className="w-4 h-4" style={{ color: '#f472b6' }} />
                    </div>

                    <div className="flex-1 min-w-[180px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-white text-sm">{o.name}</p>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                          title={meta.desc}
                          style={{ background: `${meta.colour}1f`, color: meta.colour, border: `1px solid ${meta.colour}55` }}>
                          {meta.short}
                        </span>
                        {o.suspendedAt && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                            title="Every card in this team shows a notice. They still work."
                            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.45)' }}>
                            Suspended
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{o.adminEmail || o.adminUserId.slice(0, 8)}</p>
                    </div>

                    {/* Counted from real team_cards rows. organizations.used_seats
                        exists but nothing maintains it, so it is ignored. */}
                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-center">
                        <p className="font-bold text-white text-sm">{o.maxSeats}</p>
                        <p style={{ color: 'rgba(255,255,255,0.35)' }}>seats</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-sm" style={{ color: o.cardsCreated > o.maxSeats ? '#ef4444' : '#fff' }}>{o.cardsCreated}</p>
                        <p style={{ color: 'rgba(255,255,255,0.35)' }}>created</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-sm" style={{ color: '#22c55e' }}>{o.cardsClaimed}</p>
                        <p style={{ color: 'rgba(255,255,255,0.35)' }}>claimed</p>
                      </div>
                      <div className="text-center min-w-[70px]">
                        <p className="font-bold text-sm" style={{ color: o.isRevenue ? '#22c55e' : 'rgba(255,255,255,0.3)' }}>
                          {o.isRevenue ? randFmt(o.monthlyRand) : 'free'}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.35)' }}>{o.isRevenue ? '/month' : 'not billed'}</p>
                      </div>
                    </div>
                  </button>

                  {/* On the row, not hidden inside the expand panel. Burying
                      this was the reason it looked like it did not exist. */}
                  <button
                    onClick={() => {
                      if (o.suspendedAt) {
                        onSuspend(o.id, false, null)
                        return
                      }
                      if (!confirm(`Flag ${o.name}?\n\nAll ${o.cardsCreated} of their cards show a notice asking them to contact their administrator. The cards KEEP WORKING: they open, save and scan as normal.\n\nLift it the moment payment lands.`)) return
                      onSuspend(o.id, true, null)
                    }}
                    disabled={loading === `susp-${o.id}`}
                    title={o.suspendedAt ? 'Flagged. Click to lift.' : 'Flag this team until they pay. Their cards keep working, with a notice.'}
                    className="px-3.5 flex items-center justify-center transition hover:bg-white/5 disabled:opacity-40 border-l"
                    style={{ borderColor: 'rgba(255,255,255,0.06)', color: o.suspendedAt ? '#f59e0b' : 'rgba(255,255,255,0.25)' }}>
                    {loading === `susp-${o.id}`
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Flag className="w-4 h-4" fill={o.suspendedAt ? '#f59e0b' : 'none'} />}
                  </button>
                  </div>

                  {(o.trialDaysLeft !== null || o.needsCollecting || o.suspendedAt) && (
                    <div className="px-3.5 pb-3 -mt-1 flex flex-wrap gap-2">
                      {o.suspendedAt && (
                        <span className="text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5"
                          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b' }}>
                          <Flag className="w-3 h-3" fill="#f59e0b" />
                          Flagged {fmtDate(o.suspendedAt)}. All {o.cardsCreated} cards show a notice and still work. Click the flag to lift.
                        </span>
                      )}
                      {o.trialDaysLeft !== null && (
                        <span className="text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5"
                          style={o.trialDaysLeft <= 0
                            ? { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444' }
                            : { background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7' }}>
                          <CalendarClock className="w-3 h-3" />
                          {o.trialDaysLeft <= 0
                            ? `Trial ended ${fmtDate(o.trialEndsAt)}. Still live, still free. Convert them.`
                            : `Trial ends ${fmtDate(o.trialEndsAt)} (${o.trialDaysLeft} days)`}
                        </span>
                      )}
                      {o.needsCollecting && (
                        <button onClick={() => onMarkCollected(o.id)} disabled={loading === `collect-${o.id}`}
                          className="text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition hover:opacity-80 disabled:opacity-40"
                          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', color: '#f59e0b' }}>
                          {loading === `collect-${o.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Banknote className="w-3 h-3" />}
                          {o.lastCollectedOn
                            ? `Last collected ${fmtDate(o.lastCollectedOn)}. Load ${randFmt(o.monthlyRand)} and mark collected`
                            : `Never collected. Load ${randFmt(o.monthlyRand)} and mark collected`}
                        </button>
                      )}
                    </div>
                  )}

                  {editing === o.id && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      {idle > 0 && o.isRevenue && (
                        <p className="text-xs mb-3 rounded-lg px-3 py-2"
                          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}>
                          Billed for {o.maxSeats} seats, only {o.cardsCreated} card{o.cardsCreated === 1 ? '' : 's'} created. {idle} idle.
                        </p>
                      )}
                      {o.billingMode === 'debit_order' && (
                        <p className="text-xs mb-3 rounded-lg px-3 py-2"
                          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}>
                          <AlertTriangle className="w-3 h-3 inline mr-1" />
                          Nothing collects this automatically. You invoice and collect {randFmt(o.monthlyRand)} yourself.
                        </p>
                      )}
                      {/* Who is actually in this team.
                          The rebuild dropped the old Team Cards table, and an
                          UNCLAIMED card has no user account at all, so it can
                          never appear under Users. That left 5 of 16 team
                          cards with nowhere to be seen. This is their home:
                          the question is always "who is in this team", not
                          "which users exist". */}
                      <TeamMembers
                        cards={teamCards.filter((c: any) => c.organization_id === o.id)}
                        departments={o.departments}
                        onMove={(cardId, deptId) => onDept('move_card_to_department', { team_card_id: cardId, department_id: deptId }, `movecard-${cardId}`, deptId ? 'Card moved' : 'Card moved to org level')}
                        loading={loading} />

                      <DepartmentsSection org={o} users={users} onDept={onDept} loading={loading} />

                      <SuspendControl org={o} onSuspend={onSuspend} busy={loading === `susp-${o.id}`} />

                      {reps.length > 0 && (
                        <div className="mb-3">
                          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                            Signed by
                          </label>
                          <select
                            value={o.repId || ''}
                            disabled={loading === `reporg-${o.id}`}
                            onChange={e => onAssignRep(o.id, e.target.value || null)}
                            className={inputClass} style={inputStyle}>
                            <option value="" style={{ background: '#1a1a1a' }}>No rep</option>
                            {reps.filter(r => r.active).map(r => (
                              <option key={r.id} value={r.id} style={{ background: '#1a1a1a' }}>{r.name}</option>
                            ))}
                          </select>
                          <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {o.isRevenue
                              ? `All ${o.maxSeats} billed seats count toward their target.`
                              : 'This team is comped, so it counts zero toward a target. Nothing is billed, so nothing is owed.'}
                          </p>
                        </div>
                      )}

                      <TeamForm form={form} setForm={setForm} users={users}
                        busy={busy}
                        onSave={async () => { const ok = await onSave(form); if (ok) setEditing(null) }} />
                      <p className="text-[11px] mt-2.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        Created {fmtDate(o.createdAt)}. Dropping below {o.cardsCreated} seats blocks this team from adding cards.
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

function TeamForm({ form, setForm, users, onSave, busy, showUserPicker }: {
  form: Form
  setForm: (f: Form | ((f: Form) => Form)) => void
  users: AdminUserRow[]
  onSave: () => void
  busy: boolean
  showUserPicker?: boolean
}) {
  const [userQ, setUserQ] = useState('')
  const seats = Number(form.seats)
  const meta = BILLING_MODE_META[form.mode]
  const monthly = orgMonthlyRand(seats, form.mode)

  // Paystack self-serve stops at 20 seats. Anything larger is not billed by
  // Paystack at all, so calling it monthly would claim money nothing collects.
  const overCap = seats > MAX_SELF_SERVE_SEATS && (form.mode === 'monthly' || form.mode === 'yearly')

  const matches = useMemo(() => {
    const n = userQ.trim().toLowerCase()
    if (!n) return []
    return users.filter(u => u.email?.toLowerCase().includes(n) || u.card?.name?.toLowerCase().includes(n)).slice(0, 6)
  }, [users, userQ])

  const owner = users.find(u => u.id === form.userId)

  return (
    <div className="space-y-3">
      {showUserPicker && (
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Team owner</label>
          {owner ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-white px-3 py-2 rounded-lg flex-1" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
                {owner.email}
              </span>
              <button onClick={() => { setForm(f => ({ ...f, userId: '' })); setUserQ('') }}
                className="p-2 rounded-lg transition hover:bg-white/10"><X className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.5)' }} /></button>
            </div>
          ) : (
            <>
              <input value={userQ} onChange={e => setUserQ(e.target.value)} placeholder="Search by email or name"
                className={inputClass} style={inputStyle} />
              {matches.length > 0 && (
                <div className="mt-1 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                  {matches.map(u => (
                    <button key={u.id} onClick={() => { setForm(f => ({ ...f, userId: u.id })); setUserQ('') }}
                      className="w-full text-left px-3 py-2 text-xs transition hover:bg-white/10 flex items-center justify-between gap-2"
                      style={{ color: 'rgba(255,255,255,0.75)' }}>
                      <span>{u.email}</span>
                      {u.org && <span style={{ color: '#f59e0b' }}>already owns {u.org.name}</span>}
                    </button>
                  ))}
                </div>
              )}
              {userQ && matches.length === 0 && (
                <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  No match. They need a Cardtly account first: ask them to sign up, then come back.
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-[170px]">
          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Company name</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className={inputClass} style={inputStyle} placeholder="Acme (Pty) Ltd" />
        </div>
        <div className="w-24">
          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Seats</label>
          {/* A number field, not a plus/minus stepper. 5 -> 50 used to be 45 clicks. */}
          <input type="number" min={1} value={form.seats} onChange={e => setForm(f => ({ ...f, seats: e.target.value }))}
            className={inputClass} style={inputStyle} />
        </div>
        <div className="min-w-[190px]">
          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Billing</label>
          <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value as OrgBillingMode }))}
            className={inputClass} style={inputStyle}>
            {ORG_BILLING_MODES.map(m => (
              <option key={m} value={m} style={{ background: '#1a1a1a' }}>{BILLING_MODE_META[m].label}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{meta.desc}</p>

      {form.mode === 'trial' && (
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Trial ends
          </label>
          <input type="date" value={form.trialEndsAt} onChange={e => setForm(f => ({ ...f, trialEndsAt: e.target.value }))}
            className={inputClass} style={inputStyle} />
          <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Their cards stay live after this date. Nothing is cut off: it flags here and you convert them.
          </p>
        </div>
      )}

      {(form.mode === 'debit_order' || form.mode === 'comp') && (
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Billing notes {form.mode === 'debit_order' ? '(finance contact, PO number, mandate date)' : '(why this is free)'}
          </label>
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className={inputClass} style={inputStyle}
            placeholder={form.mode === 'debit_order' ? 'accounts@acme.co.za · PO 4471 · mandate signed 2026-07-17' : 'Promo partner, free forever'} />
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {seats >= 1 && (
            meta.isRevenue
              ? <><span className="font-bold text-white">{randFmt(monthly)}</span>/month at R{SEAT_PRICE_RAND} a seat</>
              : <span style={{ color: '#0ea5e9' }}>Not billed. Will not appear in MRR.</span>
          )}
        </div>
        <button
          disabled={busy || !form.name.trim() || !(seats >= 1) || !form.userId || overCap || (form.mode === 'trial' && !form.trialEndsAt)}
          onClick={onSave}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
          style={{ background: grad }}>
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Save team
        </button>
      </div>

      {overCap && (
        <p className="text-xs rounded-lg px-3 py-2"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
          <AlertTriangle className="w-3 h-3 inline mr-1" />
          {seats} seats is above the {MAX_SELF_SERVE_SEATS}-seat Paystack limit. Switch billing to Debit order (Enterprise) or Comped.
        </p>
      )}
    </div>
  )
}

// Suspending a team, and saying plainly what it does.
//
// The wording of the control matters as much as the banner. An admin reaching
// for this needs to know it is NOT a kill switch: the cards keep working, and
// the notice is what does the work. Nobody should discover that by trying it
// on a real customer.
function SuspendControl({ org, onSuspend, busy }: {
  org: AdminOrgRow
  onSuspend: (orgId: string, suspended: boolean, message: string | null) => Promise<boolean>
  busy: boolean
}) {
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState(org.suspensionMessage || '')

  if (org.suspendedAt) {
    return (
      <div className="mb-3 rounded-lg px-3 py-2.5" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
        <p className="text-xs mb-2" style={{ color: '#f59e0b' }}>
          <PauseCircle className="w-3 h-3 inline mr-1.5" />
          Suspended {fmtDate(org.suspendedAt)}. All {org.cardsCreated} card{org.cardsCreated === 1 ? '' : 's'} show a notice and still work.
        </p>
        {org.suspensionMessage && (
          <p className="text-[11px] mb-2 italic" style={{ color: 'rgba(255,255,255,0.5)' }}>&ldquo;{org.suspensionMessage}&rdquo;</p>
        )}
        <button onClick={() => onSuspend(org.id, false, null)} disabled={busy}
          className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition hover:bg-white/10 disabled:opacity-40"
          style={{ border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e' }}>
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlayCircle className="w-3 h-3 inline mr-1" />}
          Lift suspension
        </button>
      </div>
    )
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="mb-3 text-xs px-2.5 py-1.5 rounded-lg font-semibold transition hover:bg-white/10"
        style={{ border: '1px solid rgba(245,158,11,0.35)', color: '#f59e0b' }}>
        <PauseCircle className="w-3 h-3 inline mr-1" />
        Suspend this team
      </button>
    )
  }

  return (
    <div className="mb-3 rounded-lg px-3 py-2.5" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)' }}>
      <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
        Puts a notice on all {org.cardsCreated} card{org.cardsCreated === 1 ? '' : 's'} in this team.
        <strong className="text-white"> They keep working</strong>: the card opens, saves and scans as normal.
        Their staff will ask about it, which is how it gets paid.
      </p>
      <input value={msg} onChange={e => setMsg(e.target.value)}
        className={inputClass + ' mb-2'} style={inputStyle}
        placeholder="This account needs attention. Please contact your administrator." />
      <p className="text-[11px] mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Their customers see this, not just their staff. Leave it blank for the default. Say what is needed, not what is owed.
      </p>
      <div className="flex gap-2">
        <button onClick={async () => { const ok = await onSuspend(org.id, true, msg.trim() || null); if (ok) setOpen(false) }} disabled={busy}
          className="text-xs px-2.5 py-1.5 rounded-lg font-bold text-white transition hover:opacity-90 disabled:opacity-40"
          style={{ background: '#f59e0b' }}>
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Suspend'}
        </button>
        <button onClick={() => setOpen(false)}
          className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition hover:bg-white/10"
          style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// The cards in a team, claimed or not.
//
// An unclaimed card is a real card with a real URL that a real person can
// open: it just has nobody signed in behind it yet. That distinction is the
// whole point of showing this, because "invited but never claimed" is the
// state you actually want to chase.
function TeamMembers({ cards, departments, onMove, loading }: {
  cards: any[]
  departments: AdminOrgRow['departments']
  onMove: (cardId: string, deptId: string | null) => Promise<boolean>
  loading: string | null
}) {
  if (!cards.length) {
    return (
      <p className="text-xs mb-3 rounded-lg px-3 py-2"
        style={{ background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.4)' }}>
        No cards created for this team yet.
      </p>
    )
  }

  const claimed = cards.filter(c => c.user_id).length
  return (
    <div className="mb-3">
      <p className="text-[11px] font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Cards in this team &middot; {claimed} of {cards.length} claimed
        {claimed < cards.length && (
          <span style={{ color: '#f59e0b' }}> &middot; {cards.length - claimed} never signed in</span>
        )}
      </p>
      <div className="space-y-1">
        {cards.map(c => (
          <div key={c.id} className="flex items-center gap-2.5 text-xs rounded-lg px-2.5 py-1.5"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            {c.user_id
              ? <UserCheck className="w-3 h-3 flex-shrink-0" style={{ color: '#22c55e' }} />
              : <MailQuestion className="w-3 h-3 flex-shrink-0" style={{ color: '#f59e0b' }} />}
            <span className="text-white truncate max-w-[130px]">{c.name || 'Unnamed'}</span>
            <span className="truncate max-w-[140px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {c.user_id ? 'claimed' : `invited ${c.email || '(no email)'}`}
            </span>
            {/* Which department this card sits in. Only shown when the team has
                departments, since otherwise there is nowhere to move it. */}
            {departments.length > 0 && (
              <select
                value={c.department_id || ''}
                disabled={loading === `movecard-${c.id}`}
                onChange={e => onMove(c.id, e.target.value || null)}
                className="text-[11px] px-1.5 py-0.5 rounded"
                style={{ ...inputStyle, border: `1px solid ${c.department_id ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.1)'}`, color: c.department_id ? '#a78bfa' : 'rgba(255,255,255,0.4)' }}>
                <option value="" style={{ background: '#1a1a1a' }}>No department</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id} style={{ background: '#1a1a1a' }}>{d.name}</option>
                ))}
              </select>
            )}
            {c.slug && (
              <a href={`/card/${c.slug}`} target="_blank" rel="noreferrer"
                className="ml-auto flex items-center gap-1 transition hover:text-white"
                style={{ color: 'rgba(255,255,255,0.4)' }}>
                /{c.slug} <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <span className="tabular-nums w-14 text-right" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {c.view_count || 0} views
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Departments inside a team. Structure only here: create, name, delete,
// assign a manager. The manager sets the department's LOOK in their own
// dashboard, so there is no brand editor here, just a badge saying whether a
// department has a custom look yet.
function DepartmentsSection({ org, users, onDept, loading }: {
  org: AdminOrgRow
  users: AdminUserRow[]
  onDept: (action: string, body: Record<string, any>, key: string, msg: string) => Promise<boolean>
  loading: string | null
}) {
  const [newName, setNewName] = useState('')
  const [managerFor, setManagerFor] = useState<string | null>(null)
  const [userQ, setUserQ] = useState('')

  const matches = useMemo(() => {
    const n = userQ.trim().toLowerCase()
    if (!n) return []
    return users.filter(u => u.email?.toLowerCase().includes(n) || u.card?.name?.toLowerCase().includes(n)).slice(0, 5)
  }, [users, userQ])

  return (
    <div className="mb-3 rounded-lg px-3 py-3" style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.2)' }}>
      <p className="text-[11px] font-semibold mb-2 flex items-center gap-1.5" style={{ color: '#a78bfa' }}>
        <Layers className="w-3 h-3" />
        Departments &middot; each can look different and have its own manager
      </p>

      {org.departments.length > 0 && (
        <div className="space-y-1.5 mb-2.5">
          {org.departments.map(d => (
            <div key={d.id} className="rounded-lg px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-white">{d.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                  {d.cardCount} card{d.cardCount === 1 ? '' : 's'}
                </span>
                {d.hasBrand
                  ? <span className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: 'rgba(34,197,94,0.14)', color: '#22c55e' }}><Palette className="w-2.5 h-2.5" />custom look</span>
                  : <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)' }}>inherits org look</span>}
                <button onClick={() => { setManagerFor(managerFor === d.id ? null : d.id); setUserQ('') }}
                  className="ml-auto text-[11px] px-2 py-0.5 rounded transition hover:bg-white/10"
                  style={{ border: '1px solid rgba(168,85,247,0.35)', color: '#a855f7' }}>
                  <UserCog className="w-3 h-3 inline mr-1" />
                  {d.managers.length ? `${d.managers.length} manager${d.managers.length === 1 ? '' : 's'}` : 'Add manager'}
                </button>
                <button onClick={() => {
                  if (!confirm(`Delete the "${d.name}" department?\n\nIts ${d.cardCount} card${d.cardCount === 1 ? '' : 's'} are NOT deleted; they fall back to the company look.`)) return
                  onDept('delete_department', { department_id: d.id }, `deldept-${d.id}`, 'Department deleted')
                }}
                  className="text-[11px] p-1 rounded transition hover:bg-white/10" style={{ color: 'rgba(239,68,68,0.7)' }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Managers */}
              {d.managers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {d.managers.map(m => (
                    <span key={m.userId} className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: 'rgba(168,85,247,0.12)', color: '#a78bfa' }}>
                      {m.email || m.userId.slice(0, 8)}
                      <button onClick={() => onDept('set_dept_manager', { department_id: d.id, user_id: m.userId, manage: false }, `mgr-${d.id}-${m.userId}`, 'Manager removed')}
                        className="hover:text-white"><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ))}
                </div>
              )}

              {managerFor === d.id && (
                <div className="mt-2">
                  <input value={userQ} onChange={e => setUserQ(e.target.value)} placeholder="Search a user by email or name to make them manager"
                    className={inputClass} style={inputStyle} />
                  {matches.length > 0 && (
                    <div className="mt-1 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                      {matches.map(u => (
                        <button key={u.id} onClick={async () => {
                          const ok = await onDept('set_dept_manager', { department_id: d.id, user_id: u.id, manage: true }, `mgr-${d.id}-${u.id}`, `${u.email} manages ${d.name}`)
                          if (ok) { setManagerFor(null); setUserQ('') }
                        }}
                          className="w-full text-left px-3 py-2 text-xs transition hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.75)' }}>
                          {u.email}
                        </button>
                      ))}
                    </div>
                  )}
                  {userQ && matches.length === 0 && (
                    <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      No match. A manager needs a Cardtly account first.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New department name, e.g. Sales"
          className={inputClass} style={inputStyle} />
        <button
          disabled={!newName.trim() || loading === `newdept-${org.id}`}
          onClick={async () => {
            const ok = await onDept('create_department', { org_id: org.id, name: newName.trim() }, `newdept-${org.id}`, `${newName.trim()} added`)
            if (ok) setNewName('')
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40"
          style={{ background: grad }}>
          {loading === `newdept-${org.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Add
        </button>
      </div>
    </div>
  )
}
