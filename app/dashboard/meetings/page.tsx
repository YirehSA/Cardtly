import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getRepForUser, serviceClient } from '@/lib/rep-access'
import { listMeetings } from '@/lib/rep-meetings-server'
import MeetingsView from '@/components/rep/MeetingsView'
import type { CalendarMeeting } from '@/lib/rep-meetings'

export const metadata = { title: 'My meetings' }

// A rep's own meetings. Only reachable by an account linked to a rep record;
// anyone else is sent back to the dashboard rather than shown an empty page that
// looks like a feature they cannot use.
export default async function MeetingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = serviceClient()
  const rep = await getRepForUser(admin, user.id, user.email)
  if (!rep) redirect('/dashboard')

  // Tolerant, through listMeetings: rep_meetings arrives with migration 047 and
  // its calendar columns with 048, both applied by hand after the deploy. An
  // empty calendar with a working "add" beats a stack trace.
  const res = await listMeetings(admin, { repId: rep.id })
  const meetings: CalendarMeeting[] = res.ok ? (res.meetings as CalendarMeeting[]) : []

  return <MeetingsView repName={rep.name} active={rep.active} initial={meetings} />
}
