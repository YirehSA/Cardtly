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
    default: 'Cardtly — Digital Business Cards',
    template: '%s | Cardtly',
  },
  description: 'Create and share your digital business card. Custom URLs, QR codes, and easy sharing.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com'),
  openGraph: { type: 'website', siteName: 'Cardtly' },
  twitter: { card: 'summary_large_image' },
  // Browser tab icon + iOS "Add to Home Screen" icon. The PNG lives
  // in /public/favicon.png (the Cardtly C logo on transparent bg).
  // Next.js serves /public files at the root, so /favicon.png is
  // the correct URL for both.
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
    ],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
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
