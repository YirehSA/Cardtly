'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Eye, MousePointer, UserCheck, QrCode, TrendingUp, Smartphone, Monitor, Tablet } from 'lucide-react'

interface Props {
  card: { id: string; name: string; slug: string; view_count: number | null }
}

type Period = 7 | 30 | 90
type EventRow = {
  event_type: string
  link_title: string | null
  device: string | null
  browser: string | null
  os: string | null
  created_at: string
}

interface Stats {
  views: number
  linkClicks: number
  contactSaves: number
  qrScans: number
  shares: number
  byDay: { date: string; views: number; clicks: number }[]
  byDevice: { device: string; count: number }[]
  byBrowser: { browser: string; count: number }[]
  byOS: { os: string; count: number }[]
  topLinks: { title: string; count: number }[]
}

const PERIODS: { label: string; value: Period }[] = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
]

export default function AnalyticsDashboard({ card }: Props) {
  const [period, setPeriod] = useState<Period>(30)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchStats()
  }, [period])

  async function fetchStats() {
    setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - period)

    const { data, error } = await supabase
      .from('card_events')
      .select('event_type, link_title, device, browser, os, created_at')
      .eq('card_id', card.id)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })

    if (error || !data) {
      setLoading(false)
      return
    }

    const events = data as EventRow[]

    // Counts
    const views = events.filter(e => e.event_type === 'view').length
    const linkClicks = events.filter(e => e.event_type === 'link_click').length
    const contactSaves = events.filter(e => e.event_type === 'contact_save').length
    const qrScans = events.filter(e => e.event_type === 'qr_scan').length
    const shares = events.filter(e => e.event_type === 'share').length

    // By day
    const dayMap = new Map<string, { views: number; clicks: number }>()
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      dayMap.set(key, { views: 0, clicks: 0 })
    }
    events.forEach(e => {
      const key = e.created_at.slice(0, 10)
      const day = dayMap.get(key)
      if (day) {
        if (e.event_type === 'view') day.views++
        if (e.event_type === 'link_click') day.clicks++
      }
    })
    const byDay = Array.from(dayMap.entries()).map(([date, v]) => ({ date, ...v }))

    // By device
    const deviceMap = new Map<string, number>()
    events.forEach(e => {
      if (e.device) deviceMap.set(e.device, (deviceMap.get(e.device) || 0) + 1)
    })
    const byDevice = Array.from(deviceMap.entries()).map(([device, count]) => ({ device, count })).sort((a, b) => b.count - a.count)

    // By browser
    const browserMap = new Map<string, number>()
    events.forEach(e => {
      if (e.browser) browserMap.set(e.browser, (browserMap.get(e.browser) || 0) + 1)
    })
    const byBrowser = Array.from(browserMap.entries()).map(([browser, count]) => ({ browser, count })).sort((a, b) => b.count - a.count)

    // By OS
    const osMap = new Map<string, number>()
    events.forEach(e => {
      if (e.os) osMap.set(e.os, (osMap.get(e.os) || 0) + 1)
    })
    const byOS = Array.from(osMap.entries()).map(([os, count]) => ({ os, count })).sort((a, b) => b.count - a.count)

    // Top links
    const linkMap = new Map<string, number>()
    events.filter(e => e.event_type === 'link_click' && e.link_title).forEach(e => {
      linkMap.set(e.link_title!, (linkMap.get(e.link_title!) || 0) + 1)
    })
    const topLinks = Array.from(linkMap.entries()).map(([title, count]) => ({ title, count })).sort((a, b) => b.count - a.count).slice(0, 5)

    setStats({ views, linkClicks, contactSaves, qrScans, shares, byDay, byDevice, byBrowser, byOS, topLinks })
    setLoading(false)
  }

  const maxDayValue = stats ? Math.max(...stats.byDay.map(d => Math.max(d.views, d.clicks)), 1) : 1

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {card.name} — cardtly.com/card/{card.slug}
          </p>
        </div>
        {/* Period selector */}
        <div className="flex gap-1 bg-muted p-1 rounded-xl">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${period === p.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
              <div className="h-4 bg-muted rounded w-2/3 mb-3" />
              <div className="h-8 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Card views', value: stats.views, icon: Eye, color: 'text-blue-500', bg: 'bg-blue-500/10' },
              { label: 'Link clicks', value: stats.linkClicks, icon: MousePointer, color: 'text-purple-500', bg: 'bg-purple-500/10' },
              { label: 'Contact saves', value: stats.contactSaves, icon: UserCheck, color: 'text-green-500', bg: 'bg-green-500/10' },
              { label: 'QR scans', value: stats.qrScans, icon: QrCode, color: 'text-orange-500', bg: 'bg-orange-500/10' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-card border border-border rounded-2xl p-5">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <p className="text-2xl font-bold font-display">{value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Views over time chart */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold">Activity over time</h2>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />Views</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block" />Clicks</span>
              </div>
            </div>
            {stats.byDay.every(d => d.views === 0 && d.clicks === 0) ? (
              <div className="h-40 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No data yet for this period</p>
              </div>
            ) : (
              <div className="relative h-40">
                <div className="absolute inset-0 flex items-end gap-px">
                  {stats.byDay.map((day, i) => {
                    const showLabel = period <= 30 || i % Math.ceil(period / 12) === 0
                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                        {/* Bars */}
                        <div className="w-full flex items-end gap-px h-32">
                          <div
                            className="flex-1 bg-blue-500 rounded-t-sm transition-all hover:bg-blue-400"
                            style={{ height: `${(day.views / maxDayValue) * 100}%`, minHeight: day.views > 0 ? 2 : 0 }}
                          />
                          <div
                            className="flex-1 bg-purple-500 rounded-t-sm transition-all hover:bg-purple-400"
                            style={{ height: `${(day.clicks / maxDayValue) * 100}%`, minHeight: day.clicks > 0 ? 2 : 0 }}
                          />
                        </div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block bg-foreground text-background text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap z-10 pointer-events-none">
                          <p className="font-medium">{new Date(day.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</p>
                          <p>{day.views} views · {day.clicks} clicks</p>
                        </div>
                        {/* X axis label */}
                        {showLabel && (
                          <span className="text-xs text-muted-foreground mt-1 hidden sm:block">
                            {new Date(day.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Device + Browser + OS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Device */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-sm mb-4">Device</h3>
              {stats.byDevice.length === 0 ? (
                <p className="text-xs text-muted-foreground">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {stats.byDevice.map(({ device, count }) => {
                    const total = stats.byDevice.reduce((s, d) => s + d.count, 0)
                    const pct = Math.round((count / total) * 100)
                    const Icon = device === 'mobile' ? Smartphone : device === 'tablet' ? Tablet : Monitor
                    return (
                      <div key={device}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium capitalize">{device}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Browser */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-sm mb-4">Browser</h3>
              {stats.byBrowser.length === 0 ? (
                <p className="text-xs text-muted-foreground">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {stats.byBrowser.slice(0, 5).map(({ browser, count }) => {
                    const total = stats.byBrowser.reduce((s, d) => s + d.count, 0)
                    const pct = Math.round((count / total) * 100)
                    return (
                      <div key={browser}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium">{browser}</span>
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* OS */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-sm mb-4">Operating system</h3>
              {stats.byOS.length === 0 ? (
                <p className="text-xs text-muted-foreground">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {stats.byOS.slice(0, 5).map(({ os, count }) => {
                    const total = stats.byOS.reduce((s, d) => s + d.count, 0)
                    const pct = Math.round((count / total) * 100)
                    return (
                      <div key={os}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium">{os}</span>
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Top links */}
          {stats.topLinks.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-semibold mb-4">Top clicked links</h2>
              <div className="space-y-3">
                {stats.topLinks.map(({ title, count }, i) => {
                  const max = stats.topLinks[0].count
                  const pct = Math.round((count / max) * 100)
                  return (
                    <div key={title} className="flex items-center gap-4">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{title}</span>
                          <span className="text-xs text-muted-foreground">{count} click{count !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Empty state for links */}
          {stats.topLinks.length === 0 && stats.views === 0 && (
            <div className="bg-card border border-border rounded-2xl p-10 text-center">
              <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold mb-1">No data yet</p>
              <p className="text-sm text-muted-foreground">
                Share your card to start seeing analytics. Data will appear here as people view and interact with your card.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-10 text-center">
          <p className="text-sm text-muted-foreground">Failed to load analytics. Please refresh.</p>
        </div>
      )}
    </div>
  )
}
