import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { card_id, team_card_id, name, email, phone, message } = body

    if (!name || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!card_id && !team_card_id) {
      return NextResponse.json({ error: 'Missing card reference' }, { status: 400 })
    }

    const supabase = await createClient() as any

    const { error } = await supabase
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
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
