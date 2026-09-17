import { createServiceClient } from '@/lib/supabase/server'
import { visitorHash, clientIp, sourceOrigin } from '@/lib/visitor-hash'
import { isMissingColumn } from '@/lib/pg-errors'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { sanitiseEventMetadata, MAX_METADATA_BYTES } from '@/lib/card-context'

function detectDevice(ua: string): string {
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
  if (/mobile|iphone|ipod|android|blackberry|opera mini|windows phone/i.test(ua)) return 'mobile'
  return 'desktop'
}

function detectBrowser(ua: string): string {
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome'
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari'
  if (ua.includes('Edg')) return 'Edge'
  if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera'
  return 'Other'
}

function detectOS(ua: string): string {
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Mac OS')) return 'macOS'
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('Linux')) return 'Linux'
  return 'Other'
}

/**
 * An insert failed. Say so, without saying anything the visitor should not
 * hear.
 *
 * WHY THIS EXISTS. This route used to discard the insert result and return
 * success unconditionally, so a failing write was invisible: the schema
 * mismatch found while building migration 080 returned {"success":true} while
 * storing nothing. Analytics that can lose events silently cannot be used to
 * decide whether a feature works, which is exactly what these Context events
 * are for.
 *
 * THE CLIENT GETS NOTHING DIAGNOSTIC. A public card visitor is anonymous and
 * untrusted; Postgres error text names tables, columns, constraints and
 * policies. That belongs in the server log, which is ours, and not in a
 * response anybody can read. Same shape as the other failures in this route.
 */
function failed(table: string, error: unknown, eventType: unknown) {
  const detail = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  console.error('analytics insert failed', {
    table,
    event_type: typeof eventType === 'string' ? eventType.slice(0, 40) : null,
    code: detail.code ?? null,
    message: detail.message ?? null,
  })
  return NextResponse.json({ success: false }, { status: 500 })
}

export async function POST(request: Request) {
  try {
    // REFUSE AN ABSURD BODY BEFORE PARSING IT. An analytics event is a couple
    // of hundred bytes; 8KB is enormously generous and still makes it
    // impossible to push a document through this endpoint. Only enforced when
    // the header is actually present, so a client that omits it is not
    // punished - the metadata cap below is the real limit either way.
    const declared = Number(request.headers.get('content-length') || 0)
    if (declared > 8192) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    const body = await request.json()
    const { card_id, team_card_id, event_type, link_title } = body

    // Need either a personal or team card id plus an event type.
    if ((!card_id && !team_card_id) || !event_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validated against an allow-list, never trusted. Null means store no
    // metadata; it never means reject the event, because a malformed payload
    // must not cost an owner an ordinary card view. See lib/card-context.
    const metadata = sanitiseEventMetadata(body.metadata)

    // Only mentioned in the insert when there is something to store. An
    // ordinary event therefore never references the column at all, which is
    // what makes this code safe to deploy before migration 080 has run.
    const withMetadata = metadata ? { metadata } : {}

    const headersList = await headers()
    const ua = headersList.get('user-agent') || ''

    // FROM THE BODY, NOT THE HEADER. This used to be
    // headersList.get('referer'), which on a POST made BY the card page is the
    // card page - so the column recorded the visitor's destination rather than
    // their origin, every time. Across 5,325 rows not one held a real source:
    // all of them were cardtly.com/card/... or localhost. lib/track now sends
    // document.referrer, which is the only value that knows the answer.
    const referrer = sourceOrigin((body as { referrer?: unknown }).referrer)

    const device = detectDevice(ua)
    const browser = detectBrowser(ua)
    const os = detectOS(ua)

    // THE SERVICE ROLE, not the visitor's session. A card view is recorded on
    // behalf of somebody anonymous, and until migration 085 that meant the anon
    // key held INSERT on the two events tables - so anybody could post events
    // straight to PostgREST and invent views, taps and leads on any card whose
    // id they had, which is in the page. 085 revoked it and this insert went
    // with it, which is how the gap was found.
    //
    // Writing them here instead is what the two view_count triggers already do
    // one level down: the comment below says the app-side increment "ran with
    // the anonymous visitor's session, which RLS blocks", and the fix then was
    // a SECURITY DEFINER trigger. Same reasoning, one level up.
    const supabase = createServiceClient()

    // WHO, as far as anybody is allowed to know. Scoped to the card it belongs
    // to and rotated daily, so it answers "has this visitor already viewed
    // THIS card TODAY" and nothing wider. See lib/visitor-hash.ts.
    const ip = clientIp(headersList)
    const visitorFor = (scope: string) => {
      const hash = visitorHash({ ip, userAgent: ua, scope })
      return hash ? { visitor_hash: hash } : {}
    }

    /**
     * Insert, and survive the column not existing yet.
     *
     * This code deployed somewhere migration 086 has not run. An event is
     * worth more than the extra field on it, so the row is written without the
     * hash rather than lost - the same call that would otherwise return 500
     * and drop a real card view. The retry is attempted once, and only for the
     * field this route added.
     *
     * isMissingColumn rather than a code test written here, because the right
     * code is not the obvious one. An INSERT never raises Postgres's 42703:
     * PostgREST refuses the payload against its own schema cache before any
     * SQL is sent, so the code is PGRST204. Tested against the real database
     * with the column absent. A first version of this checked 42703 alone,
     * did nothing whatsoever, and would have returned 500 on every card view
     * until migration 086 ran. See lib/pg-errors.ts.
     */
    const insertEvent = async (table: string, row: Record<string, unknown>) => {
      const { error } = await (supabase.from(table) as any).insert(row)
      if (error && isMissingColumn(error) && 'visitor_hash' in row) {
        const { visitor_hash: _dropped, ...withoutHash } = row
        const retry = await (supabase.from(table) as any).insert(withoutHash)
        return retry.error
      }
      return error
    }

    if (card_id) {
      // Personal card: insert card_events row. A DB trigger
      // (migration 019) bumps cards.view_count from this row -
      // server-side so RLS can't block it.
      const error = await insertEvent('card_events', {
        card_id,
        event_type,
        link_title: link_title || null,
        device,
        browser,
        os,
        referrer: referrer || null,
        ...withMetadata,
        ...visitorFor(card_id),
      })
      if (error) return failed('card_events', error, event_type)
    }

    if (team_card_id) {
      // Team card: log to its own events table so we can do
      // time-windowed analytics (last 30d, this month) instead of
      // just running totals. team_card_events mirrors card_events
      // and was added in migration 010.
      //
      // team_cards.view_count is kept in sync by a DB trigger
      // (migration 018), NOT here - the old app-side increment ran
      // with the anonymous visitor's session, which RLS blocks on
      // team_cards, so it silently undercounted. The trigger runs
      // server-side and can't be blocked.
      const error = await insertEvent('team_card_events', {
        team_card_id,
        event_type,
        link_title: link_title || null,
        device,
        browser,
        os,
        referrer: referrer || null,
        ...withMetadata,
        ...visitorFor(team_card_id),
      })
      if (error) return failed('team_card_events', error, event_type)
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
