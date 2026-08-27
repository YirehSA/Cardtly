'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Users, Search, Layers, X } from 'lucide-react'
import HeadTeamCard, { type HeadCard } from '@/components/team/HeadTeamCard'

// A department head's view of their own people.
//
// Deliberately NOT the owner's Team Cards screen with parts hidden. That page
// carries seats, billing, org identity, delete and revoke, and hiding those one
// by one is the kind of guard that survives until somebody adds a button and
// forgets the flag. A head's page holds only what a head may see, so nothing
// owner-only can leak into it by omission.
//
// Actions live under Departments, which already scopes every write through
// canManageDepartment. This is the list; that is the console.

type Card = HeadCard

export default function HeadTeamView({
  orgName, departmentNames, cards, forms = [],
}: {
  orgName: string
  departmentNames: string[]
  cards: Card[]
  /** The org's lead-capture form library, for the per-card picker. */
  forms?: { id: string; title?: string }[]
}) {
  const [q, setQ] = useState('')

  // Word-AND, the same rule as the owner's search: "andrew restorations"
  // finds the person whose name and company are each half of it.
  const visible = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length === 0) return cards
    return cards.filter(c => {
      const hay = [c.name, c.title, c.email, c.phone, c.slug, c.inviteEmail, c.departmentName]
        .filter(Boolean).join(' ').toLowerCase()
      return terms.every(t => hay.includes(t))
    })
  }, [q, cards])

  const claimed = cards.filter(c => c.claimed).length
  const totalViews = cards.reduce((n, c) => n + c.views, 0)
  const totalLeads = cards.reduce((n, c) => n + c.leads, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
          <Users className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold leading-tight">My Team</h1>
          <p className="text-sm text-muted-foreground">
            {departmentNames.length === 1
              ? departmentNames[0]
              : `${departmentNames.length} departments`}
            {orgName ? ` at ${orgName}` : ''}
          </p>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <Users className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <p className="font-semibold">Nobody here yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add people to your department and their cards appear here.
          </p>
          <Link href="/dashboard/departments"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition">
            <Layers className="w-4 h-4" />Go to Departments
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'People', value: cards.length, tone: undefined },
              { label: 'Using their card', value: claimed, tone: '#22c55e' },
              { label: 'Leads captured', value: totalLeads, tone: totalLeads > 0 ? '#22c55e' : undefined },
            ].map(({ label, value, tone }) => (
              <div key={label} className="rounded-2xl bg-card border border-border p-3">
                <p className="text-xl font-black leading-none tabular-nums" style={{ color: tone }}>{value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>

          {cards.length > 1 && (
            <div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Search by name, job title, email or department..."
                  aria-label="Search my team"
                  className="w-full px-4 py-2.5 pl-10 pr-10 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
                />
                {q && (
                  <button onClick={() => setQ('')} aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {q && (
                <p className="text-xs text-muted-foreground mt-2">
                  {visible.length === 0
                    ? <>Nothing matches &ldquo;{q}&rdquo;.</>
                    : <><strong className="text-foreground">{visible.length}</strong> of {cards.length} people</>}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map(c => (
              <HeadTeamCard key={c.id} card={c} forms={forms} onChanged={() => window.location.reload()} />
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            To invite someone, resend an invite or change a card, go to{' '}
            <Link href="/dashboard/departments" className="underline hover:text-foreground">Departments</Link>.
          </p>
        </>
      )}
    </div>
  )
}
