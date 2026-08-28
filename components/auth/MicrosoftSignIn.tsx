'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

// Sign in with a Microsoft work or school account.
//
// The identity stays in the customer's own Entra tenant, which their employer
// already pays for, so nothing is billed to us and there is no user ceiling to
// plan around. Cardtly never sees a password, and when their IT disables the
// account the person loses access here too, without anybody telling us.
//
// Rendered only when the provider is actually configured, so the button cannot
// appear on an environment where pressing it would fail. See NEXT_PUBLIC_MS_SSO.

// Microsoft's brand mark. Four squares, exact colours from their guidelines -
// using a generic "M" or a tinted version is the thing they ask people not to
// do, and it also reads as a phishing page.
function MicrosoftMark({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 23 23" className={className} aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  )
}

export default function MicrosoftSignIn({ next = '/dashboard' }: { next?: string }) {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function signIn() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        // email is not in the default scope set, and without it the account
        // arrives with no address at all - which every other part of Cardtly
        // treats as the person's identity.
        scopes: 'openid profile email',
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (error) {
      toast.error(error.message || 'Could not start Microsoft sign-in', { duration: 8000 })
      setLoading(false)
    }
    // On success the browser leaves for Microsoft, so the spinner stays up
    // rather than flashing off before the redirect.
  }

  return (
    <button
      type="button"
      onClick={signIn}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl border border-border bg-background text-sm font-semibold hover:bg-muted transition disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MicrosoftMark />}
      Sign in with Microsoft
    </button>
  )
}
