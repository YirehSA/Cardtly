'use client'

import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'

// Reads the number and message from the # part of the address (never sent to
// a server), then opens the WhatsApp app.
//
// It tries once on its own, and always shows a button, because the built-in
// browsers in Gmail and Outlook only let a page open another app from a real
// tap. On Android the address is an intent, so Chrome can fall back to
// wa.me itself when WhatsApp is not installed; elsewhere it is whatsapp://.

interface Target { phone: string; text: string }

function readTarget(): Target | null {
  try {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const phone = (params.get('phone') || '').replace(/\D/g, '')
    if (phone.length < 9 || phone.length > 15) return null
    return { phone, text: (params.get('text') || '').slice(0, 1000) }
  } catch {
    return null
  }
}

function webUrl(t: Target): string {
  return `https://wa.me/${t.phone}${t.text ? `?text=${encodeURIComponent(t.text)}` : ''}`
}

function appUrl(t: Target): string {
  const query = `phone=${t.phone}${t.text ? `&text=${encodeURIComponent(t.text)}` : ''}`
  if (/Android/i.test(navigator.userAgent)) {
    // No package named, so WhatsApp and WhatsApp Business can both answer.
    return `intent://send?${query}#Intent;scheme=whatsapp;S.browser_fallback_url=${encodeURIComponent(webUrl(t))};end`
  }
  return `whatsapp://send?${query}`
}

export default function WhatsAppBridge() {
  const [target, setTarget] = useState<Target | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const t = readTarget()
    setTarget(t)
    setReady(true)
    if (t) {
      try { window.location.href = appUrl(t) } catch { /* the button below still works */ }
    }
  }, [])

  const display = target ? `+${target.phone}` : ''

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-12" style={{ background: '#000', color: '#fff' }}>
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(37,211,102,0.15)' }}>
          <MessageCircle className="w-7 h-7" style={{ color: '#25D366' }} aria-hidden="true" />
        </div>
        {!ready ? (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>Opening WhatsApp...</p>
        ) : target ? (
          <>
            <h1 className="text-xl font-bold mb-2">Open WhatsApp</h1>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.6)' }}>
              To message <span className="text-white font-semibold">{display}</span>. If WhatsApp did not open by itself, tap the button.
            </p>
            <a href={appUrl(target)}
              className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: '#25D366' }}>
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              Open WhatsApp
            </a>
            <a href={webUrl(target)}
              className="block mt-4 text-xs underline" style={{ color: 'rgba(255,255,255,0.5)' }}>
              No WhatsApp on this device? Open it in the browser instead
            </a>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-2">Nothing to open</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              This link is missing the phone number. Open the email again and tap the WhatsApp button from there.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
