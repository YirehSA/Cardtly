import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  keyFromHeader, hashApiKey, hashesMatch, hasPermission, isExpired, type Permission,
} from '@/lib/api-keys'

// Authenticating a request to the public API.
//
// Every v1 endpoint starts here and nothing reaches data without it. The
// checks are ordered so the cheapest refusals happen first, and every refusal
// says the same amount: "that key is not valid" rather than "that key exists
// but has expired", which would confirm a guessed key to whoever guessed it.

export type ApiContext = {
  keyId: string
  orgId: string
  permissions: string[]
  /** Populated by the endpoint and written when it finishes. */
  startedAt: number
}

export function apiError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...(extra || {}) }, { status })
}

export function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as any
}

/**
 * Resolve a request to an organisation, or refuse it.
 *
 * Returns either a context or a Response to send straight back.
 */
export async function authenticate(
  admin: any,
  request: Request,
  needed: Permission,
): Promise<{ ctx: ApiContext } | { response: NextResponse }> {
  const startedAt = Date.now()
  const key = keyFromHeader(request.headers.get('authorization'))
  if (!key) {
    return { response: apiError(401, 'Provide your API key as: Authorization: Bearer ck_...') }
  }

  const hash = hashApiKey(key)
  const { data: row, error } = await admin
    .from('api_keys').select('*').eq('key_hash', hash).maybeSingle()

  if (error) {
    // 42P01: the table does not exist on this database.
    return { response: apiError(503, 'The API is not available on this deployment.') }
  }

  // Deliberately the same message for "no such key", "revoked" and "expired".
  // Distinguishing them tells somebody working through guesses which of their
  // guesses was once real.
  const invalid = apiError(401, 'That API key is not valid.')
  if (!row) return { response: invalid }
  // Belt and braces on top of the indexed lookup: if this ever changes to
  // fetch by anything other than the hash, the comparison stays constant time.
  if (!hashesMatch(row.key_hash, hash)) return { response: invalid }
  if (!row.is_active) return { response: invalid }
  if (isExpired(row.expires_at, new Date())) return { response: invalid }

  if (!hasPermission(row.permissions, needed)) {
    // This one CAN be specific: the caller already proved the key is theirs.
    return { response: apiError(403, `This key does not have the "${needed}" permission.`) }
  }

  // Rate limit, counted from what was actually served rather than a counter
  // that can drift. usage_count on the key is a lifetime total and is not used
  // for this.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('api_usage_logs')
    .select('id', { count: 'exact', head: true })
    .eq('api_key_id', row.id)
    .gte('created_at', hourAgo)

  const limit = row.rate_limit_per_hour || 1000
  if ((count || 0) >= limit) {
    return {
      response: apiError(429, `Rate limit reached: ${limit} requests an hour. Try again shortly.`, {
        limit, retry_after_seconds: 300,
      }),
    }
  }

  return { ctx: { keyId: row.id, orgId: row.org_id, permissions: row.permissions || [], startedAt } }
}

/**
 * Record the call. Never throws: a failure to write the log must not turn a
 * served response into an error.
 */
export async function logUsage(
  admin: any,
  ctx: ApiContext,
  request: Request,
  status: number,
): Promise<void> {
  try {
    const url = new URL(request.url)
    await admin.from('api_usage_logs').insert({
      api_key_id: ctx.keyId,
      endpoint: url.pathname,
      method: request.method,
      status_code: status,
      response_time_ms: Date.now() - ctx.startedAt,
      // Behind Vercel the socket address is a load balancer, so the forwarded
      // header is the only useful value. Left null rather than logging ours.
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      user_agent: request.headers.get('user-agent')?.slice(0, 500) || null,
    })
    await admin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', ctx.keyId)
  } catch {
    // Best effort.
  }
}

/** Wrap an endpoint: authenticate, run, log, return. */
export async function serve(
  request: Request,
  needed: Permission,
  handler: (admin: any, ctx: ApiContext) => Promise<NextResponse>,
): Promise<NextResponse> {
  const admin = adminClient()
  const auth = await authenticate(admin, request, needed)
  if ('response' in auth) return auth.response

  let res: NextResponse
  try {
    res = await handler(admin, auth.ctx)
  } catch {
    res = apiError(500, 'Something went wrong handling that request.')
  }
  await logUsage(admin, auth.ctx, request, res.status)
  return res
}
