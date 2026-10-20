import type { Metadata } from 'next'
import WhatsAppBridge from './WhatsAppBridge'

// The WhatsApp button in emails sent before the number was sealed into the
// path lands here, with the number after the #. Today's emails go to
// /wa/<token> instead. See lib/wa-bridge.

export const metadata: Metadata = {
  title: 'Opening WhatsApp',
  robots: { index: false, follow: false },
}

export default function WhatsAppBridgePage() {
  return <WhatsAppBridge />
}
