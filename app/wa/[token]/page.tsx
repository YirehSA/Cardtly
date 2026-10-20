import type { Metadata } from 'next'
import WhatsAppBridge from '../WhatsAppBridge'
import { openWaTarget } from '@/lib/wa-bridge'

// The WhatsApp button in a lead or meeting-request email lands here. The token
// is the number and message, sealed by waBridgeLink in lib/wa-bridge, so the
// link survives email scanners that rewrite links. no-referrer keeps the token
// out of the request to wa.me.

export const metadata: Metadata = {
  title: 'Opening WhatsApp',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export const dynamic = 'force-dynamic'

export default async function SealedWhatsAppPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <WhatsAppBridge sealed={{ target: openWaTarget(token) }} />
}
