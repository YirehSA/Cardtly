// Trial reminder email bodies.
//
// Lives here rather than in the cron route because a Next route file may only
// export HTTP handlers, which would make these impossible to render or test
// without actually sending mail.

import { PRO_PRICE_RAND, SOLO_PRICE_RAND } from './plan-prices'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com'

// No email here names a trial LENGTH any more. It used to say "your 60-day
// trial" throughout, which stopped being true the moment trials became
// variable: a signup now gets 7 days (migration 049) and a code grants 30 or
// 60. Telling somebody on day 5 of 7 that their 60-day trial is nearly up is
// the kind of small lie that costs trust for no gain - daysLeft already says
// everything they need.
// 'choose_plan' (migration 109): a new account made its card but has not chosen
// Solo or Pro, or taken the trial. Sent once.
export type TrialEmailKind = 'trial_7d' | 'trial_1d' | 'trial_expired' | 'card_live' | 'choose_plan'

// Both plans, in the exact prices the dashboard uses (lib/solo). These emails
// used to say "R97 a month" alone; since Cardtly Solo there are two ways to
// keep a card live.
const PLANS_LINE = `Solo at R${SOLO_PRICE_RAND.monthly} a month or Pro at R${PRO_PRICE_RAND.monthly} a month`

export interface TrialEmailInput {
  kind: TrialEmailKind
  firstName: string
  slug: string | null
  daysLeft: number
  /** trial_expired only: whether it was a trial or a subscription that ended.
   *  Someone who paid and cancelled, or whose card payments lapsed, was never
   *  on a trial by the time the card went down, and "your trial has ended"
   *  told them something untrue. */
  endedBecause?: 'trial' | 'subscription'
  /** The unsubscribe line for this person (lib/email-optout), placed under
   *  the footer. POPIA section 69: every one of these needs a way out. */
  unsubscribeHtml?: string
}

const BTN =
  'display:inline-block;background:linear-gradient(135deg,#00d4ff,#7c3aed,#ec4899);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 26px;border-radius:11px'

