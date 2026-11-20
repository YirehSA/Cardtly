'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Check, ArrowRight, Zap, Building2, User, Users, LayoutTemplate, Target, BarChart3, Sparkles,
} from 'lucide-react'
import PriceEstimate, { RandChargeNote } from './PriceEstimate'

// The four plans on /pricing, redesigned (Andre, 2026-11-20: "Its long. Maybe
// just make it easier. Still showing everything but maybe 2 next to each
// other"). Two rows of two: Solo and Pro for one person, Teams and Enterprise
// for a company. One Monthly / Yearly switch drives every price, each card's
// button sits by its price, and features run in two columns, with Pro's
// grouped by what they do for you.
//
// Figures arrive as props from the page, which reads them from lib/plan-prices
// and lib/org-billing. Nothing is derived at module scope: a 'use client'
// module's top level runs through the server bundle before its imports are
// live (see PlanPrice).

type GroupIcon = 'card' | 'leads' | 'insight' | 'brand'

export interface PricingPlansProps {
  solo: { monthly: number; yearly: number; features: string[] }
  pro: { monthly: number; yearly: number; groups: Array<{ icon: GroupIcon; title: string; items: string[] }> }
  teams: { seatMonthly: number; seatYearly: number; maxSeats: number; features: string[] }
  enterprise: { fromSeats: number; features: string[] }
}

const GROUP_ICON = { card: LayoutTemplate, leads: Target, insight: BarChart3, brand: Sparkles } as const

const MINT = '#34d399'
const LILAC = '#a78bfa'
const INK = 'rgba(255,255,255,0.92)'
const BODY = 'rgba(255,255,255,0.7)'
const DIM = 'rgba(255,255,255,0.6)'
const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

const pct = (monthly: number, yearly: number) => Math.round(((monthly * 12 - yearly) / (monthly * 12)) * 100)

export default function PricingPlans({ solo, pro, teams, enterprise }: PricingPlansProps) {
  const [yearly, setYearly] = useState(false)
  const best = Math.max(pct(solo.monthly, solo.yearly), pct(pro.monthly, pro.yearly), pct(teams.seatMonthly, teams.seatYearly))

  return (
    <section className="relative py-16 lg:py-20 px-4 sm:px-6" aria-labelledby="plans-title">
      <div className="absolute inset-x-0 top-24 mx-auto h-[520px] max-w-5xl rounded-full blur-[140px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.14), rgba(0,212,255,0.05) 45%, transparent 70%)' }} />

      <div className="relative mx-auto max-w-6xl">
        {/* Heading and the one switch */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
          <div className="text-center lg:text-left">
            <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#ec4899' }}>Plans</p>
            <h2 id="plans-title" className="font-black tracking-[-0.02em] leading-[1.05]" style={{ fontSize: 'clamp(2rem, 3.4vw, 3rem)' }}>
              Pick the plan that fits.
            </h2>
            <p className="mt-3 text-base max-w-xl mx-auto lg:mx-0" style={{ color: BODY }}>
              Your own link for good, nothing to install for the people you meet, and cancel any time.
            </p>
          </div>
          <BillingSwitch yearly={yearly} onChange={setYearly} best={best} />
        </div>

        {/* Just you */}
        <RowLabel icon={User} title="Just you" note="Start on Solo and move up to Pro whenever you like." />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-14">
          <SoloCard {...solo} isYearly={yearly} />
          <ProCard {...pro} isYearly={yearly} />
        </div>

        {/* Your team */}
        <RowLabel icon={Users} title="Your team" note={`From 2 people to the whole company, on one invoice.`} />
        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-5">
          <TeamsCard {...teams} isYearly={yearly} />
          <EnterpriseCard {...enterprise} />
        </div>
      </div>
    </section>
  )
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function BillingSwitch({ yearly, onChange, best }: { yearly: boolean; onChange: (v: boolean) => void; best: number }) {
  return (
    <div className="flex flex-col items-center lg:items-end gap-2">
      <div role="group" aria-label="Billing period"
        className="relative inline-grid grid-cols-2 p-1 rounded-full"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        {/* The sliding thumb behind whichever is chosen. */}
        <span aria-hidden="true"
          className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full motion-safe:transition-transform motion-safe:duration-300"
          style={{ background: grad, boxShadow: '0 6px 24px rgba(124,58,237,0.45)', transform: yearly ? 'translateX(100%)' : 'translateX(0)' }} />
        {([false, true] as const).map(y => (
          <button key={String(y)} type="button" onClick={() => onChange(y)} aria-pressed={yearly === y}
            className="relative z-10 min-h-11 px-6 sm:px-8 rounded-full text-sm font-bold transition-colors"
            style={{ color: yearly === y ? '#fff' : 'rgba(255,255,255,0.7)' }}>
            {y ? 'Yearly' : 'Monthly'}
          </button>
        ))}
      </div>
      <p className="text-xs font-semibold" style={{ color: MINT }}>Pay yearly and save up to {best}%</p>
    </div>
  )
}

function RowLabel({ icon: Icon, title, note }: { icon: typeof User; title: string; note: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="w-9 h-9 rounded-xl grid place-items-center flex-shrink-0"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <Icon className="w-4 h-4" style={{ color: INK }} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight">{title}</p>
        <p className="text-sm" style={{ color: DIM }}>{note}</p>
      </div>
      <span className="hidden sm:block flex-1 h-px ml-2" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.14), transparent)' }} />
    </div>
  )
}

