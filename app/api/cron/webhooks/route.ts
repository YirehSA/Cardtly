import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { denyIfNotCron } from '@/lib/cron-auth'
import { deliverPending } from '@/lib/webhook-dispatch'

// Delivers queued leads to customer webhooks.
//
// Separate from the request that captured the lead on purpose: the lead is
// saved and the visitor gets their answer immediately, whatever the customer's
// CRM is doing. This runs afterwards and retries on its own schedule.
//
// Secured with CRON_SECRET (see lib/cron-auth), required in production.

export const maxDuration = 60

export async function GET(request: Request) {
  const denied = denyIfNotCron(request)
  if (denied) return denied

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as any

  // Capped per run so one backlog cannot run past maxDuration and be killed
  // halfway, which would leave rows marked as attempted and never retried.
  const run = await deliverPending(admin, 50)

  return NextResponse.json({ ok: true, ...run })
}
