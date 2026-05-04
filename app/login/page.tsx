'use client'

import { Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormData = z.infer<typeof schema>

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
          placeholder="you@example.com"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-destructive text-xs mt-1">{errors.email.message}</p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium" htmlFor="password">
            Password
          </label>
          <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground transition">
            Forgot password?
          </Link>
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
          placeholder="••••••••"
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
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Left — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-foreground text-background flex-col justify-between p-12">
        <div>
          <span className="font-display text-2xl font-bold tracking-tight">Cardtly</span>
        </div>
        <div>
          <blockquote className="text-3xl font-display font-semibold leading-tight mb-6">
            Your card.<br />Your identity.<br />Always on.
          </blockquote>
          <p className="text-background/60 text-sm">
            Thousands of professionals share their details with Cardtly every day.
          </p>
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

          <h1 className="font-display text-3xl font-bold mb-2">Welcome back</h1>
          <p className="text-muted-foreground mb-8">Sign in to your account</p>

          <Suspense fallback={<div className="h-40 animate-pulse bg-muted rounded-lg" />}>
            <LoginForm />
          </Suspense>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-foreground font-medium hover:underline">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
