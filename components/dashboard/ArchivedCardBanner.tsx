'use client'

import { useState } from 'react'
import { EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export interface ArchivedCard {
  id: string
  name: string | null
  slug: string | null
}

// Shown when one of your cards is archived, which means it is not opening for
// anybody.
//
// This exists because the failure is otherwise completely silent. An archived
// card 404s for every visitor, while the dashboard keeps showing it as healthy
// - the dashboard reads it as the owner, the public page reads it anonymously,
// and only the anonymous read is filtered. One card sat dead for four days
// before a person happened to try the link.
//
// So the banner does not just warn, it fixes: restoring is one request, and
// there is no other route to it in the product.
export default function ArchivedCardBanner({ cards }: { cards: ArchivedCard[] }) {
  const [pending, setPending] = useState<string | null>(null)
  const [restored, setRestored] = useState<string[]>([])

  const remaining = cards.filter(c => !restored.includes(c.id))
  if (remaining.length === 0) return null

  async function restore(card: ArchivedCard) {
    setPending(card.id)
    try {
      const res = await fetch('/api/cards/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: card.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Could not bring the card back online')
      } else {
        setRestored(r => [...r, card.id])
        toast.success('That card is live again')
      }
    } catch {
      toast.error('Network error. Try again.')
    }
    setPending(null)
  }

  return (
    <div
      className="mb-5 rounded-lg border p-4 sm:p-5"
      style={{ borderColor: 'rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)' }}
    >
      <div className="flex items-start gap-4">
        <span
          className="w-10 h-10 rounded-xl grid place-items-center shrink-0"
          style={{ background: 'rgba(239,68,68,0.16)' }}
        >
          <EyeOff className="w-5 h-5" style={{ color: '#ef4444' }} aria-hidden="true" />
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">
            {remaining.length === 1
              ? 'One of your cards is not opening for anyone'
              : `${remaining.length} of your cards are not opening for anyone`}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            {remaining.length === 1 ? 'It is' : 'They are'} archived, so the link shows
            a &ldquo;not available&rdquo; page to every visitor, including anyone who
            taps an NFC card or scans a printed QR code. Your details are untouched.
          </p>

          <ul className="mt-3 space-y-2">
            {remaining.map(card => (
              <li
                key={card.id}
                className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-border bg-background/60 px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">
                    {card.name || 'Untitled card'}
                  </span>
                  {card.slug && (
                    <span className="block text-[11px] text-muted-foreground truncate">
                      cardtly.com/card/{card.slug}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => restore(card)}
                  disabled={pending === card.id}
                  className="shrink-0 inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-lg text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'hsl(var(--accent))' }}
                >
                  {pending === card.id && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  )}
                  {pending === card.id ? 'Bringing it back' : 'Make it live again'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
