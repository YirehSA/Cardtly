import { CreditCard } from 'lucide-react'

// Shown on every dashboard page while a payment has failed but the grace
// window is still open.
//
// Before this a failed payment was invisible inside the product: the public
// card kept working, then stopped, and nothing anywhere said why. Its own
// component rather than inline markup so it can be rendered and checked
// without putting a real account into past_due to look at it.
export default function PastDueBanner({ graceDaysLeft }: { graceDaysLeft?: number }) {
  const remaining =
    typeof graceDaysLeft === 'number'
      ? ` for another ${graceDaysLeft} ${graceDaysLeft === 1 ? 'day' : 'days'}`
      : ' for now'

  return (
    <div
      className="mb-5 rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3"
      style={{ borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.10)' }}
    >
      <span
        className="w-10 h-10 rounded-xl grid place-items-center shrink-0"
        style={{ background: 'rgba(245,158,11,0.18)' }}
      >
        <CreditCard className="w-5 h-5" style={{ color: '#f59e0b' }} aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Your last payment did not go through</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Your card is still live{remaining}. Update your payment details to keep it online.
        </p>
      </div>
      <a
        href="/upgrade"
        className="shrink-0 inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}
      >
        Fix payment
      </a>
    </div>
  )
}
