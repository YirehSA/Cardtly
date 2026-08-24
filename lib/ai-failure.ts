// What to tell the user when an OpenAI call fails, and when to tell Andre.
//
// Nothing is imported at module scope, so classifyAiError can be compiled and
// tested on its own the way lib/calendar.ts is. Resend and the Supabase client
// are pulled in inside reportAiFailure, which also keeps them out of the module
// graph of every request that does not fail.
//
// Both AI routes used to do this:
//
//   catch (err) { return NextResponse.json({ error: err.message }, ...) }
//
// which handed OpenAI's own wording to the customer. When the balance ran out,
// a paying Pro user tapping Scan was shown "You exceeded your current quota,
// please check your plan and billing details" - a message about OUR billing,
// addressed to someone who had already paid, on a feature they were entitled
// to. It also reads as though the fault is theirs, so nobody reports it, and
// the first sign of an empty balance is a customer eventually mentioning it.
//
// Two rules here:
//   1. The provider's error text never reaches the client.
//   2. Anything that is our fault to fix emails us, once an hour at most.

const OPS_EMAIL = 'hello@cardtly.com'

export type FailureKind =
  | 'not_configured'   // no API key in the environment
  | 'out_of_credit'    // balance exhausted
  | 'bad_key'          // key revoked, rotated or wrong
  | 'model_denied'     // account cannot use this model
  | 'rate_limited'     // too many requests, transient
  | 'provider_down'    // OpenAI 5xx
  | 'unreachable'      // network or timeout
  | 'unknown'

type Classified = {
  kind: FailureKind
  /** Safe to show a customer. Never contains provider text. */
  userMessage: string
  status: number
  /** Is this ours to fix? Transient provider trouble is not. */
  ours: boolean
}

// "Temporarily unavailable" for everything we have to go and fix, because from
// the user's side that is exactly what it is, and it invites them to try again
// rather than to go hunting for a problem with their own account.
const OURS = 'Card scanning is temporarily unavailable. We have been alerted and are looking at it. Please try again shortly.'

export function classifyAiError(err: unknown, feature: 'scan' | 'bio'): Classified {
  const e = err as any
  const status: number | undefined = typeof e?.status === 'number' ? e.status : undefined
  const code: string = typeof e?.code === 'string' ? e.code : ''
  const type: string = typeof e?.type === 'string' ? e.type : ''
  const blob = `${code} ${type} ${typeof e?.message === 'string' ? e.message : ''}`.toLowerCase()

  const ours = feature === 'scan'
    ? OURS
    : 'The bio writer is temporarily unavailable. We have been alerted and are looking at it. Please try again shortly.'

  // Quota first: it arrives as a 429 like an ordinary rate limit, and the two
  // need opposite handling. A rate limit clears by waiting; an empty balance
  // never does, and waiting is exactly the wrong advice.
  if (code === 'insufficient_quota' || blob.includes('insufficient_quota') || blob.includes('exceeded your current quota')) {
    return { kind: 'out_of_credit', userMessage: ours, status: 503, ours: true }
  }
  if (status === 401 || code === 'invalid_api_key' || blob.includes('incorrect api key')) {
    return { kind: 'bad_key', userMessage: ours, status: 503, ours: true }
  }
  if (status === 403 || code === 'model_not_found' || blob.includes('does not have access to model')) {
    return { kind: 'model_denied', userMessage: ours, status: 503, ours: true }
  }
  if (status === 429) {
    return {
      kind: 'rate_limited',
      userMessage: feature === 'scan'
        ? 'Too many scans at once. Give it a few seconds and try again.'
        : 'Too many requests at once. Give it a few seconds and try again.',
      status: 429,
      ours: false,
    }
  }
  if (typeof status === 'number' && status >= 500) {
    return {
      kind: 'provider_down',
      userMessage: feature === 'scan'
        ? 'Card scanning is having trouble right now. Please try again in a minute.'
        : 'The bio writer is having trouble right now. Please try again in a minute.',
      status: 503,
      ours: false,
    }
  }
  if (blob.includes('timeout') || blob.includes('econnreset') || blob.includes('fetch failed') || e?.name === 'AbortError') {
    return {
      kind: 'unreachable',
      userMessage: feature === 'scan'
        ? 'That took too long. Try again, and a smaller photo will be quicker.'
        : 'That took too long. Please try again.',
      status: 504,
      ours: false,
    }
  }
  // An unrecognised failure is ours until proven otherwise. Silence on
  // something we cannot classify is how a broken feature stays broken.
  return { kind: 'unknown', userMessage: ours, status: 500, ours: true }
}

