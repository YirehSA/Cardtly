// Trial reminder email bodies.
//
// Lives here rather than in the cron route because a Next route file may only
// export HTTP handlers, which would make these impossible to render or test
// without actually sending mail.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com'

// No email here names a trial LENGTH any more. It used to say "your 60-day
// trial" throughout, which stopped being true the moment trials became
// variable: a signup now gets 7 days (migration 049) and a code grants 30 or
// 60. Telling somebody on day 5 of 7 that their 60-day trial is nearly up is
// the kind of small lie that costs trust for no gain - daysLeft already says
// everything they need.
export type TrialEmailKind = 'trial_7d' | 'trial_1d' | 'trial_expired' | 'card_live'

export interface TrialEmailInput {
  kind: TrialEmailKind
  firstName: string
  slug: string | null
  daysLeft: number
}

const BTN =
  'display:inline-block;background:linear-gradient(135deg,#00d4ff,#7c3aed,#ec4899);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 26px;border-radius:11px'

function wrap(inner: string): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">${inner}
    <p style="color:#aaa;font-size:12px;margin:28px 0 0">You're getting this because you have a Cardtly card. Sent via Cardtly.</p>
  </div>`
}

export function renderTrialEmail({ kind, firstName, slug, daysLeft }: TrialEmailInput): { subject: string; html: string } {
  const name = escapeHtml(firstName)
  const cardUrl = escapeHtml(slug ? `cardtly.com/card/${slug}` : 'your card link')

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
          You have ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} to try everything. R97 a month keeps it live after that, on the same link.
        </p>
        <a href="${APP_URL}/card/${escapeHtml(slug || '')}" style="${BTN}">See my card</a>`),
    }
  }

  if (kind === 'trial_expired') {
    return {
      subject: 'Your Cardtly card is offline',
      html: wrap(`
        <h1 style="font-size:22px;margin:0 0 4px">Your card is offline, ${name}</h1>
        <p style="color:#666;font-size:14px;margin:0 0 20px">
          Your trial has ended, so <strong>${cardUrl}</strong> no longer opens for anyone you have shared it with.
        </p>
        <p style="color:#666;font-size:14px;margin:0 0 24px">
          Nothing has been deleted. Your design, your details and every contact you captured are exactly where you left them. Subscribe and your card goes back live on the same link.
        </p>
        <a href="${APP_URL}/dashboard/upgrade" style="${BTN}">Put my card back online, R97/month</a>`),
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
          R97 a month keeps it live, on the same link, with everything you have built.
        </p>
        <a href="${APP_URL}/dashboard/upgrade" style="${BTN}">Keep my card live</a>`),
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
        R97 a month keeps everything exactly as it is: the same link, your design, your contacts, every feature. Nothing to redo.
      </p>
      <a href="${APP_URL}/dashboard/upgrade" style="${BTN}">Subscribe for R97/month</a>`),
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
