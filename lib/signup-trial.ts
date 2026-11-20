// The 7-day trial, taken only by somebody who will not choose a plan (Andre,
// 2026-11-20: "we don't want to promote the trial, they must actually just
// choose between the 2, and if they don't want to then we offer the 7 day free
// trial"). The trial is Cardtly Solo, not Pro.
//
// Once only: an account can take it while it has no trial and has never had a
// subscription (migration 109's trial_tier 'none'). Claimed compare-and-set, so
// two clicks cannot start it twice. A rep's trial code is separate and still
// gives a Pro trial (app/api/trial-code/claim).

export const SIGNUP_TRIAL_DAYS = 7

export type StartTrialResult =
  | { ok: true; endsAt: string }
  | { ok: false; status: number; error: string }

export async function startSoloTrial(db: any, userId: string, now = new Date()): Promise<StartTrialResult> {
  const { data: profile, error } = await db.from('profiles').select('trial_tier').eq('user_id', userId).maybeSingle()
  if (error) {
    return /trial_tier/.test(error.message || '')
      ? { ok: false, status: 503, error: 'The free trial is not switched on yet. Choose a plan, or try again shortly.' }
      : { ok: false, status: 500, error: 'Could not start your trial. Please try again.' }
  }
  if (profile?.trial_tier !== 'none') {
    return { ok: false, status: 409, error: 'This account has already had its free trial, or is already on a plan.' }
  }
  const { count } = await db.from('whop_subscriptions').select('user_id', { count: 'exact', head: true }).eq('user_id', userId)
  if ((count ?? 0) > 0) {
    return { ok: false, status: 409, error: 'This account has had a plan before, so the free trial is not available. Choose Solo or Pro.' }
  }
  const endsAt = new Date(now.getTime() + SIGNUP_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data: claimed, error: upErr } = await db.from('profiles')
    .update({ trial_tier: 'solo', trial_ends_at: endsAt })
    .eq('user_id', userId).eq('trial_tier', 'none')
    .select('user_id')
  if (upErr) return { ok: false, status: 500, error: 'Could not start your trial. Please try again.' }
  if (!claimed?.length) return { ok: false, status: 409, error: 'Your trial has already started.' }
  return { ok: true, endsAt }
}
