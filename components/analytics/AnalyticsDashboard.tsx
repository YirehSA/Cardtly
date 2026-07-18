'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { parseDesign, getAccentHex } from '@/types/design'
import {
  Eye, Users, TrendingUp, TrendingDown, Minus, Smartphone, Monitor,
  Tablet, Globe, QrCode, ArrowUpRight, BarChart3, MousePointerClick, UserPlus,
} from 'lucide-react'

interface EventRow {
  event_type: string
  link_title: string | null
  device: string | null
  browser: string | null
  os: string | null
  referrer: string | null
  created_at: string
}

interface Props {
  card: { name: string; slug: string; colorTheme: string | null; totalViews: number }
  isTeam: boolean
  events: EventRow[]
  contactDates: string[]
}

type Period = 7 | 30 | 90

const PERIODS: { label: string; value: Period }[] = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
]

// Bucket by LOCAL date. Grouping on the raw ISO string put anything before
// 02:00 South African time into the previous day, which quietly shifted a
// chunk of every evening's activity onto the wrong bar.
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfLocalDay(offsetDays: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - offsetDays)
  return d
}

// Everything that arrives without a referring site: a QR scan, an NFC tap, a
// typed link, a reload. Our own domain lands here too, since a self-referral
// means "they opened the link" rather than "they came from cardtly.com". Named
// once because the source panel splits this bucket back apart using the ?s=
// markers the QR and NFC tag carry.
const DIRECT_BUCKET = 'Direct link, QR or NFC'

function sourceLabel(referrer: string | null): string {
  if (!referrer) return DIRECT_BUCKET
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase()
    if (host.endsWith('cardtly.com') || host === 'localhost') return DIRECT_BUCKET
    if (host.includes('whatsapp')) return 'WhatsApp'
    if (host.includes('facebook') || host.includes('fb.')) return 'Facebook'
    if (host.includes('instagram')) return 'Instagram'
    if (host.includes('linkedin') || host.includes('lnkd.')) return 'LinkedIn'
    if (host.includes('google')) return 'Google'
    if (host === 't.co' || host.includes('twitter') || host === 'x.com') return 'X'
    if (host.includes('tiktok')) return 'TikTok'
    if (host.includes('mail') || host.includes('outlook')) return 'Email'
    return host
  } catch {
    return DIRECT_BUCKET
  }
}

function countBy<T>(rows: T[], pick: (r: T) => string | null): { key: string; count: number }[] {
  const m = new Map<string, number>()
  for (const r of rows) {
    const k = pick(r)
    if (k) m.set(k, (m.get(k) || 0) + 1)
  }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)
}

function Trend({ now, prev, days }: { now: number; prev: number; days: number }) {
  if (prev === 0 && now === 0) {
    return <span className="text-[11px] text-muted-foreground">No activity yet</span>
  }
  if (prev === 0) {
    return <span className="text-[11px] font-medium text-green-500">New this period</span>
  }
  const pct = Math.round(((now - prev) / prev) * 100)
  const flat = pct === 0
  const up = pct > 0
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown
  const tone = flat ? 'text-muted-foreground' : up ? 'text-green-500' : 'text-red-500'
  return (
    <span className={`text-[11px] font-medium flex items-center gap-1 ${tone}`}>
      <Icon className="w-3 h-3" />
      {flat ? 'Same as' : `${up ? '+' : ''}${pct}% vs`} the previous {days} days
    </span>
  )
}

