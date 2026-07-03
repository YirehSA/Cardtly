import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { slugFromObjectId } from '@/lib/google-wallet'

// POST /api/wallet/google/callback
//
// Google Wallet save/delete callback. Fires whenever someone adds or
// removes a Cardtly pass (registered via callbackOptions on the class).
// We log it so a card owner can see how many people saved their card to
// Google Wallet.
//
// NOTE: we do a structural check (the object ID must resolve to a real
// Cardtly card) but do NOT cryptographically verify Google's ECv2
// signature. This only increments a non-sensitive save counter, so the
// worst case is an inflated vanity metric. If this ever feeds anything
// that matters, add full ECv2 signature verification.
//
// Always returns 200 so Google doesn't retry-storm on our parsing edge
// cases.

export const dynamic = 'force-dynamic'

function extractEvent(body: any): { objectId?: string; eventType?: string } {
  // Documented shape: { signedMessage: '{"objectId":..,"eventType":".."}', ... }
  if (body && typeof body.signedMessage === 'string') {
    try {
      const m = JSON.parse(body.signedMessage)
      return { objectId: m.objectId, eventType: m.eventType }
    } catch { /* fall through */ }
  }
  // Some deliveries put the fields at the top level.
  if (body && (body.objectId || body.eventType)) {
    return { objectId: body.objectId, eventType: body.eventType }
  }
  return {}
}

export async function POST(req: Request) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: true }) }

  const { objectId, eventType } = extractEvent(body)
  const slug = objectId ? slugFromObjectId(objectId) : null
  if (!slug || !eventType) return NextResponse.json({ ok: true })

  const et = String(eventType).toLowerCase()
  const mapped = et === 'save' ? 'wallet_save'
    : (et === 'del' || et === 'delete') ? 'wallet_remove'
    : null
  if (!mapped) return NextResponse.json({ ok: true })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ ok: true })
  const admin = createAdminClient(url, key) as any

  // Personal card first, then team card.
  const { data: card } = await admin.from('cards').select('id').eq('slug', slug).maybeSingle()
  if (card?.id) {
    await admin.from('card_events').insert({ card_id: card.id, event_type: mapped })
    return NextResponse.json({ ok: true })
  }
  const { data: teamCard } = await admin.from('team_cards').select('id').eq('slug', slug).maybeSingle()
  if (teamCard?.id) {
    await admin.from('team_card_events').insert({ team_card_id: teamCard.id, event_type: mapped })
  }
  return NextResponse.json({ ok: true })
}
