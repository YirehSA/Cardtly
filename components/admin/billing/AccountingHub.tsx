'use client'

import { useState, useEffect } from 'react'
import {
  FileSignature, Receipt, RefreshCw, Banknote, Contact, SlidersHorizontal,
  TrendingUp, AlertTriangle, Wallet, ArrowUpRight, Loader2, Check, Clock, Info,
} from 'lucide-react'
import { money } from './shared'

// The Accounting hub.
//
// It leads with money rather than with links. A grid that says "Invoices" and
// "Payments" is a menu; the same grid saying "R42 380 outstanding, R12 100 of
// it overdue" is the reason somebody opened the screen, and it answers the
// first question before they click anything.
//
// COLOUR IS A SECOND SIGNAL, NEVER THE ONLY ONE. Every block carries an icon
// and a written label as well as its hue, so it reads the same to somebody who
// cannot separate violet from blue. The figures are the hierarchy; the colour
// is what makes six destinations findable at a glance instead of scanned.
//
// Contrast is the constraint the whole palette is built inside: these hues sit
// on a near-black surface, so each one is used at full strength for a large
// figure or an icon, and the small print stays white at 55 to 75 percent.

export type BillingTab = 'quotes' | 'invoices' | 'recurring' | 'payments' | 'clients' | 'billing'

type Summary = {
  outstandingCents: number; overdueCents: number; overdueCount: number
  collectedThisMonthCents: number; unappliedCents: number
  invoices: { draftCount: number; openCount: number }
  quotes: { out: number; outValueCents: number; accepted: number; acceptedValueCents: number }
  recurring: { active: number; awaitingApproval: number }
  clients: number
}

/** One hue per destination, chosen to stay distinguishable at a glance and to
 *  clear 3:1 against the near-black surface at the sizes they are used. */
const HUES: Record<BillingTab, { base: string; label: string; icon: any }> = {
  quotes:    { base: '#a855f7', label: 'Quotes',    icon: FileSignature },
  invoices:  { base: '#3b82f6', label: 'Invoices',  icon: Receipt },
  recurring: { base: '#06b6d4', label: 'Recurring', icon: RefreshCw },
  payments:  { base: '#22c55e', label: 'Payments',  icon: Banknote },
  clients:   { base: '#f59e0b', label: 'Clients',   icon: Contact },
  billing:   { base: '#94a3b8', label: 'Settings',  icon: SlidersHorizontal },
}

/** What a note MEANS, in colour and in an icon. */
const TONES = {
  good: { bg: 'rgba(34,197,94,0.14)',  fg: '#86efac', border: 'rgba(34,197,94,0.34)',  Icon: Check },
  warn: { bg: 'rgba(245,158,11,0.14)', fg: '#fcd34d', border: 'rgba(245,158,11,0.34)', Icon: Clock },
  bad:  { bg: 'rgba(239,68,68,0.14)',  fg: '#fca5a5', border: 'rgba(239,68,68,0.32)',  Icon: AlertTriangle },
  info: { bg: 'rgba(56,189,248,0.13)', fg: '#7dd3fc', border: 'rgba(56,189,248,0.32)', Icon: Info },
} as const

