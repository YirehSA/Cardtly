'use client'

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { Loader2, Save, FileText, Landmark, Building2, Receipt, ScrollText, AlertTriangle } from 'lucide-react'
import { Section, inputClass, inputStyle, grad } from './shared'

// Who Cardtly is on a quote or an invoice, and the terms it promises.
//
// Everything on this screen is snapshotted onto a document the moment it is
// issued. Editing here changes what FUTURE documents say and touches nothing
// already sent, which is the whole reason the schema keeps copies instead of
// joining. The screen says so out loud, because a settings page that silently
// rewrote history would look exactly like this one.

type Settings = Record<string, any>
type Terms = { id: string; version: number; body: string; is_active: boolean; created_at: string }

const ACCOUNT_TYPES = ['Current Account', 'Cheque Account', 'Savings Account', 'Transmission Account']

const DUE_RULES: { id: string; label: string; hint: string }[] = [
  { id: 'end_of_month', label: 'Last day of the month', hint: 'What the letterhead says. An invoice issued on the 3rd and one issued on the 27th are both due on the 30th.' },
  { id: 'days', label: 'A number of days after issue', hint: 'Uses the payment terms below. For a client who negotiated 30 days.' },
  { id: 'on_issue', label: 'On issue', hint: 'Due the day it goes out. NFC card orders and anything else paid before it is fulfilled.' },
]

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="block mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{hint}</span>}
    </label>
  )
}

function Note({ children, tone = 'warn' }: { children: React.ReactNode; tone?: 'warn' | 'info' }) {
  const colour = tone === 'warn' ? '#f59e0b' : '#0ea5e9'
  return (
    <div className="flex items-start gap-2 rounded-lg p-3 text-xs"
      style={{ background: `${colour}14`, border: `1px solid ${colour}44`, color: 'rgba(255,255,255,0.75)' }}>
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: colour }} />
      <div className="leading-relaxed">{children}</div>
    </div>
  )
}

