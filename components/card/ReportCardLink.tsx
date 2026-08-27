'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import ReportCardDialog from '@/components/network/ReportCardDialog'

// A quiet way to report the card you are looking at.
//
// Rendered once by the page rather than inside PublicCardView, which branches
// across a dozen templates - putting it in each of them would mean a template
// added later silently has no report link, which is exactly the gap this
// exists to close.
//
// Blocking is not offered here. Blocking hides somebody from YOUR Network, and
// a person opening a card from a QR code has probably never seen the Network
// and may not have an account at all. Reporting works either way.

export default function ReportCardLink({
  cardId, teamCardId, cardName,
}: {
  cardId?: string | null
  teamCardId?: string | null
  cardName?: string | null
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="w-full flex justify-center py-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70 transition"
        >
          <Flag className="w-3 h-3" />
          Report this card
        </button>
      </div>
      {open && (
        <ReportCardDialog
          cardId={cardId}
          teamCardId={teamCardId}
          cardName={cardName}
          canBlock={false}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
