import type { Metadata } from 'next'

// The signup page is a client component ('use client') so it can't
// export metadata itself - this layout wrapper carries it instead.
export const metadata: Metadata = {
  title: 'Sign Up - Create Your Digital Business Card',
  description:
    'Have your digital business card live in 2 minutes. Custom link, QR code, and contact-save built in. No credit card needed to start.',
  alternates: { canonical: '/signup' },
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children
}
