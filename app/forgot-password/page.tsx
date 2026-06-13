'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowRight, ArrowLeft, Mail } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
})

type FormData = z.infer<typeof schema>

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    // Token-hash reset via our own endpoint so the link works on any
    // device (not just the browser that requested it). See
    // lib/password-reset for the why.
    try {
      const res = await fetch('/api/auth/send-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'Could not send reset email')
        setLoading(false)
        return
      }
      setSent(data.email)
    } catch {
      toast.error('Network error. Please try again.')
    }
    setLoading(false)
  }

  const inputClass = "w-full px-4 py-3 rounded-xl border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/30 transition"

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#050510' }}>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 70%)' }} />

      <div className="w-full max-w-sm relative">
        {sent ? (
          <div className="space-y-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))' }}>
              <Mail className="w-8 h-8" style={{ color: '#00d4ff' }} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight mb-2">Check your email</h1>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                We sent a reset link to <span className="font-semibold text-white">{sent}</span>. Click it to choose a new password.
              </p>
            </div>
            <div className="rounded-xl p-4 space-y-2 text-sm"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="font-medium text-white">Not seeing it?</p>
              <ul className="space-y-1 list-disc pl-5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                <li>Check your spam folder</li>
                <li>The link can take a minute to arrive</li>
                <li>Confirm the email is spelled correctly</li>
              </ul>
            </div>
            <Link href="/login" className="flex items-center gap-2 text-sm font-medium text-white/60 hover:text-white transition">
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-black text-white tracking-tight mb-2">Reset your password</h1>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Enter the email on your Cardtly account and we will send you a link to choose a new password.
              </p>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-white/70">Email</label>
                <input type="email" autoComplete="email" placeholder="you@company.com"
                  className={inputClass}
                  style={{ color: 'white', backgroundColor: 'rgba(255,255,255,0.06)' }}
                  {...register('email')} />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ background: grad, boxShadow: '0 8px 32px rgba(124,58,237,0.35)' }}>
                {loading ? 'Sending...' : <><span>Send reset link</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
            <p className="text-center text-sm mt-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Remember it after all?{' '}
              <Link href="/login" className="font-semibold hover:opacity-80 transition" style={{ color: '#00d4ff' }}>
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
