'use client'

import QuotesTab from '@/components/admin/billing/QuotesTab'

// A rep's quotes, in the dashboard rather than the admin console.
//
// Wrapped rather than duplicated: one Quotes screen means a fix to the editor
// or the accept link reaches reps and staff at the same time. What a rep can
// actually see is decided by the API, not by this component.

export default function RepQuotes({ repName, isAdmin }: { repName: string | null; isAdmin: boolean }) {
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="page-title">Quotes</h1>
        <p className="page-subtitle">
          {isAdmin
            ? 'Every quote on the system.'
            : `Quotes you have raised${repName ? `, ${repName}` : ''}. Issue one, then send it with your proposal - the client accepts it on the link.`}
        </p>
      </div>
      <QuotesTab />
    </div>
  )
}
