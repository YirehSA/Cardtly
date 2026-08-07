import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { normaliseCode, rejectCode, REJECTION_MESSAGE, type TrialCodeRow } from '@/lib/trial-codes'
import { isIosAppUA } from '@/lib/app-platform'

// Redeems a trial code for the signed-in account.
//
// Server-side and service-role on purpose. The signup page creates the profile
// row from the browser, so if the trial length were set there a user could put
// any date in it - the gate would be advisory. The length is decided here, from
// the code's own `days`, and never from anything the client sends.
//
// Called right after signup. If it is never called, or the code is bad, the
// account keeps the no-trial default from migration 046 and has to pay: the gate
// fails closed, and a trial that should have been granted can be given from the
// admin panel.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let code: string
  try {
    const body = await request.json()
    code = normaliseCode(body?.code)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (!code) return NextResponse.json({ error: 'Enter a trial code.' }, { status: 400 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const { data: row, error: lookupError } = await admin
    .from('trial_codes')
    .select('id, code, days, active, expires_at, max_uses, uses')
    .eq('code', code)
    .maybeSingle()

  if (lookupError) {
    // The table arrives with migration 046. Say so rather than telling a real
    // customer their valid code is invalid.
    if (lookupError.code === '42P01' || lookupError.code === '42703') {
      console.error('trial-code claim: migration 046 not applied yet')
      return NextResponse.json({ error: 'Trial codes are not switched on yet. Contact us and we will set your trial up.' }, { status: 503 })
    }
    console.error('trial-code lookup failed:', lookupError)
    return NextResponse.json({ error: 'Could not check that code. Please try again.' }, { status: 500 })
  }

  const rejection = rejectCode(row as TrialCodeRow | null)
  if (rejection) {
    return NextResponse.json({ error: REJECTION_MESSAGE[rejection] }, { status: 400 })
  }

  const days: number = (row as TrialCodeRow).days

  // Not from inside the iOS app, at all.
  //
  // App Review's second finding on 1.0 (7) was explicit: "the app uses a trial
  // code to unlock or enable subscriptions", and their instruction was to
  // remove the feature. The box itself is gone with /dashboard/upgrade, but a
  // ?code= link captured at signup would still claim one silently - the same
  // mechanism, just out of sight. Refused here so it is gone in fact and not
  // only in the interface. The web and Android are untouched.
  if (isIosAppUA(request.headers.get('user-agent'))) {
    return NextResponse.json({
      error: 'Trial codes cannot be redeemed in the iOS app. Open cardtly.com in a browser to use your code.',
    }, { status: 403 })
  }

  // One code per account. Without this the same code could be replayed to stack
  // trials indefinitely - the account is already signed in, so the request is
  // trivially repeatable.
  const { data: profile } = await admin
    .from('profiles').select('trial_code').eq('user_id', user.id).maybeSingle()
  if ((profile as any)?.trial_code) {
    // A dead end for the customer unless it says what to do next: they cannot
    // clear this themselves, and a second trial is a decision for us to make in
    // the admin panel rather than something a code should stack.
    return NextResponse.json({
      error: 'A trial code has already been used on this account. Contact us if you need more time.',
    }, { status: 409 })
  }

  const endsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

  const { error: grantError } = await admin
    .from('profiles')
    .update({ trial_ends_at: endsAt, trial_code: code })
    .eq('user_id', user.id)

  if (grantError) {
    console.error('trial-code grant failed:', grantError)
    return NextResponse.json({ error: 'Could not start your trial. Please contact us.' }, { status: 500 })
  }

  // Counted after the grant, so a failed grant never burns a use. Counting is
  // for reporting and the optional cap; a lost increment costs a statistic, an
  // ungranted trial costs a customer.
  await admin
    .from('trial_codes')
    .update({ uses: (row as TrialCodeRow).uses + 1, updated_at: new Date().toISOString() })
    .eq('id', (row as TrialCodeRow).id)

  return NextResponse.json({ success: true, days, trial_ends_at: endsAt })
}
