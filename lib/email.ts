// Shared addresses for outbound Cardtly mail.
//
// FROM stays noreply@ because it is the Resend-verified sending domain and
// nothing receives there. REPLY_TO is what makes a reply reach a human: any
// mail we send that a customer might sensibly answer must set it, or the
// reply lands nowhere and the sender never knows.
//
// This bit us on the trial heads-up: the email is signed "Andre" and invites
// a response, but every reply would have bounced off noreply@.
//
// hello@cardtly.com is the public address already shown on /contact. Confirmed
// receiving 2026-07-17 by sending a probe to it and reading the inbox, not
// just by trusting the domain's MX (mx1.cpmx.co.za).
//
// NOTE: do NOT set REPLY_TO on mail that is already addressed TO us with a
// customer's address in replyTo (the contact form, lead capture, booking
// requests). Those deliberately reply to the customer, which is correct.
export const FROM_EMAIL = 'Cardtly <noreply@cardtly.com>'
export const REPLY_TO = 'hello@cardtly.com'
