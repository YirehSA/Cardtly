import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sanitizeQuestionnaire } from '@/lib/questionnaire'

// Lets a client build/save their own questionnaire - but only if an
// admin has switched the add-on on for them (addons.questionnaireEnabled).
// Saves the question definitions into addons.questionnaire, preserving
// the other addon flags.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // Resolve the caller's card: personal first, else claimed team card.
  let table = 'cards'
  let { data: card } = await admin.from('cards').select('id, addons').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!card) {
    const r = await admin.from('team_cards').select('id, addons').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    table = 'team_cards'
    card = r.data
  }
  if (!card) return NextResponse.json({ error: 'No card found' }, { status: 404 })

  const addons = card.addons || {}
  if (!addons.questionnaireEnabled) {
    return NextResponse.json({ error: 'The questionnaire add-on is not enabled on your account.' }, { status: 403 })
  }

  const questionnaire = sanitizeQuestionnaire(body)
  const nextAddons = { ...addons, questionnaire }

  const { error } = await admin.from(table).update({ addons: nextAddons }).eq('id', card.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, questionnaire })
}
