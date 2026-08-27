import {
  buildLeadPayload, deliveryHeaders, shouldRetry, nextRetryAt, LEAD_CREATED,
} from '@/lib/webhooks'

// Queueing a lead for delivery, and delivering it.
//
// Split from lib/webhooks so the payload shape, signature and retry policy
// stay testable without a database.
//
// Nothing in here is allowed to throw into a caller. The caller is the request
// that just captured a lead from a member of the public, and a webhook is a
// convenience for the customer: an integration failing must never turn a saved
// lead into an error page for the person who filled the form in.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com'

/**
 * Queue a captured lead for every webhook the organisation has switched on.
 *
 * Writes rows and returns. It deliberately does not attempt delivery inline:
 * an HTTP call to somebody else's server, inside the request that is saving
 * the lead, would put their downtime on our response time.
 */
export async function enqueueLeadCreated(
  admin: any,
  opts: {
    /** The contacts row just written. */
    contactId: string
    /** Whichever of the two the lead was captured against. */
    teamCardId?: string | null
    personalCardId?: string | null
  },
): Promise<void> {
  try {
    if (!opts.contactId) return

    // Webhooks belong to an organisation, so only a team card can have one.
    // A personal card has no org and nothing to deliver to.
    if (!opts.teamCardId) return

    const { data: teamCard } = await admin
      .from('team_cards')
      .select('id, name, slug, organization_id')
      .eq('id', opts.teamCardId)
      .maybeSingle()
    if (!teamCard?.organization_id) return

    const orgId: string = teamCard.organization_id
    const card = { id: teamCard.id, name: teamCard.name, slug: teamCard.slug, isTeam: true }

    // 42P01 here means the webhooks table has not been created on this
    // database. Nothing to deliver to, and certainly nothing worth failing a
    // lead capture over.
    const { data: hooks, error } = await admin
      .from('webhooks')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_active', true)
    if (error || !hooks || hooks.length === 0) return

    const wanted = hooks.filter((h: any) => {
      const events = Array.isArray(h.events) ? h.events : []
      return events.includes(LEAD_CREATED)
    })
    if (wanted.length === 0) return

    const { data: org } = await admin
      .from('organizations').select('id, name').eq('id', orgId).maybeSingle()

    // Read back rather than passed in, so the payload carries exactly what
    // was stored - including any column the caller did not bother to send.
    const { data: contact } = await admin
      .from('contacts').select('*').eq('id', opts.contactId).maybeSingle()
    if (!contact) return

    const payload = buildLeadPayload({
      contact,
      card,
      org: org ? { id: org.id, name: org.name } : { id: orgId, name: null },
      appUrl: APP_URL,
      sentAt: new Date().toISOString(),
    })

    await admin.from('webhook_deliveries').insert(
      wanted.map((h: any) => ({
        webhook_id: h.id,
        event_type: LEAD_CREATED,
        payload,
      })),
    )
  } catch {
    // Best effort, deliberately silent. See the note at the top.
  }
}

export type DeliveryRun = {
  attempted: number
  delivered: number
  retrying: number
  failed: number
  errors: string[]
}

/**
 * Send everything that is due.
 *
 * Called from the cron. Each delivery is independent: one endpoint hanging
 * must not stop the rest, so every attempt carries its own timeout and its own
 * try/catch.
 */
export async function deliverPending(admin: any, limit = 50): Promise<DeliveryRun> {
  const run: DeliveryRun = { attempted: 0, delivered: 0, retrying: 0, failed: 0, errors: [] }
  const nowIso = new Date().toISOString()

  const { data: due, error } = await admin
    .from('webhook_deliveries')
    .select('*')
    .is('delivered_at', null)
    .is('failed_at', null)
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    run.errors.push(`queue read failed: ${error.code || ''} ${error.message || ''}`.trim())
    return run
  }
  if (!due || due.length === 0) return run

  // Webhooks fetched once rather than per delivery: a burst of leads on one
  // card produces many rows pointing at the same endpoint.
  const ids = [...new Set(due.map((d: any) => d.webhook_id))]
  const { data: hooks } = await admin.from('webhooks').select('*').in('id', ids)
  const byId = new Map<string, any>((hooks || []).map((h: any) => [h.id, h]))

  for (const d of due) {
    const hook = byId.get(d.webhook_id)
    if (!hook) {
      // The webhook was deleted after the lead was queued. Nothing to send to.
      await admin.from('webhook_deliveries')
        .update({ failed_at: new Date().toISOString(), response_body: 'Webhook no longer exists' })
        .eq('id', d.id)
      run.failed++
      continue
    }
    if (!hook.is_active) continue // paused: leave it queued for when it resumes

    run.attempted++
    const attempt = (d.attempt_count || 1)
    const body = JSON.stringify(d.payload)
    const timestamp = String(Math.floor(Date.now() / 1000))
    const started = Date.now()

    let status = 0
    let responseText = ''
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), Math.min((hook.timeout_seconds || 30), 30) * 1000)
      const res = await fetch(hook.url, {
        method: 'POST',
        headers: deliveryHeaders({
          secret: hook.secret_token || null,
          timestamp,
          body,
          event: d.event_type,
          deliveryId: d.id,
          extra: hook.headers && typeof hook.headers === 'object' ? hook.headers : null,
        }),
        body,
        signal: controller.signal,
        redirect: 'manual',
      })
      clearTimeout(timer)
      status = res.status
      // Capped: a receiver that answers with a full HTML error page must not
      // put a megabyte of it in the delivery log for every retry.
      responseText = (await res.text().catch(() => '')).slice(0, 1000)
    } catch (e: any) {
      status = 0
      responseText = (e?.name === 'AbortError' ? 'Timed out' : (e?.message || 'Could not reach the address')).slice(0, 1000)
    }

    const ms = Date.now() - started
    const ok = status >= 200 && status < 300

    if (ok) {
      await admin.from('webhook_deliveries').update({
        delivered_at: new Date().toISOString(),
        response_status: status,
        response_body: responseText,
        response_time_ms: ms,
        attempt_count: attempt,
      }).eq('id', d.id)
      run.delivered++
      continue
    }

    const maxAttempts = Math.max(1, hook.retry_count || 3)
    if (shouldRetry(status, attempt, maxAttempts)) {
      await admin.from('webhook_deliveries').update({
        attempt_count: attempt + 1,
        next_retry_at: nextRetryAt(attempt, new Date()).toISOString(),
        response_status: status || null,
        response_body: responseText,
        response_time_ms: ms,
      }).eq('id', d.id)
      run.retrying++
    } else {
      await admin.from('webhook_deliveries').update({
        failed_at: new Date().toISOString(),
        response_status: status || null,
        response_body: responseText,
        response_time_ms: ms,
        attempt_count: attempt,
      }).eq('id', d.id)
      run.failed++
    }
  }

  return run
}
