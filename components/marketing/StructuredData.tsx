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
  logo: 'https://cardtly.com/cardtly-logo.png',
  description:
    'Cardtly is a digital business card platform built in South Africa. Create a free digital business card and share it by NFC tap, QR code, or link.',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'ZA',
  },
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
