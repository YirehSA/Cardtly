import type { Metadata } from 'next'

// The signup page is a client component ('use client') so it can't
// export metadata itself - this layout wrapper carries it instead.
export const metadata: Metadata = {
  title: 'Start Your Free 60-Day Digital Business Card Trial',
  description:
    'Have your digital business card live in 2 minutes, free for 60 days. Custom link, QR code, and contact-save built in. No credit card needed to start.',
  alternates: { canonical: '/signup' },
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children
}
