import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getPrimaryCard, getMemberTeamCard } from '@/lib/card-server'

// Saves a contact the signed-in user captured themselves (e.g. from
// the paper-card scanner) into their own contacts list. Distinct from
// /api/contact, which is the public lead-capture endpoint. The contact
// is attached to the user's own card so it shows in their Contacts
// dashboard, tagged source='scanned'.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    name?: string; title?: string; company?: string
    email?: string; phone?: string; website?: string; address?: string
    notes?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'A name is required' }, { status: 400 })
  }

  // Resolve which of the user's cards to attach to: personal first,
  // else a claimed team card.
  const personal = await getPrimaryCard<{ id: string }>(user.id, 'id')
  const teamCard = personal ? null : await getMemberTeamCard<{ id: string }>(user.id, 'id')
  const cardId = personal?.id || null
  const teamCardId = personal ? null : (teamCard?.id || null)

  if (!cardId && !teamCardId) {
    return NextResponse.json({ error: 'No card found on your account to save this against.' }, { status: 400 })
  }

  // Service role: insert bypasses RLS reliably (mirrors /api/contact).
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const { data, error } = await admin
    .from('contacts')
    .insert({
      card_id: cardId,
      team_card_id: teamCardId,
      name:    body.name.trim(),
      email:   body.email?.trim() || null,
      phone:   body.phone?.trim() || null,
      title:   body.title?.trim() || null,
      company: body.company?.trim() || null,
      website: body.website?.trim() || null,
      address: body.address?.trim() || null,
      message: body.notes?.trim() || null,
      source:  'scanned',
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: data.id })
}
