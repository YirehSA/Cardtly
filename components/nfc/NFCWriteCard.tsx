'use client'

import { useEffect, useState } from 'react'
import { Wifi, Loader2, CheckCircle, X, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { isNativeApp, isNFCSupported, writeNFCTag } from '@/lib/capacitor'

interface Props {
  cardUrl: string
  cardName: string
}

// Dashboard section for writing the user's card URL to a blank NFC tag.
// Only renders when running inside the Cardtly Android app on a device
// with NFC hardware. On the web (or on Android without NFC) we hide the
// section entirely so it doesn't dangle as a non-functional button.

export default function NFCWriteCard({ cardUrl, cardName }: Props) {
  const [nfcReady, setNfcReady] = useState<'unknown' | 'yes' | 'no'>('unknown')
  const [writing, setWriting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!isNativeApp()) {
      setNfcReady('no')
      return
    }
    isNFCSupported().then((ok) => {
      if (!cancelled) setNfcReady(ok ? 'yes' : 'no')
    })
    return () => { cancelled = true }
  }, [])

  // Hide entirely outside the native app or on devices without NFC
  if (nfcReady === 'no') return null

  // Show a loading skeleton while we figure out NFC support, so the
  // page layout doesn't jump when we resolve.
  if (nfcReady === 'unknown') {
    return (
      <div className="rounded-3xl border border-border p-6 mb-6 animate-pulse h-32" />
    )
  }

  async function handleWrite() {
    setError(null)
    setSuccess(false)
    setWriting(true)
    setShowModal(true)
    try {
      await writeNFCTag(cardUrl)
      setSuccess(true)
      toast.success('Tag written. Tap your phone on any device to share.')
      setTimeout(() => setShowModal(false), 1500)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not write to tag'
      setError(message)
      toast.error(message)
    } finally {
      setWriting(false)
    }
  }

  function dismiss() {
    setShowModal(false)
    setError(null)
    setSuccess(false)
  }

  return (
    <>
      <div className="rounded-3xl border border-border p-6 mb-6"
        style={{ background: 'rgba(0,212,255,0.04)', borderColor: 'rgba(0,212,255,0.2)' }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))' }}>
            <Wifi className="w-5 h-5" style={{ color: '#00d4ff' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base mb-1">Write to your own NFC tag</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Already have blank NFC tags or stickers? Tap below, then hold a tag against the back of your phone to write {cardName ? `${cardName}'s` : 'your'} card URL to it.
            </p>
            <p className="text-xs font-mono break-all text-muted-foreground mb-4">{cardUrl}</p>
            <button
              onClick={handleWrite}
              disabled={writing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
              {writing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
              {writing ? 'Waiting for tag' : 'Write to NFC tag'}
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={dismiss}>
          <div className="rounded-3xl p-8 max-w-sm w-full text-center relative"
            style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={(e) => e.stopPropagation()}>
            <button onClick={dismiss}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition">
              <X className="w-4 h-4" />
            </button>
            {success ? (
              <>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(34,197,94,0.15)' }}>
                  <CheckCircle className="w-8 h-8" style={{ color: '#22c55e' }} />
                </div>
                <h3 className="text-xl font-bold mb-2">Tag written</h3>
                <p className="text-sm text-muted-foreground">Tap your tag on any phone to share your card.</p>
              </>
            ) : error ? (
              <>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(239,68,68,0.15)' }}>
                  <AlertCircle className="w-8 h-8" style={{ color: '#ef4444' }} />
                </div>
                <h3 className="text-xl font-bold mb-2">Write failed</h3>
                <p className="text-sm text-muted-foreground mb-5">{error}</p>
                <button onClick={handleWrite}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
                  Try again
                </button>
              </>
            ) : (
              <>
                <div className="relative w-24 h-24 flex items-center justify-center mx-auto mb-4">
                  {/* Concentric pulsing rings simulate the radiating NFC field */}
                  <span className="nfc-pulse-ring absolute inset-0 rounded-full" style={{ animationDelay: '0s' }} />
                  <span className="nfc-pulse-ring absolute inset-0 rounded-full" style={{ animationDelay: '0.6s' }} />
                  <span className="nfc-pulse-ring absolute inset-0 rounded-full" style={{ animationDelay: '1.2s' }} />
                  <div className="relative w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.25), rgba(124,58,237,0.25))' }}>
                    <Wifi className="w-8 h-8" style={{ color: '#00d4ff' }} />
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-2">Hold a tag near your phone</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Place a blank NFC tag or sticker against the back of your phone, usually just above the camera.
                </p>
                <p className="text-xs text-muted-foreground">Hold steady until you feel a vibration.</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
