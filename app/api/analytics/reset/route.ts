import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resetCardAnalytics } from '@/lib/team-analytics'
import { auditLog } from '@/lib/admin-audit'

// Reset ONE personal card's analytics to zero, by the person whose card it is
// (Andre, 2026-11-23: "reset only one card to check the end of the month").
//
// Only their own personal card: the card is matched on user_id = the signed-in
// login, so an id from the browser can never reach somebody else's. A team
// card is the company's numbers and is reset by the team owner on Team
// analytics (app/api/team/analytics), never from here.
//
// Contacts are kept (lib/team-analytics). Irreversible, so the page confirms
// first, and every reset goes to the audit log, which is also where the page
// reads "counting since" from.

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const cardId = String(body?.card_id || '')
  if (!cardId) return NextResponse.json({ error: 'Which card?' }, { status: 400 })

  const admin = createServiceClient() as any
  const { data: card } = await admin.from('cards').select('id, name, slug')
    .eq('id', cardId).eq('user_id', user.id).maybeSingle()
  if (!card) return NextResponse.json({ error: 'That card is not yours.' }, { status: 404 })

  try {
    const result = await resetCardAnalytics(admin, card.id)
    await auditLog(admin, {
      actorUserId: user.id, actorEmail: user.email, action: 'card_reset_analytics',
      detail: { card_id: card.id, card_name: card.name, card_slug: card.slug, ...result },
    })
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not reset the analytics.' }, { status: 500 })
  }
}
