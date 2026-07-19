'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Network, X } from 'lucide-react'

// The one-time notice that this account is listed in the Cardtly Network.
//
// The directory lists everyone by default with an opt-out, which only works as
// a fair deal if people actually know. Someone who never opens Settings would
// otherwise be listed indefinitely without being told - and under POPIA,
// compiling names, positions and employers into a searchable index is a new
// processing purpose, not something the original signup covers.
//
// So it says plainly what is shown, what is not, and where the switch is. It
// dismisses to the database rather than local storage, so it stays dismissed
// on their next device and there is a record it was shown.
export default function NetworkNotice() {
  const [hidden, setHidden] = useState(false)
  const [saving, setSaving] = useState(false)

  async function acknowledge() {
    setSaving(true)
    setHidden(true) // optimistic: it should never bounce back on a slow network
    try {
      await fetch('/api/network/notice', { method: 'POST' })
    } catch {
      // Left dismissed for this session either way. Worst case it reappears on
      // the next load, which is far better than a notice that will not close.
    }
    setSaving(false)
  }

  if (hidden) return null

  return (
    <div
      className="mb-5 rounded-2xl border p-4 sm:p-5"
      style={{ borderColor: 'rgba(0,212,255,0.28)', background: 'rgba(0,212,255,0.07)' }}
    >
      <div className="flex items-start gap-4">
        <span
          className="w-10 h-10 rounded-xl grid place-items-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}
        >
          <Network className="w-5 h-5 text-white" aria-hidden="true" />
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">You&rsquo;re listed in the Cardtly Network</p>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Other signed-in Cardtly members can find you by company, name or job title.
            Your listing shows your name, position, company and photo, the same things
            already on your public card. It never shows your phone number or email
            address, and the Network is not visible to the public or to search engines.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href="/dashboard/network"
              className="text-xs font-semibold underline underline-offset-2 hover:opacity-80"
            >
              Take a look
            </Link>
            <Link
              href="/dashboard/settings"
              className="text-xs font-semibold underline underline-offset-2 hover:opacity-80"
            >
              Turn my listing off
            </Link>
            <button
              type="button"
              onClick={acknowledge}
              disabled={saving}
              className="ml-auto min-h-[36px] px-4 rounded-lg text-xs font-semibold border border-border hover:bg-muted transition disabled:opacity-50"
            >
              Got it
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={acknowledge}
          aria-label="Dismiss"
          className="shrink-0 w-8 h-8 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
