'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Ticket, Loader2, Check } from 'lucide-react'

// Where someone WITH a code actually uses it.
//
// A trial code normally travels in a link (cardtly.com/signup?code=...), so
// there is deliberately no box on the signup form - it would ask every visitor
// for something only some of them have. But a code given over the phone, read
// off a flyer, or passed on by a colleague had nowhere to go at all: the person
// held a valid code and could not redeem it.
//
// This sits on the upgrade screen, which is exactly where someone lands when
// their card is not live - the moment they would reach for a code. The claim
// endpoint was already written to work for any signed-in account, not just
// during signup, so this needed no new server work.
export default function TrialCodeBox() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function redeem() {
    const clean = code.trim().toUpperCase()
    if (!clean) return
    setBusy(true)
    try {
      const res = await fetch('/api/trial-code/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: clean }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.success) {
        setDone(true)
        toast.success(`Your ${data.days}-day free trial has started`)
        // The card goes live on the server the moment the trial lands, so the
        // page has to refetch or it keeps showing the paywall it just cleared.
        router.refresh()
      } else {
        toast.error(data?.error || 'That code did not work.', { duration: 8000 })
      }
    } catch {
      toast.error('Could not check that code. Please try again.', { duration: 8000 })
    }
    setBusy(false)
  }

  if (done) {
    return (
      <div className="rounded-2xl border p-4 flex items-start gap-3"
        style={{ borderColor: 'rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.08)' }}>
        <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#22c55e' }} />
        <div>
          <p className="font-semibold text-sm">Trial started</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your card is live. Nothing to pay until the trial ends.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="w-8 h-8 rounded-xl grid place-items-center bg-muted shrink-0">
          <Ticket className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        </span>
        <p className="font-semibold text-sm">Have a trial code?</p>
      </div>
      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
        Enter it here and your card goes live free for the length of the trial. No card details needed.
      </p>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
          onKeyDown={e => { if (e.key === 'Enter') redeem() }}
          placeholder="CARDTLY30"
          aria-label="Trial code"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring transition"
        />
        <button
          onClick={redeem}
          disabled={busy || code.trim().length < 3}
          className="px-4 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5"
          style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
        </button>
      </div>
    </div>
  )
}
