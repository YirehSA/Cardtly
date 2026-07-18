'use client'

import { useMemo, useState } from 'react'
import ContactCard, { ContactRow, SOURCE_META, sourceMeta } from './ContactCard'
import ExportContactsButton from './ExportContactsButton'
import EmptyState from '@/components/EmptyState'
import { Search, Users, X, Inbox, CalendarClock } from 'lucide-react'

interface Props {
  rows: ContactRow[]
  ownerName?: string
}

function daysAgo(n: number): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d.getTime()
}

export default function ContactsList({ rows, ownerName }: Props) {
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('all')

  const stats = useMemo(() => {
    const week = daysAgo(6)
    const month = daysAgo(29)
    const t = (iso: string) => new Date(iso).getTime()
    return {
      total: rows.length,
      thisWeek: rows.filter(r => t(r.created_at) >= week).length,
      thisMonth: rows.filter(r => t(r.created_at) >= month).length,
    }
  }, [rows])

  // Only offer filters for sources this person actually has, so nobody is
  // asked to choose between buckets that are all empty.
  const sourceTabs = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rows) {
      const meta = sourceMeta(r.source)
      if (!meta) continue
      // The card form and its old name are one thing to a human.
      const key = r.source === 'contact_form' ? 'card_form' : r.source!
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return [...counts.entries()]
      .map(([key, count]) => ({ key, count, label: SOURCE_META[key]?.label || key }))
      .sort((a, b) => b.count - a.count)
  }, [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(r => {
      if (source !== 'all') {
        const key = r.source === 'contact_form' ? 'card_form' : r.source
        if (key !== source) return false
      }
      if (!q) return true
      return [r.name, r.email, r.phone, r.company, r.title, r.message]
        .some(v => (v || '').toLowerCase().includes(q))
    })
  }, [rows, query, source])

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nobody has left their details yet"
        description="When someone fills in the form on your card, books a meeting or answers your questions, they land here with their contact details ready to save."
        action={{ label: 'Get my QR code to share', href: '/dashboard/qr' }}
        accent="#f59e0b"
      />
    )
  }

  const STATS = [
    { label: 'People in total', value: stats.total, icon: Users, colour: '#f59e0b' },
    { label: 'Came in this week', value: stats.thisWeek, icon: CalendarClock, colour: '#10b981' },
    { label: 'Came in this month', value: stats.thisMonth, icon: Inbox, colour: '#8b5cf6' },
  ]

  return (
    <div className="space-y-5">
      {/* Numbers */}
      <div className="grid grid-cols-3 gap-3">
        {STATS.map(({ label, value, icon: Icon, colour }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4">
            <div className="w-9 h-9 rounded-xl grid place-items-center mb-2" style={{ background: colour + '18' }}>
              <Icon className="w-4 h-4" style={{ color: colour }} />
            </div>
            <p className="text-2xl font-black tracking-tight leading-none" style={{ color: colour }}>{value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Find someone */}
      <div className="rounded-3xl border border-border bg-card p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, email, phone or company"
            className="w-full pl-10 pr-10 py-3 rounded-2xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {sourceTabs.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setSource('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition ${source === 'all' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-foreground/20'}`}>
              Everyone ({rows.length})
            </button>
            {sourceTabs.map(t => (
              <button key={t.key} onClick={() => setSource(t.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition ${source === t.key ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-foreground/20'}`}>
                {t.label} ({t.count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-10 text-center">
          <Search className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold mb-1">Nobody matches that</p>
          <p className="text-sm text-muted-foreground mb-4">
            Try part of a name, an email address or a company.
          </p>
          <button onClick={() => { setQuery(''); setSource('all') }}
            className="text-sm font-semibold px-4 py-2 rounded-xl border border-border hover:bg-muted transition">
            Show everyone
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap px-1">
            <p className="text-xs text-muted-foreground">
              {filtered.length === rows.length
                ? `${rows.length} ${rows.length === 1 ? 'person' : 'people'}, newest first`
                : `Showing ${filtered.length} of ${rows.length}`}
            </p>
            <ExportContactsButton contacts={filtered as any} ownerName={ownerName} />
          </div>
          <div className="space-y-3">
            {filtered.map(contact => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
