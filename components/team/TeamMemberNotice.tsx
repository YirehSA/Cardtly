import Link from 'next/link'
import { Building2, Layers, CreditCard, ArrowRight } from 'lucide-react'

// What Team Cards shows to somebody who is already in a team but does not
// administer it - a department head, or an ordinary member.
//
// They used to get the "set up your team" checkout, because the page only
// looked for an organisation they administer and found none. That offered to
// sell a second organisation to somebody already in one; a department head
// who paid would have created a duplicate org and a real monthly charge.
export default function TeamMemberNotice({
  orgName,
  departments,
  hasCard,
}: {
  orgName: string
  departments: string[]
  hasCard: boolean
}) {
  const isHead = departments.length > 0

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="rounded-xl border border-border overflow-hidden">
        <div
          className="p-6 sm:p-8"
          style={{ background: 'hsl(var(--card))' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-lg grid place-items-center text-white shrink-0"
              style={{ background: 'hsl(var(--accent))' }}
            >
              <Building2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold leading-tight">{orgName}</h1>
              <p className="text-muted-foreground text-sm">
                {isHead
                  ? `You manage ${departments.length === 1 ? 'a department' : 'departments'} here. Your seat is covered by the company.`
                  : 'You are part of this team. Your seat is covered by the company.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground leading-relaxed">
          This page is for the person who owns the team account and pays for the
          seats. You do not need to set up or pay for anything.
          {isHead && ' Everything you manage is under Departments, including editing your people’s cards.'}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {isHead && (
            <Link
              href="/dashboard/departments"
              className="group rounded-lg border border-border p-5 hover:border-foreground/20 transition"
            >
              <span className="w-10 h-10 rounded-xl grid place-items-center bg-muted">
                <Layers className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
              </span>
              <p className="mt-3 font-semibold text-sm">
                {departments.length === 1 ? departments[0] : `${departments.length} departments`}
              </p>
              {/* "Edit their cards" is spelled out because it is the thing heads
                  come to this page looking for. They could always do it - the
                  editor and the save API have both allowed heads throughout -
                  but nothing here said so, so the page read as a dead end. */}
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Add people, edit their cards, set the look, and see their numbers.
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold">
                Go to Departments
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          )}

          <Link
            href="/dashboard/card"
            className="group rounded-lg border border-border p-5 hover:border-foreground/20 transition"
          >
            <span className="w-10 h-10 rounded-xl grid place-items-center bg-muted">
              <CreditCard className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
            </span>
            <p className="mt-3 font-semibold text-sm">
              {hasCard ? 'Your card' : 'You do not have a team card yet'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {hasCard
                ? 'Edit your details, design and links.'
                : isHead
                  ? 'Create one for yourself from Departments, in the department you manage.'
                  : 'Ask whoever runs the team account to invite you.'}
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold">
              {hasCard ? 'Edit my card' : 'Open my card'}
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
