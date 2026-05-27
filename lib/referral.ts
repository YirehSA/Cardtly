// Referral code capture & retrieval.
//
// When a user lands on cardtly.com/?ref=ABC123 we stash the code in
// localStorage so it survives navigation (homepage → /signup) and the
// email-confirmation round-trip. After successful signup we consume
// the stored code and create the referrals row via /api/referrals/track.

const REFERRAL_KEY = 'cardtly_ref'
const REFERRAL_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

type StoredReferral = { code: string; capturedAt: number }

// Strict validation: 6 chars, A-Z2-9 (no I/O/0/1 to match the
// gen_referral_code() PL/pgSQL function on the server).
const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/

export function captureReferralCode(): void {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('ref')
  if (!raw) return
  const code = raw.trim().toUpperCase()
  if (!CODE_RE.test(code)) return
  try {
    const payload: StoredReferral = { code, capturedAt: Date.now() }
    localStorage.setItem(REFERRAL_KEY, JSON.stringify(payload))
  } catch {
    // localStorage disabled / quota - silently ignore
  }
}

export function getStoredReferralCode(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(REFERRAL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredReferral
    if (!parsed.code || !CODE_RE.test(parsed.code)) return null
    if (Date.now() - parsed.capturedAt > REFERRAL_EXPIRY_MS) {
      localStorage.removeItem(REFERRAL_KEY)
      return null
    }
    return parsed.code
  } catch {
    return null
  }
}

export function clearReferralCode(): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(REFERRAL_KEY) } catch {}
}
