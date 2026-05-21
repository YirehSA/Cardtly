'use client'

import { useEffect, useState } from 'react'
import { X, ArrowRight, ArrowLeft, Sparkles, CreditCard, QrCode, Share2 } from 'lucide-react'

const KEY_TOUR_DISMISSED = 'cardtly:tour-dismissed'

interface Step {
  title: string
  description: string
  icon: typeof Sparkles
}

const STEPS: Step[] = [
  {
    title: 'Welcome to Cardtly',
    description: 'Your digital business card is already live. Let me show you around in 30 seconds.',
    icon: Sparkles,
  },
  {
    title: 'Edit your card',
    description: 'Click "My Card" in the sidebar to add your photo, contact details, and pick a template. Your changes go live the moment you save.',
    icon: CreditCard,
  },
  {
    title: 'Get your QR code',
    description: 'Under "QR Code" you can download a printable code. Stick it on your laptop, business card holder, or anywhere people might want to scan it.',
    icon: QrCode,
  },
  {
    title: 'Share anywhere',
    description: 'Send your cardtly.com link via WhatsApp, email, Instagram bio - anywhere. Tap a Cardtly NFC tag to share with just a touch.',
    icon: Share2,
  },
]

// Full-screen modal tour that fires once for new users. Detected via a
// localStorage flag so it only ever appears the first time a user lands
// on the dashboard. The "Skip tour" link and the "Got it" final button
// both dismiss permanently. Renders nothing if already dismissed.

export default function OnboardingTour() {
  const [step, setStep] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(KEY_TOUR_DISMISSED) === '1'
      if (!dismissed) setOpen(true)
    } catch {
      // localStorage unavailable (private browsing?), skip the tour
    }
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(KEY_TOUR_DISMISSED, '1')
    } catch {}
    setOpen(false)
  }

  if (!open) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const Icon = current.icon

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={dismiss}>
      <div className="relative max-w-md w-full rounded-3xl p-8"
        style={{
          background: '#0a0a0a',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 30px 60px -20px rgba(124,58,237,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}>

        <button onClick={dismiss}
          aria-label="Close tour"
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/60 hover:text-white transition">
          <X className="w-4 h-4" />
        </button>

        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.25), rgba(124,58,237,0.25))' }}>
          <Icon className="w-8 h-8" style={{ color: '#00d4ff' }} />
        </div>

        <h2 className="text-2xl font-black tracking-tight text-white mb-2">{current.title}</h2>
        <p className="text-sm leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.65)' }}>
          {current.description}
        </p>

        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <button key={i} onClick={() => setStep(i)}
              className="h-1 rounded-full transition-all"
              style={{
                width: i === step ? 24 : 6,
                background: i === step
                  ? 'linear-gradient(90deg, #00d4ff, #7c3aed)'
                  : 'rgba(255,255,255,0.2)',
              }} />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white transition">
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <button onClick={dismiss}
              className="text-sm font-medium text-white/50 hover:text-white/80 transition">
              Skip tour
            </button>
          )}

          {isLast ? (
            <button onClick={dismiss}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)',
                boxShadow: '0 8px 24px -6px rgba(124,58,237,0.5)',
              }}>
              Got it
              <Sparkles className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={() => setStep(s => s + 1)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
                boxShadow: '0 8px 24px -6px rgba(124,58,237,0.5)',
              }}>
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