function Bars({ rows, total, colour }: { rows: { key: string; count: number }[]; total: number; colour: string }) {
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">Nothing yet</p>
  return (
    <div className="space-y-3">
      {rows.slice(0, 5).map(({ key, count }) => {
        const pct = total ? Math.round((count / total) * 100) : 0
        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-1 gap-2">
              {/* No capitalize here: these labels are already written the way
                  they should read, and title-casing turned "Direct link, QR or
                  NFC" into "Direct Link, QR Or NFC". */}
              <span className="text-xs font-medium truncate">{key}</span>
              <span className="text-xs text-muted-foreground shrink-0">{pct}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colour }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function AnalyticsDashboard({ card, isTeam, events, contactDates }: Props) {
  const [period, setPeriod] = useState<Period>(30)
  const accent = useMemo(() => getAccentHex(parseDesign(card.colorTheme)), [card.colorTheme])

  const stats = useMemo(() => {
    const startNow = startOfLocalDay(period - 1).getTime()
    const startPrev = startOfLocalDay(period * 2 - 1).getTime()

    const inNow = <T extends { created_at: string }>(r: T) => new Date(r.created_at).getTime() >= startNow
    const inPrev = <T extends { created_at: string }>(r: T) => {
      const t = new Date(r.created_at).getTime()
      return t >= startPrev && t < startNow
    }

    const viewsAll = events.filter(e => e.event_type === 'view')
    const sharesAll = events.filter(e => e.event_type === 'share')
    const clicksAll = events.filter(e => e.event_type === 'link_click')
    const savesAll = events.filter(e => e.event_type === 'contact_save')
    const qrAll = events.filter(e => e.event_type === 'qr_scan')
    const nfcAll = events.filter(e => e.event_type === 'nfc_tap')
    const contacts = contactDates.map(created_at => ({ created_at }))

    const views = viewsAll.filter(inNow)
    const prevViews = viewsAll.filter(inPrev).length
    const shares = sharesAll.filter(inNow).length
    const prevShares = sharesAll.filter(inPrev).length
    const clicks = clicksAll.filter(inNow)
    const prevClicks = clicksAll.filter(inPrev).length
    const saves = savesAll.filter(inNow).length
    const prevSaves = savesAll.filter(inPrev).length
    const leads = contacts.filter(inNow).length
    const prevLeads = contacts.filter(inPrev).length
    const qrScans = qrAll.filter(inNow).length
    const nfcTaps = nfcAll.filter(inNow).length

    // One bar per day in the window, in local time.
    const dayMap = new Map<string, number>()
    for (let i = period - 1; i >= 0; i--) dayMap.set(dayKey(startOfLocalDay(i)), 0)
    for (const v of views) {
      const k = dayKey(new Date(v.created_at))
      if (dayMap.has(k)) dayMap.set(k, dayMap.get(k)! + 1)
    }
    const byDay = [...dayMap.entries()].map(([date, count]) => ({ date, count }))
    const peak = byDay.reduce((best, d) => (d.count > best.count ? d : best), { date: '', count: 0 })

    return {
      views: views.length, prevViews,
      shares, prevShares,
      clicks: clicks.length, prevClicks,
      saves, prevSaves,
      leads, prevLeads,
      topLinks: countBy(clicks, c => c.link_title),
      byDay, peak,
      byDevice: countBy(views, v => v.device),
      byBrowser: countBy(views, v => v.browser),
      // A scan or a tap arrives with no referring site, so both land in the
      // untagged bucket. Pull them back out using the markers the QR and NFC
      // tag carry, and only rename what is left when there was something to
      // separate - older opens genuinely cannot be told apart.
      bySource: (() => {
        const raw = countBy(views, v => sourceLabel(v.referrer))
        const split = qrScans + nfcTaps
        const out: { key: string; count: number }[] = []
        for (const row of raw) {
          if (row.key !== DIRECT_BUCKET) { out.push(row); continue }
          if (qrScans) out.push({ key: 'QR code scan', count: qrScans })
          if (nfcTaps) out.push({ key: 'NFC card tap', count: nfcTaps })
          const rest = Math.max(0, row.count - split)
          if (rest) out.push({ key: split > 0 ? 'Other direct opens' : DIRECT_BUCKET, count: rest })
        }
        return out.sort((a, b) => b.count - a.count)
      })(),
    }
  }, [events, contactDates, period])

  const maxDay = Math.max(...stats.byDay.map(d => d.count), 1)
  const prettyDate = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })

  const HEADLINE = [
    { label: 'Times your card was opened', value: stats.views, prev: stats.prevViews, icon: Eye, colour: accent },
    { label: 'Buttons and links tapped', value: stats.clicks, prev: stats.prevClicks, icon: MousePointerClick, colour: '#8b5cf6' },
    { label: 'Saved your contact', value: stats.saves, prev: stats.prevSaves, icon: UserPlus, colour: '#10b981' },
    { label: 'People who left their details', value: stats.leads, prev: stats.prevLeads, icon: Users, colour: '#f59e0b' },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="rounded-3xl border border-border overflow-hidden">
        <div className="p-6 sm:p-8" style={{ background: `linear-gradient(135deg, ${accent}1f, transparent 65%)` }}>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl grid place-items-center text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold leading-tight">How your card is doing</h1>
                <p className="text-muted-foreground text-sm">
                  {card.name}
                  {isTeam && <span className="ml-2 text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
                    style={{ background: accent + '20', color: accent }}>Team</span>}
                </p>
              </div>
            </div>
            <div className="flex gap-1 bg-muted p-1 rounded-2xl">
              {PERIODS.map(p => (
                <button key={p.value} onClick={() => setPeriod(p.value)}
                  className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition ${period === p.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {HEADLINE.map(({ label, value, prev, icon: Icon, colour }) => (
          <div key={label} className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-2xl grid place-items-center" style={{ background: colour + '18' }}>
                <Icon className="w-5 h-5" style={{ color: colour }} />
              </div>
            </div>
            <p className="text-3xl font-black tracking-tight" style={{ color: colour }}>{value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1 mb-2">{label}</p>
            <Trend now={value} prev={prev} days={period} />
          </div>
        ))}
      </div>

      {stats.views === 0 ? (
        /* Nothing to show yet - say what to do about it rather than "no data". */
        <div className="rounded-3xl border border-border bg-card p-10 text-center">
          <div className="w-14 h-14 rounded-3xl grid place-items-center mx-auto mb-4"
            style={{ background: accent + '18' }}>
            <TrendingUp className="w-6 h-6" style={{ color: accent }} />
          </div>
          <p className="font-semibold mb-1">Nobody has opened your card in this period</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
            As soon as someone opens your link, you will see when they did it, what they used and how they found you.
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Link href="/dashboard/qr"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: accent }}>
              <QrCode className="w-4 h-4" /> Get my QR code
            </Link>
            {card.slug && (
              <a href={`/card/${card.slug}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-muted transition">
                Open my card <ArrowUpRight className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* When people opened it */}
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-start justify-between flex-wrap gap-2 mb-5">
              <div>
                <h2 className="font-semibold text-sm">When people opened it</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stats.peak.count > 0
                    ? `Busiest day was ${prettyDate(stats.peak.date)}, with ${stats.peak.count} ${stats.peak.count === 1 ? 'open' : 'opens'}.`
                    : 'One bar per day.'}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {stats.views.toLocaleString()} opens
                {stats.shares > 0 && ` · shared ${stats.shares}×`}
              </span>
            </div>

            <div className="flex items-end gap-[2px] h-36">
              {stats.byDay.map(day => {
                const h = (day.count / maxDay) * 100
                const isPeak = day.count === stats.peak.count && day.count > 0
                return (
                  <div key={day.date} className="flex-1 h-full flex items-end"
                    title={`${prettyDate(day.date)}: ${day.count} ${day.count === 1 ? 'open' : 'opens'}`}>
                    <div className="w-full rounded-t-sm transition-all"
                      style={{
                        height: `${Math.max(h, day.count > 0 ? 3 : 0)}%`,
                        background: isPeak ? accent : accent + '66',
                      }} />
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between mt-2 text-[11px] text-muted-foreground">
              <span>{prettyDate(stats.byDay[0]?.date || '')}</span>
              <span>{prettyDate(stats.byDay[stats.byDay.length - 1]?.date || '')}</span>
            </div>
          </div>

          {/* What they tapped. Only appears once there is something to show,
              rather than sitting there as a permanent row of zeros. */}
          {stats.topLinks.length > 0 && (
            <div className="rounded-3xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-1">
                <MousePointerClick className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">What they tapped most</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Which of your buttons and links people actually used.
              </p>
              <div className="space-y-3">
                {stats.topLinks.slice(0, 6).map(({ key, count }, i) => {
                  const pct = Math.round((count / stats.topLinks[0].count) * 100)
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <span className="text-sm font-medium truncate">{key}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {count} {count === 1 ? 'tap' : 'taps'}
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#8b5cf6' }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* How they found you + what they used */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-3xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">How they found you</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Where people were just before they opened your card.
              </p>
              <Bars rows={stats.bySource} total={stats.views} colour={accent} />
            </div>

            <div className="rounded-3xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-1">
                <Smartphone className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">What they opened it on</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Worth knowing your card looks right on whatever they use.
              </p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {(['mobile', 'desktop', 'tablet'] as const).map(kind => {
                  const found = stats.byDevice.find(d => d.key === kind)
                  const pct = stats.views ? Math.round(((found?.count || 0) / stats.views) * 100) : 0
                  const Icon = kind === 'mobile' ? Smartphone : kind === 'tablet' ? Tablet : Monitor
                  const nice = kind === 'mobile' ? 'Phone' : kind === 'desktop' ? 'Computer' : 'Tablet'
                  return (
                    <div key={kind} className="rounded-2xl bg-muted/50 p-3 text-center">
                      <Icon className="w-4 h-4 mx-auto mb-1.5 text-muted-foreground" />
                      <p className="text-lg font-black leading-none" style={{ color: accent }}>{pct}%</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{nice}</p>
                    </div>
                  )
                })}
              </div>
              <Bars rows={stats.byBrowser} total={stats.views} colour="#8b5cf6" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