/** A card with a gradient border: the wrapper is the border, the inside the card. */
function Frame({ border, background, glow, children, id, className = '' }: {
  border: string; background: string; glow?: string; children: React.ReactNode; id?: string; className?: string
}) {
  return (
    <div id={id} className={`relative rounded-[28px] p-px lift-card scroll-mt-24 ${className}`}
      style={{ background: border, boxShadow: glow }}>
      <div className="relative h-full rounded-[27px] p-6 sm:p-8 overflow-hidden flex flex-col" style={{ background }}>
        {children}
      </div>
    </div>
  )
}

function Badge({ children, tone, dot = true }: { children: React.ReactNode; tone: string; dot?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: tone }}>
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone }} />}{children}
    </span>
  )
}

/** The big number. Keyed on the figure so it replays its entrance when the
 *  switch changes it. */
function Price({ amount, prefix, suffix, zar, estimateSuffix }: {
  amount: string; prefix?: string; suffix: string; zar: number; estimateSuffix: string
}) {
  return (
    <div>
      <div className="flex items-end gap-2 flex-wrap">
        {prefix && <span className="text-base pb-2" style={{ color: DIM }}>{prefix}</span>}
        <span key={amount} className="motion-safe:animate-fade-up text-5xl sm:text-6xl font-black tracking-tight leading-none">{amount}</span>
        <span className="text-base pb-1" style={{ color: DIM }}>{suffix}</span>
      </div>
      <PriceEstimate zar={zar} suffix={estimateSuffix} className="block text-sm font-medium mt-2 text-white/70" />
      <RandChargeNote className="block text-xs mt-0.5 text-white/60" />
    </div>
  )
}

