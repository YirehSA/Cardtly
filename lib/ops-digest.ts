import { Resend } from 'resend'
import { FROM_EMAIL } from '@/lib/email'
import { orgTrialDaysLeft, orgNeedsCollecting, orgBillingStartsInDays, orgMonthlyRand, isOrgBillingMode } from '@/lib/org-billing'

// The things nothing else will notice.
//
// Two states are enforced by nobody, on purpose:
//   - A team trial lapses. Cutting a corporate's fifty reps dead over a diary
//     date ends the relationship, so the team stays live and free until a
//     human converts them. Which means a human has to know.
//   - A debit_order team needs collecting. Paystack does not touch these; they
//     are invoiced by hand. Without a nudge a team can go months unbilled and
//     nothing anywhere would say so.
//
// Lives in lib, not in the route, because Vercel's Hobby plan allows two cron
// jobs and both are already spoken for. The daily trial-reminders run calls
// this, so it needs no slot of its own.

const TO = 'hello@cardtly.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com'

export interface OpsDigest {
  lapsed: any[]
  ending: any[]
  collect: any[]
  starting: any[]
  nothingToDo: boolean
  subject: string
  html: string
}

export async function buildOpsDigest(admin: any): Promise<OpsDigest | { error: string }> {
  // select('*') rather than a column list on purpose. Migrations here are
  // applied by hand after the deploy, so an explicit list naming a column that
  // does not exist yet returns 42703 and kills the whole digest - not just the
  // new field. The organizations table is a handful of rows; the columns are
  // free.
  const { data: orgs, error } = await admin.from('organizations').select('*')
  if (error) return { error: error.message }

  const lapsed: any[] = []
  const ending: any[] = []
  const collect: any[] = []
  const starting: any[] = []

  for (const o of orgs || []) {
    const mode = isOrgBillingMode(o.billing_period) ? o.billing_period : 'monthly'
    const days = orgTrialDaysLeft(mode, o.trial_ends_at)
    if (days !== null) {
      if (days <= 0) lapsed.push({ ...o, days })
      else if (days <= 7) ending.push({ ...o, days })
    }
    if (orgNeedsCollecting(mode, o.last_collected_on, o.billing_starts_on ?? null)) {
      collect.push({ ...o, rand: orgMonthlyRand(o.max_seats ?? 0, mode) })
    }
    // An enterprise free run about to end. This is the one with a deadline
    // outside our control: the mandate has to be with the bank before the
    // first collection date, so a week's warning is the whole point.
    const startsIn = orgBillingStartsInDays(mode, o.billing_starts_on ?? null)
    if (startsIn !== null && startsIn > 0 && startsIn <= 7) {
      starting.push({ ...o, startsIn, rand: orgMonthlyRand(o.max_seats ?? 0, mode) })
    }
  }

  const nothingToDo = !lapsed.length && !ending.length && !collect.length && !starting.length

  const rows = (title: string, items: string[], colour: string) => items.length
    ? `<p style="font-size:13px;font-weight:700;margin:20px 0 6px;color:${colour}">${title}</p>
       <ul style="margin:0;padding-left:18px;color:#444;font-size:13px;line-height:1.7">${items.map(i => `<li>${i}</li>`).join('')}</ul>`
    : ''

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111">
    <h1 style="font-size:20px;margin:0 0 4px">Teams needing a human</h1>
    <p style="color:#666;font-size:13px;margin:0">Nothing enforces any of this, so it sits here until someone acts.</p>
    ${rows('Trials that have lapsed (still live, still free)', lapsed.map(o =>
      `<strong>${esc(o.name)}</strong> &mdash; ended ${fmt(o.trial_ends_at)}, ${Math.abs(o.days)} day${Math.abs(o.days) === 1 ? '' : 's'} ago. ${o.max_seats} seats = ${rand(orgMonthlyRand(o.max_seats, 'debit_order'))}/month if converted.`), '#ef4444')}
    ${rows('Trials ending within a week', ending.map(o =>
      `<strong>${esc(o.name)}</strong> &mdash; ends ${fmt(o.trial_ends_at)} (${o.days} day${o.days === 1 ? '' : 's'})`), '#a855f7')}
    ${rows('Debit orders starting within a week', starting.map(o =>
      `<strong>${esc(o.name)}</strong> &mdash; first collection ${fmt(o.billing_starts_on)}, in ${o.startsIn} day${o.startsIn === 1 ? '' : 's'}, ${rand(o.rand)}/month. The mandate needs to be with the bank before then.${o.billing_notes ? ` ${esc(o.billing_notes)}` : ''}`), '#0ea5e9')}
    ${rows('Debit orders to load', collect.map(o =>
      `<strong>${esc(o.name)}</strong> &mdash; ${rand(o.rand)}. ${o.last_collected_on ? `Last collected ${fmt(o.last_collected_on)}.` : 'Never collected.'}${o.billing_notes ? ` ${esc(o.billing_notes)}` : ''}`), '#f59e0b')}
    <a href="${APP_URL}/admin" style="display:inline-block;margin-top:24px;background:linear-gradient(135deg,#00d4ff,#7c3aed,#ec4899);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 26px;border-radius:11px">Open the admin</a>
    <p style="color:#aaa;font-size:12px;margin:28px 0 0">You only get this when something needs doing.</p>
  </div>`

  const bits = [
    lapsed.length ? `${lapsed.length} lapsed` : null,
    ending.length ? `${ending.length} ending` : null,
    starting.length ? `${starting.length} starting` : null,
    collect.length ? `${collect.length} to collect` : null,
  ].filter(Boolean).join(', ')

  return { lapsed, ending, collect, starting, nothingToDo, subject: `Cardtly teams: ${bits}`, html }
}

// Sends only when there is something to do. A daily "nothing to report" mail
// trains you to ignore the one that matters.
export async function sendOpsDigest(admin: any, resendKey: string): Promise<{ sent: boolean; reason?: string; error?: string }> {
  const d = await buildOpsDigest(admin)
  if ('error' in d) return { sent: false, error: d.error }
  if (d.nothingToDo) return { sent: false, reason: 'nothing to report' }
  try {
    const resend = new Resend(resendKey)
    await resend.emails.send({ from: FROM_EMAIL, to: TO, subject: d.subject, html: d.html })
    return { sent: true }
  } catch (e: any) {
    return { sent: false, error: e?.message || 'send failed' }
  }
}

function esc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function fmt(d: any): string {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'
}
function rand(n: number): string {
  return 'R' + Number(n || 0).toLocaleString('en-ZA')
}
