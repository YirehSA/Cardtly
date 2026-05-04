'use client'

import { Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ArrowRight, Wifi } from 'lucide-react'

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
  const supabase = createClient()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    router.push(redirectTo)
    router.refresh()
  }

  const inputClass = "w-full px-4 py-3 rounded-xl border border-white/10 bg-white/08 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:bg-white/12 transition"

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Email</label>
        <input id="email" type="email" autoComplete="email"
          className={inputClass} placeholder="you@company.com" {...register('email')} />
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
          className={inputClass} placeholder="••••••••" {...register('password')} />
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
