'use client'

import { useState } from 'react'
import { Ticket, Loader2, Check, Plus, X, Power, AlertTriangle } from 'lucide-react'
import { Section, fmtDate, inputClass, inputStyle, grad } from './shared'
import type { TrialCodeRow } from '@/lib/admin-data'

interface Form {
  id: string | null
  code: string
  days: string
  maxUses: string
  expiresOn: string
  notes: string
  active: boolean
}

const BLANK: Form = { id: null, code: '', days: '30', maxUses: '', expiresOn: '', notes: '', active: true }

function dateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Trial codes.
//
// A free trial is no longer something every signup gets - it comes from a code,
// handed out in a link like cardtly.com/signup?code=CARDTLY60. This is where
// those codes are made, capped, expired and switched off.
export default function TrialsTab({
  codes, onSave, onToggle, loading,
}: {
  codes: TrialCodeRow[]
  onSave: (f: Form) => Promise<boolean>
  onToggle: (id: string, active: boolean) => Promise<boolean>
  loading: string | null
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<Form>(BLANK)

  function openCreate() {
    setEditing(null)
    setCreating(c => !c)
    setForm(BLANK)
  }

  function openEdit(c: TrialCodeRow) {
    setCreating(false)
    if (editing === c.id) { setEditing(null); return }
    setEditing(c.id)
    setForm({
      id: c.id,
      code: c.code,
      days: String(c.days),
      maxUses: c.max_uses === null ? '' : String(c.max_uses),
      expiresOn: c.expires_at ? c.expires_at.slice(0, 10) : '',
      notes: c.notes || '',
      active: c.active,
    })
  }

  const totalUses = codes.reduce((n, c) => n + (c.uses || 0), 0)

  return (
    <div className="space-y-4">
      <Section
        title="Trial codes"
        sub={codes.length
          ? `${codes.length} code${codes.length === 1 ? '' : 's'} · ${totalUses} trial${totalUses === 1 ? '' : 's'} handed out`
          : 'No codes yet'}
        right={
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition hover:opacity-90"
            style={{ background: grad }}>
            {creating ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {creating ? 'Cancel' : 'New code'}
          </button>
        }
      >
        {creating && (
          <div className="rounded-xl border p-4 mb-4" style={{ borderColor: 'hsl(var(--accent) / 0.4)', background: 'hsl(var(--accent) / 0.06)' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: '#a78bfa' }}>
              New code. Share it as a link and the trial applies with nothing for them to type.
            </p>
            <CodeForm form={form} setForm={setForm} busy={loading === 'code-save'}
              onSave={async () => { const ok = await onSave(form); if (ok) { setCreating(false); setForm(BLANK) } }} />
          </div>
        )}

        {codes.length === 0 && !creating ? (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            No trial codes. Without one, nobody can start a free trial - which may be exactly what you want.
          </p>
        ) : (
          <div className="space-y-2">
            {codes.map(c => {
              const expired = !!c.expires_at && new Date(c.expires_at).getTime() <= Date.now()
              const exhausted = c.max_uses !== null && c.uses >= c.max_uses
              const usable = c.active && !expired && !exhausted
              return (
                <div key={c.id} className="rounded-xl border"
                  style={{ borderColor: usable ? 'rgba(255,255,255,0.08)' : 'rgba(245,158,11,0.35)', background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-stretch">
                    <button onClick={() => openEdit(c)}
                      title={`Edit ${c.code}`}
                      aria-expanded={editing === c.id}
                      className="flex-1 min-w-0 text-left p-3.5 flex items-center gap-3 flex-wrap hover:bg-white/[0.03] transition rounded-l-xl">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(168,85,247,0.14)', border: '1px solid rgba(168,85,247,0.3)' }}>
                        <Ticket className="w-4 h-4" style={{ color: '#c084fc' }} />
                      </div>
                      <div className="flex-1 min-w-[180px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-mono font-bold text-white text-sm">{c.code}</p>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                            style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.4)' }}>
                            {c.days} days
                          </span>
                          {!usable && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)' }}>
                              {!c.active ? 'Off' : expired ? 'Expired' : 'Used up'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {c.uses} used{c.max_uses !== null ? ` of ${c.max_uses}` : ''}
                          {c.expires_at ? ` · expires ${fmtDate(c.expires_at)}` : ''}
                          {c.notes ? ` · ${c.notes}` : ''}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => onToggle(c.id, !c.active)}
                      disabled={loading === `code-${c.id}`}
                      title={c.active ? 'Switch this code off' : 'Switch this code back on'}
                      className="px-3.5 flex items-center justify-center transition hover:bg-white/5 disabled:opacity-40 border-l"
                      style={{ borderColor: 'rgba(255,255,255,0.06)', color: c.active ? '#22c55e' : 'rgba(255,255,255,0.25)' }}>
                      {loading === `code-${c.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* The link to actually hand out. The code is never typed by
                      the customer, so this is the thing worth copying. */}
                  <div className="px-3.5 pb-3 -mt-1">
                    <code className="text-[11px] break-all" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      cardtly.com/signup?code={c.code}
                    </code>
                  </div>

                  {editing === c.id && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      {c.uses > 0 && (
                        <p className="text-xs mb-3 rounded-lg px-3 py-2 flex items-start gap-1.5"
                          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}>
                          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                          {c.uses} {c.uses === 1 ? 'person has' : 'people have'} already used this code. Changing the days does not
                          affect trials already granted - only the next person to use it.
                        </p>
                      )}
                      <CodeForm form={form} setForm={setForm} busy={loading === 'code-save'}
                        onSave={async () => { const ok = await onSave(form); if (ok) setEditing(null) }} />
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

function CodeForm({ form, setForm, onSave, busy }: {
  form: Form
  setForm: (f: (p: Form) => Form) => void
  onSave: () => void
  busy: boolean
}) {
  const days = Number(form.days)
  const valid = form.code.trim().length >= 3 && Number.isInteger(days) && days >= 1 && days <= 365

  return (
    <div className="space-y-3">
      <div className="flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-[150px]">
          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Code</label>
          {/* Uppercased as you type, because that is how it is stored and
              compared - so what you see is what a link will carry. */}
          <input value={form.code}
            onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') }))}
            className={inputClass + ' font-mono'} style={inputStyle} placeholder="LAUNCH30" />
        </div>
        <div className="w-24">
          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Days</label>
          <input type="number" min={1} max={365} value={form.days}
            onChange={e => setForm(f => ({ ...f, days: e.target.value }))}
            className={inputClass} style={inputStyle} />
        </div>
        <div className="w-28">
          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Max uses</label>
          <input type="number" min={1} value={form.maxUses}
            onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))}
            className={inputClass} style={inputStyle} placeholder="∞" />
        </div>
        <div className="w-40">
          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Expires</label>
          <input type="date" min={dateInput(new Date())} value={form.expiresOn}
            onChange={e => setForm(f => ({ ...f, expiresOn: e.target.value }))}
            className={inputClass} style={inputStyle} />
        </div>
      </div>

      <div>
        <label className="text-[11px] font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Notes (what this code is for)</label>
        <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className={inputClass} style={inputStyle} placeholder="Expo handout, Sept 2026" />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Blank max uses means unlimited. Blank expiry means it never expires on its own.
        </p>
        <button disabled={busy || !valid} onClick={onSave}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
          style={{ background: grad }}>
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Save code
        </button>
      </div>
    </div>
  )
}