function Cta({ href, children, solid, tone }: { href: string; children: React.ReactNode; solid?: boolean; tone?: string }) {
  return (
    <Link href={href}
      className="group inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-12 px-6 rounded-2xl text-sm font-bold whitespace-nowrap transition hover:scale-[1.02] active:scale-[0.99]"
      style={solid
        ? { background: grad, color: '#fff', boxShadow: '0 10px 36px rgba(124,58,237,0.45)' }
        : { border: `1px solid ${tone || 'rgba(255,255,255,0.22)'}`, color: INK, background: 'rgba(255,255,255,0.03)' }}>
      {children}
      <ArrowRight className="w-4 h-4 motion-safe:transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  )
}

function Feature({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm leading-snug" style={{ color: BODY }}>
      <span className="mt-0.5 w-4 h-4 rounded-full grid place-items-center flex-shrink-0" style={{ background: `${tone}22` }}>
        <Check className="w-2.5 h-2.5" style={{ color: tone }} strokeWidth={3.5} aria-hidden="true" />
      </span>
      <span>{children}</span>
    </li>
  )
}

function YearNote({ yearly, monthly, perYear, unit = '' }: { yearly: boolean; monthly: number; perYear: number; unit?: string }) {
  const saving = monthly * 12 - perYear
  return (
    <p className="text-xs mt-2 min-h-[1rem]" style={{ color: yearly ? MINT : DIM }}>
      {yearly
        ? `About R${Math.round(perYear / 12)}${unit} a month, R${saving}${unit} less than monthly`
        : `Or R${perYear}${unit} a year, and save R${saving}${unit}`}
    </p>
  )
}

// ── The four plans ──────────────────────────────────────────────────────────

function SoloCard({ monthly, yearly: perYear, features, isYearly: yearly }: PricingPlansProps['solo'] & { isYearly: boolean }) {
  return (
    <Frame id="solo"
      border="linear-gradient(160deg, rgba(52,211,153,0.55), rgba(52,211,153,0.08) 55%, rgba(255,255,255,0.06))"
      background="linear-gradient(180deg, #06140f 0%, #050807 60%)">
      <div className="absolute -top-24 -right-16 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(52,211,153,0.12)' }} />
      <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
        <div>
          <Badge tone={MINT}>Solo</Badge>
          <p className="mt-2 text-sm max-w-xs" style={{ color: BODY }}>Your own card, done properly. One person, one card.</p>
        </div>
      </div>
      <div className="relative mt-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
        <div>
          <Price amount={`R${yearly ? perYear : monthly}`} suffix={yearly ? '/ year' : '/ month'} zar={yearly ? perYear : monthly} estimateSuffix={yearly ? '/yr' : '/mo'} />
          <YearNote yearly={yearly} monthly={monthly} perYear={perYear} />
        </div>
        <Cta href="/signup?plan=solo" tone="rgba(52,211,153,0.55)">Choose Solo</Cta>
      </div>

      <div className="relative my-6 h-px" style={{ background: 'linear-gradient(90deg, rgba(52,211,153,0.35), rgba(255,255,255,0.06))' }} />

      <ul className="relative grid sm:grid-cols-2 content-start gap-x-6 gap-y-3 flex-1">
        {features.map(f => <Feature key={f} tone={MINT}>{f}</Feature>)}
      </ul>
      {/* R49 a month is R1.63 a day. */}
      <div className="relative mt-6 flex flex-wrap gap-2">
        {['Under R2 a day', 'Billed in rand', 'Cancel any time'].map(t => (
          <span key={t} className="px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: MINT }}>{t}</span>
        ))}
      </div>
      <Link href="/solo" className="relative mt-6 inline-flex items-center gap-1.5 self-start min-h-11 text-sm font-semibold transition hover:text-white" style={{ color: MINT }}>
        More about Solo <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
      </Link>
    </Frame>
  )
}

function ProCard({ monthly, yearly: perYear, groups, isYearly: yearly }: PricingPlansProps['pro'] & { isYearly: boolean }) {
  return (
    <Frame
      border="linear-gradient(160deg, rgba(167,139,250,0.75), rgba(124,58,237,0.25) 50%, rgba(236,72,153,0.35))"
      background="linear-gradient(180deg, #0f0a1c 0%, #07060b 65%)"
      glow="0 20px 70px -20px rgba(124,58,237,0.45)">
      <div className="absolute -top-28 -right-20 w-72 h-72 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(124,58,237,0.2)' }} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <Badge tone={LILAC}>Pro</Badge>
          <p className="mt-2 text-sm max-w-xs" style={{ color: BODY }}>Everything Cardtly does, for one person.</p>
        </div>
        <span className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
          <Zap className="w-3 h-3" aria-hidden="true" />Every feature
        </span>
      </div>
      <div className="relative mt-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
        <div>
          <Price amount={`R${yearly ? perYear : monthly}`} suffix={yearly ? '/ year' : '/ month'} zar={yearly ? perYear : monthly} estimateSuffix={yearly ? '/yr' : '/mo'} />
          <YearNote yearly={yearly} monthly={monthly} perYear={perYear} />
        </div>
        <Cta href="/signup?plan=pro" solid>Choose Pro</Cta>
      </div>

      <div className="relative my-6 h-px" style={{ background: 'linear-gradient(90deg, rgba(167,139,250,0.4), rgba(255,255,255,0.06))' }} />

      <p className="relative text-[11px] font-bold uppercase tracking-[0.16em] mb-4" style={{ color: DIM }}>Everything in Solo, plus</p>
      <div className="relative grid sm:grid-cols-2 gap-3 flex-1">
        {groups.map(g => {
          const Icon = GROUP_ICON[g.icon]
          return (
            <div key={g.title} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="flex items-center gap-2 text-sm font-bold mb-2.5" style={{ color: INK }}>
                <span className="w-6 h-6 rounded-lg grid place-items-center" style={{ background: 'rgba(167,139,250,0.16)' }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: LILAC }} aria-hidden="true" />
                </span>
                {g.title}
              </p>
              <ul className="space-y-2">
                {g.items.map(i => <Feature key={i} tone={LILAC}>{i}</Feature>)}
              </ul>
            </div>
          )
        })}
      </div>
    </Frame>
  )
}

