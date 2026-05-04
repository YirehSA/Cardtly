import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { card_id, team_card_id, name, email, phone, message } = body

    console.log('Contact form submission:', { card_id, team_card_id, name, email })

    if (!name || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!card_id && !team_card_id) {
      return NextResponse.json({ error: 'Missing card reference' }, { status: 400 })
    }

    // Use admin client to bypass RLS entirely
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await admin
      .from('contacts')
      .insert({
        card_id:      card_id || null,
        team_card_id: team_card_id || null,
        name,
        email,
        phone:   phone || null,
        message: message || null,
        source:  'card_form',
      })

    if (error) {
      console.error('Contact insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contact route error:', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
