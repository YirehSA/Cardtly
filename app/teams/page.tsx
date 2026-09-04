import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import { SEAT_PRICE_RAND, MAX_SELF_SERVE_SEATS } from '@/lib/org-billing'
import { ArrowRight, Check } from 'lucide-react'

// The page for "digital business cards for teams / companies / corporate".
//
// The site had nothing aimed at a buyer purchasing for other people. Every
// page spoke to one professional buying one card, so a search for the team
// version of the question had nothing on this domain to match, and an AI
// assistant asked "which digital business card is best for a company" had
// nothing here to quote.
//
// Written to be quotable as well as to rank. AI answers are assembled from
// passages, not pages: a self-contained block that answers one question in its
// first sentence gets cited, and a paragraph that only makes sense after the
// three above it does not. Hence the question headings, the short answer
// directly under each, the comparison table and the FAQ.

export const metadata: Metadata = {
  title: { absolute: 'Digital Business Cards for Teams & Companies | Cardtly' },
  description:
    'Cardtly gives every employee a branded digital business card the company controls. Group, company and department structure, locked brand fields, seat billing, bulk import and per-card analytics. Used worldwide, built in South Africa.',
  alternates: { canonical: '/teams' },
  keywords: [
    'digital business cards for teams',
    'digital business cards for companies',
    'corporate digital business cards',
    'enterprise digital business cards',
    'company digital business card',
    'team digital business card platform',
    'digital business cards for employees',
    'branded digital business cards',
  ],
  openGraph: {
    title: 'Digital Business Cards for Teams & Companies',
    description:
      'One branded card for every employee, controlled by the company. Group and department structure, locked brand fields, seat billing and analytics.',
    url: 'https://cardtly.com/teams',
    type: 'website',
  },
}

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'What is a digital business card for teams?',
    a: `A digital business card for teams is a web page for each employee, holding their name, role, contact details and links, that the company owns and controls centrally. An administrator creates the cards, applies the company logo and colours to all of them at once, and can lock the fields that must stay the same. Each person shares their card by NFC tap, QR code or link, and the recipient saves the details without installing anything. Because every card is a live page, a rebrand or an address change is made once by the administrator and takes effect on every card immediately, with nothing reprinted and no card left showing details that are out of date.`,
  },
  {
    q: 'How does a company keep every card on brand?',
    a: `The company sets its brand once, at organisation level, and every card inherits it: logo, colours, fonts, website, address and social links. Individual fields can then be locked so employees cannot change them. Cardtly locks in groups rather than single fields, so "socials" is one decision covering six links and "link buttons" covers ten, which means adding a field later cannot silently leave it unlocked on every card. Locks accumulate downward: a department head can tighten what their own team may edit but can never unlock something the company set. Anything left unlocked stays the employee's to change, so a company can standardise the logo and the switchboard number while letting people write their own bio.`,
  },
  {
    q: 'Can one account hold several companies?',
    a: `Yes. Cardtly supports three levels: a group at the top, companies beneath it, and departments inside those. A holding company with seven businesses under it runs all of them from one account, on one invoice and one seat pool, while each business keeps its own logo, colours, web address and manager. Each company chooses whether to wear the group's look or its own, and the group owner can lock that choice so a company cannot change it. Departments inside a company inherit from that company rather than from the group, so a business that has opted out stays consistent all the way down its own structure.`,
  },
  {
    q: 'What does it cost for a team?',
    a: `Cardtly is R${SEAT_PRICE_RAND} per card per month in South African rand, billed monthly or annually. Teams of 2 to ${MAX_SELF_SERVE_SEATS} cards are self-serve: an administrator buys seats and issues cards without talking to anyone. Above ${MAX_SELF_SERVE_SEATS} seats the arrangement is quoted, because that is where invoicing, purchase orders and rollout support usually matter more than a checkout page. Every card carries the full feature set. There is no cut-down tier where analytics or lead capture are held back, so the price does not change according to which features a team turns on. Physical NFC cards are separate and optional: R150 each for the standard design or R200 for one designed around your brand, once off, plus R100 shipping per order rather than per card, and those ship within South Africa only. The digital cards themselves have no such limit.`,
  },
  {
    q: 'How do employees get their cards?',
    a: `An administrator can create cards one at a time or import a spreadsheet of the whole company. Each person is invited by email and claims their card with one click, at which point it is already branded and filled in with whatever the administrator entered. Nobody has to design anything or learn the product to start using their card. Somebody who leaves can have their card archived, which takes it offline immediately without deleting the leads it captured, and the seat can be reissued to their replacement. Every card is live from the moment it is claimed, so a rollout does not need a training session or a launch date. Leads captured by an archived card stay in the company's shared contacts list and can still be exported.`,
  },
  {
    q: 'Does the recipient need an app?',
    a: `No. A Cardtly card opens as an ordinary web page in whatever browser the recipient already has, whether it arrives by NFC tap, QR scan or a link in a message. They can save the contact straight to their phone without downloading anything or creating an account. This matters more for teams than for individuals: a sales team hands its card to people who have no relationship with the company yet, and any step that asks a stranger to install something is a step most of them will not take. Cardtly does publish an Android app for the card's owner, which adds tap-to-share from the phone itself, but it is never required of anyone receiving a card. The details can also be added to Google Wallet, and that pass updates itself whenever the card changes.`,
  },
  {
    q: 'Can we see which employees are actually using their cards?',
    a: `Yes. Every card reports its own views, button taps, link clicks and saved contacts, and the team dashboard rolls those up so an administrator can see which cards are being shared and which have never been opened. A card with plenty of views and no captured leads is being handed out but not converting; a card with neither has not been shared at all. Both are visible without asking anyone, which is the practical difference between issuing cards and knowing whether they were adopted. Leads captured across the team land in one shared list with the source of each, exportable to Excel with the answers to any custom questions attached, and a Monday digest email summarises the previous seven days of views and new leads without anyone opening the dashboard.`,
  },
  {
    q: 'Where can Cardtly be used?',
    a: `Cardtly cards work anywhere with a browser, and are used internationally. The platform is built and billed in South Africa: subscriptions are charged in South African rand through Paystack, and physical NFC cards are printed and shipped within South Africa only. The digital cards themselves have no geographic limit, so a company with staff in several countries can run every card from one account, and only the optional physical NFC cards are restricted to South African delivery. Pricing is shown in rand with a live estimate in the visitor's own currency, so an international buyer can see what a seat costs them before signing up. There is an Android app for card owners; iOS is not released yet, and no app is ever required to receive a card.`,
  },
  {
    q: 'What happens to printed cards and QR codes if details change?',
    a: `Nothing has to be reprinted. Each card has a permanent address of its own, such as cardtly.com/card/name, and the page at that address is edited rather than replaced. A QR code printed on a banner, a signature block, or a physical NFC card keeps pointing at the same page, so a new phone number or a rebrand reaches everyone who has ever received the card. If a card's link is changed deliberately, the old link keeps redirecting, so anything already printed still works. The same applies to a whole company: an administrator changing the logo or the head office address updates every card at once, so a rebrand does not strand a single printed QR code or NFC card anywhere in the field.`,
  },
  {
    q: 'How is this different from everyone having their own digital card?',
    a: `A company where each person signed up individually has no shared brand, no way to fix a wrong logo across the group, no record of who has a card, and no ownership of the leads those cards capture. When somebody leaves, their card and their contacts leave with them. A team account inverts that: the company owns the cards and the data, applies the brand centrally, controls which fields staff may edit, and keeps the leads when a person moves on. It also changes what happens at scale. Fifteen people signing up individually produce fifteen slightly different cards, fifteen invoices and no way to audit any of it, where a team account produces one consistent set, one invoice, and a list of exactly who holds a card and whether they have ever shared it.`,
  },
]

