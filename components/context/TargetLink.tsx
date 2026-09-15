'use client'

import Link from 'next/link'
import { User, Users } from 'lucide-react'
import { hasUnsavedContext, LEAVE_WARNING } from './unsaved'

// The target switcher's links, with one question attached.
//
// Switching target is a server navigation that re-reads the other card's
// configuration, so an unsaved draft would simply be gone. Silently throwing
// away somebody's work because they clicked the wrong card is not acceptable,
// and the App Router has no route change guard to hook, so the check happens
// where the navigation starts: on the click.
//
// A native confirm, deliberately. It is the one dialog that reliably blocks a
// navigation, it needs no state, and it cannot be missed. A prettier modal
// here would have to reimplement blocking and would be the fragile browser
// hack rather than the robust option.

export default function TargetLink({ href, label, isOrg, active }: {
  href: string
  label: string
  isOrg: boolean
  active: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      onClick={e => {
        if (active) return
        if (hasUnsavedContext() && !window.confirm(LEAVE_WARNING)) e.preventDefault()
      }}
      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-semibold transition min-h-11"
      style={active
        ? { borderColor: 'transparent', background: 'hsl(var(--accent))', color: '#fff' }
        : { borderColor: 'hsl(var(--border))', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}
    >
      {isOrg ? <Users className="w-4 h-4" aria-hidden="true" /> : <User className="w-4 h-4" aria-hidden="true" />}
      {label}
    </Link>
  )
}
