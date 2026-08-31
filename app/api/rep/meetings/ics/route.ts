import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRepForUser, serviceClient } from '@/lib/rep-access'
import { listMeetings } from '@/lib/rep-meetings-server'
import { buildIcs } from '@/lib/ics'
import type { RepMeeting } from '@/lib/rep-meetings'

// Download a rep's meetings as a calendar file.
//
// Scoped to the signed-in rep, exactly like the JSON route: the rep_id comes
// from the session and never from the request.
//
//   /api/rep/meetings/ics             every meeting
//   /api/rep/meetings/ics?id=<uuid>   just that one, for "add to my diary"
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = serviceClient()
  const rep = await getRepForUser(admin, user.id, user.email)
  if (!rep) return NextResponse.json({ error: 'Not a rep account' }, { status: 403 })

  const res = await listMeetings(admin, { repId: rep.id })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })

  const one = new URL(request.url).searchParams.get('id')
  const meetings = (one
    ? res.meetings.filter((m: any) => m.id === one)
    : res.meetings) as RepMeeting[]

  if (one && meetings.length === 0) {
    return NextResponse.json({ error: 'That meeting is not yours or no longer exists.' }, { status: 404 })
  }

  const body = buildIcs(meetings, { calendarName: `${rep.name} - Cardtly meetings` })
  const filename = one ? `cardtly-meeting-${one.slice(0, 8)}.ics` : 'cardtly-meetings.ics'

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // A diary is not something to serve from a cache.
      'Cache-Control': 'no-store',
    },
  })
}
