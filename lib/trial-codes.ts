// Validating a trial code. Shared by the claim endpoint and the admin panel so
// the rules cannot drift.

export const TRIAL_CODE_MAX_LEN = 32

export function normaliseCode(raw: unknown): string {
  return String(raw ?? '').trim().toUpperCase().slice(0, TRIAL_CODE_MAX_LEN)
}

export interface TrialCodeRow {
  id: string
  code: string
  days: number
  active: boolean
  expires_at: string | null
  max_uses: number | null
  uses: number
}

export type CodeRejection = 'unknown' | 'inactive' | 'expired' | 'exhausted'

export const REJECTION_MESSAGE: Record<CodeRejection, string> = {
  // Deliberately the same sentence for unknown and inactive: telling someone
  // "that code exists but is switched off" invites guessing at others.
  unknown: 'That code is not valid.',
  inactive: 'That code is not valid.',
  expired: 'That code has expired.',
  exhausted: 'That code has been used up.',
}

/** Why a code cannot be redeemed, or null when it can. */
export function rejectCode(row: TrialCodeRow | null | undefined): CodeRejection | null {
  if (!row) return 'unknown'
  if (!row.active) return 'inactive'
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return 'expired'
  if (row.max_uses !== null && row.uses >= row.max_uses) return 'exhausted'
  return null
}
