import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sanitizeQuestionnaire } from '@/lib/questionnaire'
import { resolveAddonTarget } from '@/lib/addon-target'

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

  // Org for a team admin (applies to all team cards), else the caller's
  // own card.
  const target = await resolveAddonTarget(admin, user.id)
  if (!target) return NextResponse.json({ error: 'No card found' }, { status: 404 })

  if (!target.addons.questionnaireEnabled) {
    return NextResponse.json({ error: 'The questionnaire add-on is not enabled on your account.' }, { status: 403 })
  }

  const questionnaire = sanitizeQuestionnaire(body)
  const nextAddons = { ...target.addons, questionnaire }

  const { error } = await admin.from(target.table).update({ addons: nextAddons }).eq('id', target.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, questionnaire })
}
