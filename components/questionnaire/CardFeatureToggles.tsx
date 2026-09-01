'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, MessageSquare, ClipboardList, Sparkles } from 'lucide-react'

interface Props {
  target: { table: string; id: string }
  contactExchange: boolean
  questionnaireEnabled: boolean
  cardtlyBadge: boolean
  // True when the target is an organization, so the copy can say the change
  // hits every card in the team rather than just this one.
  teamWide: boolean
}

// The two lead-capture features on a public card. Both are standard on Pro
// now; this is where the user switches them on and off. Turning one off never
// deletes anything: a saved questionnaire stays in the same jsonb and comes
// straight back when it goes on again.
export default function CardFeatureToggles({ target, contactExchange, questionnaireEnabled, cardtlyBadge, teamWide }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  // Optimistic local state so the switch moves the instant it is clicked.
  // Reverted if the server says no.
  const [state, setState] = useState({ contactExchange, questionnaireEnabled, cardtlyBadge })

  async function toggle(addon: 'contactExchange' | 'questionnaireEnabled' | 'cardtlyBadge', next: boolean) {
    setPending(addon)
    setState(s => ({ ...s, [addon]: next }))
    try {
      const res = await fetch('/api/card/addons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addon, value: next, targetTable: target.table, targetId: target.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save that')
      toast.success(next ? 'Switched on. It is live on your card now.' : 'Switched off.')
      // Refresh so the rest of the page (and the sidebar) reflects the change.
      router.refresh()
    } catch (e: any) {
      setState(s => ({ ...s, [addon]: !next })) // put the switch back
      toast.error(e.message || 'Could not save that')
    } finally {
      setPending(null)
    }
  }

  const rows = [
    {
      key: 'contactExchange' as const,
      icon: MessageSquare,
      colour: '#0ea5e9',
      title: 'Contact exchange popup',
      desc: teamWide
        ? 'Every card in your team asks visitors to share their details back, so a tap becomes a two-way swap.'
        : 'Asks whoever opens your card to share their details back, so a tap becomes a two-way swap.',
      on: state.contactExchange,
    },
    {
      key: 'questionnaireEnabled' as const,
      icon: ClipboardList,
      colour: '#a855f7',
      title: 'Custom questionnaire',
      desc: teamWide
        ? 'Shows your live form on every team card. You can switch it off per card from the team page.'
        : 'Shows your live form on your card, so you collect the answers you actually need.',
      on: state.questionnaireEnabled,
    },
    {
      key: 'cardtlyBadge' as const,
      icon: Sparkles,
      colour: '#ec4899',
      title: 'Get your own Cardtly card button',
      desc: teamWide
        ? 'A button at the bottom of every team card, so somebody who liked it can get one. Switch it off and it goes from all of them.'
        : 'A button at the bottom of your card, so somebody who liked it can get one of their own.',
      on: state.cardtlyBadge,
    },
  ]

  return (
    <div className="rounded-2xl border border-border bg-card divide-y divide-border">
      {rows.map(({ key, icon: Icon, colour, title, desc, on }) => (
        <div key={key} className="flex items-start gap-4 p-4 sm:p-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${colour}18`, border: `1px solid ${colour}33` }}>
            <Icon className="w-5 h-5" style={{ color: colour }} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
          </div>

          <button
            role="switch"
            aria-checked={on}
            aria-label={`${title}: ${on ? 'on' : 'off'}`}
            disabled={pending === key}
            onClick={() => toggle(key, !on)}
            className="relative flex-shrink-0 rounded-full transition-colors disabled:opacity-60"
            style={{
              width: 46,
              height: 26,
              background: on ? colour : 'hsl(var(--muted))',
              border: `1px solid ${on ? colour : 'hsl(var(--border))'}`,
            }}
          >
            <span
              className="absolute top-1/2 rounded-full bg-white shadow transition-all flex items-center justify-center"
              style={{ width: 18, height: 18, left: on ? 24 : 3, transform: 'translateY(-50%)' }}
            >
              {pending === key && <Loader2 className="w-3 h-3 animate-spin" style={{ color: colour }} />}
            </span>
          </button>
        </div>
      ))}
    </div>
  )
}
