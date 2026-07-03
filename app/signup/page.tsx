'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Mail, ArrowLeft, Check, Sparkles, QrCode, Loader2, ArrowRight } from 'lucide-react'
import { getStoredReferralCode, clearReferralCode } from '@/lib/referral'

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

const schema = z.object({
  name:     z.string().min(2, 'Enter your full name'),
  company:  z.string().optional(),
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormData = z.infer<typeof schema>

function buildSlug(name: string, company?: string): string {
  const clean = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')

  const namePart    = clean(name).slice(0, 30)
  const companyPart = company ? clean(company).slice(0, 20) : ''

  return companyPart ? `${companyPart}-${namePart}` : namePart
}

async function getUniqueSlug(supabase: any, base: string): Promise<string> {
  // Try the clean slug first
  const { data: existing } = await supabase
    .from('cards')
    .select('id')
    .eq('slug', base)
    .single()

  if (!existing) return base

  // If taken, try appending numbers
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}-${i}`
    const { data: taken } = await supabase
      .from('cards')
      .select('id')
      .eq('slug', candidate)
      .single()
    if (!taken) return candidate
  }

  // Fallback with random suffix
  return `${base}-${Math.random().toString(36).slice(2, 6)}`
}

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  // Live values driving the card preview - the form IS the card
  // builder. Every keystroke renders onto the card on the left.
  const liveName = watch('name') || ''
  const liveCompany = watch('company') || ''
  const liveEmail = watch('email') || ''
  const liveSlug = liveName.trim().length >= 2 ? buildSlug(liveName, liveCompany || undefined) : ''

  const [confirmEmail, setConfirmEmail] = useState<string | null>(null)

  // Prefill the name when arriving from the homepage hero's
  // "claim your card" CTA (/signup?name=Jane+Doe). window read in
  // an effect because this page is prerendered server-side.
  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get('name')
    if (prefill && prefill.trim().length >= 2) {
      setValue('name', prefill.trim())
    }
  }, [setValue])

  async function onSubmit(data: FormData) {
    setLoading(true)

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    })

    if (authError || !authData.user) {
      toast.error(authError?.message || 'Something went wrong')
      setLoading(false)
      return
    }

    const userId = authData.user.id

    // Create profile
    await supabase.from('profiles').insert({
      user_id: userId,
      name: data.name,
    })

    // Generate slug: company-firstname-lastname or firstname-lastname
    const baseSlug = buildSlug(data.name, data.company)
    const slug = await getUniqueSlug(supabase, baseSlug)

    await supabase.from('cards').insert({
      user_id:    userId,
      name:       data.name,
      company:    data.company || null,
      email:      data.email,
      slug,
      is_primary: true,
      color_theme: 'blue',
    })

    // Best-effort: capture sign-up IP + country so the admin panel can
    // show where each user came from. Fire and forget; never block.
    fetch('/api/track-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    }).catch(() => {})

    // Consume any referral code stored from a ?ref= link the user
    // hit earlier. Best-effort: if it fails for any reason, the
    // user still gets their account - we just lose the referral
    // attribution.
    const referralCode = getStoredReferralCode()
    if (referralCode) {
      fetch('/api/referrals/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, referral_code: referralCode }),
      })
        .then(() => clearReferralCode())
        .catch(() => {})
    }

    // If the DB trigger flagged this user as one of the first 100
    // founders, grant the 3-month Pro reward. Best-effort, no-op
    // if they're not a founder.
    fetch('/api/promotions/grant-founder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    }).catch(() => {})

    // If Supabase returned a session, email confirmation is off and we
    // can take the user straight in. Otherwise the user must confirm
    // their email first, so show the "check your inbox" screen rather
    // than redirecting to a dashboard they can't access yet.
    if (authData.session) {
      toast.success('Account created! Welcome to Cardtly.')
      router.push('/dashboard')
      router.refresh()
    } else {
      setConfirmEmail(data.email)
      setLoading(false)
    }
  }

  const inputClass = "w-full px-4 py-3 rounded-xl border text-sm text-white transition focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-white/30"
  const inputStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }
  const filledCount = [liveName.trim(), liveCompany.trim(), liveEmail.trim()].filter(Boolean).length

  return (
    <div className="min-h-screen flex" style={{ background: '#000', color: '#fff' }}>
      {/* Left — live card preview that builds as they type */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Ambient orbs */}
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full blur-[130px] pointer-events-none animate-pulse-slow-signup"
          style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.16) 0%, rgba(124,58,237,0.10) 50%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-[110px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.12) 0%, transparent 70%)' }} />

        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2.5 hover:opacity-80 transition">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cardtly-icon.png" alt="Cardtly" className="h-12 w-12 rounded-full" />
            <span className="font-black text-xl tracking-tight" style={gradText}>Cardtly</span>
          </Link>
        </div>

        <div className="relative flex flex-col items-center">
          <h2 className="text-3xl font-black tracking-tight text-white text-center leading-tight mb-2">
            Watch your card<br /><span style={gradText}>build itself.</span>
          </h2>
          <p className="text-sm mb-10 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Start typing on the right — this is your actual card.
          </p>

          {/* The live card */}
          <div className="w-72 rounded-3xl overflow-hidden transition-all duration-300 animate-float-card"
            style={{
              background: 'linear-gradient(135deg, rgba(0,212,255,0.16), rgba(124,58,237,0.16))',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(20px)',
              boxShadow: `0 30px 80px rgba(124,58,237,${0.2 + filledCount * 0.08}), 0 8px 30px rgba(0,0,0,0.4)`,
            }}>
            <div className="h-20" style={{ background: 'linear-gradient(135deg, #00d4ff33, #7c3aed33)' }} />
            <div className="px-6 pb-6 text-center" style={{ marginTop: -32 }}>
              <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-2xl font-black text-white transition-all"
                style={{ background: grad, boxShadow: '0 8px 24px rgba(124,58,237,0.45)' }}>
                {(liveName.trim()[0] || '?').toUpperCase()}
              </div>
              <p className="font-bold text-white text-lg min-h-[28px]">
                {liveName.trim() || <span style={{ color: 'rgba(255,255,255,0.25)' }}>Your name</span>}
              </p>
              <p className="text-xs mt-0.5 min-h-[16px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {liveCompany.trim() || <span style={{ color: 'rgba(255,255,255,0.2)' }}>Your company</span>}
              </p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-xs py-2 px-3 rounded-xl text-left"
                  style={{ background: 'rgba(255,255,255,0.08)', color: liveEmail.trim() ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)' }}>
                  <Mail className="w-3 h-3 flex-shrink-0" style={{ color: '#00d4ff' }} />
                  <span className="truncate">{liveEmail.trim() || 'your@email.com'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs py-2 px-3 rounded-xl text-left"
                  style={{ background: 'rgba(255,255,255,0.08)', color: liveSlug ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)' }}>
                  <QrCode className="w-3 h-3 flex-shrink-0" style={{ color: '#ec4899' }} />
                  <span className="truncate">cardtly.com/card/{liveSlug || 'your-name'}</span>
                </div>
              </div>
              <div className="mt-4 py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: grad }}>
                Save Contact
              </div>
            </div>
          </div>

          {/* Live URL claim pill */}
          {liveSlug && (
            <div className="mt-6 flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold animate-fade-in-signup"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
              <Check className="w-3.5 h-3.5" />
              cardtly.com/card/{liveSlug} is yours when you sign up
            </div>
          )}
        </div>

        <div className="relative flex items-center justify-between">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            © {new Date().getFullYear()} Cardtly · Made in South Africa 🇿🇦
          </p>
          <div className="flex gap-3">
            {['Free forever', 'QR included', 'NFC ready'].map(perk => (
              <span key={perk} className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)' }}>
                {perk}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)' }} />

        <div className="w-full max-w-sm relative">
          <div className="lg:hidden mb-10">
            <Link href="/" aria-label="Cardtly home" className="inline-block hover:opacity-80 transition">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/cardtly-icon.png" alt="Cardtly" className="h-12 w-12 rounded-full" />
            </Link>
          </div>

          {confirmEmail ? (
            <div className="space-y-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(124,58,237,0.15))', border: '1px solid rgba(124,58,237,0.3)' }}>
                <Mail className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white tracking-tight mb-2">Check your email</h1>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  We sent a confirmation link to <span className="font-semibold text-white">{confirmEmail}</span>. Click it to activate your Cardtly account.
                </p>
              </div>
              <div className="rounded-xl p-4 space-y-2 text-sm"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="font-medium text-white">Not seeing it?</p>
                <ul className="space-y-1 list-disc pl-5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <li>Check your spam folder</li>
                  <li>Confirm <span className="font-mono text-xs">{confirmEmail}</span> is spelled correctly</li>
                  <li>The link can take a minute to arrive</li>
                </ul>
              </div>
              <button onClick={() => setConfirmEmail(null)}
                className="flex items-center gap-2 text-sm font-medium transition hover:text-white"
                style={{ color: 'rgba(255,255,255,0.5)' }}>
                <ArrowLeft className="w-4 h-4" />
                Use a different email
              </button>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Already confirmed? <Link href="/login" className="text-white font-medium hover:underline">Sign in</Link>
              </p>
            </div>
          ) : (
          <>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest mb-5"
            style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}>
            <Sparkles className="w-3 h-3" />
            Free forever · No credit card
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">
            Create your <span style={gradText}>card</span>
          </h1>
          <p className="mb-8 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Live in 60 seconds. Watch it build as you type.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-white" htmlFor="name">
                Full name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                className={inputClass}
                style={inputStyle}
                placeholder="Andre Nel"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-white" htmlFor="company">
                Company <span className="font-normal" style={{ color: 'rgba(255,255,255,0.35)' }}>(optional)</span>
              </label>
              <input
                id="company"
                type="text"
                autoComplete="organization"
                className={inputClass}
                style={inputStyle}
                placeholder="Yireh Business Solutions"
                {...register('company')}
              />
              {/* Live URL preview - the moment a name exists, show them
                  the exact address they're claiming. On desktop the left
                  panel shows it too; on mobile this is the only preview. */}
              <p className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color: liveSlug ? '#4ade80' : 'rgba(255,255,255,0.35)' }}>
                {liveSlug && <Check className="w-3 h-3" />}
                {liveSlug
                  ? <>Your URL: <span className="font-mono">cardtly.com/card/{liveSlug}</span></>
                  : <>Used to create your card URL e.g. <span className="font-mono">yireh-andre-nel</span></>}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-white" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={inputClass}
                style={inputStyle}
                placeholder="you@example.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-white" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                className={inputClass}
                style={inputStyle}
                placeholder="At least 8 characters"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{ background: grad, boxShadow: '0 8px 30px rgba(124,58,237,0.4)' }}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating your card...</>
              ) : (
                <>{liveSlug ? `Claim cardtly.com/card/${liveSlug.slice(0, 24)}${liveSlug.length > 24 ? '…' : ''}` : 'Create free card'}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /></>
              )}
            </button>
          </form>

          <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
            By signing up you agree to our{' '}
            <Link href="/terms" className="underline transition hover:text-white">Terms</Link>
            {' '}and{' '}
            <Link href="/privacy" className="underline transition hover:text-white">Privacy Policy</Link>
          </p>

          <p className="text-center text-sm mt-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Already have an account?{' '}
            <Link href="/login" className="text-white font-medium hover:underline">
              Sign in
            </Link>
          </p>
          </>
          )}
        </div>
      </div>

      {/* Local keyframes for the floating card + fade-ins */}
      <style>{`
        @keyframes float-card {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50%      { transform: translateY(-10px) rotate(1deg); }
        }
        @keyframes fade-in-signup {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-slow-signup {
          0%, 100% { opacity: 0.9; }
          50%      { opacity: 0.55; }
        }
        .animate-float-card        { animation: float-card 6s ease-in-out infinite; }
        .animate-fade-in-signup    { animation: fade-in-signup 0.4s ease-out both; }
        .animate-pulse-slow-signup { animation: pulse-slow-signup 5s ease-in-out infinite; }
      `}</style>
    </div>
  )
}
