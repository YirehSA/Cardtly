'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

// The switch used wherever a setting is on or off.
//
// This shape already existed inside CardFeatureToggles; the department screens
// were using bordered buttons that had to be read to work out their state.
// Andre asked for toggles because a switch says which way it is set without
// being read, which matters most on the screens where one person is setting
// rules for several companies at once.
//
// IT MOVES WHEN YOU PRESS IT.
//
// The first version was purely controlled: it drew `on` straight from a server
// prop, and pressing it only fired the save. The switch could not move until
// the write finished AND router.refresh() had re-run the server component AND
// the new props had reached back down here. On a good connection that is a
// visible pause; on a slow one it looks like a dead control, and it looked
// like a dead control to Andre three times running while every single write
// was landing in the database exactly as asked.
//
// So the position is local state now. It flips on press, the save runs behind
// it, and the server's answer is reconciled when it arrives. If the save
// fails, the switch goes back to where it was and the caller's error toast
// explains why - the one thing worse than a switch that does not move is a
// switch that moves and lies.
//
// `tone` exists so a lock can be amber while an ordinary setting is the
// accent, since a lock is a restriction rather than a preference.

interface Props {
  on: boolean
  /** Return false to reject the change: the switch goes back. Anything else,
   *  including void, is treated as accepted. */
  onChange: (next: boolean) => void | boolean | Promise<void | boolean>
  label: string
  /** Shown under the label. */
  hint?: string
  disabled?: boolean
  /** Why it is disabled. Replaces the hint when present, because a control the
   *  person cannot use owes them a reason more than it owes them a
   *  description. */
  disabledReason?: string
  tone?: 'accent' | 'lock'
  /** Leading icon, sized by the caller. */
  icon?: React.ReactNode
}

export default function Toggle({
  on, onChange, label, hint, disabled = false, disabledReason, tone = 'accent', icon,
}: Props) {
  const [shown, setShown] = useState(on)
  const [saving, setSaving] = useState(false)
  // While a save is in flight the server prop is still the OLD value, and
  // syncing to it would drag the switch back under the user's finger.
  const inFlight = useRef(false)

  useEffect(() => {
    if (!inFlight.current) setShown(on)
  }, [on])

  const colour = tone === 'lock' ? '#f59e0b' : 'hsl(var(--accent))'
  const note = disabled && disabledReason ? disabledReason : hint

  async function press() {
    const next = !shown
    setShown(next)
    setSaving(true)
    inFlight.current = true
    try {
      const result = await onChange(next)
      if (result === false) setShown(!next)
    } catch {
      setShown(!next)
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  return (
    <div className={`flex items-start gap-3 py-2.5 ${disabled ? 'opacity-60' : ''}`}>
      {icon && <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{label}</p>
        {note && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{note}</p>}
      </div>
      {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground mt-1 shrink-0" />}
      <button
        type="button"
        role="switch"
        aria-checked={shown}
        aria-busy={saving}
        aria-label={`${label}: ${shown ? 'on' : 'off'}`}
        disabled={disabled}
        onClick={press}
        className="relative shrink-0 rounded-full transition-colors disabled:cursor-not-allowed mt-0.5"
        style={{
          width: 42,
          height: 24,
          background: shown ? colour : 'hsl(var(--muted))',
          border: `1px solid ${shown ? colour : 'hsl(var(--border))'}`,
        }}
      >
        <span
          className="absolute rounded-full bg-white transition-transform"
          style={{
            width: 18, height: 18, top: 2,
            left: 2,
            transform: shown ? 'translateX(18px)' : 'translateX(0)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
          }}
        />
      </button>
    </div>
  )
}
