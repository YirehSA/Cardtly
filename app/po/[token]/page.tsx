import type { Metadata } from 'next'
import PurchaseOrderSignView from '@/components/billing/PurchaseOrderSignView'

// Where a client's department manager approves a purchase order Cardtly drafted.
//
// noindex, like the quote page: the URL is the whole of the security, and a
// crawled one would publish somebody else's order to anybody who searches.
export const metadata: Metadata = {
  title: 'Purchase order for approval',
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

export default async function PurchaseOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <PurchaseOrderSignView token={token} />
}
