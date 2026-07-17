// The single From address for all outbound Cardtly mail.
//
// hello@cardtly.com, not noreply@. Resend verifies the whole cardtly.com
// domain (confirmed via the API: status=verified), so it can send as any
// address there, and hello@ is a real mailbox that someone reads (confirmed
// 2026-07-17 by sending a probe to it and finding it in the inbox).
//
// Sending as a real address is what makes a reply work: it arrives naturally,
// with no reply-to header to remember. Every Cardtly email used to come from
// noreply@ with nothing set, so a reply went nowhere and the sender never
// found out. That was worst on mail signed "Andre" that invites a response.
//
// Because From is now the address we want replies at, a reply-to pointing to
// the same place would be redundant, so those were removed.
//
// The exception, deliberately untouched: mail addressed TO us that carries a
// customer's address in replyTo (the contact form, card lead capture, booking
// requests). There, replying should reach the customer, not us. Do not "tidy"
// those to this constant.
export const FROM_EMAIL = 'Cardtly <hello@cardtly.com>'
