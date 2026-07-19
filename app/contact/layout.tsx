import type { Metadata } from 'next'

// The contact page is a client component ('use client') so it can't
// export metadata itself - this layout wrapper carries it instead.
export const metadata: Metadata = {
  // "Contact Us | Cardtly" was 20 characters, most of a result slot unused.
  title: { absolute: 'Contact Cardtly | Digital Business Cards South Africa' },
  description:
    'Questions about digital business cards, NFC cards, or team plans? Get in touch with the Cardtly team - we are based in South Africa and reply fast.',
  alternates: { canonical: '/contact' },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
