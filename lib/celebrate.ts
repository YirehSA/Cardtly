'use client'

// Confetti celebration helpers. Used for the first-card-save moment
// and any other "wow" beats we add later. Wraps canvas-confetti with
// a couple of preset shapes so call sites stay one-liners.

const KEY_FIRST_CARD_SAVED = 'cardtly:first-card-saved'

export function hasCelebratedFirstSave(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(KEY_FIRST_CARD_SAVED) === '1'
  } catch {
    return true
  }
}

export function markFirstSaveCelebrated() {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY_FIRST_CARD_SAVED, '1')
  } catch {}
}

// Bursting fountain effect from the bottom-centre of the screen. Best
// when paired with a toast message confirming the save.
export async function celebrateFirstSave() {
  if (typeof window === 'undefined') return
  // Respect reduced-motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const { default: confetti } = await import('canvas-confetti')
  const duration = 1800
  const end = Date.now() + duration

  const colors = ['#00d4ff', '#7c3aed', '#ec4899', '#ffffff']

  function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      startVelocity: 55,
      origin: { x: 0, y: 0.85 },
      colors,
      ticks: 200,
      zIndex: 9999,
    })
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      startVelocity: 55,
      origin: { x: 1, y: 0.85 },
      colors,
      ticks: 200,
      zIndex: 9999,
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

// Quick single burst from a specific element. Lighter than the first
// save celebration - good for less-momentous successes like "card
// shared" or "tag written".
export async function celebrateSmall(x: number = 0.5, y: number = 0.5) {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const { default: confetti } = await import('canvas-confetti')
  confetti({
    particleCount: 40,
    spread: 70,
    startVelocity: 35,
    origin: { x, y },
    colors: ['#00d4ff', '#7c3aed', '#ec4899'],
    zIndex: 9999,
  })
}
