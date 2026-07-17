// One-off: tell existing free users that their 60-day trial has started.
//
//   node --use-system-ca scripts/send-trial-heads-up.mjs           # dry run
//   node --use-system-ca scripts/send-trial-heads-up.mjs --send    # actually sends
//
// Dry run is the DEFAULT. Sending needs an explicit --send.
//
// Audience is the same rule the reminder cron uses (see
// app/api/cron/trial-reminders/route.ts): skip anyone with an active
// subscription (nothing is ending for them), skip claimed team members (their
// card is served by their org and is never gated on a personal trial), and
// skip anyone with no personal card (nothing to take offline).
//
// Send-once is enforced by the DB, not by this script: trial_emails has a
// unique (user_id, kind), and the marker is inserted BEFORE the send. If this
// dies partway through, re-running it will not re-email anyone it already
// reached. Needs migration 027 for the 'trial_heads_up' kind.
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import fs from 'fs'

const SEND = process.argv.includes('--send')
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
    const i = l.indexOf('=')
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  })
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const resend = new Resend(env.RESEND_API_KEY)
const FROM = 'Cardtly <noreply@cardtly.com>'
// Keep in step with REPLY_TO in lib/email.ts (.mjs cannot import the TS module).
const REPLY_TO = 'hello@cardtly.com'
const APP_URL = 'https://cardtly.com'
const KIND = 'trial_heads_up'

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Some cards are named with a username rather than a person: "raeoog1",
// "janinegeldenhuys20", "umndeni off-road customs". "Hi raeoog1," reads worse
// than "Hi there," so anything carrying a digit, or that is a single
// all-lowercase token, falls back. Real first names still come through.
function greetingName(raw) {
  const first = String(raw || '').trim().split(/\s+/)[0] || ''
  if (!first) return 'there'
  if (/\d/.test(first)) return 'there'
  if (first.length < 2) return 'there'
  if (first === first.toLowerCase() && !/^[a-z]+$/.test(first)) return 'there'
  // Tidy casing: NTSAKO -> Ntsako, dirk -> Dirk.
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
}
const fmt = (d) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })

function render({ firstName, slug, trialEndsAt }) {
  const name = esc(firstName)
  const cardUrl = esc(slug ? `cardtly.com/card/${slug}` : 'your card link')
  const date = esc(fmt(trialEndsAt))
  const btn =
    'display:inline-block;background:linear-gradient(135deg,#00d4ff,#7c3aed,#ec4899);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 26px;border-radius:11px'
  return {
    subject: 'Your Cardtly card, and what is changing',
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">
      <h1 style="font-size:22px;margin:0 0 16px">Hi ${name},</h1>
      <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 16px">
        Cardtly is moving to one simple plan: R97 a month, every feature included. No tiers to choose between.
      </p>
      <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 16px">
        Your card has been free until now, so here is a clean 60 days on us, until <strong>${date}</strong>. Nothing changes before then. Same link, same design, every feature still on.
      </p>
      <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 16px">
        After that, keeping <strong>${cardUrl}</strong> live is R97 a month. If you would rather not, nothing gets deleted. Your card simply stops opening, and you can bring it back any time on the same link.
      </p>
      <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 24px">
        We will remind you a week before, and again the day before. No surprises.
      </p>
      <a href="${APP_URL}/dashboard/upgrade" style="${btn}">Keep my card live</a>
      <p style="color:#444;font-size:14px;line-height:1.6;margin:24px 0 0">Thanks for being here early.<br>Andre</p>
      <p style="color:#aaa;font-size:12px;margin:28px 0 0">You're getting this because you have a Cardtly card. Sent via Cardtly.</p>
    </div>`,
  }
}

const [{ data: profiles }, { data: subs }, { data: teamCards }, { data: cards }, { data: already }] = await Promise.all([
  db.from('profiles').select('user_id, name, trial_ends_at').not('trial_ends_at', 'is', null),
  db.from('whop_subscriptions').select('user_id').eq('status', 'active'),
  db.from('team_cards').select('user_id').not('user_id', 'is', null),
  db.from('cards').select('user_id, name, slug'),
  db.from('trial_emails').select('user_id').eq('kind', KIND),
])

const paid = new Set((subs || []).map((s) => s.user_id).filter(Boolean))
const members = new Set((teamCards || []).map((t) => t.user_id).filter(Boolean))
const done = new Set((already || []).map((r) => r.user_id))
const cardBy = {}
for (const c of cards || []) if (c.user_id && !cardBy[c.user_id]) cardBy[c.user_id] = c

const { data: authData } = await db.auth.admin.listUsers({ perPage: 1000 })
const emailBy = {}
for (const u of authData?.users || []) if (u.id && u.email) emailBy[u.id] = u.email

const queue = []
const skips = { paid: 0, member: 0, noCard: 0, noEmail: 0, alreadySent: 0 }
for (const p of profiles || []) {
  if (paid.has(p.user_id)) { skips.paid++; continue }
  if (members.has(p.user_id)) { skips.member++; continue }
  const card = cardBy[p.user_id]
  if (!card) { skips.noCard++; continue }
  const to = emailBy[p.user_id]
  if (!to) { skips.noEmail++; continue }
  if (done.has(p.user_id)) { skips.alreadySent++; continue }
  queue.push({
    userId: p.user_id,
    to,
    firstName: greetingName(card.name || p.name),
    slug: card.slug,
    trialEndsAt: p.trial_ends_at,
  })
}

console.log(SEND ? '*** LIVE SEND ***' : 'DRY RUN (nothing will be sent). Pass --send to actually send.')
console.log(`\nSkipped: ${skips.paid} paid, ${skips.member} team members, ${skips.noCard} no card, ${skips.noEmail} no email, ${skips.alreadySent} already sent`)
console.log(`Recipients: ${queue.length}\n`)
for (const q of queue) console.log(`  ${q.to.padEnd(34)} ${String(q.firstName).padEnd(12)} /card/${q.slug ?? '-'}  ends ${fmt(q.trialEndsAt)}`)

if (!SEND) {
  const sample = render(queue[0] || { firstName: 'there', slug: 'demo', trialEndsAt: new Date() })
  console.log(`\nSubject: ${sample.subject}`)
  console.log('\n--- body as plain text ---')
  console.log(sample.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
  process.exit(0)
}

let sent = 0
const failed = []
for (const q of queue) {
  // Claim before sending, so a crash cannot cause a re-send on retry.
  const { error: claimErr } = await db.from('trial_emails').insert({ user_id: q.userId, kind: KIND })
  if (claimErr) { console.log(`  skip ${q.to}: ${claimErr.message}`); continue }
  try {
    const { subject, html } = render(q)
    const { error } = await resend.emails.send({ from: FROM, to: q.to, replyTo: REPLY_TO, subject, html })
    if (error) throw new Error(error.message || JSON.stringify(error))
    sent++
    console.log(`  sent ${q.to}`)
  } catch (e) {
    await db.from('trial_emails').delete().eq('user_id', q.userId).eq('kind', KIND)
    failed.push(`${q.to}: ${e.message}`)
    console.log(`  FAILED ${q.to}: ${e.message}`)
  }
  await new Promise((r) => setTimeout(r, 600)) // stay under Resend's rate limit
}
console.log(`\nSent ${sent}, failed ${failed.length}`)
for (const f of failed) console.log('  ' + f)
