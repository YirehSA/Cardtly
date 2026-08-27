// Reporting and blocking a card in the Network.
//
// Pure, so the reasons, the validation and the wording can be tested without a
// database. Imports nothing.

export const REPORT_REASONS = [
  { id: 'impersonation', label: 'Pretending to be someone else', hint: 'This card uses a real person or company name that is not theirs.' },
  { id: 'offensive', label: 'Offensive or abusive', hint: 'Language or images that should not be here.' },
  { id: 'spam', label: 'Spam or a scam', hint: 'Selling something unrelated, or trying to trick people.' },
  { id: 'not_a_person', label: 'Not a real person or business', hint: 'A fake or test card listed as if it were real.' },
  { id: 'other', label: 'Something else', hint: 'Tell us what is wrong and we will look.' },
] as const

export type ReportReason = typeof REPORT_REASONS[number]['id']

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === 'string' && REPORT_REASONS.some(r => r.id === value)
}

export const MAX_DETAIL = 1000

/**
 * Check a report before it is written.
 *
 * "other" is the only reason that requires the person to say something. The
 * rest are self-explanatory, and demanding an explanation for every report is
 * how a report button stops being used.
 */
export function validateReport(input: { reason: unknown; detail?: unknown }):
  { reason: ReportReason; detail: string | null } | { error: string } {
  if (!isReportReason(input.reason)) return { error: 'Choose a reason for the report.' }

  const detail = typeof input.detail === 'string' ? input.detail.trim().slice(0, MAX_DETAIL) : ''
  if (input.reason === 'other' && detail.length < 3) {
    return { error: 'Tell us briefly what is wrong, so we know what to look at.' }
  }
  return { reason: input.reason, detail: detail || null }
}

export const REPORT_STATUSES = ['open', 'actioned', 'dismissed'] as const
export type ReportStatus = typeof REPORT_STATUSES[number]

export function isReportStatus(value: unknown): value is ReportStatus {
  return typeof value === 'string' && (REPORT_STATUSES as readonly string[]).includes(value)
}

/** How long a report has been waiting, for the queue. */
export function ageInHours(createdAt: string, now: Date): number {
  const t = new Date(createdAt).getTime()
  if (!Number.isFinite(t)) return 0
  return Math.max(0, (now.getTime() - t) / 3_600_000)
}

/**
 * Reports are answered within a day.
 *
 * That is not an arbitrary target: Apple's Guideline 1.2 asks for objectionable
 * content to be acted on within 24 hours, and it is the commitment the product
 * makes to somebody who reports being impersonated. The queue marks anything
 * older so it cannot quietly sit there.
 */
export const SLA_HOURS = 24

export function isOverdue(createdAt: string, now: Date): boolean {
  return ageInHours(createdAt, now) > SLA_HOURS
}

export function reasonLabel(id: string): string {
  return REPORT_REASONS.find(r => r.id === id)?.label || id
}
