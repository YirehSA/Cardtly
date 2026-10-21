'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Loader2, Search, Check, ChevronLeft, ChevronRight, FileSignature, Receipt, Banknote,
  Building2, Mail, AlertTriangle, X, RotateCcw, FileText, Info, UserPlus, Ban,
} from 'lucide-react'
import { inputClass, inputStyle, grad, fmtDate as niceDate, matchesAllWords } from '../shared'
import { money, toCents, toRands, METHODS } from './shared'
import { suggestTeam, planSteps, paymentFit, referenceMatches, type StepId } from '@/lib/payment-flow'
import { prepaidPeriodEnd, BILLING_MODE_META, type OrgBillingMode } from '@/lib/org-billing'
import type { AdminUserRow, AdminOrgRow } from '@/lib/admin-data'
import type { Tab } from '../AdminShell'

// PAYMENT RECEIVED: from an EFT in the bank to a live team, in four steps.
//
// Andre, 2026-10-21: "We have to jump and change to so many screens to get the
// order right... when allocating the payment to the invoice I still can't
// select the invoice that got paid and I have to go into the bank to check the
// amount."
//
// So the first step is a list of everything a client could be paying, with the
// amount each one owes: tap the one that was paid and the amount, reference,
// client, team and months are filled in from it. The questions are asked once,
// and the last step does the rest in the order it has to happen (see
// lib/payment-flow): team, link, invoice, months, issue, money, email. Every
// write goes through the route that already owns it, so nothing here skips the
// checks those screens have.
//
// A step that fails stops the run where it is and says why. Try again carries
// on from that step; what is done stays done and is not repeated.

type Line = { description: string; qty: number; unit_price_cents: number }
interface Client { id: string; name: string; contact_person: string | null; email: string | null; phone: string | null; organization_id: string | null }
interface Team { id: string; name: string; max_seats: number; billing_period: string; business_plan_active: boolean; paid_until: string | null; admin_user_id: string; reseller_id: string | null }
interface Quote {
  id: string; number: string | null; client_id: string; status: string; display_status: string; total_cents: number
  issued_at: string | null; valid_until: string | null; accepted_at: string | null; accepted_name: string | null; accepted_email: string | null
  lines: Line[]
}
interface Invoice {
  id: string; number: string | null; client_id: string; status: string; total_cents: number; paid_cents: number
  credited_cents: number; outstanding_cents: number; issued_at: string | null; due_at: string | null
  from_quote_id: string | null; prepaid_months: number | null; prepaid_applied_at: string | null; lines: Line[]
}
interface ReceiptRow {
  id: string; client_id: string | null; amount_cents: number; received_on: string; method: string; reference: string | null
  unallocated_cents: number; allocations: { invoice_id: string; amount_cents: number }[]
}
interface Data { clients: Client[]; teams: Team[]; quotes: Quote[]; invoices: Invoice[]; receipts: ReceiptRow[] }

interface Doc {
  key: string
  kind: 'quote' | 'invoice'
  id: string
  number: string | null
  clientId: string
  owing: number
  tag: { label: string; colour: string }
  group: 'signed' | 'invoice' | 'unsigned'
  detail: string
  lines: Line[]
  quote?: Quote
  invoice?: Invoice
}

export type FlowStart = { kind: 'quote' | 'invoice'; id: string } | null

const LINE = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.55)'
const FAINT = 'rgba(255,255,255,0.4)'
const ACCENT = 'hsl(var(--accent))'
const STEP_LABELS = ['What was paid', 'The money', 'The team', 'Check and finish']
const MONTH_CHIPS = [1, 3, 6, 12, 24, 36]
const today = () => new Date().toISOString().slice(0, 10)
const looksLikeEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(s.trim())
// create_org's note for a new prepaid team. True on its own, but this screen
// pays the invoice a moment later, so it would only alarm.
const NOT_LIVE_YET = 'Prepaid team saved but NOT live yet. It goes live when its invoice is marked paid: create the invoice under Billing and give it a prepaid period.'

function toDocs(d: Data): Doc[] {
  const out: Doc[] = []
  for (const q of d.quotes) {
    const signed = q.status === 'accepted'
    const expired = q.display_status === 'expired'
    out.push({
      key: `quote:${q.id}`, kind: 'quote', id: q.id, number: q.number, clientId: q.client_id,
      owing: q.total_cents,
      tag: signed ? { label: 'Signed', colour: '#22c55e' }
        : expired ? { label: 'Expired', colour: '#f59e0b' }
        : { label: 'Not signed yet', colour: '#94a3b8' },
      group: signed ? 'signed' : 'unsigned',
      detail: signed
        ? `Quote, signed${q.accepted_name ? ` by ${q.accepted_name}` : ''} ${niceDate(q.accepted_at)}`
        : `Quote, issued ${niceDate(q.issued_at)}`,
      lines: q.lines, quote: q,
    })
  }
  for (const i of d.invoices) {
    const owing = i.status === 'draft' ? i.total_cents : i.outstanding_cents
    if (owing <= 0) continue
    out.push({
      key: `invoice:${i.id}`, kind: 'invoice', id: i.id, number: i.number, clientId: i.client_id,
      owing,
      tag: i.status === 'draft' ? { label: 'Draft', colour: '#9ca3af' }
        : i.status === 'overdue' ? { label: 'Overdue', colour: '#ef4444' }
        : i.status === 'part_paid' ? { label: 'Part paid', colour: '#f59e0b' }
        : { label: 'Unpaid', colour: '#38bdf8' },
      group: 'invoice',
      detail: i.status === 'draft'
        ? 'Invoice, still a draft. It is issued as part of this.'
        : `Invoice, issued ${niceDate(i.issued_at)}${i.due_at ? `, due ${niceDate(i.due_at)}` : ''}`,
      lines: i.lines, invoice: i,
    })
  }
  return out
}

/** A typed amount, "12000", "12 000" or "R12,000.00", as cents. Null when it is not one. */
function amountIn(needle: string): number | null {
  const s = needle.replace(/\s/g, '').replace(/^r/i, '').replace(/,(?=\d{3}\b)/g, '')
  if (!/^\d+([.,]\d{1,2})?$/.test(s)) return null
  return Math.round(Number(s.replace(',', '.')) * 100)
}