const SUBJECTS: Record<FailureKind, string> = {
  not_configured: 'Cardtly AI is not configured',
  out_of_credit:  'Cardtly AI has run out of OpenAI credit',
  bad_key:        'Cardtly AI key is being rejected',
  model_denied:   'Cardtly AI cannot access its model',
  rate_limited:   'Cardtly AI is being rate limited',
  provider_down:  'OpenAI is returning errors to Cardtly',
  unreachable:    'Cardtly cannot reach OpenAI',
  unknown:        'Cardtly AI failed for an unrecognised reason',
}

const WHAT_TO_DO: Record<FailureKind, string> = {
  not_configured: 'OPENAI_API_KEY is missing from the environment. Set it in Vercel, Project Settings, Environment Variables, then redeploy.',
  out_of_credit:  'Top up at platform.openai.com, Settings, Billing. Turn on auto recharge so this does not repeat.',
  bad_key:        'The key has been revoked or rotated. Issue a new one at platform.openai.com and update OPENAI_API_KEY in Vercel.',
  model_denied:   'The account cannot use this model. Check model access on the OpenAI account the key belongs to.',
  rate_limited:   'Usually clears itself. If it persists, the account tier limits are too low for current traffic.',
  provider_down:  'OpenAI side. Check status.openai.com. Usually clears itself.',
  unreachable:    'Network or timeout reaching OpenAI. Usually clears itself.',
  unknown:        'Not recognised. The detail below is the raw provider error.',
}

/**
 * Email Andre, at most once an hour per kind.
 *
 * Never throws and never blocks the caller's own error handling: a failure to
 * report a failure must not turn a handled error into a 500.
 */
export async function reportAiFailure(
  kind: FailureKind,
  detail: string,
  feature: 'scan' | 'bio',
): Promise<void> {
  try {
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return

    const [{ Resend }, { createServiceClient }, { FROM_EMAIL }] = await Promise.all([
      import('resend'),
      import('@/lib/supabase/server'),
      import('@/lib/email'),
    ])

    const admin = createServiceClient() as any
    const windowStart = new Date()
    windowStart.setMinutes(0, 0, 0)

    // Claim the hour. A unique violation means somebody already sent this one.
    const { error } = await admin.from('ops_alerts').insert({
      kind: `ai_${kind}`,
      window_start: windowStart.toISOString(),
      detail: detail.slice(0, 2000),
    })
    if (error) {
      // 23505: already alerted this hour, which is the point. 42P01: the table
      // has not been created yet, in which case fall through and send anyway -
      // an un-run migration should not cost us the alert that matters.
      if (error.code === '23505') return
      if (error.code !== '42P01') return
    }

    const featureName = feature === 'scan' ? 'Business card scanner' : 'AI bio writer'
    const html = `
      <p><strong>${featureName}</strong> is failing for users right now.</p>
      <p>${WHAT_TO_DO[kind]}</p>
      <p style="color:#666;font-size:13px">Both the scanner (gpt-4o) and the bio writer (gpt-4o-mini) share one OPENAI_API_KEY, so if this is a billing or key problem, both are down.</p>
      <p style="color:#666;font-size:13px">Users are being shown a neutral "temporarily unavailable" message, not this.</p>
      <pre style="background:#f4f4f5;padding:12px;border-radius:8px;font-size:12px;white-space:pre-wrap">${escapeHtml(detail.slice(0, 1000))}</pre>
      <p style="color:#999;font-size:12px">One alert per problem per hour.</p>
    `

    await new Resend(resendKey).emails.send({
      from: FROM_EMAIL,
      to: OPS_EMAIL,
      subject: SUBJECTS[kind],
      html,
    })
  } catch {
    // Deliberately silent. Reporting is best effort.
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
