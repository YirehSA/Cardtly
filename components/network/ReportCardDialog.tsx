'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Flag, Loader2, X, EyeOff, Check } from 'lucide-react'
import { REPORT_REASONS, MAX_DETAIL } from '@/lib/moderation'

// Reporting a card, and blocking it.
//
// Both are offered in one place because from the reader's side they are one
// thought - "I do not want to see this" - even though they do different
// things. Blocking is theirs alone and instant; reporting asks somebody here
// to look. The dialog says which is which, so nobody reports a card expecting
// it to disappear from their own list, or blocks one expecting us to know.

type Props = {
  cardId?: string | null
  teamCardId?: string | null
  cardName?: string | null
  /** Blocking needs an account; a public card viewer may not have one. */
  canBlock?: boolean
  onBlocked?: () => void
  onClose: () => void
}

export default function ReportCardDialog({
  cardId, teamCardId, cardName, canBlock = false, onBlocked, onClose,
}: Props) {
  const [reason, setReason] = useState<string>('')
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const target = { card_id: cardId || undefined, team_card_id: teamCardId || undefined }

  async function submit() {
    setBusy('report')
    const res = await fetch('/api/network/report', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...target, reason, detail }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok || data?.error) { toast.error(data?.error || 'Could not send that report'); return }
    setSent(true)
  }

  async function block() {
    setBusy('block')
    const res = await fetch('/api/network/block', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(target),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok || data?.error) { toast.error(data?.error || 'Could not block that card'); return }
    toast.success('Blocked. You will not see this card in your Network again.')
    onBlocked?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-bold text-sm">
              {sent ? 'Thank you' : `Report ${cardName || 'this card'}`}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {sent ? (
            <>
              <div className="flex items-start gap-2.5">
                <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <p className="text-sm">
                  We have your report and will look at it within 24 hours. If the card breaks our rules
                  it comes down and the account goes with it.
                </p>
              </div>
              {canBlock && (
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    Reporting does not hide the card from you. If you would rather not see it again:
                  </p>
                  <button onClick={block} disabled={busy === 'block'}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition">
                    {busy === 'block' ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />}
                    Block this card too
                  </button>
                </div>
              )}
              <button onClick={onClose}
                className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
                Done
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">What is wrong with it?</p>
              <div className="space-y-1.5">
                {REPORT_REASONS.map(r => (
                  <label key={r.id}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${reason === r.id ? 'border-purple-500/60 bg-purple-500/5' : 'border-border hover:bg-muted'}`}>
                    <input type="radio" name="reason" value={r.id} checked={reason === r.id}
                      onChange={() => setReason(r.id)} className="mt-0.5" />
                    <span>
                      <span className="text-sm font-medium block">{r.label}</span>
                      <span className="text-xs text-muted-foreground">{r.hint}</span>
                    </span>
                  </label>
                ))}
              </div>

              <textarea value={detail} onChange={e => setDetail(e.target.value.slice(0, MAX_DETAIL))}
                rows={3} aria-label="Anything else we should know"
                placeholder={reason === 'other' ? 'Tell us what is wrong' : 'Anything else we should know (optional)'}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm" />

              <div className="flex flex-wrap gap-2">
                <button onClick={submit} disabled={!reason || busy === 'report'}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
                  {busy === 'report' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send report'}
                </button>
                {canBlock && (
                  <button onClick={block} disabled={busy === 'block'}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition">
                    {busy === 'block' ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />}
                    Just block it
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Blocking hides the card from you straight away and tells us nothing.
                Reporting asks us to look at it for everyone.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
