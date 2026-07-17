import { ChevronDown } from 'lucide-react'

// Homepage FAQ. Each question targets a real long-tail search query
// ("what is a digital business card", "digital business card cost
// south africa", etc). The same array feeds both the visible
// accordion and the FAQPage JSON-LD so they can never drift apart -
// Google penalizes schema that doesn't match on-page content.
//
// Plain <details>/<summary> so it ships zero JS and the answers are
// in the HTML for crawlers (display:none content inside details is
// still indexed; Google confirmed this pattern for accordions).

const gradText: React.CSSProperties = {
  background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'What is a digital business card?',
    a: 'A digital business card is an online profile that replaces paper cards. It holds your name, role, company, contact details, links, and photo on a single page with its own link. With Cardtly you share it by NFC tap, QR code, or URL, and the person you meet can save your details straight to their phone contacts - no app required on their side.',
  },
  {
    q: 'How do I share a digital business card?',
    a: 'Three ways: tap your Cardtly NFC card against any modern smartphone, let someone scan your QR code, or send your card link through WhatsApp, email, or SMS. You can also add your card to Google Wallet so it is always one swipe away.',
  },
  {
    q: 'How much does a digital business card cost in South Africa?',
    a: 'Cardtly is R97 per card per month, or R970 a year, and that includes every feature. Teams are the same R97 a seat, from 2 to 20 seats, with locked company branding and one admin dashboard. Above 20 seats we bill Enterprise by debit order. A physical NFC card is a once-off R150 plus R100 shipping anywhere in South Africa.',
  },
  {
    q: 'Do I need an NFC card to use Cardtly?',
    a: 'No. Your QR code and card link work on the free plan with nothing physical at all. The NFC card is an optional extra for people who love the tap-to-share moment in meetings and at networking events.',
  },
  {
    q: 'Can I update my card after I have shared it?',
    a: 'Yes - that is the point. Your card is a live page, so when you change roles, numbers, or companies, everyone who has your link or scanned your QR code automatically sees the latest version. No reprinting, no out-of-date cards in circulation.',
  },
  {
    q: 'Can my whole team use digital business cards?',
    a: 'Yes. Cardtly Teams gives every team member a branded card with locked company branding, while each person manages their own details. Admins control the brand, templates, and seats from one dashboard - ideal for sales teams, agencies, and franchises.',
  },
  {
    q: 'Can I customise the design of my digital business card?',
    a: 'Completely. Choose from 12 templates, then make it yours: accent colours (including any custom hex), light or dark mode, five font styles, logo position and size, custom background colours, button colours, and the size and colour of every text element. Add photo galleries, custom links, social profiles, and certifications.',
  },
  {
    q: 'What happens when someone taps my NFC card?',
    a: 'Your card opens instantly in their phone browser - no app to install. They see your details, photo, and links, and can save you to their contacts with one tap. You see the view in your analytics.',
  },
  {
    q: 'Can people book a meeting from my digital business card?',
    a: 'Yes. Your card has a built-in "Book a meeting" button - visitors pick a date and time, you get the request by email and can confirm with a single reply. No Calendly or extra tools needed, and the requester is automatically saved to your contacts.',
  },
  {
    q: 'Does Cardtly capture leads from my card?',
    a: 'Yes. Visitors can share their name, email, and phone number through your card, and every lead lands in your Cardtly contacts dashboard - a lightweight CRM that builds itself as you network. Meeting requests are captured there too.',
  },
  {
    q: 'Can I scan other people’s paper business cards?',
    a: 'Yes. With Cardtly Pro you can photograph someone’s paper business card and our AI reads the details - name, title, company, email, phone, website, address - into a contact you can edit, save to your Cardtly contacts, and add straight to your phone. A fast way to digitise the stack of cards you collect at events.',
  },
]

export default function FaqSection() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  return (
    <section className="py-24 px-6" id="faq" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#7c3aed' }}>
            Questions, answered
          </p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight">
            Digital business cards, <span style={gradText}>explained.</span>
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map(({ q, a }) => (
            <details
              key={q}
              className="group rounded-2xl border overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <summary
                className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none text-left text-base font-semibold text-white transition hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden"
              >
                {q}
                <ChevronDown
                  className="w-4 h-4 flex-shrink-0 transition-transform group-open:rotate-180"
                  style={{ color: '#00d4ff' }}
                />
              </summary>
              <p className="px-6 pb-6 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
