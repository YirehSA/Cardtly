'use client'

import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'

// Opens WhatsApp for the number and message an email button carried.
//
// Where they come from. Today's links seal them into the path, and the server
// page opens them and passes them in (see lib/wa-bridge). Links in emails sent
// before that carry them after the # instead, which only this browser code can
// read, so those still work too.
//
// What it opens depends on the device:
//   - a phone: the WhatsApp app. It tries once on its own and always shows a
//     button, because the built-in browsers in Gmail and Outlook only let a
//     page open another app from a real tap. On Android the address is an
//     intent, so Chrome falls back to wa.me itself when WhatsApp is missing.
//   - a computer: straight on to wa.me, WhatsApp's own page, which offers the
//     desktop app or WhatsApp Web. whatsapp:// on a PC with no desktop app only
//     brings up Windows asking which app should open it, and work email is
//     often read on a PC.

interface Target { phone: string; text: string }
type Device = 'android' | 'ios' | 'computer'

function readHashTarget(): Target | null {
  try {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const phone = (params.get('phone') || '').replace(/\D/g, '')
    if (phone.length < 9 || phone.length > 15) return null
    return { phone, text: (params.get('text') || '').slice(0, 1000) }
  } catch {
    return null
  }
}

function detectDevice(): Device {
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return 'android'
  // iPadOS reports itself as a Mac; the touch screen gives it away.
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  return 'computer'
}

function webUrl(t: Target): string {
  return `https://wa.me/${t.phone}${t.text ? `?text=${encodeURIComponent(t.text)}` : ''}`
}

function appUrl(t: Target, device: Device): string {
  if (device === 'computer') return webUrl(t)
  const query = `phone=${t.phone}${t.text ? `&text=${encodeURIComponent(t.text)}` : ''}`
  if (device === 'android') {
    // No package named, so WhatsApp and WhatsApp Business can both answer.
    return `intent://send?${query}#Intent;scheme=whatsapp;S.browser_fallback_url=${encodeURIComponent(webUrl(t))};end`
  }
  return `whatsapp://send?${query}`
}

export default function WhatsAppBridge({ sealed }: { sealed?: { target: Target | null } }) {
  const [target, setTarget] = useState<Target | null>(null)
  const [device, setDevice] = useState<Device>('computer')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const t = sealed ? sealed.target : readHashTarget()
    const d = detectDevice()
    setTarget(t)
    setDevice(d)
    setReady(true)
    if (!t) return
    try {
      // replace, so Back from WhatsApp's page does not land here and bounce again.
      if (d === 'computer') window.location.replace(webUrl(t))
      else window.location.href = appUrl(t, d)
    } catch { /* the button below still works */ }
  }, [sealed])

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
              To message <span className="text-white font-semibold">{display}</span>.{' '}
              {device === 'computer'
                ? 'If WhatsApp did not open by itself, click the button to use the WhatsApp app on this computer or WhatsApp Web.'
                : 'If WhatsApp did not open by itself, tap the button.'}
            </p>
            <a href={appUrl(target, device)}
              className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: '#25D366' }}>
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              Open WhatsApp
            </a>
            {device !== 'computer' && (
              <a href={webUrl(target)}
                className="block mt-4 text-xs underline" style={{ color: 'rgba(255,255,255,0.5)' }}>
                No WhatsApp on this device? Open it in the browser instead
              </a>
            )}
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-2">This link could not be opened</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Work email systems such as Mimecast sometimes change links on the way in, and this one lost the phone number. The number is in the email itself: copy it into WhatsApp, or reply to the email instead.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
