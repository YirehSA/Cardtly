'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Copy, Check, Share2, Heart, ArrowUpRight, Trophy } from 'lucide-react'

interface Props {
  referralCode: string
  firstName: string
}

// Discoverable referral panel for the main dashboard. Same link
// format as the /promotions page but surfaced where users land
// every day. Click-to-copy and native share supported.

export default function ReferralCard({ referralCode, firstName }: Props) {
  const [copied, setCopied] = useState(false)
  const referralUrl = `https://cardtly.com/?ref=${referralCode}`

  function copyLink() {
    navigator.clipboard.writeText(referralUrl)
    setCopied(true)
    toast.success('Link copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  function shareNative() {
    if (navigator.share) {
      navigator.share({
        title: 'Cardtly — Get a digital business card',
        text: `${firstName} invited you to Cardtly. Join with my link and we both win.`,
        url: referralUrl,
      }).catch(() => {})
    } else {
      copyLink()
    }
  }

  return (
    <div
      className="relative overflow-hidden rounded-lg p-6"
      style={{
        background: 'hsl(var(--accent) / 0.07)',
        border: '1px solid hsl(var(--accent) / 0.24)',
      }}
    >
      {/* Decorative ambient glow */}
      <div
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'transparent' }}
      />

      <div className="relative flex flex-col lg:flex-row lg:items-center gap-5">
        {/* Left: pitch */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'hsl(var(--accent))' }}>
              <Heart className="w-4 h-4 text-white" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'hsl(var(--accent))' }}>
              Refer &amp; earn entries
            </p>
          </div>
          <p className="font-bold text-base mb-1">Share your link. Win prizes.</p>
          <p className="text-sm text-muted-foreground">
            Every friend who signs up via your link and stays on Pro for 30 days earns you a bonus entry in the next prize draw. Capped at 10 entries per person.
          </p>
        </div>

        {/* Right: link + actions */}
        <div className="flex flex-col gap-2 lg:w-80 flex-shrink-0">
          {/* Link display */}
          <div
            className="rounded-xl px-3 py-2.5 font-mono text-xs break-all"
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' }}
          >
            cardtly.com/?ref={referralCode}
          </div>
          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={copyLink}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-border bg-card hover:bg-muted transition"
            >
              {copied ? <><Check className="w-4 h-4 text-emerald-500" />Copied</> : <><Copy className="w-4 h-4" />Copy</>}
            </button>
            <button
              onClick={shareNative}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: 'hsl(var(--accent))' }}
            >
              <Share2 className="w-4 h-4" />Share
            </button>
          </div>
          {/* Link to full programme */}
          <Link
            href="/promotions"
            className="flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition mt-1"
          >
            <Trophy className="w-3 h-3" />
            See the prize ladder
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
