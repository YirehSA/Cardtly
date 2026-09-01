import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/plan-server'
import { resolveAddonTarget, loadOwnedTarget } from '@/lib/addon-target'

// Lets a user switch their own card features on and off.
//
// The contact-exchange popup and the custom questionnaire used to be
// add-ons an admin granted per client, which meant a paying customer had to
// email and ask. They are standard on Pro now, and this is how the user
// turns them on and off themselves. /api/admin's set_card_addon is gone.
//
// Body: { addon, value, targetTable?, targetId? }
//
// The target is explicit because a team admin has two separate places to
// configure: the organization (fans out to every team card) and their own
// personal card. Without a target we fall back to the default resolution
// order, which is org-first.

const ALLOWED = ['contactExchange', 'questionnaireEnabled', 'cardtlyBadge'] as const

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { addon?: string; value?: boolean; targetTable?: string; targetId?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { addon, value, targetTable, targetId } = body
  if (!addon || !(ALLOWED as readonly string[]).includes(addon) || typeof value !== 'boolean') {
    return NextResponse.json({ error: 'Unknown feature' }, { status: 400 })
  }

  // All three are Pro. A trial counts as Pro, so a trialling user gets the real
  // thing rather than a preview of it.
  //
  // The badge is here too, which is not a new paywall: a card that is not Pro
  // has always carried "Powered by Cardtly" with no way to remove it. The badge
  // is a better-looking version of that line, and PublicCardView falls back to
  // it if the badge is ever off on a card that is not Pro - so switching off
  // still cannot strip a free card of the mark.
  const plan = await getUserPlan(user.id)
  if (!(plan.tier === 'pro' && plan.isActive)) {
    return NextResponse.json({ error: 'This is a Pro feature. Subscribe to switch it on.' }, { status: 403 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // loadOwnedTarget verifies the caller actually owns/administers the target
  // they posted, so a crafted request cannot flip a feature on someone
  // else's card.
  const target = (targetTable && targetId)
    ? await loadOwnedTarget(admin, user.id, targetTable, targetId)
    : await resolveAddonTarget(admin, user.id)
  if (!target) return NextResponse.json({ error: 'No card found' }, { status: 404 })

  // Merge rather than replace: the questionnaire definitions live in the
  // same jsonb, and turning the feature off must not delete the form the
  // user built. Switching back on brings it straight back.
  const nextAddons = { ...target.addons, [addon]: value }

  const { error } = await admin.from(target.table).update({ addons: nextAddons }).eq('id', target.id)
  if (error) {
    console.error('card/addons update failed:', error)
    return NextResponse.json({ error: 'Could not save that. Try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, addons: nextAddons })
}
