'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { statusMeta, type CalendarMeeting } from '@/lib/rep-meetings'
import { repColour } from '@/lib/calendar'
import { useTheme } from '@/components/dashboard/ThemeProvider'

// The calendar is used in two places that look nothing alike: the dashboard,
// which follows the user's light or dark theme, and /admin, which paints itself
// dark with fixed colours and sits outside the ThemeProvider entirely.
//
// So the components below never name a colour. They read CSS variables, and the
// page that mounts them sets those variables once on a wrapper. One set of
// components, two skins, and no second copy of a month grid to keep in step.

export const APP_SKIN = {
  '--cal-surface': 'hsl(var(--card))',
  // Opaque, for the slide-over and the modal. --cal-surface is translucent in
  // the admin skin, and a panel you can read the page through is unreadable.
  '--cal-panel': 'hsl(var(--card))',
  '--cal-raised': 'hsl(var(--muted))',
  '--cal-input': 'hsl(var(--background))',
  '--cal-border': 'hsl(var(--border))',
  '--cal-grid': 'hsl(var(--border) / 0.6)',
  '--cal-text': 'hsl(var(--foreground))',
  '--cal-muted': 'hsl(var(--muted-foreground))',
  '--cal-hover': 'hsl(var(--muted))',
  '--cal-today': 'hsl(var(--muted) / 0.7)',
} as unknown as CSSProperties

export const ADMIN_SKIN = {
  '--cal-surface': 'rgba(255,255,255,0.02)',
  // The admin page is #0a0a0a. Lifted a shade so the panel reads as sitting on
  // top of it rather than being a hole in it.
  '--cal-panel': '#141418',
  '--cal-raised': 'rgba(255,255,255,0.05)',
  '--cal-input': 'rgba(255,255,255,0.05)',
  '--cal-border': 'rgba(255,255,255,0.10)',
  '--cal-grid': 'rgba(255,255,255,0.07)',
  '--cal-text': '#ffffff',
  '--cal-muted': 'rgba(255,255,255,0.45)',
  '--cal-hover': 'rgba(255,255,255,0.06)',
  '--cal-today': 'hsl(var(--accent) / 0.12)',
} as unknown as CSSProperties

export const GRAD = 'hsl(var(--accent))'

/**
 * A hue that is still readable as TEXT on whichever theme is on.
 *
 * The colours that identify things here - sky for the calendar, green for
 * calls, amber for overdue - were picked to glow on a near-black panel, and
 * they do. On the light theme the same values are 2.0 to 3.2 against white,
 * which is a label people squint at. There is no single value that works on
 * both, so each one is a pair and the theme decides.
 *
 * Only for text. Backgrounds, borders, icons and tints keep the bright hue in
 * both themes - none of them has a contrast ratio to meet, and swapping them
 * would drain the colour out of the page for no gain.
 *
 * Outside the dashboard's ThemeProvider - the admin page - this returns the
 * bright value, which is right: that page is always dark.
 */
export function useInk(): (bright: string, deep: string) => string {
  const { theme } = useTheme()
  return (bright, deep) => (theme === 'dark' ? bright : deep)
}

/** The paired values, so a hue is never half-corrected in one place and not
 *  another. Every deep value clears 5:1 on white. */
export const INK = {
  sky:    { bright: '#0ea5e9', deep: '#0369a1' },
  blue:   { bright: '#3b82f6', deep: '#1d4ed8' },
  green:  { bright: '#22c55e', deep: '#15803d' },
  amber:  { bright: '#f59e0b', deep: '#b45309' },
  purple: { bright: '#a855f7', deep: '#7e22ce' },
} as const

export const inputClass =
  'w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition'

export const inputStyle: CSSProperties = {
  background: 'var(--cal-input)',
  borderColor: 'var(--cal-border)',
  color: 'var(--cal-text)',
}

/**
 * True once the browser has taken over.
 *
 * Every time on this page is rendered in the viewer's timezone. On the server
 * that is UTC, in Andre's hand it is UTC+2, so a 09:00 meeting would be drawn
 * at 07:00 for the split second before hydration and React would rightly
 * complain about it. Waiting one frame and showing a skeleton is cheaper than
 * a calendar that visibly jumps two hours on load.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  return mounted
}

/** The current time, kept fresh so the "now" line creeps down the day and
 *  "coming up" stops counting a meeting the moment it has finished. */
export function useNow(everyMs = 60_000): Date {
  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), everyMs)
    return () => clearInterval(t)
  }, [everyMs])
  return now
}

export type ColourBy = 'status' | 'rep'

export function meetingColour(m: CalendarMeeting, colourBy: ColourBy): string {
  return colourBy === 'rep' ? repColour(m.rep_id) : statusMeta(m.status).colour
}

// Planned, and the end time has gone by. Re-exported rather than reimplemented:
// the "!" marker on a chip and the Needs-outcome filter have to agree about what
// overdue means, and two copies of that rule would not stay in step.
export { isOverdue } from '@/lib/meeting-filters'

/**
 * A status chip.
 *
 * THE LABEL IS NOT THE HUE. It used to be, and measuring the four skins this
 * renders in put "Meeting booked" at 2.80:1 and "Email sent" at 4.06:1 - a
 * 10px uppercase label below AA on the status column of three different
 * screens. It cannot be fixed by picking better hues: the same component sits
 * on a near-white dashboard and a near-black admin page, and a mid-tone that
 * clears 4.5:1 against both does not exist.
 *
 * So the text takes the surface's own foreground, which is readable by
 * construction in every skin, and the colour moves to the fill and the border
 * where it has no contrast requirement to meet. The chip still reads as green
 * or purple at a glance; it just no longer depends on that to be legible.
 */
export function Pill({ label, colour, title }: { label: string; colour: string; title?: string }) {
  return (
    <span
      title={title}
      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md whitespace-nowrap"
      style={{ background: colour + '2e', color: 'var(--cal-text)', border: `1px solid ${colour}88` }}
    >
      {label}
    </span>
  )
}

/** Shown until the clock is the browser's. Roughly the shape of the real thing,
 *  so the page does not jump when it arrives. */
export function CalendarSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-hidden="true">
      <div className="h-16 rounded-lg" style={{ background: 'var(--cal-raised)' }} />
      <div className="h-11 rounded-xl" style={{ background: 'var(--cal-raised)' }} />
      <div className="h-[420px] rounded-lg" style={{ background: 'var(--cal-raised)' }} />
    </div>
  )
}
