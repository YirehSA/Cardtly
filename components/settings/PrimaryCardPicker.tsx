'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Loader2, ExternalLink, Link2, Users, User } from 'lucide-react'

// Which card your link opens, when you have more than one.
//
// Only rendered for people who actually hold two, which today is anybody who
// signed up in the usual way and later joined a team. Neither card is deleted:
// the one not chosen keeps its leads and forwards to the other, so an NFC card
// already printed with the old address still lands in the right place.

export type PickerCard = {
  id: string
  slug: string
  name: string | null
  kind: 'personal' | 'team'
  /** Where this card currently forwards, if anywhere. */
  redirectTo: string | null
  views: number
  leads: number
}

export default function PrimaryCardPicker({ cards }: { cards: PickerCard[] }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [chosen, setChosen] = useState<string | null>(
    cards.find(c => !c.redirectTo)?.id ?? null
  )

  if (cards.length < 2) return null

  async function choose(card: PickerCard) {
    setBusy(card.id)
    const res = await fetch('/api/account/primary-card', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: card.id, kind: card.kind }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok || data?.error) {
      toast.error(data?.error || 'That did not work', { duration: 8000 })
      return
    }
    setChosen(card.id)
    toast.success(`Your link now opens ${card.name || 'that card'}`)
  }

  return (
    <div className="p-4 rounded-xl border border-border space-y-3">
      <div>
        <p className="font-medium text-sm">Which card does your link open?</p>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-xl leading-relaxed">
          You have more than one card, so you have more than one web address. Pick the one
          people should land on. The other keeps everything it has captured and simply
          forwards here, so anything already printed still works.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {cards.map(c => {
          const active = chosen === c.id
          const Icon = c.kind === 'team' ? Users : User
          return (
            <button key={c.id} onClick={() => choose(c)} disabled={busy !== null}
              aria-pressed={active}
              className="text-left rounded-xl border-2 p-3 transition disabled:opacity-60"
              style={active
                ? { borderColor: '#22c55e', background: 'rgba(34,197,94,0.08)' }
                : { borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0"
                  style={active
                    ? { borderColor: '#22c55e', background: '#22c55e' }
                    : { borderColor: 'var(--border)' }}>
                  {busy === c.id
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : active ? <Check className="w-3 h-3 text-white" /> : null}
                </span>
                <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="font-semibold text-sm truncate">{c.name || 'Unnamed'}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ml-auto shrink-0"
                  style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                  {c.kind === 'team' ? 'Team' : 'Personal'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono truncate mt-1.5 flex items-center gap-1">
                <Link2 className="w-3 h-3 shrink-0" />/card/{c.slug}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                {c.views} view{c.views === 1 ? '' : 's'} · {c.leads} lead{c.leads === 1 ? '' : 's'}
                {active
                  ? <span className="ml-1.5 font-semibold" style={{ color: '#22c55e' }}>opens directly</span>
                  : <span className="ml-1.5">forwards to the other</span>}
              </p>
            </button>
          )
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Both addresses keep working either way.{' '}
        {cards.filter(c => chosen === c.id).map(c => (
          <a key={c.id} href={`/card/${c.slug}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline hover:text-foreground">
            <ExternalLink className="w-3 h-3" />Open the one you picked
          </a>
        ))}
      </p>
    </div>
  )
}
