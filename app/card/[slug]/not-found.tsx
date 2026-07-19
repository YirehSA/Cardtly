import Link from 'next/link'
import { CreditCard, ArrowRight } from 'lucide-react'

// What someone sees after tapping an NFC card or scanning a QR code that no
// longer resolves. Before this it was the bare Next.js 404, which reads as
// "you did something wrong" or "this site is broken" - a bad last impression
// for the cardholder, who is usually standing right there.
//
// Reached from two places in page.tsx: a slug that never existed, and a card
// whose owner is past their trial or grace window. The copy has to be true for
// both, so it says the card is not available rather than guessing which.
//
// Rendered through notFound(), so this still returns a real 404 status. A
// friendlier page served as 200 would be a soft 404, and search engines treat
// those worse than the honest thing.
// No title here on purpose: generateMetadata in page.tsx resolves before
// notFound() is thrown and wins, so a title set here would never be used and
// would just read as a lie in the source. robots does apply, and matters -
// a dead card must not be indexed.
export const metadata = {
  robots: { index: false, follow: false },
}

export default function CardNotFound() {
  return (
    <main className="min-h-dvh grid place-items-center px-6 py-16 bg-background">
      <div className="w-full max-w-md text-center">
        <div
          className="w-14 h-14 rounded-2xl grid place-items-center mx-auto text-white"
          style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}
        >
          <CreditCard className="w-6 h-6" aria-hidden="true" />
        </div>

        <h1 className="mt-6 font-display text-2xl font-bold">This card isn&rsquo;t available</h1>

        <p className="mt-3 text-muted-foreground leading-relaxed">
          The link may have changed, or the card may no longer be active. If someone
          gave you this card, ask them for their current link.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}
          >
            Get your own digital card
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center min-h-[48px] px-6 rounded-xl text-sm font-semibold border border-border hover:bg-muted transition"
          >
            Sign in
          </Link>
        </div>

        {/* The owner arriving at their own dead card is the person most likely
            to be looking at this, and the one who can actually fix it. */}
        <p className="mt-8 text-xs text-muted-foreground">
          Is this your card? Sign in to check your subscription and bring it back
          online.
        </p>
      </div>
    </main>
  )
}
