'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2, AlertTriangle, Mail, Clock } from 'lucide-react'
import { Section, grad } from '../shared'
import { money, Empty, fmtDate } from './shared'

// Who is late, and the nudge each one is due.
//
// Sits at the top of Invoices because that is where somebody goes to ask "who
// owes us money". Opening it sends nothing: the queue is a read, and every
// send is a press.

type Row = {
  id: string; number: string | null; clientName: string; email: string | null
  dueAt: string; daysOverdue: number; totalCents: number; outstandingCents: number
  stage: number; isFinal: boolean; remindersSent: number; lastReminderAt: string | null
}

export default function OverdueQueue({ onSent }: { onSent?: () => void }) {
  const [rows, setRows] = useState<Row[]>([])
  const [ladder, setLadder] = useState<number[]>([])
  const [autoSend, setAutoSend] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/admin/billing/reminders')
    const d = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) return
    setRows(d.rows || []); setLadder(d.ladder || []); setAutoSend(!!d.autoSend)
  }
  useEffect(() => { load() }, [])

  async function send(ids: string[], label: string) {
    if (!confirm(`Send ${label}? ${ids.length === 1 ? 'This email goes' : 'These emails go'} to the client straight away.`)) return
    setBusy(ids.length === 1 ? ids[0] : 'all')
    const res = await fetch('/api/admin/billing/reminders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok || d?.error) { toast.error(d?.error || 'Could not send'); return }
    if (d.sent) toast.success(`${d.sent} reminder${d.sent === 1 ? '' : 's'} sent: ${d.sentNumbers.join(', ')}`)
    for (const f of d.failed || []) toast.error(`${f.number}: ${f.error}`, { duration: 9000 })
    load(); onSent?.()
  }

  if (loading || rows.length === 0) return null

  const total = rows.reduce((n, r) => n + r.outstandingCents, 0)
  const sendable = rows.filter(r => r.email)
  const noEmail = rows.length - sendable.length

  return (
    <Section
      title={`${rows.length} invoice${rows.length === 1 ? '' : 's'} due a reminder`}
      sub={`${money(total)} outstanding. Chasing at ${ladder.join(', ')} days past due.${autoSend ? ' Sending automatically each morning.' : ''}`}
      right={sendable.length > 1 ? (
        <button onClick={() => send(sendable.map(r => r.id), `${sendable.length} reminders`)}
          disabled={busy === 'all'}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={{ background: grad, color: '#fff' }}>
          {busy === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          Send all {sendable.length}
        </button>
      ) : undefined}>

      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg flex-wrap"
            style={{
              background: r.isFinal ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${r.isFinal ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'}`,
            }}>
            <div className="w-24">
              <p className="font-mono text-xs text-white">{r.number}</p>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                style={r.isFinal
                  ? { background: 'rgba(239,68,68,0.2)', color: '#ef4444' }
                  : { background: 'rgba(245,158,11,0.18)', color: '#f59e0b' }}>
                {r.isFinal ? 'Final' : `Nudge ${r.stage}`}
              </span>
            </div>
            <div className="flex-1 min-w-[160px]">
              <p className="text-sm text-white">{r.clientName}</p>
              <p className="text-xs flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                <Clock className="w-3 h-3" />
                {r.daysOverdue} days past {fmtDate(r.dueAt)}
                {r.remindersSent > 0 && ` · ${r.remindersSent} sent, last ${fmtDate(r.lastReminderAt)}`}
              </p>
            </div>
            <p className="text-sm font-bold w-28 text-right" style={{ color: '#f59e0b' }}>
              {money(r.outstandingCents)}
            </p>
            {r.email ? (
              <button onClick={() => send([r.id], `a reminder to ${r.clientName}`)} disabled={busy === r.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.75)' }}>
                {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                Send
              </button>
            ) : (
              <span className="text-[11px]" style={{ color: '#ef4444' }}>No email address</span>
            )}
          </div>
        ))}
      </div>

      {noEmail > 0 && (
        <div className="flex items-start gap-2 mt-3 text-xs" style={{ color: '#ef4444' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            {noEmail} of these has no email address, so it cannot be chased. Add one on the Clients screen.
          </span>
        </div>
      )}
    </Section>
  )
}
