import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Instrument_Sans } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import CapacitorBackButton from '@/components/CapacitorBackButton'
import CapacitorDeepLinks from '@/components/CapacitorDeepLinks'
import CapacitorSessionRefresh from '@/components/CapacitorSessionRefresh'
import ReferralCapture from '@/components/ReferralCapture'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

// Headings. This was Syne, a geometric display face that reads creative
// agency: wide counters, a quirky lowercase g, and enough personality that at
// the 900 weight the dashboard used it at, it looked like a consumer app.
// Cardtly sells to corporates, and the heading font is the loudest single
// signal of who a product is for. Instrument Sans is a neutral grotesque with
// tight apertures that holds authority at 600 and 700 without shouting.
const display = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    // Lead with the exact target phrase "Digital Business Cards", then the
    // buyer we actually want, then the brand.
    //
    // This used to read "Digital Business Cards South Africa", which competed
    // for a geography rather than for the product and left nothing on the site
    // matching a search for the team or company version of the question. South
    // Africa still appears in the description, where it earns the local result
    // without capping the rest.
    default: 'Digital Business Cards for Teams & Companies | Cardtly',
    template: '%s | Cardtly',
  },
  description:
    'Give every employee a branded digital business card the company controls. Share by NFC tap, QR code or link, with no app for the recipient. Central brand control, group and department structure, seat billing and per-card analytics. Used worldwide, built in South Africa.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com'),
  keywords: [
    'digital business card',
    'digital business cards for teams',
    'digital business cards for companies',
    'corporate digital business cards',
    'enterprise digital business cards',
    'digital business cards for employees',
    'digital business card south africa',
    'nfc business card',
    'smart business card',
    'electronic business card',
    'qr code business card',
    'virtual business card',
    'digital visiting card',
  ],
  // NOTE: no alternates.canonical here - the root layout's metadata
  // is inherited by every page, so a canonical set here would point
  // ALL pages at the homepage and deindex them. Set canonicals
  // per-page where needed instead.
  openGraph: {
    type: 'website',
    siteName: 'Cardtly',
    locale: 'en_ZA',
    title: 'Digital Business Cards for Teams & Companies - Cardtly',
    description:
      'One branded card for every employee, controlled by the company. NFC tap, QR code or link, and no app for the person receiving it.',
  },
  twitter: { card: 'summary_large_image' },
  // Browser tab icon + iOS "Add to Home Screen" icon. The PNG lives
  // in /public/favicon.png (the circular Cardtly badge - same brand
  // mark as the Android app icon). ?v=2 busts the old C-only favicon
  // out of browser caches. Next.js serves /public files at the root.
  icons: {
    icon: [
      { url: '/favicon.png?v=2', type: 'image/png' },
    ],
    shortcut: '/favicon.png?v=2',
    apple: '/favicon.png?v=2',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${display.variable} dark`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground">
        {/* Who this company is, on every page. An AI assistant asked to
            recommend a product has to resolve the brand to an entity before it
            can cite it, and sameAs is the link between this domain and the
            places it is talked about. Rendered server-side, since AI crawlers
            do not run JavaScript. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'Organization',
                '@id': 'https://cardtly.com/#organization',
                name: 'Cardtly',
                url: 'https://cardtly.com',
                logo: 'https://cardtly.com/cardtly-logo.png',
                description:
                  'Cardtly is a digital business card platform for individuals, teams and companies. Cards are shared by NFC tap, QR code or link, and a company can brand and control every employee card centrally.',
                foundingLocation: { '@type': 'Place', name: 'South Africa' },
                areaServed: 'Worldwide',
                sameAs: [
                  'https://play.google.com/store/apps/details?id=com.cardtly.app',
                  'https://www.linkedin.com/company/cardtly',
                ],
                contactPoint: {
                  '@type': 'ContactPoint',
                  contactType: 'sales',
                  email: 'hello@cardtly.com',
                  url: 'https://cardtly.com/contact',
                  availableLanguage: ['en'],
                },
              },
              {
                '@type': 'WebSite',
                '@id': 'https://cardtly.com/#website',
                url: 'https://cardtly.com',
                name: 'Cardtly',
                publisher: { '@id': 'https://cardtly.com/#organization' },
              },
            ],
          }) }}
        />
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          expand
          duration={3500}
          toastOptions={{
            style: {
              borderRadius: '12px',
              border: '1px solid hsl(var(--border))',
              boxShadow: '0 10px 30px -10px rgba(0,0,0,0.3)',
            },
          }}
        />
        <CapacitorBackButton />
        <ReferralCapture />
        <CapacitorDeepLinks />
        <CapacitorSessionRefresh />
      </body>
    </html>
  )
}
