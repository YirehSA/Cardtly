import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getRepForUser, serviceClient } from '@/lib/rep-access'
import MeetingsView from '@/components/rep/MeetingsView'
import type { RepMeeting } from '@/lib/rep-meetings'

export const metadata = { title: 'My meetings' }

// A rep's own meetings. Only reachable by an account linked to a rep record;
// anyone else is sent back to the dashboard rather than shown an empty page that
// looks like a feature they cannot use.
export default async function MeetingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = serviceClient()
  const rep = await getRepForUser(admin, user.id)
  if (!rep) redirect('/dashboard')

  // Tolerant: rep_meetings arrives with migration 047, applied by hand after
  // the deploy. An empty list with a working "add" form is a better landing
  // than a stack trace.
  const meetings: RepMeeting[] = await (async () => {
    try {
      const { data, error } = await admin
        .from('rep_meetings')
        .select('*')
        .eq('rep_id', rep.id)
        .order('scheduled_at', { ascending: false })
      if (error) return []
      return (data || []) as RepMeeting[]
    } catch {
      return []
    }
  })()

  return <MeetingsView repName={rep.name} active={rep.active} initial={meetings} />
}
