'use client'

import { Mail, Handshake, TrendingUp, MessageSquareReply, Linkedin } from 'lucide-react'
import { useInk, INK } from '@/components/calendar/shared'
import { summariseActivities, type RepActivity } from '@/lib/rep-activities'
import type { CalendarView } from '@/lib/calendar'

// The four figures, in one place.
//
// Both the rep's page and the admin panel show them, and they have to mean the
// same thing on both. Two copies of "positive replies over emails sent" is two
// chances to count a bounce as a reply on one screen and not the other, and
// nobody would spot it - the numbers would simply disagree and each would look
// plausible on its own.

type Note = { text: string; tone: 'good' | 'bad' | 'muted' }

/**
 * How this period compares with the one before it.
 *
 * Says nothing rather than inventing a percentage when there was nothing to
 * compare against: "up 100%" from zero to one is arithmetically true and
 * useless.
 */
export function delta(now: number, before: number | undefined, period: CalendarView): Note {
  if (before === undefined) return { text: 'All time', tone: 'muted' }
  const unit = period === 'week' ? 'week' : 'month'
  if (before === 0) {
    return now === 0
      ? { text: `Nothing last ${unit} either`, tone: 'muted' }
      : { text: `Up from none last ${unit}`, tone: 'good' }
  }
  const pct = Math.round(((now - before) / before) * 100)
  if (pct === 0) return { text: `Same as last ${unit}`, tone: 'muted' }
  return {
    text: `${pct > 0 ? 'Up' : 'Down'} ${Math.abs(pct)}% vs last ${unit}`,
    tone: pct > 0 ? 'good' : 'bad',
  }
}

export default function ActivityStats({ activities, calls, previous, period, connectionsNote }: {
  activities: RepActivity[]
  /** Only their outcomes are read, for the meetings figure. */
  calls: { outcome: string }[]
  /** The same window one step back, or null when the period is All. */
  previous: { emailsSent: number } | null
  period: CalendarView
  /** The admin panel says "across the team"; a rep's own page does not. */
  connectionsNote?: string
}) {
  const stats = summariseActivities(activities, calls)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Stat
        icon={<Mail className="w-5 h-5" />} colour="#3b82f6"
        value={stats.emailsSent} label="Emails sent"
        note={delta(stats.emailsSent, previous?.emailsSent, period)} />
      <Stat
        icon={<MessageSquareReply className="w-5 h-5" />} colour="#22c55e"
        value={stats.positive} label="Positive replies"
        note={stats.responseRate === null
          ? { text: 'Nothing sent yet', tone: 'muted' }
          : { text: `${stats.responseRate}% response rate`, tone: 'good' }} />
      <Stat
        icon={<Linkedin className="w-5 h-5" />} colour="#a855f7"
        value={stats.connections} label="New connections"
        note={{ text: connectionsNote || 'LinkedIn and networking', tone: 'muted' }} />
      <Stat
        icon={<Handshake className="w-5 h-5" />} colour="#ec4899"
        value={stats.meetings} label="Meetings booked"
        note={{ text: 'From outreach and calls', tone: 'muted' }} />
    </div>
  )
}

function Stat({ icon, colour, value, label, note }: {
  icon: React.ReactNode; colour: string; value: number; label: string; note: Note
}) {
  const ink = useInk()
  const TONE: Record<Note['tone'], string> = {
    good: ink(INK.green.bright, INK.green.deep),
    bad: ink(INK.amber.bright, INK.amber.deep),
    muted: 'var(--cal-muted)',
  }
  return (
    <div className="rounded-2xl border p-4 flex items-start gap-3"
      style={{
        borderColor: colour + '33',
        // 0e, not 14. At 8% the green card's own tint pushed the muted note on
        // it to 4.43:1 - the app sets --muted-foreground precisely to clear
        // 4.56 on its surfaces, and a decorative wash must not spend that.
        background: `linear-gradient(150deg, ${colour}0e 0%, transparent 60%)`,
      }}>
      <span className="w-11 h-11 rounded-xl grid place-items-center flex-shrink-0"
        style={{ background: colour + '22', color: colour }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-display text-3xl font-bold leading-none tabular-nums"
          style={{ color: 'var(--cal-text)' }}>{value}</p>
        <p className="text-sm font-medium mt-1" style={{ color: 'var(--cal-text)' }}>{label}</p>
        {/* The tone is carried by an arrow as well as a colour, so it still
            reads as up or down to somebody who cannot separate the two. */}
        <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: TONE[note.tone] }}>
          {note.tone === 'good' && <TrendingUp className="w-3 h-3" />}
          {note.tone === 'bad' && <TrendingUp className="w-3 h-3 rotate-180" />}
          {note.text}
        </p>
      </div>
    </div>
  )
}
