import type { Metadata } from 'next'

// The login page is a client component ('use client') so it can't
// export metadata itself - this layout wrapper carries it instead.
export const metadata: Metadata = {
  title: 'Log In',
  description: 'Log in to your Cardtly account to manage and share your digital business card.',
  alternates: { canonical: '/login' },
  // A login page has no business ranking - keep it out of the index so
  // crawl budget goes to pages that can (still followable for link equity).
  robots: { index: false, follow: true },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