const COMPARISON: Array<[string, string, string, string]> = [
  ['Brand consistency', 'Reprint everything', 'Each person decides', 'Set once, applied to every card'],
  ['Updating details', 'Reprint everything', 'Each person updates their own', 'Administrator updates centrally'],
  ['Who owns the leads', 'Nobody, they are on paper', 'The individual', 'The company'],
  ['Staff turnover', 'Cards are wasted', 'Card and contacts leave too', 'Card archived, seat reissued'],
  ['Knowing what is used', 'No idea', 'Only the individual sees it', 'Per-card and team-wide analytics'],
  ['Several businesses', 'Separate everything', 'Separate accounts', 'One account, one invoice'],
]

export default function TeamsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'Cardtly for Teams',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web, Android',
        url: 'https://cardtly.com/teams',
        description:
          'Digital business card platform for teams and companies. Central brand control, group and department structure, seat billing, bulk import and per-card analytics.',
        offers: {
          '@type': 'Offer',
          price: String(SEAT_PRICE_RAND),
          priceCurrency: 'ZAR',
          category: 'per seat per month',
          url: 'https://cardtly.com/pricing',
        },
        featureList: [
          'Central brand control across every employee card',
          'Group, company and department hierarchy',
          'Locked brand fields staff cannot edit',
          'Seat-based billing and seat reassignment',
          'Bulk import from a spreadsheet',
          'Per-card and team-wide analytics',
          'Lead capture with a shared company contacts list',
          'NFC tap, QR code and link sharing',
        ],
        publisher: { '@type': 'Organization', name: 'Cardtly', url: 'https://cardtly.com' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Cardtly', item: 'https://cardtly.com' },
          { '@type': 'ListItem', position: 2, name: 'For teams', item: 'https://cardtly.com/teams' },
        ],
      },
    ],
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Rendered on the server. AI crawlers do not run JavaScript, so anything
          that matters has to be in the HTML that arrives. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />

      <main className="max-w-4xl mx-auto px-5 sm:px-8 pt-28 pb-20">
        {/* The answer, in the first sentence, because that is the part that
            gets extracted. */}
        <header className="pb-10 border-b border-border">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Cardtly for teams
          </p>
          <h1 className="font-display text-[34px] sm:text-[52px] font-bold tracking-[-0.03em] leading-[1.05] mt-3">
            Digital business cards for teams and companies
          </h1>
          <p className="text-lg text-muted-foreground mt-5 leading-relaxed">
            Cardtly gives every employee a branded digital business card that the company owns and
            controls. An administrator sets the logo and colours once, locks the fields that must
            stay the same, and issues a card to each person. Staff share theirs by NFC tap, QR code
            or link, and the recipient saves the details without installing an app.
          </p>
          <div className="flex flex-wrap gap-3 mt-7">
            <Link href="/signup"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: 'hsl(var(--accent))' }}>
              Start a team <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/contact"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold border border-border">
              Talk to us about {MAX_SELF_SERVE_SEATS}+ seats
            </Link>
          </div>
        </header>

        <section className="pt-12">
          <h2 className="font-display text-[26px] sm:text-[32px] font-bold tracking-[-0.02em]">
            What a company gets that individuals do not
          </h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            A company where everyone signed up on their own has no shared brand, no way to correct a
            logo across the group, no record of who holds a card, and no claim on the leads those
            cards capture. A team account inverts each of those.
          </p>

          <div className="overflow-x-auto mt-7 rounded-xl border border-border">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left font-semibold p-3.5"></th>
                  <th className="text-left font-semibold p-3.5">Paper cards</th>
                  <th className="text-left font-semibold p-3.5">Individual digital cards</th>
                  <th className="text-left font-semibold p-3.5">Cardtly for teams</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(([label, paper, individual, cardtly]) => (
                  <tr key={label} className="border-b border-border last:border-0">
                    <td className="p-3.5 font-medium">{label}</td>
                    <td className="p-3.5 text-muted-foreground">{paper}</td>
                    <td className="p-3.5 text-muted-foreground">{individual}</td>
                    <td className="p-3.5">{cardtly}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="pt-14">
          <h2 className="font-display text-[26px] sm:text-[32px] font-bold tracking-[-0.02em]">
            One account can hold several companies
          </h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            Cardtly has three levels: a group at the top, companies beneath it, and departments
            inside those. A holding company with seven businesses runs all of them from one account,
            on one invoice and one seat pool, while each business keeps its own logo, colours, web
            address and manager.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              'Each company chooses whether to wear the group look or its own.',
              'The group owner can lock that choice so a company cannot change it.',
              'Departments inherit from their own company, not from the group above it.',
              'Every company gets its own slice of the URL, such as cardtly.com/card/company/person.',
              'A department head manages only their own people and can tighten rules, never loosen them.',
            ].map(line => (
              <li key={line} className="flex gap-3">
                <Check className="w-4 h-4 mt-1 shrink-0" style={{ color: 'hsl(var(--accent))' }} />
                <span className="text-muted-foreground leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="pt-14">
          <h2 className="font-display text-[26px] sm:text-[32px] font-bold tracking-[-0.02em]">
            What it costs
          </h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            R{SEAT_PRICE_RAND} per card per month, billed monthly or annually. Teams of 2 to{' '}
            {MAX_SELF_SERVE_SEATS} cards are self-serve. Above {MAX_SELF_SERVE_SEATS} seats the
            arrangement is quoted, because that is where invoicing, purchase orders and rollout
            support matter more than a checkout page. Every card carries the full feature set, so
            the price does not change according to which features a team turns on.
          </p>
          <Link href="/pricing"
            className="inline-flex items-center gap-2 mt-6 text-sm font-semibold"
            style={{ color: 'hsl(var(--accent))' }}>
            See full pricing <ArrowRight className="w-4 h-4" />
          </Link>
        </section>

        <section className="pt-14">
          <h2 className="font-display text-[26px] sm:text-[32px] font-bold tracking-[-0.02em]">
            Questions companies ask
          </h2>
          <div className="mt-7 divide-y divide-border border-y border-border">
            {FAQ.map(({ q, a }) => (
              <article key={q} className="py-6">
                <h3 className="font-semibold text-lg leading-snug">{q}</h3>
                <p className="text-muted-foreground mt-3 leading-relaxed">{a}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="pt-14">
          <div className="rounded-xl border border-border p-7 sm:p-9">
            <h2 className="font-display text-[24px] sm:text-[28px] font-bold tracking-[-0.02em]">
              Give your whole team a card this week
            </h2>
            <p className="text-muted-foreground mt-3 leading-relaxed max-w-2xl">
              Create the account, upload your logo, import your people from a spreadsheet, and send
              the invitations. Everyone claims their own card with one click, already branded.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <Link href="/signup"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: 'hsl(var(--accent))' }}>
                Start a team <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/contact"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold border border-border">
                Ask a question
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
