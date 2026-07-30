// Capturing a trial code from a link.
//
// The code is not something a customer types. A rep hands out a link -
// cardtly.com/signup?code=CARDTLY60, or any page with ?code= on it - and the
// trial is applied at signup without the person ever seeing a field. Putting the
// box on the signup form asked every visitor for something only some of them
// have, and invited guessing.
//
// Mirrors lib/referral.ts: stashed in localStorage so the code survives the
// homepage -> /signup hop and the email-confirmation round trip.

const TRIAL_CODE_KEY = 'cardtly_trial_code'
const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

type Stored = { code: string; capturedAt: number }

// Deliberately loose on shape - codes are created by hand in the admin panel, so
// this cannot assume a format the way the 6-character referral codes can. The
// server is the authority on whether a code is real; this only decides what is
// worth carrying.
const CODE_RE = /^[A-Z0-9][A-Z0-9-]{1,31}$/

function normalise(raw: string): string {
  return raw.trim().toUpperCase().slice(0, 32)
}

export function captureTrialCode(): void {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  // `code` is the obvious one; `trial` is accepted so a link written either way
  // still works.
  const raw = params.get('code') || params.get('trial')
  if (!raw) return
  const code = normalise(raw)
  if (!CODE_RE.test(code)) return
  try {
    localStorage.setItem(TRIAL_CODE_KEY, JSON.stringify({ code, capturedAt: Date.now() } as Stored))
  } catch {
    // localStorage disabled or full - the trial can still be granted from admin
  }
}

export function getStoredTrialCode(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(TRIAL_CODE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Stored
    if (!parsed.code || !CODE_RE.test(parsed.code)) return null
    if (Date.now() - parsed.capturedAt > EXPIRY_MS) {
      localStorage.removeItem(TRIAL_CODE_KEY)
      return null
    }
    return parsed.code
  } catch {
    return null
  }
}

export function clearTrialCode(): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(TRIAL_CODE_KEY) } catch {}
}
