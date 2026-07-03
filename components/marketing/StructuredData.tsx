// Sitewide JSON-LD for the homepage: Organization + WebSite +
// SoftwareApplication. Tells Google what Cardtly IS (a SaaS product
// with a free tier, made by a South African company) rather than
// leaving it to infer from page text. Rendered server-side - plain
// script tags, zero client JS.

const ORG = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://cardtly.com/#organization',
  name: 'Cardtly',
  url: 'https://cardtly.com',
  logo: 'https://cardtly.com/cardtly-icon.png',
  description:
    'Cardtly is a digital business card platform built in South Africa. Create a free digital business card and share it by NFC tap, QR code, or link.',
  slogan: 'Your card. One tap away.',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'ZA',
  },
  areaServed: { '@type': 'Country', name: 'South Africa' },
  // Topics Cardtly is an authority on - helps AI engines map the
  // brand to the right subject for "best digital business card"
  // style questions.
  knowsAbout: [
    'Digital business cards',
    'NFC business cards',
    'QR code contact sharing',
    'Networking',
  ],
  sameAs: [
    'https://play.google.com/store/apps/details?id=com.cardtly.app',
  ],
}

const WEBSITE = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://cardtly.com/#website',
  url: 'https://cardtly.com',
  name: 'Cardtly',
  publisher: { '@id': 'https://cardtly.com/#organization' },
}

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
    '12 customisable card templates',
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
      name: 'Free',
      price: '0',
      priceCurrency: 'ZAR',
      description: 'Free digital business card with QR code and link sharing.',
    },
    {
      '@type': 'Offer',
      name: 'Pro',
      price: '65',
      priceCurrency: 'ZAR',
      description: 'Premium templates, advanced analytics, and Pro features. Billed monthly.',
    },
  ],
}

export default function StructuredData() {
  return (
    <>
      {[ORG, WEBSITE, APP].map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  )
}
