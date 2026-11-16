import Link from 'next/link'
import { Handshake, Users } from 'lucide-react'

// Team Cards for a reseller's own login (Andre, 2026-11-16: "the reseller can
// sell the cards at whatever they want").
//
// Everybody else without a team sees Cardtly's price list and a Paystack
// checkout here. A reseller does not buy a team: it makes its clients' teams
// on the Reseller page, at a price it agrees with each client. And it shows
// this dashboard to those clients over a shared screen, so the page says how a
// team works and names no price at all. Keep it that way: no rand amounts in
// this file (scripts/check-resellers looks).

const STEPS = [
  {
    t: 'You add the client',
    d: 'From your Reseller page: their company name, the email of the person who will run their team, and how many cards. The team is live straight away, and their admin gets an email to choose a password.',
  },
  {
    t: 'Their admin builds the cards',
    d: 'Each person is created from the Team Cards dashboard: name, title, email, phone. The team look is set once and every card wears it, so everybody matches.',
  },
  {
    t: 'Each card is live the moment it is saved',
    d: 'It gets its own cardtly.com address and QR code straight away. Nobody has to accept an invite first.',
  },
  {
    t: 'Cards are handed over when ready (optional)',
    d: 'Their admin can invite somebody by email to edit their own card. With the brand locked, the look stays exactly as it was set.',
  },
]

export default function ResellerTeamCards() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6" />Team Cards
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Give your clients&apos; teams a professional digital business card.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="font-semibold text-lg">You set up your clients&apos; teams from your Reseller page</h2>
        <p className="text-sm text-muted-foreground mt-2">
          You agree the price with each client. Cardtly bills you for the seats, on your own invoice.
        </p>
        <Link href="/dashboard/reseller"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
          style={{ background: 'hsl(var(--accent))' }}>
          <Handshake className="w-4 h-4" />Open your Reseller page
        </Link>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="font-semibold text-lg">How a team works for your client</h2>
        <ol className="mt-4 space-y-4">
          {STEPS.map(({ t, d }, i) => (
            <li key={t} className="flex items-start gap-3">
              <span
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: 'hsl(var(--accent))' }}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{t}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{d}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground mt-5 pt-4 border-t border-border">
          Cardtly&apos;s own prices are not shown in a reseller account, so you can share this screen with a client
          and quote your own price. Your Reseller page does show what Cardtly charges you, so keep that one to yourself.
        </p>
      </div>
    </div>
  )
}
