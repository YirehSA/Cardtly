import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { denyIfNotCron } from '@/lib/cron-auth'
import { buildOpsDigest, sendOpsDigest } from '@/lib/ops-digest'

// Manual/dry-run entry point for the ops digest.
//
// NOT wired into vercel.json: the Hobby plan allows two cron jobs and both are
// taken (weekly-digest, trial-reminders). The daily trial-reminders run calls
// sendOpsDigest directly, so this route exists to test it and to be promoted
// to its own schedule later if the plan allows.
//
//   GET ?dry=1  lists what would be sent, sends nothing.

export const maxDuration = 60

export async function GET(request: Request) {
  const denied = denyIfNotCron(request)
  if (denied) return denied

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  if (!url || !serviceKey || !resendKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  const admin = createAdminClient(url, serviceKey) as any
  const dryRun = new URL(request.url).searchParams.get('dry') === '1'

  if (dryRun) {
    const d = await buildOpsDigest(admin)
    if ('error' in d) return NextResponse.json({ error: d.error }, { status: 500 })
    return NextResponse.json({
      ok: true, dry_run: true, would_send: !d.nothingToDo, subject: d.nothingToDo ? null : d.subject,
      lapsed: d.lapsed.map((o: any) => o.name),
      ending: d.ending.map((o: any) => `${o.name} (${o.days}d)`),
      collect: d.collect.map((o: any) => `${o.name} (R${o.rand})`),
    })
  }

  const r = await sendOpsDigest(admin, resendKey)
  if (r.error) return NextResponse.json({ error: r.error }, { status: 500 })
  return NextResponse.json({ ok: true, ...r })
}
