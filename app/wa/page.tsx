import type { Metadata } from 'next'
import WhatsAppBridge from './WhatsAppBridge'

// The WhatsApp button in a lead or meeting-request email lands here, and this
// page opens the WhatsApp app. See waBridgeLink in lib/whatsapp for why an
// email cannot link to the app directly.

export const metadata: Metadata = {
  title: 'Opening WhatsApp',
  robots: { index: false, follow: false },
}

export default function WhatsAppBridgePage() {
  return <WhatsAppBridge />
}
