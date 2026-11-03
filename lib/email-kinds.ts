// The scheduled emails a person can switch off, by name. Kept apart from
// lib/email-optout, which signs links with Node's crypto, so the Settings page
// can import the names without pulling crypto into the browser.
//
// Adding a kind here also needs it in migration 103's check constraint (a new
// migration), a footer and List-Unsubscribe headers on the email itself, and a
// skip in the job that sends it. scripts/check-email-unsubscribe looks for each.

export const EMAIL_KINDS = {
  weekly_summary: {
    label: 'the weekly summary of your card',
    title: 'Weekly summary',
    detail: 'Every Monday: how many people opened your card and how many leads it brought in.',
  },
  trial_reminders: {
    label: 'trial reminders',
    title: 'Trial reminders',
    detail: 'When your card goes live, a week and a day before your trial ends, and when it has ended.',
  },
} as const

export type EmailKind = keyof typeof EMAIL_KINDS

export function isEmailKind(v: unknown): v is EmailKind {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(EMAIL_KINDS, v)
}
