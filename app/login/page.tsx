'use client'

import { Suspense, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ArrowRight, Wifi, Fingerprint } from 'lucide-react'
import { getBiometricStatus, hasBiometricEnabled, signInWithBiometric, enableBiometric } from '@/lib/biometric'

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormData = z.infer<typeof schema>

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'
  const [loading, setLoading] = useState(false)
  const [biometricLabel, setBiometricLabel] = useState<string>('')
  const [showBiometricButton, setShowBiometricButton] = useState(false)
  const [biometricBusy, setBiometricBusy] = useState(false)
  const [postLoginPrompt, setPostLoginPrompt] = useState<{ email: string; refreshToken: string } | null>(null)
  const supabase = createClient()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  // On mount: check if biometric is available and previously enabled.
  // If so, surface a button so the user can sign in with one tap. We do
  // NOT auto-prompt because some users want to switch accounts.
  useEffect(() => {
    let cancelled = false
    async function check() {
      const status = await getBiometricStatus()
      if (cancelled) return
      if (status.available && hasBiometricEnabled()) {
        setBiometricLabel(status.label)
        setShowBiometricButton(true)
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  async function handleBiometricSignIn() {
    setBiometricBusy(true)
    try {
      const result = await signInWithBiometric()
      if (!result.ok || !result.refreshToken) {
        toast.error('Could not verify. Try password.')
        setBiometricBusy(false)
        return
      }
      const { error } = await supabase.auth.refreshSession({ refresh_token: result.refreshToken })
      if (error) {
        toast.error('Session expired. Sign in with password.')
        setBiometricBusy(false)
        return
      }
      router.push(redirectTo)
      router.refresh()
    } catch {
      toast.error('Biometric sign in failed')
      setBiometricBusy(false)
    }
  }

  async function onSubmit(data: FormData) {
    setLoading(true)
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    // Offer biometric opt-in if available and not already enabled
    const status = await getBiometricStatus()
    if (status.available && !hasBiometricEnabled() && authData.session?.refresh_token) {
      setPostLoginPrompt({
        email: data.email,
        refreshToken: authData.session.refresh_token,
      })
      setLoading(false)
      return
    }
    router.push(redirectTo)
    router.refresh()
  }

  async function acceptBiometric() {
    if (!postLoginPrompt) return
    try {
      await enableBiometric(postLoginPrompt.email, postLoginPrompt.refreshToken)
      toast.success(`Saved. Use ${biometricLabel || 'biometric'} next time.`)
    } catch {
      toast.error('Could not save biometric. You can try again from Settings.')
    }
    setPostLoginPrompt(null)
    router.push(redirectTo)
    router.refresh()
  }

  function declineBiometric() {
    setPostLoginPrompt(null)
    router.push(redirectTo)
    router.refresh()
  }

  const inputClass = "w-full px-4 py-3 rounded-xl border border-white/10 bg-white/08 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:bg-white/12 transition"

  // Post-login prompt asking the user to enable biometric login
  if (postLoginPrompt) {
    return (
      <div className="space-y-5 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))' }}>
          <Fingerprint className="w-8 h-8" style={{ color: '#00d4ff' }} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Use {biometricLabel || 'biometric'} next time?</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Sign in faster by using your {biometricLabel || 'fingerprint or face'}. We store an encrypted session token on this device only.
          </p>
        </div>
        <div className="space-y-2">
          <button onClick={acceptBiometric}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: grad, boxShadow: '0 8px 32px rgba(124,58,237,0.35)' }}>
            Enable {biometricLabel || 'biometric'} sign in
          </button>
          <button onClick={declineBiometric}
            className="w-full py-3 rounded-xl text-sm font-medium text-white/70 hover:text-white transition">
            Not now
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {showBiometricButton && (
        <>
          <button type="button" onClick={handleBiometricSignIn} disabled={biometricBusy}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition hover:opacity-90 disabled:opacity-50"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'white',
            }}>
            <Fingerprint className="w-4 h-4" style={{ color: '#00d4ff' }} />
            {biometricBusy ? 'Verifying...' : `Sign in with ${biometricLabel || 'biometric'}`}
          </button>
          <div className="flex items-center gap-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <span className="text-xs">or</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          </div>
        </>
      )}
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Email</label>
        <input id="email" type="email" autoComplete="email"
          className={inputClass} placeholder="you@company.com" style={{ color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' }} {...register('email')} />
        {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-white/70">Password</label>
          <Link href="/forgot-password" className="text-xs hover:text-white transition" style={{ color: '#00d4ff' }}>
            Forgot password?
          </Link>
        </div>
        <input id="password" type="password" autoComplete="current-password"
          className={inputClass} placeholder="••••••••" style={{ color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' }} {...register('password')} />
        {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
      </div>

      <button type="submit" disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50 mt-2"
        style={{ background: grad, boxShadow: '0 8px 32px rgba(124,58,237,0.35)' }}>
        {loading ? 'Signing in...' : <><span>Sign in</span><ArrowRight className="w-4 h-4" /></>}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex" style={{ background: '#050510' }}>
      {/* Left — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Background glows */}
        <div className="absolute top-0 left-0 w-96 h-96 rounded-full blur-[120px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full blur-[100px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)' }} />

        <div className="relative">
          <img src="/logo.png" alt="Cardtly" className="h-10 w-auto object-contain" />
        </div>

        <div className="relative space-y-8">
          <div>
            <h2 className="text-4xl font-black tracking-tight text-white leading-tight mb-4">
              Your card.<br />Your identity.<br />
              <span style={gradText}>Always on.</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)' }} className="text-base leading-relaxed">
              Share your details with a tap, a scan, or a link. No paper needed.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-3">
            {[
              { icon: '🪪', text: 'Digital business card with your own URL' },
              { icon: '📊', text: 'See who viewed your card and when' },
              { icon: '✉️', text: 'Email signature generated instantly' },
              { icon: <Wifi className="w-4 h-4" style={{ color: '#00d4ff' }} />, text: 'NFC cards — tap to share in person' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                <span className="text-base">{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            © {new Date().getFullYear()} Cardtly · Made in South Africa 🇿🇦
          </p>
        </div>
      </div>

      {/* Right — form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)' }} />

        <div className="w-full max-w-sm relative">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10">
            <img src="/logo.png" alt="Cardtly" className="h-9 w-auto object-contain" />
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-black text-white tracking-tight mb-2">Welcome back</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)' }} className="text-sm">Sign in to your Cardtly account</p>
          </div>

          <Suspense fallback={<div className="h-40 animate-pulse rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }} />}>
            <LoginForm />
          </Suspense>

          <p className="text-center text-sm mt-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
            No account yet?{' '}
            <Link href="/signup" className="font-semibold hover:opacity-80 transition" style={{ color: '#00d4ff' }}>
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
