import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { card_id, team_card_id, event_type, link_title } = body

    // Need either a personal or team card id plus an event type.
    if ((!card_id && !team_card_id) || !event_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const headersList = await headers()
    const ua = headersList.get('user-agent') || ''
    const referrer = headersList.get('referer') || ''

    const device = detectDevice(ua)
    const browser = detectBrowser(ua)
    const os = detectOS(ua)

    const supabase = await createClient()

    if (card_id) {
      // Personal card: insert card_events row. A DB trigger
      // (migration 019) bumps cards.view_count from this row -
      // server-side so RLS can't block it.
      await (supabase.from('card_events') as any).insert({
        card_id,
        event_type,
        link_title: link_title || null,
        device,
        browser,
        os,
        referrer: referrer || null,
      })
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
      await (supabase.from('team_card_events') as any).insert({
        team_card_id,
        event_type,
        link_title: link_title || null,
        device,
        browser,
        os,
        referrer: referrer || null,
      })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
