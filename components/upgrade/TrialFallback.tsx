'use client'

import { useState } from 'react'
import { toast } from 'sonner'

// The quiet trial offer for somebody who backed out of paying (lib/signup-
// trial). Never advertised: shown on the payment-cancelled page only to an
// account that has not chosen a plan or taken the trial yet.

export default function TrialFallback() {
  const [busy, setBusy] = useState(false)
  async function start() {
    setBusy(true)
    try {
      const res = await fetch('/api/trial/start', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error || 'Could not start your trial. Please try again.'); setBusy(false); return }
      toast.success('Your 7-day free trial has started. Your card is live.')
      window.location.href = '/dashboard/card'
    } catch {
      toast.error('Could not start your trial. Please try again.')
      setBusy(false)
    }
  }
  return (
    <p className="mt-6 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
      Not ready to pay?{' '}
      <button type="button" onClick={start} disabled={busy} className="underline underline-offset-4 hover:text-white disabled:opacity-60">
        {busy ? 'Starting your trial...' : 'Try Solo free for 7 days'}
      </button>
      . No card needed.
    </p>
  )
}
