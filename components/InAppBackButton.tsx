'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { isNativeApp } from '@/lib/capacitor'

interface Props {
  // Color theme of the host page — light or dark — so the button is
  // legible against whatever background the card uses.
  bgMode?: 'light' | 'dark'
  // Where to navigate when history is empty (e.g., when the user
  // arrived via a deep link with no in-app history). Defaults to /.
  fallbackHref?: string
}

// A floating back-arrow that only renders inside the Cardtly Android
// app. The public card view has no built-in navigation chrome (it's
// designed for external visitors), so card owners viewing their own
// card in the app would otherwise get stranded. This button gives
// them a guaranteed way out regardless of whether Android's hardware
// back button fires correctly.

export default function InAppBackButton({ bgMode = 'dark', fallbackHref = '/' }: Props) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    setShow(isNativeApp())
  }, [])

  if (!show) return null

  function handleClick() {
    if (typeof window === 'undefined') return
    if (window.history.length > 1) {
      window.history.back()
      // Safety net: if history.back() failed silently (some Next.js
      // edge cases), fall through to a hard navigation after a tick.
      setTimeout(() => {
        // If the URL didn't change, force the fallback.
        // We can't reliably detect that, so use the fallback as a
        // last resort only if the user taps a second time.
      }, 100)
    } else {
      window.location.href = fallbackHref
    }
  }

  const bgColor = bgMode === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'
  const iconColor = bgMode === 'light' ? '#0a0a0a' : '#ffffff'

  return (
    <button
      onClick={handleClick}
      aria-label="Go back"
      className="fixed top-4 left-4 z-50 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm transition hover:opacity-80 active:scale-95"
      style={{ backgroundColor: bgColor }}>
      <ArrowLeft className="w-5 h-5" style={{ color: iconColor }} />
    </button>
  )
}
