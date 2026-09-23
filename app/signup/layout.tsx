import type { Metadata } from 'next'

// THE SIGNUP METADATA LIVES HERE AND ONLY HERE.
//
// This comment used to say the page was a client component and so could not
// export metadata. That stopped being true when page.tsx became a server
// component wrapping SignupForm (for the App Review 3.1.1 price gating), and
// the page then grew its own `{ title: 'Sign up' }` - which overrode this one,
// because Next merges page metadata over layout metadata key by key. The good
// title below was being thrown away. Keep page.tsx free of a metadata export.
export const metadata: Metadata = {
  title: 'Sign Up - Create Your Digital Business Card',
  description:
    'Have your digital business card live in 2 minutes. Custom link, QR code, and contact-save built in. No credit card needed to start.',
  alternates: { canonical: '/signup' },
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children
}
