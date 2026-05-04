'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

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

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

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

    toast.success('Account created! Welcome to Cardtly.')
    router.push('/dashboard')
    router.refresh()
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
        </div>
      </div>
    </div>
  )
}
