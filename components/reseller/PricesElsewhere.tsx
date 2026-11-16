import Link from 'next/link'
import { Handshake, Mail, Wifi, Zap } from 'lucide-react'
import type { PriceScope } from '@/lib/reseller'

// What a reseller's login, or anybody in a team a reseller sold, sees where
// Cardtly would otherwise show its own prices: the NFC order form and the Pro
// upgrade screen. A reseller sells at its own price (Andre, 2026-11-16), so
// these send the reseller to its Reseller page and the client to its reseller.
// No rand amounts in this file (scripts/check-resellers looks).

interface Props {
  scope: PriceScope
  topic: 'nfc' | 'upgrade'
  /** Upgrade only: whether this login is on Pro now. */
  isPro?: boolean
}

const button = 'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90'

function Contact({ name, email }: { name: string; email: string | null }) {
  if (!email) return null
  return (
    <a href={`mailto:${email}`} className={`mt-4 ${button}`} style={{ background: 'hsl(var(--accent))' }}>
      <Mail className="w-4 h-4" />Email {name}
    </a>
  )
}

function ResellerLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={`mt-4 ${button}`} style={{ background: 'hsl(var(--accent))' }}>
      <Handshake className="w-4 h-4" />{label}
    </Link>
  )
}

export default function PricesElsewhere({ scope, topic, isPro = true }: Props) {
  if (topic === 'nfc') {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Wifi className="w-5 h-5" />
          {scope.kind === 'reseller' ? 'Order NFC cards from your Reseller page' : `Order NFC cards through ${scope.name}`}
        </h2>
        {scope.kind === 'reseller' ? (
          <>
            <p className="text-sm text-muted-foreground mt-2">
              Blank cards, or cards printed for your client&apos;s people, at your reseller price. Cardtly invoices
              you and makes the cards once the invoice is paid. You set your own price with your client.
            </p>
            <ResellerLink href="/dashboard/reseller?tab=nfc" label="Order NFC cards" />
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mt-2">
              Your team&apos;s Cardtly plan comes through {scope.name}, so NFC cards do too. Ask them to order
              printed cards for your people.
            </p>
            <Contact name={scope.name} email={scope.email} />
          </>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="font-display text-2xl font-bold flex items-center gap-2">
        <Zap className="w-6 h-6" />Cardtly Pro
      </h1>
      <div className="bg-card border border-border rounded-lg p-6">
        {scope.kind === 'reseller' ? (
          <>
            <h2 className="font-semibold text-lg">Pro comes with your reseller account</h2>
            <p className="text-sm text-muted-foreground mt-2">
              {isPro
                ? 'Your own card is on Pro for as long as you are a Cardtly reseller.'
                : 'This login is not on Pro at the moment. Email hello@cardtly.com and we will sort it out.'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Cardtly&apos;s own prices are not shown in a reseller account, so you can show clients around and
              quote your own price.
            </p>
            <ResellerLink href="/dashboard/reseller" label="Open your Reseller page" />
          </>
        ) : (
          <>
            <h2 className="font-semibold text-lg">Your plan is managed by {scope.name}</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Your Cardtly plan comes through {scope.name}. Speak to them about your plan, your seats or NFC cards.
            </p>
            <Contact name={scope.name} email={scope.email} />
          </>
        )}
      </div>
    </div>
  )
}
