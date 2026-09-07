import type { Metadata } from 'next'
import QuoteAcceptView from '@/components/billing/QuoteAcceptView'

// The page a client lands on from the quote email.
//
// noindex, and deliberately: the URL is the whole of the security, and a search
// engine that crawls one and publishes it has handed somebody else's pricing to
// anybody who searches for it.
export const metadata: Metadata = {
  title: 'Your quotation',
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

export default async function QuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <QuoteAcceptView token={token} />
}
