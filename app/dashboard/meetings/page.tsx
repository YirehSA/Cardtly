import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getRepForUser, serviceClient } from '@/lib/rep-access'
import { listMeetings } from '@/lib/rep-meetings-server'
import { listCalls } from '@/lib/rep-calls-server'
import { listActivities } from '@/lib/rep-activities-server'
import RepWorkspace from '@/components/rep/RepWorkspace'
import type { CalendarMeeting } from '@/lib/rep-meetings'
import type { LoggedCall } from '@/lib/rep-calls'
import type { LoggedActivity } from '@/lib/rep-activities'

export const metadata = { title: 'Activity log' }

// A rep's own meetings and calls. Only reachable by an account linked to a rep
// record; anyone else is sent back to the dashboard rather than shown an empty
// page that looks like a feature they cannot use.
export default async function MeetingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = serviceClient()
  const rep = await getRepForUser(admin, user.id, user.email)
  if (!rep) redirect('/dashboard')

  // Tolerant, through the three list helpers: rep_meetings arrives with
  // migration 047, its calendar columns with 048, rep_calls with 061 and
  // rep_activities with 075 - all applied by hand after the deploy. An empty
  // list with a working "add" beats a stack trace, and all three are fetched
  // together so one missing table cannot take the others' tabs down with it.
  const [meetingRes, callRes, activityRes] = await Promise.all([
    listMeetings(admin, { repId: rep.id }),
    listCalls(admin, { repId: rep.id }),
    listActivities(admin, { repId: rep.id }),
  ])
  const meetings: CalendarMeeting[] = meetingRes.ok ? (meetingRes.meetings as CalendarMeeting[]) : []
  const calls: LoggedCall[] = callRes.ok ? (callRes.calls as LoggedCall[]) : []
  const activities: LoggedActivity[] = activityRes.ok ? (activityRes.activities as LoggedActivity[]) : []

  return (
    <RepWorkspace
      repName={rep.name} active={rep.active}
      meetings={meetings} calls={calls} activities={activities}
    />
  )
}
