// Structured data helpers for the marketing pages.
//
// Search engines and AI assistants read different things off a page. Google
// uses schema to build rich results; an assistant uses it to work out what the
// page IS before deciding whether to quote it. Both want the same JSON-LD, and
// writing it by hand per page is how one page ends up with a trailing comma
// and no schema at all.
//
// Everything here returns a plain object for JSON.stringify into a
// <script type="application/ld+json"> rendered on the server. AI crawlers do
// not run JavaScript, so schema injected on the client is schema nobody sees.

const SITE = 'https://cardtly.com'
const ORG_ID = `${SITE}/#organization`

export interface Faq { q: string; a: string }

/** Who Cardtly is. One entity, emitted once per page from the root layout.
 *
 *  This lived in components/marketing/StructuredData and therefore only ever
 *  appeared on the home page, so every other page asked an assistant to work
 *  out the brand from the prose. sameAs is the load-bearing part: it is what
 *  confirms this domain, the Play Store listing and those profiles are one
 *  company. Only add a profile that is real and active - a dead or
 *  mis-attributed sameAs weakens the entity graph rather than helping it. */
export function organization() {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'Cardtly',
    url: SITE,
    logo: `${SITE}/cardtly-icon.png`,
    description:
      'Cardtly is a digital business card platform for individuals, teams and companies. Cards are shared by NFC tap, QR code or link, and a company can brand and control every employee card centrally.',
    slogan: 'Your card. One tap away.',
    address: { '@type': 'PostalAddress', addressCountry: 'ZA' },
    // Built in South Africa, used anywhere. Saying South Africa alone told
    // every assistant this was a local-only product.
    areaServed: 'Worldwide',
    foundingLocation: { '@type': 'Place', name: 'South Africa' },
    knowsAbout: [
      'Digital business cards',
      'Digital business cards for teams and companies',
      'NFC business cards',
      'QR code contact sharing',
      'Networking',
    ],
    sameAs: [
      'https://play.google.com/store/apps/details?id=com.cardtly.app',
      'https://www.linkedin.com/company/cardtly',
      'https://www.instagram.com/cardtlydigital/',
      'https://www.facebook.com/cardtly',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: 'hello@cardtly.com',
      url: `${SITE}/contact`,
      availableLanguage: ['en'],
    },
  }
}

export function webSite() {
  return {
    '@type': 'WebSite',
    '@id': `${SITE}/#website`,
    url: SITE,
    name: 'Cardtly',
    publisher: { '@id': ORG_ID },
  }
}

/** Questions and answers. Only ever emit this for text that is VISIBLE on the
 *  page: schema describing content a reader cannot find is the thing Google
 *  issues manual actions for. */
export function faqPage(faqs: Faq[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }
}

/** Where this page sits. Give it the trail after the home page; home is added
 *  here so every trail starts the same way. */
export function breadcrumb(trail: Array<{ name: string; path: string }>) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Cardtly', path: '/' }, ...trail].map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE}${item.path === '/' ? '' : item.path}`,
    })),
  }
}

/** The product itself. `page` is the path this instance is described on, so
 *  each page's copy points at itself rather than all claiming the home page. */
export function softwareApplication(opts: {
  name: string
  path: string
  description: string
  featureList?: string[]
  price?: number
  priceCurrency?: string
  priceNote?: string
}) {
  return {
    '@type': 'SoftwareApplication',
    name: opts.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, Android',
    url: `${SITE}${opts.path}`,
    description: opts.description,
    ...(opts.featureList ? { featureList: opts.featureList } : {}),
    ...(opts.price != null
      ? {
          offers: {
            '@type': 'Offer',
            price: String(opts.price),
            priceCurrency: opts.priceCurrency || 'ZAR',
            ...(opts.priceNote ? { category: opts.priceNote } : {}),
            url: `${SITE}/pricing`,
          },
        }
      : {}),
    publisher: { '@id': ORG_ID },
  }
}

/** A sequence of steps. Used on How it works, which is literally a how-to and
 *  is the shape an assistant answering "how do I make a digital business card"
 *  is looking for. */
export function howTo(opts: {
  name: string
  description: string
  totalTime?: string
  steps: Array<{ name: string; text: string }>
}) {
  return {
    '@type': 'HowTo',
    name: opts.name,
    description: opts.description,
    ...(opts.totalTime ? { totalTime: opts.totalTime } : {}),
    step: opts.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  }
}

/** Wraps a set of nodes into the one graph a page emits. */
export function graph(...nodes: object[]) {
  return { '@context': 'https://schema.org', '@graph': nodes }
}
