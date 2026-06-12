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
      // Personal card: insert card_events row. A Supabase-side
      // trigger (configured in the dashboard, not in repo
      // migrations) bumps cards.view_count from this row.
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

    if (team_card_id && event_type === 'view') {
      // Team card: no card_events equivalent yet, so bump the
      // denormalized counter on team_cards directly. Read then
      // write +1 - simultaneous views can race and undercount,
      // which is fine for an analytics counter and avoids needing
      // to ship a Postgres function. Migration 009 added the column.
      const { data: tc } = await (supabase
        .from('team_cards') as any)
        .select('view_count')
        .eq('id', team_card_id)
        .single()
      if (tc) {
        await (supabase
          .from('team_cards') as any)
          .update({ view_count: ((tc as any).view_count || 0) + 1 })
          .eq('id', team_card_id)
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