export default function AccountingHub({ onOpen }: { onOpen: (tab: BillingTab) => void }) {
  const [s, setS] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/billing/summary')
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) { setErr(d?.error || 'Could not load the figures'); return }
        setS(d)
      })
      .catch(() => setErr('Could not load the figures'))
      .finally(() => setLoading(false))
  }, [])

  // A note's TONE, not just whether it is loud.
  //
  // The first version painted every note red with a warning triangle,
  // including "2 accepted, ready to invoice" - which is good news wearing the
  // costume of a problem. Money waiting to be invoiced and money three weeks
  // late are opposite facts and must not look the same.
  const blocks: Array<{
    tab: BillingTab; figure: string; caption: string
    note?: string; tone?: 'good' | 'warn' | 'bad' | 'info'
  }> = s ? [
    {
      tab: 'quotes',
      figure: s.quotes.out ? money(s.quotes.outValueCents) : '-',
      caption: s.quotes.out ? `${s.quotes.out} out with clients` : 'Nothing out',
      note: s.quotes.accepted ? `${s.quotes.accepted} accepted, ready to invoice` : undefined,
      tone: 'good' as const,
    },
    {
      tab: 'invoices',
      figure: money(s.outstandingCents),
      caption: s.invoices.openCount ? `${s.invoices.openCount} unpaid` : 'All settled',
      note: s.overdueCount ? `${s.overdueCount} overdue, ${money(s.overdueCents)}` : undefined,
      tone: 'bad' as const,
    },
    {
      tab: 'recurring',
      figure: String(s.recurring.active),
      caption: s.recurring.active === 1 ? 'schedule running' : 'schedules running',
      note: s.recurring.awaitingApproval ? `${s.recurring.awaitingApproval} waiting for approval` : undefined,
      tone: 'warn' as const,
    },
    {
      tab: 'payments',
      figure: money(s.collectedThisMonthCents),
      caption: 'received this month',
      note: s.unappliedCents ? `${money(s.unappliedCents)} not yet allocated` : undefined,
      tone: 'info' as const,
    },
    {
      tab: 'clients',
      figure: String(s.clients),
      caption: s.clients === 1 ? 'client on the books' : 'clients on the books',
      note: s.clients === 0 ? 'Add one to raise a quote' : undefined,
      tone: 'info' as const,
    },
    {
      tab: 'billing',
      figure: '',
      caption: 'Company details, banking, terms and chasing',
    },
  ] : []

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes hubIn { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
        .hub-in { animation: hubIn 320ms cubic-bezier(.2,.7,.3,1) both }
        .hub-card { transition: transform 180ms cubic-bezier(.2,.7,.3,1), box-shadow 180ms ease, border-color 180ms ease }
        .hub-card:hover { transform: translateY(-3px) }
        .hub-card:active { transform: translateY(-1px) scale(.995) }
        .hub-arrow { transition: transform 180ms cubic-bezier(.2,.7,.3,1), opacity 180ms ease }
        .hub-card:hover .hub-arrow { transform: translate(2px,-2px); opacity: 1 }
        /* Motion is decoration here, so it goes entirely when it is not wanted. */
        @media (prefers-reduced-motion: reduce) {
          .hub-in { animation: none }
          .hub-card, .hub-card:hover, .hub-card:active, .hub-arrow { transition: none; transform: none }
        }
      `}</style>

      {/* ── The three figures that decide the day ───────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { k: 'Owed to us', v: s ? money(s.outstandingCents) : null, c: '#f59e0b', I: Wallet,
            sub: s ? (s.invoices.openCount ? `across ${s.invoices.openCount} invoice${s.invoices.openCount === 1 ? '' : 's'}` : 'nothing outstanding') : '' },
          { k: 'Overdue', v: s ? money(s.overdueCents) : null, c: s?.overdueCents ? '#ef4444' : '#64748b', I: AlertTriangle,
            sub: s ? (s.overdueCount ? `${s.overdueCount} past its due date` : 'nothing late') : '' },
          { k: 'In this month', v: s ? money(s.collectedThisMonthCents) : null, c: '#22c55e', I: TrendingUp,
            sub: s ? (s.unappliedCents ? `${money(s.unappliedCents)} unallocated` : 'all allocated') : '' },
        ].map((h, i) => (
          <div key={h.k} className="hub-in rounded-2xl p-5 relative overflow-hidden"
            style={{
              animationDelay: `${i * 45}ms`,
              background: `linear-gradient(160deg, ${h.c}1a 0%, rgba(255,255,255,0.02) 55%)`,
              border: `1px solid ${h.c}33`,
            }}>
            <div aria-hidden className="absolute rounded-full pointer-events-none"
              style={{ width: 180, height: 180, top: -90, right: -60, background: `radial-gradient(circle, ${h.c}2e 0%, transparent 70%)` }} />
            <div className="flex items-center gap-2 relative">
              <h.I className="w-4 h-4" style={{ color: h.c }} />
              <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: h.c }}>{h.k}</span>
            </div>
            <p className="relative mt-2 text-3xl font-bold text-white tracking-tight"
              style={{ fontVariantNumeric: 'tabular-nums' }}>
              {h.v ?? <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>}
            </p>
            <p className="relative text-xs mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>{h.sub}</p>
          </div>
        ))}
      </div>

      {err && (
        <p className="text-sm" style={{ color: '#f59e0b' }}>{err}</p>
      )}
      {loading && (
        <p className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <Loader2 className="w-4 h-4 animate-spin" />Reading the books
        </p>
      )}

      {/* ── The six places to go ────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {blocks.map((b, i) => {
          const hue = HUES[b.tab]
          const Icon = hue.icon
          return (
            <button key={b.tab} onClick={() => onOpen(b.tab)}
              aria-label={`${hue.label}. ${b.figure ? b.figure + ' ' : ''}${b.caption}${b.note ? '. ' + b.note : ''}`}
              className="hub-in hub-card text-left rounded-2xl p-5 relative overflow-hidden group"
              style={{
                animationDelay: `${140 + i * 45}ms`,
                background: `linear-gradient(155deg, ${hue.base}16 0%, rgba(255,255,255,0.025) 60%)`,
                border: `1px solid ${hue.base}30`,
                minHeight: 148,
              }}>
              <div aria-hidden className="absolute rounded-full pointer-events-none"
                style={{ width: 200, height: 200, bottom: -120, right: -70, background: `radial-gradient(circle, ${hue.base}26 0%, transparent 70%)` }} />

              <div className="relative flex items-start justify-between">
                <span className="inline-flex items-center justify-center rounded-xl"
                  style={{ width: 38, height: 38, background: `${hue.base}22`, border: `1px solid ${hue.base}44` }}>
                  <Icon className="w-[18px] h-[18px]" style={{ color: hue.base }} />
                </span>
                <ArrowUpRight className="hub-arrow w-4 h-4" style={{ color: hue.base, opacity: 0.5 }} />
              </div>

              <p className="relative mt-3 text-[13px] font-bold uppercase tracking-[0.12em]" style={{ color: hue.base }}>
                {hue.label}
              </p>

              {b.figure ? (
                <p className="relative mt-1 text-2xl font-bold text-white tracking-tight"
                  style={{ fontVariantNumeric: 'tabular-nums' }}>{b.figure}</p>
              ) : null}

              <p className="relative text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{b.caption}</p>

              {b.note && (() => {
                // Each tone gets its own icon as well as its own colour, so the
                // difference between "ready to invoice" and "three weeks late"
                // survives for anybody who cannot separate green from red.
                const T = TONES[b.tone || 'info']
                return (
                  <p className="relative text-[11px] mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg font-semibold"
                    style={{ background: T.bg, color: T.fg, border: `1px solid ${T.border}` }}>
                    <T.Icon className="w-3 h-3" />
                    {b.note}
                  </p>
                )
              })()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