function TeamsCard({ seatMonthly, seatYearly, maxSeats, features, isYearly: yearly }: PricingPlansProps['teams'] & { isYearly: boolean }) {
  return (
    <Frame
      border="linear-gradient(135deg, #00d4ff, #7c3aed 50%, #ec4899)"
      background="linear-gradient(150deg, #071521 0%, #110a22 45%, #1a0816 100%)"
      glow="0 24px 80px -24px rgba(124,58,237,0.55)">
      <div className="absolute -bottom-24 -left-20 w-80 h-80 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(0,212,255,0.1)' }} />
      <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(236,72,153,0.14)' }} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <Badge tone={LILAC}>Teams</Badge>
          <p className="mt-2 text-sm max-w-sm" style={{ color: BODY }}>2 to {maxSeats} seats, every one on Pro. Set it up yourself in minutes.</p>
        </div>
        <span className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
          <Zap className="w-3 h-3" aria-hidden="true" />Most popular
        </span>
      </div>
      <div className="relative mt-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
        <div>
          <Price prefix="From" amount={`R${yearly ? seatYearly : seatMonthly}`} suffix={yearly ? '/ seat / year' : '/ seat / month'}
            zar={yearly ? seatYearly : seatMonthly} estimateSuffix={yearly ? '/seat/yr' : '/seat/mo'} />
          <YearNote yearly={yearly} monthly={seatMonthly} perYear={seatYearly} unit=" a seat" />
        </div>
        <Cta href="/dashboard/team" solid>Set up your team</Cta>
      </div>

      <div className="relative my-6 h-px" style={{ background: 'linear-gradient(90deg, rgba(0,212,255,0.4), rgba(236,72,153,0.25), transparent)' }} />

      <ul className="relative grid sm:grid-cols-2 content-start gap-x-6 gap-y-3 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2.5 text-sm leading-snug" style={{ color: INK }}>
            <span className="mt-0.5 w-4 h-4 rounded-full grid place-items-center flex-shrink-0" style={{ background: grad }}>
              <Check className="w-2.5 h-2.5 text-white" strokeWidth={3.5} aria-hidden="true" />
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </Frame>
  )
}

function EnterpriseCard({ fromSeats, features }: PricingPlansProps['enterprise']) {
  return (
    <Frame
      border="linear-gradient(160deg, rgba(255,255,255,0.22), rgba(255,255,255,0.05) 60%)"
      background="linear-gradient(180deg, #0b0b0e 0%, #060607 70%)">
      <div className="relative">
        <Badge tone="rgba(255,255,255,0.75)" dot={false}><Building2 className="w-3.5 h-3.5 -ml-0.5" aria-hidden="true" />Enterprise</Badge>
        <p className="mt-2 text-sm" style={{ color: BODY }}>For the whole company, quoted on your seat count.</p>
      </div>
      <div className="relative mt-5">
        <div className="flex items-end gap-2">
          <span className="text-5xl sm:text-6xl font-black tracking-tight leading-none">{fromSeats}+</span>
          <span className="text-base pb-1" style={{ color: DIM }}>seats</span>
        </div>
        <p className="text-xs mt-2" style={{ color: DIM }}>Billed by debit order, not by card.</p>
      </div>

      <div className="relative my-6 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.18), transparent)' }} />

      <ul className="relative space-y-3 flex-1">
        {features.map(f => <Feature key={f} tone="#e2e8f0">{f}</Feature>)}
      </ul>
      <div className="relative mt-6">
        <Cta href="/contact">Talk to us</Cta>
      </div>
    </Frame>
  )
}
