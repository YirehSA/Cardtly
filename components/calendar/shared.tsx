'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { statusMeta, type CalendarMeeting } from '@/lib/rep-meetings'
import { repColour } from '@/lib/calendar'

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

export function Pill({ label, colour, title }: { label: string; colour: string; title?: string }) {
  return (
    <span
      title={title}
      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md whitespace-nowrap"
      style={{ background: colour + '22', color: colour, border: `1px solid ${colour}55` }}
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
