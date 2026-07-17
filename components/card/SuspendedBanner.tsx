'use client'

import { AlertCircle } from 'lucide-react'

interface Props {
  message?: string | null
}

// The notice on a suspended team's cards.
//
// Wording is the whole design here. The person who sees a team card is the
// rep's CUSTOMER, not the finance person who owes us money. So this must not
// shame the individual holding it, and must not make Cardtly look petty to a
// third party with no part in the dispute. "SUSPENDED - UNPAID" would do both.
//
// It says the account needs attention and stops there. Enough that the
// cardholder gets asked about it and goes to their finance team, which is the
// lever that actually collects; not so much that it damages them in front of
// someone whose opinion they need.
//
// Deliberately not dismissible, and deliberately at the top: a notice you can
// close is a notice nobody acts on.
export default function SuspendedBanner({ message }: Props) {
  return (
    <div
      role="status"
      className="w-full px-4 py-2.5 flex items-center justify-center gap-2 text-center"
      style={{
        background: 'rgba(245,158,11,0.12)',
        borderBottom: '1px solid rgba(245,158,11,0.35)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
      <p className="text-xs font-medium" style={{ color: '#f59e0b' }}>
        {message?.trim() || 'This account needs attention. Please contact your administrator.'}
      </p>
    </div>
  )
}