export default function BillingTab() {
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [saved, setSaved] = useState<Settings>({})
  const [form, setForm] = useState<Settings>({})
  const [terms, setTerms] = useState<Terms[]>([])
  const [termsDraft, setTermsDraft] = useState('')
  const [busy, setBusy] = useState<null | 'settings' | 'terms'>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/billing/settings')
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setUnavailable(data?.error || 'Could not load billing settings'); return }
    setUnavailable(null)
    setSaved(data.settings || {})
    setForm(data.settings || {})
    setTerms(data.terms || [])
    setTermsDraft(data.terms?.find((t: Terms) => t.is_active)?.body || data.terms?.[0]?.body || '')
  }
  useEffect(() => { load() }, [])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // Only what actually changed goes to the server, so a save cannot quietly
  // reassert a stale value somebody else edited in another tab.
  const changed = useMemo(() => {
    const out: Settings = {}
    for (const k of Object.keys(form)) {
      if (k === 'updated_at' || k === 'updated_by' || k === 'id') continue
      const a = form[k] ?? ''
      const b = saved[k] ?? ''
      if (String(a) !== String(b)) out[k] = form[k]
    }
    return out
  }, [form, saved])
  const dirty = Object.keys(changed).length > 0

  const activeTerms = terms.find(t => t.is_active) || null
  const termsDirty = termsDraft.trim() !== (activeTerms?.body || '').trim() && termsDraft.trim().length > 0

  async function saveSettings() {
    setBusy('settings')
    const res = await fetch('/api/admin/billing/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changed),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok || data?.error) { toast.error(data?.error || 'That did not save'); return }
    setSaved(data.settings); setForm(data.settings)
    toast.success('Saved. Documents issued from now on carry these details.')
  }

  async function saveTerms() {
    setBusy('terms')
    const res = await fetch('/api/admin/billing/terms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: termsDraft }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok || data?.error) { toast.error(data?.error || 'That did not save'); return }
    if (data.unchanged) { toast.success('No change, so no new version'); return }
    toast.success(`Saved as version ${data.terms.version}. Quotes already signed keep the version they cited.`)
    load()
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
      <Loader2 className="w-4 h-4 animate-spin" />Loading billing settings
    </div>
  }
  if (unavailable) return <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{unavailable}</p>

  // Two things worth catching before they reach a client's accounts department.
  const vatMismatch = Number(form.vat_rate_bp || 0) > 0 && !String(form.vat_number || '').trim()
  const bankNameMismatch = !!form.bank_account_name && !!form.legal_name &&
    form.bank_account_name.trim().toLowerCase() !== form.legal_name.trim().toLowerCase()

  const input = (k: string, placeholder = '') => (
    <input className={inputClass} style={inputStyle} value={form[k] ?? ''} placeholder={placeholder}
      onChange={e => set(k, e.target.value)} />
  )

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs max-w-2xl" style={{ color: 'rgba(255,255,255,0.45)' }}>
          These details are copied onto every quote and invoice at the moment it is issued.
          Changing them here changes what the next document says. Documents already sent keep
          exactly what they were sent with.
        </p>
        <div className="flex items-center gap-2">
          <a href="/api/admin/billing/preview?kind=invoice" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <FileText className="w-4 h-4" />Preview invoice
          </a>
          <a href="/api/admin/billing/preview?kind=quote" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <FileText className="w-4 h-4" />Preview quote
          </a>
          <button onClick={saveSettings} disabled={!dirty || busy === 'settings'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-40"
            style={{ background: grad, color: '#fff' }}>
            {busy === 'settings' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {dirty ? `Save ${Object.keys(changed).length} change${Object.keys(changed).length === 1 ? '' : 's'}` : 'Saved'}
          </button>
        </div>
      </div>

      <Section title="Who the document comes from" sub="Printed at the top of every quote and invoice, and in the footer."
        right={<Building2 className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Legal name" hint="The registered entity. This is what a document is issued under.">{input('legal_name', 'Cardtly (Pty) Ltd')}</Field>
          <Field label="Trading name" hint="Shown large at the top. Leave blank to use the legal name.">{input('trading_name', 'Cardtly')}</Field>
          <Field label="Registration number">{input('reg_number', '2025/727173/07')}</Field>
          <Field label="Website">{input('website', 'www.cardtly.com')}</Field>
          <Field label="Email">{input('email', 'hello@cardtly.com')}</Field>
          <Field label="Phone">{input('phone', '062 460 7440')}</Field>
          <div className="sm:col-span-2">
            <Field label="Address">{input('address', '119 Pretoria Road, Rynfield, Benoni, 1501, Gauteng, South Africa')}</Field>
          </div>
        </div>
      </Section>

      <Section title="VAT" sub="A document is headed TAX INVOICE only when there is a VAT number on it."
        right={<Receipt className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="VAT number" hint="Leave blank until registration comes through.">{input('vat_number', '')}</Field>
          <Field label="VAT rate" hint="Basis points. 1500 is 15.00%.">
            <input type="number" className={inputClass} style={inputStyle} value={form.vat_rate_bp ?? 0}
              onChange={e => set('vat_rate_bp', e.target.value)} />
          </Field>
        </div>
        {vatMismatch && (
          <div className="mt-4">
            <Note>
              A rate is set but there is no VAT number, so <strong>no VAT will be charged</strong> and documents
              will be headed INVOICE rather than TAX INVOICE. That is deliberate: charging VAT without being
              registered to is not allowed, and it is the customer who gets caught trying to claim the input.
              The moment a VAT number is entered here, new documents start carrying VAT. Historical ones do not change.
            </Note>
          </div>
        )}
      </Section>

      <Section title="Banking" sub="Printed on invoices, and on quotes so a client can see who they will be paying."
        right={<Landmark className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Bank">{input('bank_name', 'First National Bank (FNB)')}</Field>
          <Field label="Account name" hint="Exactly as the bank has it. A mismatch can bounce an EFT.">{input('bank_account_name', '')}</Field>
          <Field label="Account number">{input('bank_account_no', '')}</Field>
          <Field label="Branch code">{input('bank_branch_code', '')}</Field>
          <Field label="Account type" hint="Part of a South African EFT beneficiary setup.">
            <select className={inputClass} style={inputStyle} value={form.bank_account_type ?? ''}
              onChange={e => set('bank_account_type', e.target.value)}>
              <option value="">Not set</option>
              {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="SWIFT" hint="Only needed for payments from outside South Africa.">{input('bank_swift', '')}</Field>
        </div>
        {bankNameMismatch && (
          <div className="mt-4">
            <Note>
              The account name (<strong>{form.bank_account_name}</strong>) is not the same as the legal name
              (<strong>{form.legal_name}</strong>). That is fine if it is genuinely how FNB has the account,
              but if it is not, a client loading the beneficiary can have the payment rejected. Worth checking
              against a bank statement once.
            </Note>
          </div>
        )}
      </Section>

      <Section title="When things fall due" sub="Subscriptions ignore all of this: they bill on the anniversary of signup, in advance."
        right={<Receipt className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Invoice due date"
            hint={DUE_RULES.find(r => r.id === (form.invoice_due_rule || 'end_of_month'))?.hint}>
            <select className={inputClass} style={inputStyle} value={form.invoice_due_rule ?? 'end_of_month'}
              onChange={e => set('invoice_due_rule', e.target.value)}>
              {DUE_RULES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Payment terms (days)" hint="Only used when the rule above is set to days after issue.">
            <input type="number" className={inputClass} style={inputStyle} value={form.payment_terms_days ?? 14}
              onChange={e => set('payment_terms_days', e.target.value)} />
          </Field>
          <Field label="Quote valid for (days)" hint="Printed on the quote as the date it lapses.">
            <input type="number" className={inputClass} style={inputStyle} value={form.quote_valid_days ?? 14}
              onChange={e => set('quote_valid_days', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Chasing overdue invoices"
        sub="Reminders escalate: a nudge, a firmer one, then a final notice."
        right={<Receipt className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />}>
        <Field label="Chase at (days past due)"
          hint="Comma separated, up to five. Each one sends at most one reminder ever, and a missed day catches up one step rather than firing them all at once.">
          <input className={inputClass} style={inputStyle} placeholder="3, 14, 30"
            value={Array.isArray(form.reminder_days) ? form.reminder_days.join(', ') : (form.reminder_days ?? '3, 14, 30')}
            onChange={e => set('reminder_days', e.target.value)} />
        </Field>
        <label className="flex items-start gap-2 mt-4 text-xs cursor-pointer" style={{ color: 'rgba(255,255,255,0.7)' }}>
          <input type="checkbox" className="mt-0.5" checked={!!form.auto_send_reminders}
            onChange={e => set('auto_send_reminders', e.target.checked)} />
          <span>
            Send them automatically each morning.
            <span className="block mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Off by default on purpose. Left off, overdue invoices collect in a queue on the Invoices
              screen and you send with one click. Turned on, the daily job emails clients without asking.
            </span>
          </span>
        </label>
      </Section>

      <Section
        title="Terms and conditions"
        sub={activeTerms ? `Version ${activeTerms.version} is active` : 'No terms saved yet'}
        right={<ScrollText className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />}>
        <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Printed on every quote, which is the document a client accepts and signs. Saving creates a
          NEW version rather than editing this one, so a signed quote can always show exactly which
          terms were agreed to.
        </p>
        <textarea
          className={inputClass} style={{ ...inputStyle, minHeight: 220, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
          value={termsDraft} onChange={e => setTermsDraft(e.target.value)}
          placeholder={'1. Payment is due by the date stated on this document.\n2. ...'}
        />
        <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {terms.length > 0
              ? `${terms.length} version${terms.length === 1 ? '' : 's'} kept. Nothing is ever overwritten.`
              : 'Nothing saved yet.'}
          </p>
          <button onClick={saveTerms} disabled={!termsDirty || busy === 'terms'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-40"
            style={{ background: grad, color: '#fff' }}>
            {busy === 'terms' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save as version {(terms[0]?.version || 0) + 1}
          </button>
        </div>
      </Section>
    </div>
  )
}
