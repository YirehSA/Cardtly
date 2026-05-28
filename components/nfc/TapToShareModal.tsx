'use client'

import { useEffect, useState } from 'react'
import { X, Wifi, AlertCircle, Settings, CheckCircle2 } from 'lucide-react'
import { startTapToShare, stopTapToShare, checkNfcSupport } from '@/lib/nfc-share'
import { isNativeApp } from '@/lib/capacitor'

interface Props {
  open: boolean
  onClose: () => void
  cardUrl: string
  cardName?: string
}

type State =
  | { kind: 'idle' }
  | { kind: 'broadcasting' }
  | { kind: 'web_unsupported' }
  | { kind: 'hardware_unsupported' }
  | { kind: 'nfc_disabled' }
  | { kind: 'error'; message: string }

// Auto-stop after this many seconds so a phone in a pocket can't
// accidentally keep broadcasting forever.
const AUTO_STOP_MS = 60_000

export default function TapToShareModal({ open, onClose, cardUrl, cardName }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' })

  useEffect(() => {
    if (!open) return
    let cancelled = false
    let stopTimer: ReturnType<typeof setTimeout> | null = null

    ;(async () => {
      if (!isNativeApp()) {
        if (!cancelled) setState({ kind: 'web_unsupported' })
        return
      }
      const cap = await checkNfcSupport()
      if (cancelled) return
      if (!cap.supported) { setState({ kind: 'hardware_unsupported' }); return }
      if (!cap.enabled)   { setState({ kind: 'nfc_disabled' }); return }

      const res = await startTapToShare(cardUrl)
      if (cancelled) return
      if (res.ok) {
        setState({ kind: 'broadcasting' })
        stopTimer = setTimeout(() => {
          stopTapToShare()
          setState({ kind: 'idle' })
        }, AUTO_STOP_MS)
      } else if (res.reason === 'nfc_disabled') {
        setState({ kind: 'nfc_disabled' })
      } else if (res.reason === 'nfc_not_supported') {
        setState({ kind: 'hardware_unsupported' })
      } else {
        setState({ kind: 'error', message: 'Could not start sharing' })
      }
    })()

    return () => {
      cancelled = true
      if (stopTimer) clearTimeout(stopTimer)
      stopTapToShare()
    }
  }, [open, cardUrl])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center text-white"
        style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}
      >
        <X className="w-5 h-5" />
      </button>

      <div className="w-full max-w-md text-center text-white">
        {state.kind === 'broadcasting' && <Broadcasting cardName={cardName} />}
        {state.kind === 'idle' && <PreparingScreen />}
        {state.kind === 'web_unsupported' && <WebUnsupportedScreen />}
        {state.kind === 'hardware_unsupported' && <NoHardwareScreen />}
        {state.kind === 'nfc_disabled' && <NfcOffScreen />}
        {state.kind === 'error' && <ErrorScreen msg={state.message} />}
      </div>
    </div>
  )
}

// ── Screens ───────────────────────────────────────────────────

function Broadcasting({ cardName }: { cardName?: string }) {
  return (
    <>
      <div className="relative w-56 h-56 mx-auto mb-8">
        {/* Animated pulse rings */}
        <span className="absolute inset-0 rounded-full animate-pulse-ring"
          style={{ border: '3px solid rgba(0,212,255,0.7)' }} />
        <span className="absolute inset-0 rounded-full animate-pulse-ring-2"
          style={{ border: '3px solid rgba(124,58,237,0.7)' }} />
        <span className="absolute inset-0 rounded-full animate-pulse-ring-3"
          style={{ border: '3px solid rgba(236,72,153,0.7)' }} />
        {/* Centre puck */}
        <div className="absolute inset-8 rounded-full flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)', boxShadow: '0 12px 60px rgba(124,58,237,0.6)' }}>
          <Wifi className="w-16 h-16 text-white" />
        </div>
      </div>

      <p className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-3"
        style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Broadcasting
      </p>

      <h2 className="text-3xl font-black mb-3">Hold your phone to theirs</h2>
      <p className="text-sm leading-relaxed max-w-xs mx-auto" style={{ color: 'rgba(255,255,255,0.65)' }}>
        {cardName ? `${cardName}'s` : 'Your'} Cardtly card will open on the other phone in a second. Both phones need NFC turned on. Back-to-back works best.
      </p>

      <p className="text-[10px] mt-6 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Auto-stops after 60 seconds
      </p>

      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(0.6); opacity: 0.9; }
          80%  { transform: scale(1.6); opacity: 0;   }
          100% { transform: scale(1.6); opacity: 0;   }
        }
        .animate-pulse-ring   { animation: pulse-ring 2.4s ease-out infinite;       }
        .animate-pulse-ring-2 { animation: pulse-ring 2.4s ease-out 0.6s infinite;  }
        .animate-pulse-ring-3 { animation: pulse-ring 2.4s ease-out 1.2s infinite;  }
      `}</style>
    </>
  )
}

function PreparingScreen() {
  return (
    <div className="space-y-4 py-12">
      <div className="w-12 h-12 rounded-full mx-auto border-4 border-white/30 border-t-white animate-spin" />
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>Getting NFC ready...</p>
    </div>
  )
}

function WebUnsupportedScreen() {
  return (
    <InfoScreen
      icon={<AlertCircle className="w-12 h-12" style={{ color: '#f59e0b' }} />}
      title="Available in the app"
      body="Phone-to-phone tap sharing only works inside the Cardtly Android app. Open the app from your home screen, then come back here."
    />
  )
}

function NoHardwareScreen() {
  return (
    <InfoScreen
      icon={<AlertCircle className="w-12 h-12" style={{ color: '#f59e0b' }} />}
      title="This phone doesn't have NFC"
      body="Your QR code and link still work. Tap the share button on your card to send via WhatsApp, email, or any other app."
    />
  )
}

function NfcOffScreen() {
  return (
    <InfoScreen
      icon={<Settings className="w-12 h-12" style={{ color: '#06b6d4' }} />}
      title="NFC is turned off"
      body="Open your phone's Settings, search for NFC, and switch it on. Then come back and try again."
    />
  )
}

function ErrorScreen({ msg }: { msg: string }) {
  return (
    <InfoScreen
      icon={<AlertCircle className="w-12 h-12" style={{ color: '#ef4444' }} />}
      title="Something went wrong"
      body={msg + '. Try closing this and opening it again.'}
    />
  )
}

function InfoScreen({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-center">{icon}</div>
      <h2 className="text-2xl font-black">{title}</h2>
      <p className="text-sm max-w-xs mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>{body}</p>
    </div>
  )
}
