'use client'

// The switch used wherever a setting is on or off.
//
// This shape already existed inside CardFeatureToggles; the department screens
// were using bordered buttons that had to be read to work out their state.
// Andre asked for toggles because a switch says which way it is set without
// being read, which matters most on the screens where one person is setting
// rules for several companies at once.
//
// `tone` exists so a lock can be amber while an ordinary setting is the
// accent, since a lock is a restriction rather than a preference.

interface Props {
  on: boolean
  onChange: (next: boolean) => void
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
  const colour = tone === 'lock' ? '#f59e0b' : 'hsl(var(--accent))'
  const note = disabled && disabledReason ? disabledReason : hint

  return (
    <div className={`flex items-start gap-3 py-2.5 ${disabled ? 'opacity-60' : ''}`}>
      {icon && <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{label}</p>
        {note && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{note}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${label}: ${on ? 'on' : 'off'}`}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className="relative shrink-0 rounded-full transition-colors disabled:cursor-not-allowed mt-0.5"
        style={{
          width: 42,
          height: 24,
          background: on ? colour : 'hsl(var(--muted))',
          border: `1px solid ${on ? colour : 'hsl(var(--border))'}`,
        }}
      >
        <span
          className="absolute rounded-full bg-white transition-transform"
          style={{
            width: 18, height: 18, top: 2,
            left: 2,
            transform: on ? 'translateX(18px)' : 'translateX(0)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
          }}
        />
      </button>
    </div>
  )
}