function wrap(inner: string, unsubscribeHtml = ''): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">${inner}
    <p style="color:#aaa;font-size:12px;margin:28px 0 0">You're getting this because you have a Cardtly card. Sent via Cardtly.</p>
    ${unsubscribeHtml}
  </div>`
}

export function renderTrialEmail({ kind, firstName, slug, daysLeft, endedBecause = 'trial', unsubscribeHtml = '' }: TrialEmailInput): { subject: string; html: string } {
  const name = escapeHtml(firstName)
  const cardUrl = escapeHtml(slug ? `cardtly.com/card/${slug}` : 'your card link')

  // Built, not live: choosing a plan is the next step (Andre, 2026-11-20). The
  // only email that mentions the trial, and only as the fallback.
  if (kind === 'choose_plan') {
    return {
      subject: 'Your Cardtly card is ready. Choose a plan to put it live',
      html: wrap(`
        <h1 style="font-size:22px;margin:0 0 4px">Your card is ready, ${name}</h1>
        <p style="color:#666;font-size:14px;margin:0 0 20px">
          <strong>${cardUrl}</strong> is built and waiting. It goes live the moment you choose a plan.
        </p>
        <ul style="color:#666;font-size:14px;margin:0 0 24px;padding-left:20px;line-height:1.7">
          <li><strong>Solo, R${SOLO_PRICE_RAND.monthly} a month:</strong> your card, your QR code and the contacts who share their details back.</li>
          <li><strong>Pro, R${PRO_PRICE_RAND.monthly} a month:</strong> every template, lead capture, booking, analytics, an email signature and more.</li>
        </ul>
        <a href="${APP_URL}/dashboard/upgrade" style="${BTN}">Choose my plan</a>
        <p style="color:#999;font-size:13px;margin:20px 0 0">Not ready to choose? You can try Solo free for 7 days from the same page.</p>`, unsubscribeHtml),
    }
  }

  // The card is live and they may not have taken it anywhere yet. Sent once,
  // shortly after the card is created, because a digital card that never leaves
  // the dashboard is worth nothing to them and converts nobody for us.
  if (kind === 'card_live') {
    return {
      subject: 'Your Cardtly card is live',
      html: wrap(`
        <h1 style="font-size:22px;margin:0 0 4px">Your card is live, ${name}</h1>
        <p style="color:#666;font-size:14px;margin:0 0 20px">
          <strong>${cardUrl}</strong> now opens for anyone you send it to. There is nothing for them to install - it opens in their browser, and they can save you to their contacts in one tap.
        </p>
        <p style="color:#666;font-size:14px;margin:0 0 8px">Three things worth doing today:</p>
        <ul style="color:#666;font-size:14px;margin:0 0 24px;padding-left:20px;line-height:1.7">
          <li>Put the link in your WhatsApp profile, your email signature and your Instagram bio.</li>
          <li>Add it to your phone's home screen so you can pull it up in a second.</li>
          <li>Hand it to the next person you meet and watch them tap Save Contact.</li>
        </ul>
        <p style="color:#666;font-size:14px;margin:0 0 24px">
          You have ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} to try it. ${PLANS_LINE} keeps it live after that, on the same link.
        </p>
        <a href="${APP_URL}/card/${escapeHtml(slug || '')}" style="${BTN}">See my card</a>`, unsubscribeHtml),
    }
  }

  if (kind === 'trial_expired') {
    return {
      subject: 'Your Cardtly card is offline',
      html: wrap(`
        <h1 style="font-size:22px;margin:0 0 4px">Your card is offline, ${name}</h1>
        <p style="color:#666;font-size:14px;margin:0 0 20px">
          ${endedBecause === 'subscription' ? 'Your subscription has ended' : 'Your trial has ended'}, so <strong>${cardUrl}</strong> no longer opens for anyone you have shared it with.
        </p>
        <p style="color:#666;font-size:14px;margin:0 0 24px">
          Nothing has been deleted. Your design, your details and every contact you captured are exactly where you left them. Choose ${PLANS_LINE} and your card goes back live on the same link.
        </p>
        <a href="${APP_URL}/dashboard/upgrade" style="${BTN}">Put my card back online</a>`, unsubscribeHtml),
    }
  }

  if (kind === 'trial_1d') {
    return {
      subject: 'Your Cardtly trial ends tomorrow',
      html: wrap(`
        <h1 style="font-size:22px;margin:0 0 4px">One day left, ${name}</h1>
        <p style="color:#666;font-size:14px;margin:0 0 20px">
          Your trial ends tomorrow. After that <strong>${cardUrl}</strong> stops opening, so anyone you have handed it to, or tapped an NFC card at, will hit a dead link.
        </p>
        <p style="color:#666;font-size:14px;margin:0 0 24px">
          ${PLANS_LINE} keeps it live, on the same link, with everything you have built.
        </p>
        <a href="${APP_URL}/dashboard/upgrade" style="${BTN}">Keep my card live</a>`, unsubscribeHtml),
    }
  }

  return {
    subject: `${daysLeft} days left on your Cardtly trial`,
    html: wrap(`
      <h1 style="font-size:22px;margin:0 0 4px">${daysLeft} days left, ${name}</h1>
      <p style="color:#666;font-size:14px;margin:0 0 20px">
        Your trial is nearly up. When it ends, <strong>${cardUrl}</strong> stops opening for the people you have shared it with.
      </p>
      <p style="color:#666;font-size:14px;margin:0 0 24px">
        ${PLANS_LINE} keeps it live: the same link, your design, your contacts. Nothing to redo.
      </p>
      <a href="${APP_URL}/dashboard/upgrade" style="${BTN}">Choose my plan</a>`, unsubscribeHtml),
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
