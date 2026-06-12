'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Mail, ArrowLeft } from 'lucide-react'
import { getStoredReferralCode, clearReferralCode } from '@/lib/referral'

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

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

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

  const inputClass = "w-full px-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-foreground text-background flex-col justify-between p-12">
        <div>
          <span className="font-display text-2xl font-bold tracking-tight">Cardtly</span>
        </div>
        <div>
          <blockquote className="text-3xl font-display font-semibold leading-tight mb-6">
            Create your card<br />in 60 seconds.<br />Share forever.
          </blockquote>
          <ul className="space-y-3 text-background/70 text-sm">
            {[
              'Free card, always',
              'Your own public URL',
              'QR code included',
              'Upgrade anytime for more',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-background/40" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="text-background/40 text-xs">
          © {new Date().getFullYear()} Cardtly
        </div>
      </div>

      {/* Right — form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-10">
            <span className="font-display text-2xl font-bold tracking-tight">Cardtly</span>
          </div>

          {confirmEmail ? (
            <div className="space-y-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(124,58,237,0.15))' }}>
                <Mail className="w-8 h-8 text-foreground" />
              </div>
              <div>
                <h1 className="font-display text-3xl font-bold mb-2">Check your email</h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  We sent a confirmation link to <span className="font-semibold text-foreground">{confirmEmail}</span>. Click it to activate your Cardtly account.
                </p>
              </div>
              <div className="rounded-xl p-4 border border-border bg-muted/30 space-y-2 text-sm">
                <p className="font-medium">Not seeing it?</p>
                <ul className="text-muted-foreground space-y-1 list-disc pl-5">
                  <li>Check your spam folder</li>
                  <li>Confirm <span className="font-mono text-xs">{confirmEmail}</span> is spelled correctly</li>
                  <li>The link can take a minute to arrive</li>
                </ul>
              </div>
              <button onClick={() => setConfirmEmail(null)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition">
                <ArrowLeft className="w-4 h-4" />
                Use a different email
              </button>
              <p className="text-sm text-muted-foreground">
                Already confirmed? <Link href="/login" className="text-foreground font-medium hover:underline">Sign in</Link>
              </p>
            </div>
          ) : (
          <>
          <h1 className="font-display text-3xl font-bold mb-2">Create your card</h1>
          <p className="text-muted-foreground mb-8">Free to start, no credit card required</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="name">
                Full name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                className={inputClass}
                placeholder="Andre Nel"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-destructive text-xs mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="company">
                Company <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                id="company"
                type="text"
                autoComplete="organization"
                className={inputClass}
                placeholder="Yireh Business Solutions"
                {...register('company')}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Used to create your card URL e.g. <span className="font-mono">yireh-andre-nel</span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={inputClass}
                placeholder="you@example.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-destructive text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                className={inputClass}
                placeholder="At least 8 characters"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-destructive text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-foreground text-background py-2.5 rounded-lg text-sm font-semibold hover:bg-foreground/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating your card...' : 'Create free card'}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            By signing up you agree to our{' '}
            <Link href="/terms" className="underline hover:text-foreground">Terms</Link>
            {' '}and{' '}
            <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>
          </p>

          <p className="text-center text-sm text-muted-foreground mt-4">
            Already have an account?{' '}
            <Link href="/login" className="text-foreground font-medium hover:underline">
              Sign in
            </Link>
          </p>
          </>
          )}
        </div>
      </div>
    </div>
  )
}