function Pill({ label, colour }: { label: string; colour: string }) {
  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
      style={{ background: `${colour}1f`, color: colour, border: `1px solid ${colour}55` }}>{label}</span>
  )
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="block mt-1 text-[11px]" style={{ color: FAINT }}>{hint}</span>}
    </label>
  )
}

function Choice({ on, onClick, icon: Icon, title, sub }: {
  on: boolean; onClick: () => void; icon: any; title: string; sub?: string
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className="text-left rounded-xl p-3 w-full transition flex items-start gap-3"
      style={{ background: on ? 'hsl(var(--accent) / 0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${on ? ACCENT : LINE}` }}>
      <span className="mt-0.5 inline-flex items-center justify-center rounded-full shrink-0"
        style={{ width: 18, height: 18, border: `2px solid ${on ? ACCENT : 'rgba(255,255,255,0.25)'}`, background: on ? ACCENT : 'transparent' }}>
        {on && <Check className="w-3 h-3 text-white" />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold text-white"><Icon className="w-4 h-4 shrink-0" style={{ color: on ? ACCENT : MUTED }} />{title}</span>
        {sub && <span className="block text-xs mt-0.5" style={{ color: MUTED }}>{sub}</span>}
      </span>
    </button>
  )
}

function Note({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'info'; children: React.ReactNode }) {
  const c = { good: '#22c55e', warn: '#f59e0b', bad: '#ef4444', info: '#38bdf8' }[tone]
  const Icon = tone === 'good' ? Check : tone === 'info' ? Info : AlertTriangle
  return (
    <div className="flex items-start gap-2 rounded-lg p-3 text-xs" style={{ background: `${c}14`, border: `1px solid ${c}44`, color: 'rgba(255,255,255,0.8)' }}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: c }} />
      <div className="leading-relaxed min-w-0">{children}</div>
    </div>
  )
}

type TeamMode = 'new' | 'existing' | 'none'
type RunState = 'todo' | 'doing' | 'done' | 'failed'

export default function PaymentFlow({ users, orgs, start, onDone, onOpen }: {
  users: AdminUserRow[]
  orgs: AdminOrgRow[]
  start?: FlowStart
  onDone: () => void
  onOpen: (t: Tab) => void
}) {
  const [data, setData] = useState<Data | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [q, setQ] = useState('')

  // The answers.
  const [docKey, setDocKey] = useState<string | null>(null)
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const [pay, setPay] = useState({ amount: '', date: today(), reference: '', method: 'eft' })
  const [team, setTeam] = useState<{ mode: TeamMode; orgId: string; name: string; email: string; seats: string; welcome: boolean }>(
    { mode: 'new', orgId: '', name: '', email: '', seats: '1', welcome: true })
  const [teamQ, setTeamQ] = useState('')
  const [months, setMonths] = useState('')
  const [send, setSend] = useState({ on: true, to: '' })

  // The run. Refs, not state, for what a retry has to see immediately.
  const ids = useRef<{ orgId?: string; invoiceId?: string; invoiceNumber?: string | null; receiptId?: string }>({})
  const done = useRef(new Set<StepId>())
  const frozenPlan = useRef<StepId[] | null>(null)
  const [progress, setProgress] = useState<Partial<Record<StepId, RunState>>>({})
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [finished, setFinished] = useState<Data | null>(null)

  async function load(): Promise<Data | null> {
    try {
      const res = await fetch('/api/admin/billing/payment-flow', { cache: 'no-store' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setLoadError(d?.error || 'Could not load what is waiting for payment'); return null }
      setLoadError(null)
      setData(d)
      return d
    } catch {
      setLoadError('Could not load what is waiting for payment')
      return null
    }
  }
  useEffect(() => { load() }, [])

  const docs = useMemo(() => (data ? toDocs(data) : []), [data])
  const clientOf = (id: string | null | undefined) => data?.clients.find(c => c.id === id) || null
  // Held from the moment the run starts: once paid, the document drops off
  // the list of things waiting for payment, and the screen still has to say
  // what was done to it.
  const [pinned, setPinned] = useState<Doc | null>(null)
  const doc = docs.find(d => d.key === docKey) || (pinned && pinned.key === docKey ? pinned : null)
  const client = clientOf(doc?.clientId)
  const [pinnedReceipt, setPinnedReceipt] = useState<ReceiptRow | null>(null)
  const receipt = data?.receipts.find(r => r.id === receiptId) || (pinnedReceipt && pinnedReceipt.id === receiptId ? pinnedReceipt : null)

  // Opened from a quote or invoice ("Paid" on those screens): start there.
  const started = useRef(false)
  useEffect(() => {
    if (started.current || !data || !start) return
    // A quote that is already an invoice is paid on that invoice.
    const d = docs.find(x => x.kind === start.kind && x.id === start.id)
      || (start.kind === 'quote' ? docs.find(x => x.invoice?.from_quote_id === start.id) : undefined)
    started.current = true
    if (d) { choose(d); setStep(2) }
  }, [data, start, docs])

  // ── Step 1: what was paid ────────────────────────────────────────────────
  function choose(d: Doc) {
    const c = clientOf(d.clientId)
    const linked = c?.organization_id ? data?.teams.find(t => t.id === c.organization_id) || null : null
    const s = suggestTeam(d.lines)
    const inv = d.invoice
    setDocKey(d.key)

    // The receipt already picked, if it can be this client's.
    const r = receiptId ? data?.receipts.find(x => x.id === receiptId) : null
    if (r && r.client_id && r.client_id !== d.clientId) setReceiptId(null)
    setPay({ amount: toRands(d.owing), date: today(), reference: d.number || '', method: 'eft' })

    // The person who builds the cards: whoever signed the quote, else the
    // client's own address.
    const email = (d.quote?.accepted_email || c?.email || '').trim().toLowerCase()
    const ownsTeam = users.find(u => u.email?.toLowerCase() === email)?.org || null
    if (linked) {
      setTeam({ mode: 'existing', orgId: linked.id, name: linked.name, email, seats: String(Math.max(linked.max_seats || 1, s.seats || 0)), welcome: true })
    } else if (ownsTeam) {
      const t = data?.teams.find(x => x.id === ownsTeam.id)
      setTeam({ mode: 'existing', orgId: ownsTeam.id, name: ownsTeam.name, email, seats: String(Math.max(t?.max_seats || 1, s.seats || 0)), welcome: true })
    } else {
      // Nothing on the quote looks like cards (an NFC order, say): no team.
      setTeam({ mode: s.seats ? 'new' : 'none', orgId: '', name: c?.name || '', email, seats: String(s.seats || 1), welcome: true })
    }
    setMonths(inv?.prepaid_months ? String(inv.prepaid_months) : s.months && (linked || ownsTeam || s.seats) ? String(s.months) : '')
    const to = (c?.email || d.quote?.accepted_email || '').trim()
    setSend({ on: !!to, to })
  }

  function pickReceipt(r: ReceiptRow) {
    setReceiptId(r.id)
    // A receipt with a client narrows the list to what that client owes.
    if (r.client_id) setQ(clientOf(r.client_id)?.name || '')
  }

  const visible = useMemo(() => {
    const needle = q.trim()
    const cents = amountIn(needle)
    const r = receipt
    return docs.filter(d => {
      if (r?.client_id && d.clientId !== r.client_id) return false
      if (!needle) return true
      const c = clientOf(d.clientId)
      if (cents !== null && cents === d.owing) return true
      if (referenceMatches(needle, d.number)) return true
      return matchesAllWords(needle, [d.number, c?.name, c?.email, c?.contact_person, d.quote?.accepted_name, d.quote?.accepted_email, money(d.owing)])
    })
  }, [docs, q, receipt, data])

  // ── Step 3: the team ──────────────────────────────────────────────────────
  const suggestion = useMemo(() => suggestTeam(doc?.lines || []), [doc])
  const chosenTeam = team.mode === 'existing' ? data?.teams.find(t => t.id === team.orgId) || null : null
  const chosenOrgRow = chosenTeam ? orgs.find(o => o.id === chosenTeam.id) || null : null
  const linkedTeam = client?.organization_id ? data?.teams.find(t => t.id === client.organization_id) || null : null
  const seatsN = Math.floor(Number(team.seats))
  const monthsN = months.trim() ? Math.floor(Number(months)) : 0
  const applied = !!doc?.invoice?.prepaid_applied_at
  const ownerAccount = looksLikeEmail(team.email) ? users.find(u => u.email?.toLowerCase() === team.email.trim().toLowerCase()) || null : null
  const ownerHasTeam = team.mode === 'new' ? ownerAccount?.org || null : null
  const isReseller = !!chosenTeam?.reseller_id

  const teamAction: 'new' | 'change' | 'keep' | 'none' =
    team.mode === 'new' ? 'new'
    : team.mode === 'none' ? 'none'
    : chosenTeam && monthsN > 0 && !isReseller && seatsN !== chosenTeam.max_seats ? 'change' : 'keep'
  const needsLink = team.mode === 'new' || (team.mode === 'existing' && !!chosenTeam && client?.organization_id !== chosenTeam.id)
  const currentMonths = doc?.invoice?.prepaid_months || null
  const wantMonths = team.mode === 'none' || isReseller ? currentMonths : (monthsN || null)
  const setMonthsStep = !applied && team.mode !== 'none' && !isReseller && wantMonths !== currentMonths
  const liveUntil = monthsN > 0 && team.mode !== 'none' && !isReseller
    ? prepaidPeriodEnd(chosenTeam?.paid_until || null, monthsN) : null

  // ── Step 2: the money ─────────────────────────────────────────────────────
  const amountCents = receipt ? receipt.unallocated_cents : toCents(pay.amount)
  const fit = paymentFit(amountCents, doc?.owing || 0)
  const clientReceipts = (data?.receipts || []).filter(r => !doc || !r.client_id || r.client_id === doc.clientId)

  const plan: StepId[] = doc ? planSteps({
    source: doc.kind === 'quote' ? 'quote' : doc.invoice?.status === 'draft' ? 'draft_invoice' : 'invoice',
    team: teamAction,
    needsLink,
    setMonths: setMonthsStep,
    send: send.on && looksLikeEmail(send.to),
  }) : []

  const stepOk = [
    true,
    !!doc,
    !!doc && amountCents > 0 && (!!receipt || !!pay.date),
    !!doc && (
      team.mode === 'none'
      || (team.mode === 'new' && !!team.name.trim() && looksLikeEmail(team.email) && seatsN >= 1 && !ownerHasTeam)
      || (team.mode === 'existing' && !!chosenTeam && seatsN >= 1 && seatsN >= (teamAction === 'change' ? chosenOrgRow?.cardsCreated || 0 : 0))
    ) && (months.trim() === '' || (monthsN >= 1 && monthsN <= 120)),
  ]
  const canNext = stepOk[step] ?? false
  const started_ = Object.values(progress).some(v => v === 'done')

  function describe(s: StepId): string {
    // A quote's invoice has no number until it is issued, a few steps in.
    const inv = ids.current.invoiceNumber || (doc?.kind === 'invoice' ? doc.number : null)
      || (doc?.kind === 'quote' ? 'the new invoice' : 'the invoice')
    switch (s) {
      case 'save_team':
        return teamAction === 'new'
          ? `Create the team "${team.name.trim()}" with ${seatsN} seat${seatsN === 1 ? '' : 's'}, owned by ${team.email.trim().toLowerCase()}${team.welcome && !ownerAccount ? ', and email them a link to choose a password' : ''}`
          : `Change ${chosenTeam?.name} from ${chosenTeam?.max_seats} to ${seatsN} seats`
      case 'link_client':
        return `Link the billing client ${client?.name} to ${team.mode === 'new' ? 'the new team' : chosenTeam?.name}`
      case 'make_invoice':
        return `Turn quote ${doc?.number} into an invoice`
      case 'set_months':
        return wantMonths ? `Put ${wantMonths} month${wantMonths === 1 ? '' : 's'} prepaid on the invoice` : 'Take the prepaid period off the invoice'
      case 'issue_invoice':
        return 'Issue the invoice, which gives it its number'
      case 'record_payment':
        return receipt
          ? `Put ${money(fit.allocateCents)} of the payment from ${niceDate(receipt.received_on)} on ${inv}`
          : `Record ${money(amountCents)} received on ${niceDate(pay.date)}${pay.reference.trim() ? `, reference ${pay.reference.trim()}` : ''}, and put ${money(fit.allocateCents)} on ${inv}`
      case 'send_invoice':
        return `Email the ${fit.kind === 'short' ? '' : 'paid '}invoice to ${send.to.trim()}`
    }
  }

  // ── The run ───────────────────────────────────────────────────────────────
  async function call(url: string, method: string, body: unknown) {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await res.json().catch(() => ({}))
    return { ok: res.ok && !d?.error, status: res.status, data: d as any }
  }

  async function doStep(s: StepId) {
    if (!doc || !client) throw new Error('Pick what was paid first.')
    if (s === 'save_team') {
      const body = teamAction === 'new'
        ? { action: 'create_org', owner_email: team.email.trim().toLowerCase(), send_welcome: team.welcome, org_name: team.name.trim(), seat_count: seatsN, billing_period: 'prepaid' }
        // Saving an existing team rewrites its billing notes, so send them back.
        : { action: 'create_org', user_id: chosenTeam!.admin_user_id, org_name: chosenTeam!.name, seat_count: seatsN, billing_period: 'prepaid', billing_notes: chosenOrgRow?.billingNotes ?? null }
      const r = await call('/api/admin', 'POST', body)
      if (!r.ok) throw new Error(r.data?.error || 'Could not save the team')
      const warning = String(r.data?.warning || '').replace(NOT_LIVE_YET, '').trim()
      if (warning) setNotes(n => [...n, warning])
      const orgId = r.data?.organization_id || (teamAction === 'change' ? chosenTeam!.id : null)
      if (!orgId) throw new Error('The team was saved, but its id did not come back. Reload this screen and pick the payment again; the team will be found.')
      ids.current.orgId = orgId
      return
    }
    if (s === 'link_client') {
      const orgId = ids.current.orgId || chosenTeam?.id
      if (!orgId) throw new Error('There is no team to link to yet.')
      const r = await call('/api/admin/billing/clients', 'PATCH', { id: client.id, organization_id: orgId })
      if (!r.ok) throw new Error(r.data?.error || 'Could not link the client to the team')
      return
    }
    if (s === 'make_invoice') {
      const r = await call('/api/admin/billing/quotes', 'PATCH', { id: doc.id, action: 'convert' })
      // Already an invoice (a retry, or somebody else got there): carry on with that one.
      if (!r.ok && !(r.status === 409 && r.data?.invoice_id)) throw new Error(r.data?.error || 'Could not turn the quote into an invoice')
      ids.current.invoiceId = r.ok ? r.data.invoice.id : r.data.invoice_id
      return
    }
    const invoiceId = ids.current.invoiceId || (doc.kind === 'invoice' ? doc.id : null)
    if (!invoiceId) throw new Error('There is no invoice yet. Try again from the start.')
    if (s === 'set_months') {
      const r = await call('/api/admin/billing/invoices', 'PATCH', { id: invoiceId, action: 'set_prepaid', prepaid_months: wantMonths })
      if (!r.ok) throw new Error(r.data?.error || 'Could not put the prepaid period on the invoice')
      return
    }
    if (s === 'issue_invoice') {
      const r = await call('/api/admin/billing/invoices', 'PATCH', { id: invoiceId, action: 'issue' })
      if (!r.ok && !/already issued/i.test(r.data?.error || '')) throw new Error(r.data?.error || 'Could not issue the invoice')
      if (r.ok) ids.current.invoiceNumber = r.data?.invoice?.number || null
      return
    }
    if (s === 'record_payment') {
      const allocation = { invoice_id: invoiceId, amount_cents: fit.allocateCents }
      const existingId = ids.current.receiptId || receipt?.id
      if (existingId) {
        // What the receipt already pays stays; this invoice is added to it.
        const keep = existingId === receipt?.id ? receipt.allocations.filter(a => a.invoice_id !== invoiceId) : []
        const r = await call('/api/admin/billing/payments', 'PATCH', { receipt_id: existingId, client_id: client.id, allocations: [...keep, allocation] })
        if (!r.ok) throw new Error(r.data?.error || 'Could not put the payment on the invoice')
        return
      }
      const r = await call('/api/admin/billing/payments', 'POST', {
        client_id: client.id, amount_cents: amountCents, received_on: pay.date, method: pay.method,
        reference: pay.reference, allocations: [allocation],
      })
      // Recorded but not placed: keep the receipt, so Try again places it
      // rather than loading the bank line a second time.
      if (r.data?.receipt?.id) ids.current.receiptId = r.data.receipt.id
      if (!r.ok) throw new Error(r.data?.error || 'Could not record the payment')
      return
    }
    if (s === 'send_invoice') {
      const r = await call('/api/admin/billing/invoices/send', 'POST', { id: invoiceId, to: send.to.trim() })
      if (!r.ok) throw new Error(r.data?.error || 'Could not email the invoice')
      return
    }
  }

  async function runAll() {
    if (!doc) return
    setPinned(doc)
    setPinnedReceipt(receipt)
    // The plan is fixed once a step has been done, so a retry finishes the
    // same job. Until then the answers can still change, and the plan with them.
    const steps = done.current.size && frozenPlan.current ? frozenPlan.current : plan
    frozenPlan.current = steps
    if (doc.kind === 'invoice' && !ids.current.invoiceId) {
      ids.current.invoiceId = doc.id
      ids.current.invoiceNumber = doc.number
    }
    if (team.mode === 'existing' && chosenTeam && !ids.current.orgId) ids.current.orgId = chosenTeam.id
    setRunning(true)
    setRunError(null)
    for (const s of steps) {
      if (done.current.has(s)) continue
      setProgress(p => ({ ...p, [s]: 'doing' }))
      try {
        await doStep(s)
        done.current.add(s)
        setProgress(p => ({ ...p, [s]: 'done' }))
      } catch (e: any) {
        setProgress(p => ({ ...p, [s]: 'failed' }))
        setRunError(e?.message || 'That step did not work')
        setRunning(false)
        onDone()
        return
      }
    }
    setRunning(false)
    const after = await load()
    setFinished(after || data)
    setStep(5)
    onDone()
  }

  function reset() {
    ids.current = {}
    done.current = new Set()
    frozenPlan.current = null
    setProgress({})
    setRunError(null)
    setNotes([])
    setFinished(null)
    setPinned(null)
    setPinnedReceipt(null)
    setDocKey(null)
    setReceiptId(null)
    setQ('')
    setTeamQ('')
    setStep(1)
    load()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loadError) return <Note tone="bad">{loadError}</Note>
  if (!data) {
    return <div className="flex items-center gap-2 text-sm" style={{ color: MUTED }}><Loader2 className="w-4 h-4 animate-spin" />Finding what is waiting for payment</div>
  }

  const header = step <= 4 && (
    <div>
    <ol className="grid grid-cols-4 gap-1.5 sm:gap-2" aria-label="Steps">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1
        const isAt = n === step
        const passed = n < step
        const reachable = !started_ && !running && (passed || (n > step && stepOk.slice(1, n).every(Boolean)))
        return (
          <li key={label}>
            <button type="button" disabled={!reachable} onClick={() => setStep(n)}
              aria-current={isAt ? 'step' : undefined}
              className="w-full text-left rounded-lg px-2 sm:px-3 py-2 transition disabled:cursor-default"
              style={{
                background: isAt ? 'hsl(var(--accent) / 0.14)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isAt ? ACCENT : LINE}`,
              }}>
              <span className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center rounded-full text-[11px] font-bold shrink-0"
                  style={{ width: 20, height: 20, background: passed ? '#22c55e' : isAt ? ACCENT : 'rgba(255,255,255,0.08)', color: '#fff' }}>
                  {passed ? <Check className="w-3 h-3" /> : n}
                </span>
                <span className="hidden sm:block text-xs font-semibold truncate" style={{ color: isAt ? '#fff' : MUTED }}>{label}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
    {/* Phones show the numbers only, so name the step being shown. */}
    <p className="sm:hidden text-xs font-semibold mt-2" style={{ color: MUTED }}>Step {step} of 4: {STEP_LABELS[step - 1]}</p>
    </div>
  )

  const summary = doc && step > 1 && step <= 4 && (
    <div className="rounded-xl p-3 flex items-center gap-3 flex-wrap" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${LINE}` }}>
      {doc.kind === 'quote' ? <FileSignature className="w-4 h-4" style={{ color: '#a855f7' }} /> : <Receipt className="w-4 h-4" style={{ color: '#3b82f6' }} />}
      <div className="flex-1 min-w-[160px]">
        <p className="text-sm text-white font-semibold">{client?.name || 'Unknown client'}</p>
        <p className="text-xs" style={{ color: MUTED }}>{doc.number || 'Draft invoice'} · {doc.detail}</p>
      </div>
      <p className="text-sm font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>{money(doc.owing)}</p>
    </div>
  )

  const nav = step >= 2 && step <= 3 && (
    <div className="flex items-center justify-between gap-2 pt-1">
      <button type="button" onClick={() => setStep(step - 1)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
        style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.75)', border: `1px solid ${LINE}` }}>
        <ChevronLeft className="w-4 h-4" />Back
      </button>
      <button type="button" onClick={() => setStep(step + 1)} disabled={!canNext}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
        style={{ background: grad, color: '#fff' }}>
        Next<ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )

  return (
    <div className="space-y-4 max-w-3xl">
      {header}
      {summary}

      {/* ── 1. What was paid ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: MUTED }}>
            Tap the quote or invoice the client paid. The amount, reference, team and months fill in from it, so
            there is nothing to look up in the bank.
          </p>

          {data.receipts.length > 0 && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.3)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: '#7dd3fc' }}>
                Already recorded on Payments, not yet put on an invoice
              </p>
              <div className="flex gap-2 flex-wrap">
                {data.receipts.map(r => {
                  const on = r.id === receiptId
                  return (
                    <button key={r.id} type="button" onClick={() => on ? setReceiptId(null) : pickReceipt(r)}
                      className="text-left rounded-lg px-3 py-2 text-xs transition"
                      style={{ background: on ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${on ? '#38bdf8' : LINE}`, color: '#fff' }}>
                      <span className="font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{money(r.unallocated_cents)}</span>
                      <span style={{ color: MUTED }}> · {niceDate(r.received_on)} · {clientOf(r.client_id)?.name || 'Not identified'}{r.reference ? ` · ${r.reference}` : ''}</span>
                    </button>
                  )
                })}
              </div>
              {receipt && (
                <p className="text-[11px] mt-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Using the {money(receipt.unallocated_cents)} from {niceDate(receipt.received_on)}. Now tap what it paid.
                </p>
              )}
            </div>
          )}

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <input value={q} onChange={e => setQ(e.target.value)} autoFocus spellCheck={false} autoComplete="off"
              placeholder="Client, quote or invoice number, the amount, or the bank reference"
              className={inputClass + ' pl-9 pr-9'} style={inputStyle} />
            {q && (
              <button type="button" onClick={() => setQ('')} aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10">
                <X className="w-3.5 h-3.5" style={{ color: FAINT }} />
              </button>
            )}
          </div>

          {docs.length === 0 ? (
            <Note tone="info">Nothing is waiting for payment. Quotes that are out or signed, and invoices still owing, appear here.</Note>
          ) : visible.length === 0 ? (
            <Note tone="info">Nothing matches &quot;{q}&quot;. Try the client&apos;s name or the amount.</Note>
          ) : (
            ([
              ['signed', 'Signed quotes'],
              ['invoice', 'Invoices waiting for payment'],
              ['unsigned', 'Quotes not signed yet'],
            ] as const).map(([g, title]) => {
              const rows = visible.filter(d => d.group === g)
              if (!rows.length) return null
              return (
                <div key={g}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: FAINT }}>{title}</p>
                  <div className="space-y-2">
                    {rows.map(d => {
                      const c = clientOf(d.clientId)
                      const same = !!receipt && receipt.unallocated_cents === d.owing
                      return (
                        <button key={d.key} type="button" onClick={() => { choose(d); setStep(2) }}
                          className="w-full text-left rounded-xl px-3 sm:px-4 py-3 flex items-center gap-3 transition hover:bg-white/[0.06]"
                          style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${same ? '#38bdf8' : LINE}` }}>
                          {d.kind === 'quote'
                            ? <FileSignature className="w-5 h-5 shrink-0" style={{ color: '#a855f7' }} />
                            : <Receipt className="w-5 h-5 shrink-0" style={{ color: '#3b82f6' }} />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{c?.name || 'Unknown client'}</p>
                            <p className="text-xs mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: MUTED }}>
                              <span className="font-mono">{d.number || 'Draft'}</span>
                              <Pill {...d.tag} />
                              {same && <Pill label="Same amount" colour="#38bdf8" />}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>{money(d.owing)}</p>
                            <p className="text-[11px]" style={{ color: FAINT }}>{d.invoice && d.invoice.paid_cents > 0 ? 'still owing' : 'to pay'}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: FAINT }} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── 2. The money ─────────────────────────────────────────────── */}
      {step === 2 && doc && (
        <div className="space-y-4">
          {clientReceipts.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-2">
              <Choice on={!receipt} onClick={() => setReceiptId(null)} icon={Banknote}
                title="A new payment" sub="Record what landed in the bank now." />
              <Choice on={!!receipt} onClick={() => setReceiptId(clientReceipts[0].id)} icon={Receipt}
                title="Already recorded" sub="It is on Payments but not on an invoice yet." />
            </div>
          )}

          {receipt ? (
            <div className="space-y-2">
              {clientReceipts.map(r => (
                <Choice key={r.id} on={r.id === receipt.id} onClick={() => setReceiptId(r.id)} icon={Banknote}
                  title={`${money(r.unallocated_cents)} from ${niceDate(r.received_on)}`}
                  sub={[clientOf(r.client_id)?.name || 'Not identified yet', r.reference, r.unallocated_cents !== r.amount_cents ? `${money(r.amount_cents)} received, part already allocated` : null].filter(Boolean).join(' · ')} />
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Amount received (R)" hint={`What ${doc.number || 'it'} ${doc.invoice && doc.invoice.paid_cents > 0 ? 'still owes' : 'is for'}: ${money(doc.owing)}`}>
                <input className={inputClass} style={inputStyle} inputMode="decimal" value={pay.amount}
                  onChange={e => setPay({ ...pay, amount: e.target.value })} />
              </Field>
              <Field label="Received on">
                <input type="date" className={inputClass} style={{ ...inputStyle, colorScheme: 'dark' }} value={pay.date} max={today()}
                  onChange={e => setPay({ ...pay, date: e.target.value })} />
              </Field>
              <Field label="Reference" hint="As it shows on the bank statement.">
                <input className={inputClass} style={inputStyle} value={pay.reference}
                  onChange={e => setPay({ ...pay, reference: e.target.value })} />
              </Field>
              <Field label="How it was paid">
                <select className={inputClass} style={inputStyle} value={pay.method}
                  onChange={e => setPay({ ...pay, method: e.target.value })}>
                  {METHODS.map(m => <option key={m.id} value={m.id} style={{ background: '#1a1a1a' }}>{m.label}</option>)}
                </select>
              </Field>
            </div>
          )}

          {amountCents > 0 && (
            fit.kind === 'full' ? <Note tone="good">Pays {doc.number || 'it'} in full.</Note>
            : fit.kind === 'short' ? (
              <Note tone="warn">
                Part payment: {money(fit.differenceCents)} will still be owing on {doc.number || 'it'}. A prepaid team only goes live
                once its invoice is paid in full.
              </Note>
            ) : (
              <Note tone="info">
                {money(fit.differenceCents)} more than it owes. {money(fit.allocateCents)} goes on {doc.number || 'it'} and the rest stays on
                {' '}{client?.name}&apos;s account as unapplied, ready for their next invoice.
              </Note>
            )
          )}
          {nav}
        </div>
      )}

      {/* ── 3. The team ──────────────────────────────────────────────── */}
      {step === 3 && doc && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-2">
            {linkedTeam && (
              <Choice on={team.mode === 'existing' && team.orgId === linkedTeam.id} icon={Building2}
                onClick={() => setTeam({ ...team, mode: 'existing', orgId: linkedTeam.id, seats: String(Math.max(linkedTeam.max_seats || 1, suggestion.seats || 0)) })}
                title={`Their team: ${linkedTeam.name}`} sub={`${linkedTeam.max_seats} seats, ${linkedTeam.business_plan_active ? 'live' : 'not live'}`} />
            )}
            <Choice on={team.mode === 'new'} onClick={() => setTeam({ ...team, mode: 'new', name: team.name || client?.name || '', seats: String(suggestion.seats || seatsN || 1) })}
              icon={UserPlus} title="Create a new team" sub="For a client who has not used Cardtly yet." />
            <Choice on={team.mode === 'existing' && team.orgId !== linkedTeam?.id} icon={Building2}
              onClick={() => setTeam({ ...team, mode: 'existing', orgId: team.orgId && team.orgId !== linkedTeam?.id ? team.orgId : '' })}
              title={linkedTeam ? 'A different team' : 'A team that already exists'} sub="They signed up before, or this adds to their team." />
            <Choice on={team.mode === 'none'} onClick={() => setTeam({ ...team, mode: 'none' })}
              icon={Ban} title="No team" sub="This payment is not for cards, e.g. NFC cards only." />
          </div>

          {team.mode === 'new' && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Company name">
                <input className={inputClass} style={inputStyle} value={team.name} onChange={e => setTeam({ ...team, name: e.target.value })} />
              </Field>
              <Field label="Owner's email" hint="They build the cards. Usually the person who signed the quote.">
                <input className={inputClass} style={inputStyle} type="email" value={team.email}
                  onChange={e => setTeam({ ...team, email: e.target.value })} />
              </Field>
              <Field label="Seats" hint={suggestion.seats ? `${suggestion.seats} on the ${doc.kind}` : undefined}>
                <input className={inputClass} style={inputStyle} type="number" min={1} value={team.seats}
                  onChange={e => setTeam({ ...team, seats: e.target.value })} />
              </Field>
              <div className="flex items-end">
                {ownerAccount ? (
                  <p className="text-[11px] pb-2" style={{ color: '#f59e0b' }}>
                    {team.email.trim()} already has a Cardtly login, so the team is linked to it. No password email is needed.
                  </p>
                ) : (
                  <label className="flex items-start gap-2 pb-2 cursor-pointer text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    <input type="checkbox" className="mt-0.5" checked={team.welcome} onChange={e => setTeam({ ...team, welcome: e.target.checked })} />
                    Email them a link to choose a password, so they can start on the cards
                  </label>
                )}
              </div>
              {ownerHasTeam && (
                <div className="sm:col-span-2">
                  <Note tone="warn">
                    {team.email.trim()} already owns the team <strong>{ownerHasTeam.name}</strong>. Saving a new team for them would rename
                    that one. <button type="button" className="underline font-semibold" style={{ color: '#fcd34d' }}
                      onClick={() => {
                        const t = data.teams.find(x => x.id === ownerHasTeam.id)
                        setTeam({ ...team, mode: 'existing', orgId: ownerHasTeam.id, seats: String(Math.max(t?.max_seats || 1, suggestion.seats || 0)) })
                      }}>Use {ownerHasTeam.name}</button>
                  </Note>
                </div>
              )}
            </div>
          )}

          {team.mode === 'existing' && team.orgId !== linkedTeam?.id && !chosenTeam && (
            <div>
              <input value={teamQ} onChange={e => setTeamQ(e.target.value)} placeholder="Search teams by name or owner"
                className={inputClass} style={inputStyle} />
              <div className="mt-2 rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
                {data.teams
                  .filter(t => matchesAllWords(teamQ, [t.name, orgs.find(o => o.id === t.id)?.adminEmail]))
                  .slice(0, 8)
                  .map(t => (
                    <button key={t.id} type="button"
                      onClick={() => { setTeam({ ...team, orgId: t.id, seats: String(Math.max(t.max_seats || 1, suggestion.seats || 0)) }); setTeamQ('') }}
                      className="w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 transition hover:bg-white/10"
                      style={{ color: 'rgba(255,255,255,0.8)', borderTop: `1px solid ${LINE}` }}>
                      <span className="truncate">{t.name}<span style={{ color: FAINT }}> · {orgs.find(o => o.id === t.id)?.adminEmail || 'owner unknown'}</span></span>
                      <span style={{ color: FAINT }}>{t.max_seats} seats</span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {team.mode === 'existing' && chosenTeam && (
            <div className="rounded-xl p-3 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${LINE}` }}>
              <div className="flex items-center gap-3 flex-wrap">
                <Building2 className="w-4 h-4" style={{ color: '#14b8a6' }} />
                <div className="flex-1 min-w-[160px]">
                  <p className="text-sm font-semibold text-white">{chosenTeam.name}</p>
                  <p className="text-xs" style={{ color: MUTED }}>
                    {BILLING_MODE_META[chosenTeam.billing_period as OrgBillingMode]?.label || chosenTeam.billing_period}
                    {' · '}{chosenOrgRow ? `${chosenOrgRow.cardsCreated} of ${chosenTeam.max_seats} seats used` : `${chosenTeam.max_seats} seats`}
                    {' · '}{chosenTeam.business_plan_active ? (chosenTeam.paid_until ? `live, paid until ${niceDate(chosenTeam.paid_until)}` : 'live') : 'not live yet'}
                  </p>
                </div>
                {chosenTeam.id !== linkedTeam?.id && (
                  <button type="button" onClick={() => setTeam({ ...team, orgId: '' })} className="text-xs underline" style={{ color: MUTED }}>Change</button>
                )}
              </div>
              {isReseller ? (
                <Note tone="warn">This team was sold by a reseller and is billed on the reseller&apos;s monthly invoice, so this payment cannot switch it on or add months.</Note>
              ) : monthsN > 0 && (
                <Field label="Seats" hint={seatsN !== chosenTeam.max_seats
                  ? `Changes from ${chosenTeam.max_seats}.${chosenOrgRow && seatsN < chosenOrgRow.cardsCreated ? ` They already have ${chosenOrgRow.cardsCreated} cards, so it cannot go below that.` : ''}`
                  : suggestion.seats && suggestion.seats !== chosenTeam.max_seats ? `${suggestion.seats} on the ${doc.kind}` : 'Unchanged'}>
                  <input className={inputClass} style={{ ...inputStyle, maxWidth: 140 }} type="number" min={1} value={team.seats}
                    onChange={e => setTeam({ ...team, seats: e.target.value })} />
                </Field>
              )}
              {client?.organization_id && client.organization_id !== chosenTeam.id && (
                <p className="text-[11px]" style={{ color: '#f59e0b' }}>
                  {client.name} is linked to {data.teams.find(t => t.id === client.organization_id)?.name || 'another team'} at the moment. This moves the link to {chosenTeam.name}.
                </p>
              )}
            </div>
          )}

          {team.mode !== 'none' && !isReseller && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(20,184,166,0.07)', border: '1px solid rgba(20,184,166,0.3)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>How long this payment covers</p>
              {applied ? (
                <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {doc.invoice?.prepaid_months} months, already added to the team on {niceDate(doc.invoice?.prepaid_applied_at)}.
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {MONTH_CHIPS.map(n => (
                      <button key={n} type="button" onClick={() => setMonths(String(n))}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: monthsN === n ? 'rgba(20,184,166,0.25)' : 'rgba(255,255,255,0.05)', color: monthsN === n ? '#5eead4' : 'rgba(255,255,255,0.65)' }}>
                        {n} {n === 1 ? 'month' : 'months'}
                      </button>
                    ))}
                    <input className={inputClass} style={{ ...inputStyle, width: 80 }} inputMode="numeric" placeholder="Other" aria-label="Months"
                      value={months} onChange={e => setMonths(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} />
                    {months && (
                      <button type="button" onClick={() => setMonths('')} className="text-[11px] underline" style={{ color: MUTED }}>None</button>
                    )}
                  </div>
                  <p className="text-[11px] mt-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {suggestion.months && suggestion.from ? `From ${suggestion.from} on the ${doc.kind}: ${suggestion.months} month${suggestion.months === 1 ? '' : 's'}. ` : ''}
                    {liveUntil
                      ? <>Once paid in full, the team is live until <strong className="text-white">{niceDate(liveUntil)}</strong>.</>
                      : 'No months: the money is recorded, but the team is not switched on or extended by it.'}
                  </p>
                </>
              )}
            </div>
          )}
          {nav}
        </div>
      )}

      {/* ── 4. Check and finish ──────────────────────────────────────── */}
      {step === 4 && doc && (
        <div className="space-y-4">
          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${LINE}` }}>
            <label className="flex items-center gap-2 text-sm cursor-pointer text-white">
              <input type="checkbox" checked={send.on} disabled={started_ || running}
                onChange={e => setSend({ ...send, on: e.target.checked })} />
              <Mail className="w-4 h-4" style={{ color: MUTED }} />
              Email the {fit.kind === 'short' ? '' : 'paid '}invoice to the client
            </label>
            {send.on && (
              <input className={inputClass + ' mt-2'} style={inputStyle} type="email" value={send.to} disabled={started_ || running}
                placeholder="accounts@client.co.za" onChange={e => setSend({ ...send, to: e.target.value })} />
            )}
            {send.on && !looksLikeEmail(send.to) && (
              <p className="text-[11px] mt-1" style={{ color: '#f59e0b' }}>Type an address, or untick this to skip the email.</p>
            )}
          </div>

          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
            <p className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: FAINT, background: 'rgba(255,255,255,0.02)' }}>
              This will, in this order
            </p>
            <ol>
              {(started_ && frozenPlan.current ? frozenPlan.current : plan).map((s, i) => {
                const st = progress[s] || 'todo'
                return (
                  <li key={s} className="flex items-start gap-3 px-4 py-3" style={{ borderTop: `1px solid ${LINE}` }}>
                    <span className="inline-flex items-center justify-center rounded-full text-[11px] font-bold shrink-0 mt-0.5"
                      style={{
                        width: 22, height: 22, color: '#fff',
                        background: st === 'done' ? '#22c55e' : st === 'failed' ? '#ef4444' : st === 'doing' ? ACCENT : 'rgba(255,255,255,0.08)',
                      }}>
                      {st === 'done' ? <Check className="w-3.5 h-3.5" /> : st === 'doing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : st === 'failed' ? <X className="w-3.5 h-3.5" /> : i + 1}
                    </span>
                    <span className="text-sm" style={{ color: st === 'done' ? 'rgba(255,255,255,0.6)' : '#fff' }}>{describe(s)}</span>
                  </li>
                )
              })}
            </ol>
          </div>

          {fit.kind === 'short'
            ? <Note tone="warn">Part payment: the invoice will be part paid with {money(fit.differenceCents)} still owing{liveUntil ? ', and the team goes live only once the rest is paid' : ''}.</Note>
            : liveUntil
              ? <Note tone="good">Then the invoice is paid and {team.mode === 'new' ? team.name.trim() : chosenTeam?.name} goes live until {niceDate(liveUntil)}.</Note>
              : <Note tone="info">Then the invoice is paid.{team.mode !== 'none' ? ' No months were given, so the team is not switched on or extended by this.' : ''}</Note>}
          {fit.kind === 'over' && <Note tone="info">{money(fit.differenceCents)} stays on {client?.name}&apos;s account as unapplied.</Note>}

          {runError && (
            <Note tone="bad">
              <strong>Stopped:</strong> {runError}
              {started_ && <span className="block mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>The ticked steps are done and will not be repeated. Fix the cause and press Try again to carry on from here.</span>}
            </Note>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button type="button" onClick={() => setStep(3)} disabled={started_ || running}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.75)', border: `1px solid ${LINE}` }}>
              <ChevronLeft className="w-4 h-4" />Back
            </button>
            <button type="button" onClick={runAll} disabled={running || !stepOk.every(Boolean) || (send.on && !looksLikeEmail(send.to))}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
              style={{ background: grad, color: '#fff' }}>
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : runError ? <RotateCcw className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              {running ? 'Working' : runError ? 'Try again' : 'Do all of this'}
            </button>
          </div>
        </div>
      )}

      {/* ── Done ─────────────────────────────────────────────────────── */}
      {step === 5 && doc && (() => {
        const orgId = ids.current.orgId || (team.mode === 'existing' ? team.orgId : null)
        const t = orgId ? finished?.teams.find(x => x.id === orgId) || null : null
        const invoiceId = ids.current.invoiceId || (doc.kind === 'invoice' ? doc.id : null)
        const number = ids.current.invoiceNumber || doc.number
        return (
          <div className="space-y-3">
            <div className="rounded-2xl p-5" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.35)' }}>
              <p className="flex items-center gap-2 text-base font-bold text-white"><Check className="w-5 h-5" style={{ color: '#22c55e' }} />Done</p>
              <ul className="mt-3 space-y-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                <li>{money(fit.allocateCents)} is on {number || 'the invoice'}{fit.kind === 'short' ? `, with ${money(fit.differenceCents)} still owing` : ', which is now paid'}.</li>
                {t && (
                  <li>
                    {t.name}: {t.max_seats} seats, {t.business_plan_active
                      ? <>live{t.paid_until ? <> until <strong className="text-white">{niceDate(t.paid_until)}</strong></> : ''}.</>
                      : 'not live yet. It goes live when its invoice is paid in full.'}
                  </li>
                )}
                {(frozenPlan.current || plan).includes('send_invoice') && <li>The invoice was emailed to {send.to.trim()}.</li>}
                {fit.kind === 'over' && <li>{money(fit.differenceCents)} stays on {client?.name}&apos;s account as unapplied.</li>}
              </ul>
              {notes.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {notes.map((n, i) => <p key={i} className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{n}</p>)}
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {invoiceId && (
                <a href={`/api/admin/billing/invoices/pdf?id=${invoiceId}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)', border: `1px solid ${LINE}` }}>
                  <FileText className="w-4 h-4" />Open the invoice
                </a>
              )}
              {t && (
                <button type="button" onClick={() => onOpen('teams')}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)', border: `1px solid ${LINE}` }}>
                  <Building2 className="w-4 h-4" />See the team
                </button>
              )}
              <button type="button" onClick={reset}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: grad, color: '#fff' }}>
                <Banknote className="w-4 h-4" />Another payment
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
