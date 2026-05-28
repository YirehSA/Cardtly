'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isNativeApp } from '@/lib/capacitor'

// When the Cardtly Android app boots, it loads cardtly.com (the
// marketing homepage). That's the wrong entry point for app users —
// they almost always want to sign in (or go straight to their
// dashboard if already signed in). This component redirects them
// before the marketing content has a chance to render.
//
// Web visitors are unaffected: isNativeApp() is false on web, so
// this is a no-op there.

export default function NativeAppRedirect() {
  const router = useRouter()

  useEffect(() => {
    if (!isNativeApp()) return

    let cancelled = false
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return
      router.replace(user ? '/dashboard' : '/login')
    }).catch(() => {
      if (cancelled) return
      router.replace('/login')
    })

    return () => { cancelled = true }
  }, [router])

  return null
}
