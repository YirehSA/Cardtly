'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react'

const schema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm: z.string().min(8, 'Confirm your password'),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
})

type FormData = z.infer<typeof schema>

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [show1, setShow1] = useState(false)
  const [show2, setShow2] = useState(false)
  const [authed, setAuthed] = useState<boolean | null>(null)

  // Supabase puts the access/refresh tokens for password-reset links in
  // the URL hash on arrival. The supabase-js client picks those up
  // automatically via detectSessionInUrl. We just need to wait for the
  // session to settle before showing the form.
  useEffect(() => {
    let cancelled = false
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!cancelled) setAuthed(!!session)
    }
    check()
    // Listen for PASSWORD_RECOVERY event in case the session arrives later
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setAuthed(true)
      }
    })
    return () => {
      cancelled = true
      sub?.subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    toast.success('Password updated. Signing you in...')
    router.push('/dashboard')
    router.refresh()
  }

  const inputClass = "w-full px-4 py-3 pr-11 rounded-xl border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/30 transition"

  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050510' }}>
        <div className="w-12 h-12 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.1)' }} />
      </div>
    )
  }

  if (authed === false) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#050510' }}>
        <div className="w-full max-w-sm text-center space-y-5">
          <h1 className="text-2xl font-black text-white">Link expired or invalid</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            This password reset link has expired or has already been used. Request a new one to continue.
          </p>
          <Link href="/forgot-password"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: grad }}>
            Send new reset link <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#050510' }}>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 70%)' }} />

      <div className="w-full max-w-sm relative">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
          style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))' }}>
          <ShieldCheck className="w-8 h-8" style={{ color: '#00d4ff' }} />
        </div>
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">Choose a new password</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            At least 8 characters. After saving you will be signed in automatically.
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-white/70">New password</label>
            <div className="relative">
              <input type={show1 ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 8 characters"
                className={inputClass}
                style={{ color: 'white', backgroundColor: 'rgba(255,255,255,0.06)' }}
                {...register('password')} />
              <button type="button" onClick={() => setShow1(p => !p)}
                aria-label={show1 ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition">
                {show1 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-white/70">Confirm password</label>
            <div className="relative">
              <input type={show2 ? 'text' : 'password'} autoComplete="new-password" placeholder="Repeat new password"
                className={inputClass}
                style={{ color: 'white', backgroundColor: 'rgba(255,255,255,0.06)' }}
                {...register('confirm')} />
              <button type="button" onClick={() => setShow2(p => !p)}
                aria-label={show2 ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition">
                {show2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirm && <p className="text-red-400 text-xs mt-1">{errors.confirm.message}</p>}
          </div>
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50 mt-2"
            style={{ background: grad, boxShadow: '0 8px 32px rgba(124,58,237,0.35)' }}>
            {loading ? 'Updating...' : <><span>Save and sign in</span><ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>
      </div>
    </div>
  )
}
