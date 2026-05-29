'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

interface Props {
  token: string
  email: string
  cardName: string | null
}

export default function ClaimForm({ token, email, cardName }: Props) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setErrorMsg('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/team/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not claim card')
        setSubmitting(false)
        return
      }
      toast.success(cardName ? `Welcome, ${cardName}!` : 'Welcome to your team!')
      // Hard-navigate so the new auth session is picked up by the server
      window.location.href = '/dashboard'
    } catch {
      setErrorMsg('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          disabled
          className="w-full px-4 py-3 rounded-xl text-sm cursor-not-allowed"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
        />
        <p className="text-[11px] mt-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Your admin chose this. It can't be changed here.
        </p>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Choose a password
        </label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-white focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}
            required
          />
          <button type="button" onClick={() => setShowPw(s => !s)}
            className="absolute top-1/2 right-3 -translate-y-1/2"
            aria-label={showPw ? 'Hide password' : 'Show password'}>
            {showPw
              ? <EyeOff className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
              : <Eye className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
            }
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Confirm password
        </label>
        <input
          type={showPw ? 'text' : 'password'}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Repeat your password"
          autoComplete="new-password"
          className="w-full px-4 py-3 rounded-xl text-sm text-white focus:outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}
          required
        />
      </div>

      {errorMsg && (
        <div className="rounded-xl p-3 text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)', boxShadow: '0 8px 28px rgba(124,58,237,0.4)' }}
      >
        {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Setting up your account...</> : 'Set up my account'}
      </button>
    </form>
  )
}
