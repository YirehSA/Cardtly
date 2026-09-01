'use client'

import { useState } from 'react'
import { CalendarClock, PhoneCall } from 'lucide-react'
import MeetingsView from '@/components/rep/MeetingsView'
import CallLog from '@/components/calls/CallLog'
import { APP_SKIN } from '@/components/calendar/shared'
import type { CalendarMeeting } from '@/lib/rep-meetings'
import type { LoggedCall } from '@/lib/rep-calls'

// A rep's two records, behind one nav item.
//
// Calls did not want a second entry in the sidebar. They belong beside the
// meetings - a call is where most meetings come from, and "Meeting booked" in
// the log is the same event as the appointment in the calendar - but they do not
// belong ON the calendar. Thirty dials a day would bury two meetings a week
// under them.

type Tab = 'calendar' | 'calls'

export default function RepWorkspace({ repName, active, meetings, calls }: {
  repName: string
  active: boolean
  meetings: CalendarMeeting[]
  calls: LoggedCall[]
}) {
  const [tab, setTab] = useState<Tab>('calendar')

  const TABS: { id: Tab; label: string; icon: React.ReactNode; count: number; colour: string }[] = [
    { id: 'calendar', label: 'Calendar', icon: <CalendarClock className="w-4 h-4" />, count: meetings.length, colour: '#0ea5e9' },
    { id: 'calls', label: 'Call log', icon: <PhoneCall className="w-4 h-4" />, count: calls.length, colour: '#22c55e' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2" role="tablist" aria-label="Calendar and call log">
        {TABS.map(t => {
          const on = tab === t.id
          return (
            <button key={t.id} role="tab" aria-selected={on} onClick={() => setTab(t.id)}
              className="px-4 min-h-[44px] rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition"
              style={{
                background: on ? `${t.colour}1f` : 'transparent',
                border: `1px solid ${on ? `${t.colour}59` : 'hsl(var(--border))'}`,
                color: on ? t.colour : 'hsl(var(--muted-foreground))',
              }}>
              {t.icon}
              {t.label}
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: on ? `${t.colour}26` : 'hsl(var(--muted))' }}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {tab === 'calendar'
        ? <MeetingsView repName={repName} active={active} initial={meetings} />
        : <CallLog calls={calls} endpoint="/api/rep/calls" skin={APP_SKIN} canWrite={active} />}
    </div>
  )
}
