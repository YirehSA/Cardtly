'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2, Flag, ExternalLink, Check, Ban, AlertTriangle } from 'lucide-react'
import { reasonLabel, isOverdue, ageInHours, SLA_HOURS } from '@/lib/moderation'

// The queue behind the report button.
//
// A report button with nowhere to act on it is not moderation, it is a
// suggestion box. This is the other half: what came in, how long it has been
// waiting, and the two things that can be done about it.
//
// Overdue is marked rather than merely sorted. The promise made to somebody
// reporting an impersonation is 24 hours, and a queue that shows age but never
// says "this one is late" lets a breach look like an ordinary row.

type Report = {
  id: string
  card_id: string | null
  team_card_id: string | null
  card_slug: string
  card_name: string | null
  reason: string
  detail: string | null
  status: string
  reporter_user_id: string | null
  created_at: string
}

export default function ReportsTab() {
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [showing, setShowing] = useState<'open' | 'all'>('open')
  const [busy, setBusy] = useState<string | null>(null)
  const now = new Date()

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/admin/reports?status=${showing}`)
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setUnavailable(data?.error || 'Could not load reports'); return }
    setUnavailable(null)
    setReports(data.reports || [])
  }
  useEffect(() => { load() }, [showing])

  async function act(id: string, status: 'actioned' | 'dismissed', takeDown: boolean) {
    setBusy(id)
    const res = await fetch('/api/admin/reports', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_id: id, status, take_down: takeDown }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok || data?.error) { toast.error(data?.error || 'That did not work'); return }
    toast.success(takeDown ? 'Card removed from the directory and the report closed' : 'Report closed')
    load()
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
      <Loader2 className="w-4 h-4 animate-spin" />Loading reports
    </div>
  }
  if (unavailable) {
    return <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{unavailable}</p>
  }

  const overdue = reports.filter(r => r.status === 'open' && isOverdue(r.created_at, now)).length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {(['open', 'all'] as const).map(v => (
          <button key={v} onClick={() => setShowing(v)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            style={showing === v
              ? { background: 'rgba(255,255,255,0.12)', color: '#fff' }
              : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)' }}>
            {v === 'open' ? 'Open' : 'Everything'}
          </button>
        ))}
        {overdue > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: 'rgba(239,68,68,0.18)', color: '#ef4444' }}>
            <AlertTriangle className="w-3.5 h-3.5" />
            {overdue} past {SLA_HOURS} hours
          </span>
        )}
      </div>

      {reports.length === 0 ? (
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {showing === 'open' ? 'Nothing waiting.' : 'No reports have ever been made.'}
        </p>
      ) : reports.map(r => {
        const hours = Math.floor(ageInHours(r.created_at, now))
        const late = r.status === 'open' && isOverdue(r.created_at, now)
        return (
          <div key={r.id} className="rounded-xl p-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${late ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}` }}>
            <div className="flex items-start gap-3 flex-wrap">
              <Flag className="w-4 h-4 mt-0.5" style={{ color: late ? '#ef4444' : 'rgba(255,255,255,0.4)' }} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-white">
                  {reasonLabel(r.reason)}
                  <span className="ml-2 text-xs font-normal" style={{ color: late ? '#ef4444' : 'rgba(255,255,255,0.45)' }}>
                    {hours < 1 ? 'just now' : `${hours}h ago`}
                  </span>
                  {r.status !== 'open' && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}>{r.status}</span>
                  )}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {r.card_name || 'Unnamed card'}
                  {' · '}
                  <a href={`/card/${r.card_slug}`} target="_blank" rel="noopener noreferrer"
                    className="underline inline-flex items-center gap-1">
                    /card/{r.card_slug}<ExternalLink className="w-3 h-3" />
                  </a>
                  {' · '}{r.reporter_user_id ? 'reported by a member' : 'reported anonymously'}
                </p>
                {r.detail && (
                  <p className="text-xs mt-2 p-2 rounded" style={{ background: 'rgba(0,0,0,0.25)', color: 'rgba(255,255,255,0.7)' }}>
                    {r.detail}
                  </p>
                )}
              </div>

              {r.status === 'open' && (
                <div className="flex gap-2 flex-wrap">
                  <button disabled={busy === r.id}
                    onClick={() => {
                      if (!confirm(`Remove "${r.card_name || r.card_slug}" from the Network?\n\nThe card keeps working on its own link. It stops being listed to anyone.`)) return
                      act(r.id, 'actioned', true)
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: 'rgba(239,68,68,0.18)', color: '#ef4444' }}>
                    {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                    Remove from Network
                  </button>
                  <button disabled={busy === r.id}
                    onClick={() => act(r.id, 'dismissed', false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}>
                    <Check className="w-3.5 h-3.5" />Nothing wrong
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
