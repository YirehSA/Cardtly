import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { resolveAddonTarget, loadOwnedTarget } from '@/lib/addon-target'
import { getUserPlan } from '@/lib/plan-server'
import { canonicaliseContextForSave, mergeContextAddon, readStoredContext } from '@/lib/card-context'

// Saves a Pro owner's Cardtly Context configuration into addons.context.
//
// THE PLATFORM SWITCH IS NOT CHECKED HERE, ON PURPOSE. CONTEXT_ENABLED in
// lib/card-context.ts governs whether Context EXECUTES on a public card. It
// has nothing to do with whether a customer may configure it, and conflating
// the two would mean we could not build, save or preview a single
// configuration until the day we turned the feature on for everybody at once.
// The separation is the whole release plan:
//
//   platform off + customer on + full config saved -> public card is standard
//   platform on  + customer on                     -> Context goes live
//
// The public card asks readCardContext, which checks the platform switch
// first. This route asks readStoredContext, which does not. Nothing saved
// through here can display anywhere until that switch moves.
//
// Like /api/card/questionnaire, this deliberately does NOT require the add-on
// to be switched on: an owner can build their audiences first and turn Context
// live when they are happy with it. And like /api/card/addons, switching it
// off never deletes what was built - the configuration is stored alongside the
// flag, not instead of it.
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

  // Same target resolution as the questionnaire builder: an explicit target
  // from the editor's switcher is honoured only after loadOwnedTarget has
  // confirmed this user owns it, and otherwise we fall back to their default.
  const target = (body?.targetTable && body?.targetId)
    ? await loadOwnedTarget(admin, user.id, body.targetTable, body.targetId)
    : await resolveAddonTarget(admin, user.id)
  if (!target) return NextResponse.json({ error: 'No card found' }, { status: 404 })

  const plan = await getUserPlan(user.id)
  if (!(plan.tier === 'pro' && plan.isActive)) {
    return NextResponse.json({ error: 'This is a Pro feature. Subscribe to switch it on.' }, { status: 403 })
  }

  const result = canonicaliseContextForSave(body?.context)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  // MERGE, NEVER REPLACE. This route knows about one key and must not be able
  // to touch another, so contact exchange, the questionnaire and the Cardtly
  // badge come through untouched. The same merge is why turning Context off
  // keeps every audience: the flag and the configuration are one object,
  // written together.
  const nextAddons = mergeContextAddon(target.addons, result.stored)

  const { error } = await admin.from(target.table).update({ addons: nextAddons }).eq('id', target.id)
  if (error) {
    // The message can carry column names, constraint names and row contents,
    // none of which is the caller's business. Logged where we can read it,
    // and answered with something the owner can act on.
    console.error('context save failed:', error)
    return NextResponse.json({ error: 'Could not save that. Please try again.' }, { status: 500 })
  }

  // THE CANONICAL STORED CONFIGURATION, read back through the same parser the
  // public card uses. The editor replaces its draft with this, so what the
  // owner sees after saving is what is stored and what the card will read,
  // rather than three hopeful copies of the same idea.
  const saved = readStoredContext(nextAddons)
  return NextResponse.json({
    success: true,
    context: { enabled: saved.enabled, audiences: saved.config.audiences, defaultAudience: saved.config.defaultAudience },
  })
}
