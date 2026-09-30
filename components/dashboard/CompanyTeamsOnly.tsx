'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Loader2, LogOut, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

// What the iOS app shows someone who is not on a company team.
//
// The app serves company teams only since App Review's 3.1.1 / 3.1.3(c)
// rejection of 2026-09-30 (lib/app-platform, iosAppAdmits). An individual who
// signs in gets this instead of the dashboard: what the app is for, how a team
// member gets in, and the two things they may still need to do here.
//
// NOTHING ABOUT BUYING, and no link out. Pointing an individual at a way to pay
// outside the app is exactly the call to action Guideline 3.1.1 forbids, so
// this says who the app is for and stops.
//
// Account deletion stays reachable because Guideline 5.1.1(v) requires it in
// any app where an account can exist, and this person cannot reach Settings.
// Same endpoint and same type-your-email confirmation as Settings.
export default function CompanyTeamsOnly({ email }: { email: string }) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function signOut() {
    setSigningOut(true)
    // This device only. Someone who signed in with the wrong account should
    // not also be signed out of it on their computer.
    await createClient().auth.signOut({ scope: 'local' })
    router.replace('/login')
  }

  async function deleteAccount() {
    if (confirm.trim().toLowerCase() !== email.toLowerCase()) {
      toast.error('Email does not match')
      return
    }
    setDeleting(true)
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Deletion failed')
      }
      try { await createClient().auth.signOut({ scope: 'local' }) } catch { /* the user is already gone */ }
      toast.success('Your account and all associated data have been deleted.')
      router.replace('/login')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not delete your account. Please try again or email andre@cardtly.com.', { duration: 8000 })
      setDeleting(false)
    }
  }

  const matches = confirm.trim().toLowerCase() === email.toLowerCase() && email !== ''

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <img src="/cardtly-icon.png" alt="Cardtly" className="h-12 w-12 rounded-full object-contain mb-8" />

        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8">
          <span className="w-11 h-11 rounded-xl grid place-items-center mb-5" style={{ background: 'hsl(var(--accent) / 0.12)' }}>
            <Building2 className="w-5 h-5" style={{ color: 'hsl(var(--accent))' }} aria-hidden="true" />
          </span>

          <h1 className="font-display text-2xl font-bold tracking-tight leading-snug">
            Cardtly for iPhone and iPad is for company teams
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mt-3">
            This app is for people whose digital business card is provided by their company.
            The account you signed in with{email ? <>, <span className="font-medium text-foreground break-all">{email}</span>,</> : ''} is
            not part of a company team.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-3">
            If your company uses Cardtly, ask whoever manages your team to invite you, then sign in
            with the account the invite sets up.
          </p>
          <p className="text-xs text-muted-foreground mt-3">
            Nothing about your account or your card has changed.
          </p>

          <button
            type="button"
            onClick={signOut}
            disabled={signingOut || deleting}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: 'hsl(var(--accent))' }}
          >
            {signingOut
              ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              : <LogOut className="w-4 h-4" aria-hidden="true" />}
            Sign in with a different account
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-destructive/30 p-5">
          {!showDelete ? (
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Delete this account</p>
                <p className="text-xs text-muted-foreground mt-0.5">Permanently, with everything it holds.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="shrink-0 inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-lg border border-destructive/40 text-destructive text-sm font-medium hover:bg-destructive/10 transition"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                Delete
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-destructive">Delete this account</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This permanently deletes your account, your cards and the contacts they collected, and
                your card links stop working. Any subscription on the account is cancelled first, so
                nothing is charged again. It cannot be undone.
              </p>
              <label className="block text-xs text-muted-foreground" htmlFor="delete-confirm">
                Type <span className="font-mono font-semibold text-foreground break-all">{email}</span> to confirm
              </label>
              <input
                id="delete-confirm"
                type="email"
                autoComplete="off"
                autoCapitalize="none"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder={email}
                className="w-full min-h-[44px] px-4 rounded-lg border border-destructive/40 bg-background text-base focus:outline-none focus:ring-2 focus:ring-destructive transition"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={deleteAccount}
                  disabled={deleting || !matches}
                  className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-destructive text-white text-sm font-semibold hover:bg-destructive/90 transition disabled:opacity-50"
                >
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  {deleting ? 'Deleting' : 'Yes, delete my account'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDelete(false); setConfirm('') }}
                  disabled={deleting}
                  className="min-h-[44px] px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
