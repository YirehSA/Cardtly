import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sanitizeQuestionnaire, sanitizeLibrary } from '@/lib/questionnaire'
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

  // New shape: a library of up to 3 forms plus which one is live.
  // Legacy shape: a single { title, questions } - wrap it as one form.
  let questionnaires, active
  if (Array.isArray(body?.questionnaires)) {
    const r = sanitizeLibrary(body.questionnaires, body.activeId)
    questionnaires = r.questionnaires
    active = r.active
  } else {
    const single = sanitizeQuestionnaire(body)
    const form = { id: 'form_1', title: single.title, questions: single.questions }
    questionnaires = [form]
    active = form
  }

  const nextAddons = {
    ...target.addons,
    questionnaires,
    activeQuestionnaireId: active.id,
    // Keep the live form mirrored here so the public card, contact form,
    // exports, and everything else keep reading a single questionnaire
    // with no changes.
    questionnaire: { title: active.title, questions: active.questions },
  }

  const { error } = await admin.from(target.table).update({ addons: nextAddons }).eq('id', target.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, questionnaires, activeId: active.id })
}
