'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Sparkles } from 'lucide-react'
import type { ContextAudience } from '@/lib/card-context'

// The one switch on the Context page: whether this card runs Context at all.
//
// IT DOES NOT GO THROUGH /api/card/addons. That route takes booleans and
// writes them at the top level of addons, and Context is not a boolean: its
// switch lives INSIDE the configuration object, beside the audiences, because
// the flag and the configuration have to be written together or turning the
// feature off would be indistinguishable from deleting it.
//
// SO THE WHOLE CONFIGURATION IS POSTED, with only `enabled` changed. The
// server canonicalises whatever arrives through the same parser the public
// card reads with, so sending the config back unchanged is not a risk: it
// cannot come back different unless it was already invalid, in which case the
// canonical version is the honest answer. What it CANNOT do is lose an
// audience, which is what a partial update of a jsonb column would eventually
// have done.

interface Props {
  target: { table: string; id: string }
  enabled: boolean
  audiences: ContextAudience[]
  defaultAudience: string | null
  teamWide: boolean
  /** True while Cardtly has not switched Context on for public cards yet. */
  beta: boolean
}

export default function ContextMasterToggle({ target, enabled, audiences, defaultAudience, teamWide, beta }: Props) {
  const router = useRouter()
  const [on, setOn] = useState(enabled)
  const [saving, setSaving] = useState(false)

  async function toggle(next: boolean) {
    setSaving(true)
    setOn(next) // optimistic, same as the lead capture switches
    try {
      const res = await fetch('/api/card/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTable: target.table,
          targetId: target.id,
          // Sent back exactly as the server gave it to us. Turning Context off
          // must not cost the owner a single audience.
          context: { enabled: next, audiences, defaultAudience },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not save that')
      toast.success(next
        ? (beta ? 'Context is on for this card. It goes live when Cardtly launches the feature.' : 'Context is on.')
        : 'Context is off. Your audiences are kept.')
      router.refresh()
    } catch (e: any) {
      setOn(!next) // put the switch back
      toast.error(e?.message || 'Could not save that')
    } finally {
      setSaving(false)
    }
  }

  const configured = audiences.filter(a => a.enabled).length

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)' }}>
            <Sparkles className="w-5 h-5" style={{ color: 'hsl(var(--accent))' }} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm">Cardtly Context</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {teamWide
                ? 'Arranges every card in your team around whoever is looking at it.'
                : 'Arranges your card around whoever is looking at it.'}
            </p>
          </div>
        </div>

        {/* A real checkbox rather than a styled div, so it is reachable by
            keyboard and announced as a switch. 44px of touch target. */}
        <label className="flex items-center gap-2 flex-shrink-0 cursor-pointer min-h-11">
          <span className="text-xs font-semibold text-muted-foreground w-7 text-right">{on ? 'On' : 'Off'}</span>
          <span className="relative inline-flex">
            <input
              type="checkbox"
              role="switch"
              checked={on}
              disabled={saving}
              onChange={e => toggle(e.target.checked)}
              aria-label="Cardtly Context"
              className="sr-only peer"
            />
            <span aria-hidden="true"
              className="block w-11 h-6 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2"
              style={{ background: on ? 'hsl(var(--accent))' : 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }} />
            <span aria-hidden="true"
              className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow"
              style={{ left: on ? 26 : 5 }} />
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin absolute -left-6 top-1.5 text-muted-foreground" aria-hidden="true" />}
          </span>
        </label>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        {on
          ? (configured
            ? `${configured} audience${configured === 1 ? '' : 's'} switched on.`
            : 'No audiences are switched on yet, so this card behaves normally.')
          : 'Switched off. Everything below is kept exactly as it is and comes back when you switch Context on again.'}
      </p>
    </div>
  )
}
