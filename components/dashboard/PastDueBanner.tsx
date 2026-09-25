import { CreditCard } from 'lucide-react'

// Shown on every dashboard page while a payment has failed but the grace
// window is still open.
//
// Before this a failed payment was invisible inside the product: the public
// card kept working, then stopped, and nothing anywhere said why. Its own
// component rather than inline markup so it can be rendered and checked
// without putting a real account into past_due to look at it.
//
// The button used to link to /upgrade, a route with no page, so "Fix payment"
// was a 404 (found 2026-09-25). It now goes to /dashboard/upgrade, which knows
// about a failed payment: paying there starts the subscription again, and the
// Paystack webhook cancels the failing one so nobody is charged twice.
//
// NOT IN THE iOS APP as a button. A way to pay outside the app is a Guideline
// 3.1.1 call to action, so in the app the banner states the fact and stops.
export default function PastDueBanner({ graceDaysLeft, iosApp = false }: { graceDaysLeft?: number; iosApp?: boolean }) {
  const remaining =
    typeof graceDaysLeft === 'number'
      ? ` for another ${graceDaysLeft} ${graceDaysLeft === 1 ? 'day' : 'days'}`
      : ' for now'

  return (
    <div
      className="mb-5 rounded-lg border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3"
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
          {iosApp
            ? `Your card is still live${remaining}.`
            : `Your card is still live${remaining}. Pay now to keep it online.`}
        </p>
      </div>
      {!iosApp && (
        <a
          href="/dashboard/upgrade"
          className="shrink-0 inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: 'hsl(var(--accent))' }}
        >
          Fix payment
        </a>
      )}
    </div>
  )
}
