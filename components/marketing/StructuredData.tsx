// The home page's SoftwareApplication node.
//
// Organization and WebSite used to live here too, which meant they appeared on
// the home page and nowhere else. They are emitted from the root layout now,
// so every page carries the entity; this file describes the product.

const APP = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Cardtly',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, Android',
  url: 'https://cardtly.com',
  description:
    'Create and share a digital business card with NFC tap, QR code, or link. Track views, update anytime, manage team cards.',
  // Explicit capability list so AI answers to "what can Cardtly do"
  // are grounded in the real feature set.
  featureList: [
    'Share by NFC tap, QR code, or link',
    '15 customisable card templates',
    'Analytics: views, clicks, and contact saves',
    'Lead capture and built-in contacts CRM',
    'Book-a-meeting button',
    'Custom questionnaire add-on (up to five questions)',
    'Reciprocal contact-exchange popup add-on',
    'Paper business card scanner (AI)',
    'WhatsApp follow-up and one-click Excel export',
    'Add to phone contacts and Google Wallet (auto-updating)',
    'Team cards with locked branding',
    "Share a teammate's card from your dashboard",
    'Email signature and virtual background generators',
  ],
  offers: [
    {
      '@type': 'Offer',
      name: 'Pro',
      price: '97',
      priceCurrency: 'ZAR',
      description: 'Every Cardtly feature on one card. Billed monthly, or R970 a year.',
    },
    {
      '@type': 'Offer',
      name: 'Teams',
      price: '97',
      priceCurrency: 'ZAR',
      description: 'R97 per seat per month, 2 to 20 seats, with locked company branding and one admin dashboard.',
    },
  ],
}

export default function StructuredData() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(APP) }}
      />
    </>
  )
}
