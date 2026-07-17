import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Syne } from 'next/font/google'
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

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    // Lead with the exact target phrase "Digital Business Cards"
    // (plural, position 1 = most weight), then the South Africa geo
    // wedge we can actually win near-term, then the brand.
    default: 'Digital Business Cards South Africa - NFC & QR Cards | Cardtly',
    template: '%s | Cardtly',
  },
  description:
    'Create your digital business card in minutes, free for 60 days. Share with an NFC tap, QR code, or link. Track views, update anytime, add to Google Wallet. Built for South African professionals and teams - ZAR pricing, local NFC card delivery.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com'),
  keywords: [
    'digital business card',
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
    title: 'Digital Business Cards South Africa - Cardtly',
    description:
      'Create your free digital business card in minutes. Share with an NFC tap, QR code, or link. ZAR pricing, built for South Africa.',
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
    <html lang="en" className={`${jakarta.variable} ${syne.variable} dark`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground">
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
