'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Coming back to a dashboard page shows it as it is NOW.
//
// Next keeps a copy of every page you have visited, and browser Back and
// Forward restore that copy instead of asking the server. On a dashboard that
// is a page from before whatever you just changed: lock the office number in
// Departments, press Back to the card, and the card still has an open box
// until you reload (Andre, 2026-10-08: "we have to refresh every time before
// we see it"). After a Back or Forward this asks the server for the page
// again, and the same when the browser itself restores a page from its own
// back-forward cache (pageshow with persisted).
//
// Only refreshes server data: anything typed and not yet saved lives in the
// page's own state, which a refresh does not reset.

export default function FreshOnReturn() {
  const router = useRouter()
  useEffect(() => {
    // After Next has finished restoring the cached page, not during it.
    const refresh = () => window.setTimeout(() => router.refresh(), 0)
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) refresh() }
    window.addEventListener('popstate', refresh)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      window.removeEventListener('popstate', refresh)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [router])
  return null
}
