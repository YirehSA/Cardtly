import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import Reveal from '@/components/marketing/Reveal'
import { SEAT_PRICE_RAND, MAX_SELF_SERVE_SEATS } from '@/lib/org-billing'
import {
  ArrowRight, Check, Building2, Lock, UserPlus, BarChart2, FileUp,
  Layers, Wifi, Mail, MousePointerClick,
} from 'lucide-react'

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
//
// PRESENTATION REBUILT 2026-09-14, CONTENT NOT TOUCHED. It was a single
// column of prose at max-w-4xl while every sibling marketing page used the
// gradient, icon tiles, mockups and scroll reveals, so it read as a document
// that had wandered onto a different website. Every word below, the whole FAQ
// and all of the JSON-LD are byte for byte what they were: the quotable
// passages are the entire point of the page and shortening them to make room
// for decoration would trade the thing that works for the thing that looks
// nice. What changed is that the two ideas hardest to carry in prose, the
// three-level hierarchy and the three-way comparison, are now drawn instead of
// described, and the ten FAQ answers are numbered cards rather than one
// unbroken wall.

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

// The site's gradient, same declaration as the home page and /features. Kept
// as a local constant rather than a shared import because that is how the
// other marketing pages do it and a new shared module would be the only one.
const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

// Body copy sits at 0.68 rather than the 0.5 the shorter marketing pages use.
// This is the longest page on the site by a wide margin, and 0.5 white on this
// background is comfortable for a four-line paragraph and tiring for forty.
const BODY = 'rgba(255,255,255,0.68)'
const DIM = 'rgba(255,255,255,0.5)'
const HAIR = 'rgba(255,255,255,0.1)'
const PANEL = 'rgba(255,255,255,0.03)'

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

// Same six rows as before. The icon is new and is decoration only: the row
// label already carries the meaning, so it is aria-hidden.
const COMPARISON: Array<{ label: string; icon: React.ComponentType<{ className?: string }>; paper: string; individual: string; cardtly: string }> = [
  { label: 'Brand consistency', icon: Lock, paper: 'Reprint everything', individual: 'Each person decides', cardtly: 'Set once, applied to every card' },
  { label: 'Updating details', icon: Wifi, paper: 'Reprint everything', individual: 'Each person updates their own', cardtly: 'Administrator updates centrally' },
  { label: 'Who owns the leads', icon: Mail, paper: 'Nobody, they are on paper', individual: 'The individual', cardtly: 'The company' },
  { label: 'Staff turnover', icon: UserPlus, paper: 'Cards are wasted', individual: 'Card and contacts leave too', cardtly: 'Card archived, seat reissued' },
  { label: 'Knowing what is used', icon: BarChart2, paper: 'No idea', individual: 'Only the individual sees it', cardtly: 'Per-card and team-wide analytics' },
  { label: 'Several businesses', icon: Building2, paper: 'Separate everything', individual: 'Separate accounts', cardtly: 'One account, one invoice' },
]

// The four steps of a rollout. Not new claims: every one of these is stated in
// the FAQ answer "How do employees get their cards?" and in the closing block.
// Drawn here because a sequence is the one thing a paragraph is worst at.
const ROLLOUT = [
  { icon: Building2, title: 'Create the account', desc: 'Upload your logo, set your colours, and lock the fields that must stay the same.' },
  { icon: FileUp, title: 'Import your people', desc: 'One at a time, or a spreadsheet of the whole company at once.' },
  { icon: Mail, title: 'Send the invitations', desc: 'Each person is invited by email and claims their card with one click.' },
  { icon: MousePointerClick, title: 'Everyone is live', desc: 'Already branded and filled in. No training session and no launch date.' },
]

const HIERARCHY_POINTS = [
  'Each company chooses whether to wear the group look or its own.',
  'The group owner can lock that choice so a company cannot change it.',
  'Departments inherit from their own company, not from the group above it.',
  'Every company gets its own slice of the URL, such as cardtly.com/card/company/person.',
  'A department head manages only their own people and can tighten rules, never loosen them.',
]

// ── Small building blocks ─────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold"
      style={{ border: '1px solid rgba(124,58,237,0.4)', color: '#a78bfa', background: 'rgba(124,58,237,0.1)' }}
    >
      <Building2 className="w-3 h-3" aria-hidden="true" />
      {children}
    </div>
  )
}

function SectionHead({ kicker, title, children }: { kicker: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: '#a78bfa' }}>
        {kicker}
      </p>
      <h2 className="font-display text-[28px] sm:text-[38px] font-bold tracking-[-0.02em] leading-[1.12] mt-3 text-white">
        {title}
      </h2>
      {children ? (
        <p className="mt-4 text-base sm:text-lg leading-relaxed max-w-2xl" style={{ color: BODY }}>
          {children}
        </p>
      ) : null}
    </>
  )
}

/** A miniature member card, used inside the hierarchy diagram. The point it
 *  makes visually is that the brand band at the top is identical across a
 *  company while the person underneath is not. */
function MiniCard({ initial, name, role, accent, light }: { initial: string; name: string; role: string; accent: string; light: string }) {
  return (
    <div
      className="rounded-xl p-2.5 w-full"
      style={{ background: 'linear-gradient(160deg, #12122a, #0a0a18)', border: `1px solid ${accent}55` }}
    >
      <div className="flex items-center gap-1.5 pb-2 mb-2" style={{ borderBottom: `1px solid ${HAIR}` }}>
        <div
          className="w-4 h-4 rounded flex items-center justify-center text-[8px] font-black text-white"
          style={{ background: accent }}
        >
          {initial}
        </div>
        <Lock className="w-2.5 h-2.5 ml-auto" style={{ color: light }} aria-hidden="true" />
      </div>
      <p className="text-[10px] font-bold text-white leading-tight">{name}</p>
      <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'rgba(255,255,255,0.62)' }}>{role}</p>
    </div>
  )
}

/** The three-level structure, drawn.
 *
 *  This replaces nothing: the five bullet points that used to carry this idea
 *  alone are still below it. The diagram exists because "a group at the top,
 *  companies beneath it, and departments inside those, and each company may
 *  keep its own logo" is four relationships at once, and four relationships in
 *  one sentence is where prose stops working and a picture starts.
 *
 *  Decorative, so the whole thing is aria-hidden and the text version below is
 *  what a screen reader gets. */
function HierarchyDiagram() {
  const tier = 'rounded-xl px-3 py-2 text-center'
  return (
    <div
      className="relative rounded-2xl p-5 sm:p-7 overflow-hidden"
      style={{ background: PANEL, border: `1px solid ${HAIR}` }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 70% 10%, rgba(124,58,237,0.18), transparent 62%)' }}
      />

      <div className="relative">
        {/* Tier 1: the group */}
        <div className="flex justify-center">
          <div
            className={`${tier} inline-flex items-center gap-2`}
            style={{ background: 'rgba(124,58,237,0.16)', border: '1px solid rgba(124,58,237,0.45)' }}
          >
            <Layers className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
            <span className="text-xs font-bold text-white">Horizon Group</span>
          </div>
        </div>

        {/* Connector down to the split */}
        <div className="mx-auto w-px h-5" style={{ background: 'rgba(124,58,237,0.45)' }} />

        {/* Tier 2 and 3: two companies, each with its own look and its own people */}
        <div className="grid grid-cols-2 gap-3 sm:gap-5">
          {[
            // `accent` paints borders and fills, `light` paints text. The deep
            // purple measures 3.28:1 on this background, which is under AA and
            // genuinely hard to read at this size, so no text uses it.
            { name: 'Horizon Build', accent: '#7c3aed', light: '#a78bfa', initial: 'H', note: 'group look', people: [['Sipho Dlamini', 'Site Manager'], ['Lerato Khumalo', 'Estimator']] },
            { name: 'Cape Interiors', accent: '#00d4ff', light: '#67e8f9', initial: 'C', note: 'own look', people: [['Jan Pretorius', 'Design Lead'], ['Amina Patel', 'Project Admin']] },
          ].map(co => (
            <div key={co.name}>
              <div className="mx-auto w-px h-4" style={{ background: `${co.accent}88` }} />
              <div
                className={`${tier} flex items-center justify-center gap-1.5 flex-wrap`}
                style={{ background: `${co.accent}1f`, border: `1px solid ${co.accent}66` }}
              >
                <Building2 className="w-3 h-3" style={{ color: co.light }} />
                <span className="text-[11px] font-bold text-white">{co.name}</span>
              </div>
              <p className="text-[10px] text-center mt-1.5 font-semibold uppercase tracking-wider" style={{ color: co.light }}>
                {co.note}
              </p>
              <div className="mx-auto w-px h-4 mt-1.5" style={{ background: `${co.accent}88` }} />
              <div className="space-y-2">
                {co.people.map(([name, role]) => (
                  <MiniCard key={name} initial={co.initial} name={name} role={role} accent={co.accent} light={co.light} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-center mt-5" style={{ color: DIM }}>
          One account. One invoice. One seat pool.
        </p>
      </div>
    </div>
  )
}

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
    <div className="min-h-screen bg-background overflow-x-clip">
      {/* Rendered on the server. AI crawlers do not run JavaScript, so anything
          that matters has to be in the HTML that arrives. That rule is why the
          FAQ answers below are plain markup and not a collapsed accordion. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />

      <main>
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section className="relative px-5 sm:px-8 pt-28 sm:pt-32 pb-16">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[760px] max-w-full h-[440px] rounded-full blur-[120px] pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.20) 0%, transparent 70%)' }}
            aria-hidden="true"
          />
          <div className="relative max-w-[1200px] mx-auto grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
            <div>
              <Eyebrow>Cardtly for teams</Eyebrow>

              {/* The h1 is unchanged. Only the second line is gradient, so the
                  keyword phrase still reads as one sentence to a crawler. */}
              <h1 className="font-display text-[34px] sm:text-[52px] font-bold tracking-[-0.03em] leading-[1.05] mt-6 text-white">
                Digital business cards for{' '}
                <span style={gradText}>teams and companies</span>
              </h1>

              <p className="text-base sm:text-lg mt-6 leading-relaxed" style={{ color: BODY }}>
                Cardtly gives every employee a branded digital business card that the company owns and
                controls. An administrator sets the logo and colours once, locks the fields that must
                stay the same, and issues a card to each person. Staff share theirs by NFC tap, QR code
                or link, and the recipient saves the details without installing an app.
              </p>

              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  href="/signup"
                  className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white transition-transform hover:scale-[1.02]"
                  style={{ background: grad, boxShadow: '0 8px 30px rgba(124,58,237,0.4)' }}
                >
                  Start a team
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white transition-colors"
                  style={{ border: `1px solid ${HAIR}`, background: PANEL }}
                >
                  Talk to us about {MAX_SELF_SERVE_SEATS}+ seats
                </Link>
              </div>

              {/* Three facts stated everywhere else on the page, given a shape
                  so the hero has something scannable under the buttons. */}
              <dl className="grid grid-cols-3 gap-3 mt-10 pt-8" style={{ borderTop: `1px solid ${HAIR}` }}>
                {[
                  { v: `R${SEAT_PRICE_RAND}`, l: 'per card, per month' },
                  { v: `2 to ${MAX_SELF_SERVE_SEATS}`, l: 'seats, self-serve' },
                  { v: '3 levels', l: 'group, company, dept' },
                ].map(s => (
                  <div key={s.l}>
                    <dt className="sr-only">{s.l}</dt>
                    <dd>
                      <span className="block font-display text-xl sm:text-2xl font-bold" style={gradText}>{s.v}</span>
                      <span className="block text-[11px] mt-1 leading-tight" style={{ color: DIM }}>{s.l}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="float-soft">
              <HierarchyDiagram />
            </div>
          </div>
        </section>

        {/* ── Comparison ─────────────────────────────────────────────── */}
        <section className="px-5 sm:px-8 py-16 sm:py-20">
          <div className="max-w-[1200px] mx-auto">
            <Reveal>
              <SectionHead kicker="Why a team account" title="What a company gets that individuals do not">
                A company where everyone signed up on their own has no shared brand, no way to correct a
                logo across the group, no record of who holds a card, and no claim on the leads those
                cards capture. A team account inverts each of those.
              </SectionHead>
            </Reveal>

            <Reveal delay={80}>
              {/* Still one real table, still one copy of every string. The
                  Cardtly column is tinted the whole way down so the answer is
                  readable at a glance without reading six rows first. */}
              <div className="overflow-x-auto mt-8 rounded-2xl" style={{ border: `1px solid ${HAIR}`, background: PANEL }}>
                <table className="w-full text-sm border-collapse min-w-[640px]">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${HAIR}` }}>
                      <th className="text-left font-semibold p-4" />
                      <th className="text-left font-semibold p-4 text-[11px] uppercase tracking-wider" style={{ color: DIM }}>Paper cards</th>
                      <th className="text-left font-semibold p-4 text-[11px] uppercase tracking-wider" style={{ color: DIM }}>Individual digital cards</th>
                      <th
                        className="text-left font-bold p-4 text-[11px] uppercase tracking-wider text-white"
                        style={{ background: 'rgba(124,58,237,0.14)', borderLeft: '1px solid rgba(124,58,237,0.35)' }}
                      >
                        Cardtly for teams
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON.map(({ label, icon: Icon, paper, individual, cardtly }, i) => (
                      <tr key={label} style={i < COMPARISON.length - 1 ? { borderBottom: `1px solid ${HAIR}` } : undefined}>
                        <td className="p-4 font-semibold text-white whitespace-nowrap">
                          <span className="inline-flex items-center gap-2.5">
                            <span
                              className="w-7 h-7 rounded-lg inline-flex items-center justify-center shrink-0"
                              style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}
                            >
                              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                            </span>
                            {label}
                          </span>
                        </td>
                        <td className="p-4" style={{ color: DIM }}>{paper}</td>
                        <td className="p-4" style={{ color: DIM }}>{individual}</td>
                        <td
                          className="p-4 font-medium text-white"
                          style={{ background: 'rgba(124,58,237,0.08)', borderLeft: '1px solid rgba(124,58,237,0.35)' }}
                        >
                          <span className="inline-flex items-start gap-2">
                            <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#22c55e' }} aria-hidden="true" />
                            {cardtly}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Hierarchy ──────────────────────────────────────────────── */}
        <section className="px-5 sm:px-8 py-16 sm:py-20" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="max-w-[1200px] mx-auto">
            <Reveal>
              <SectionHead kicker="Structure" title="One account can hold several companies">
                Cardtly has three levels: a group at the top, companies beneath it, and departments
                inside those. A holding company with seven businesses runs all of them from one account,
                on one invoice and one seat pool, while each business keeps its own logo, colours, web
                address and manager.
              </SectionHead>
            </Reveal>

            <Reveal delay={80}>
              <ul className="mt-9 grid sm:grid-cols-2 gap-x-8 gap-y-4">
                {HIERARCHY_POINTS.map(line => (
                  <li
                    key={line}
                    className="flex gap-3 rounded-xl p-4"
                    style={{ background: PANEL, border: `1px solid ${HAIR}` }}
                  >
                    <Check className="w-4 h-4 mt-1 shrink-0" style={{ color: '#22c55e' }} aria-hidden="true" />
                    <span className="leading-relaxed text-sm" style={{ color: BODY }}>{line}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* ── Rollout ────────────────────────────────────────────────── */}
        <section className="px-5 sm:px-8 py-16 sm:py-20">
          <div className="max-w-[1200px] mx-auto">
            <Reveal>
              <SectionHead kicker="Rollout" title="Four steps, and nobody needs training">
                Every card is live from the moment it is claimed, already branded and filled in. A
                rollout does not need a launch date.
              </SectionHead>
            </Reveal>

            <ol className="mt-9 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {ROLLOUT.map(({ icon: Icon, title, desc }, i) => (
                <Reveal key={title} delay={i * 70}>
                  <li className="relative rounded-2xl p-5 h-full" style={{ background: PANEL, border: `1px solid ${HAIR}` }}>
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className="w-10 h-10 rounded-xl inline-flex items-center justify-center text-white shrink-0"
                        style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}
                      >
                        <Icon className="w-4 h-4" aria-hidden="true" />
                      </span>
                      <span className="font-display text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.18)' }}>
                        {i + 1}
                      </span>
                    </div>
                    <p className="font-bold text-white text-sm mb-1.5">{title}</p>
                    <p className="text-sm leading-relaxed" style={{ color: DIM }}>{desc}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Price ──────────────────────────────────────────────────── */}
        <section className="px-5 sm:px-8 py-16 sm:py-20" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="max-w-[1200px] mx-auto">
            <Reveal>
              <div className="grid lg:grid-cols-[1fr_auto] gap-10 items-center">
                <div>
                  <SectionHead kicker="Pricing" title="What it costs">
                    R{SEAT_PRICE_RAND} per card per month, billed monthly or annually. Teams of 2 to{' '}
                    {MAX_SELF_SERVE_SEATS} cards are self-serve. Above {MAX_SELF_SERVE_SEATS} seats the
                    arrangement is quoted, because that is where invoicing, purchase orders and rollout
                    support matter more than a checkout page. Every card carries the full feature set, so
                    the price does not change according to which features a team turns on.
                  </SectionHead>
                  {/* min-h-11 rather than bare text: as an inline link this was
                      20px tall, under the 44px minimum for a touch target. */}
                  <Link
                    href="/pricing"
                    className="group inline-flex items-center gap-2 mt-4 min-h-11 py-2 text-sm font-bold"
                    style={{ color: '#a78bfa' }}
                  >
                    See full pricing
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </Link>
                </div>

                <div
                  className="rounded-2xl p-7 text-center lg:min-w-[260px]"
                  style={{ background: PANEL, border: '1px solid rgba(124,58,237,0.35)' }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: DIM }}>
                    Per card
                  </p>
                  <p className="font-display text-5xl font-bold mt-2" style={gradText}>
                    R{SEAT_PRICE_RAND}
                  </p>
                  <p className="text-xs mt-1" style={{ color: DIM }}>per month</p>
                  <div className="mt-5 pt-5 space-y-2 text-left" style={{ borderTop: `1px solid ${HAIR}` }}>
                    {['Every feature included', 'No cut-down tier', 'Monthly or annual'].map(l => (
                      <p key={l} className="flex items-center gap-2 text-xs" style={{ color: BODY }}>
                        <Check className="w-3.5 h-3.5 shrink-0" style={{ color: '#22c55e' }} aria-hidden="true" />
                        {l}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────────── */}
        {/* 640px, not the 1200 the rest of the page uses, and measured rather
            than guessed: 900px set these answers at 105 characters a line and
            700px at 80, both past the point where the eye starts losing the
            beginning of the next line. 640 lands at about 72. Every other
            section is wider because none of them asks anyone to read a
            700-character paragraph. */}
        <section className="px-5 sm:px-8 py-16 sm:py-20">
          <div className="max-w-[640px] mx-auto">
            <Reveal>
              <SectionHead kicker="FAQ" title="Questions companies ask" />
            </Reveal>

            <div className="mt-9 space-y-4">
              {FAQ.map(({ q, a }, i) => (
                <Reveal key={q} delay={i < 4 ? i * 60 : 0}>
                  <article
                    className="rounded-2xl p-5 sm:p-7"
                    style={{ background: PANEL, border: `1px solid ${HAIR}` }}
                  >
                    {/* The number sits beside the QUESTION, not beside the whole
                        card. Indenting the answer under it too cost about 48px
                        of measure, which on a 375px screen dropped the answer
                        to roughly 31 characters a line, under the readable
                        minimum. These answers are long enough that it showed. */}
                    <div className="flex items-start gap-3.5">
                      <span
                        className="w-8 h-8 rounded-lg shrink-0 inline-flex items-center justify-center text-xs font-black text-white"
                        style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.35)' }}
                        aria-hidden="true"
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <h3 className="font-bold text-lg leading-snug text-white pt-0.5 min-w-0">{q}</h3>
                    </div>
                    <p className="mt-3.5 leading-relaxed" style={{ color: BODY }}>{a}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Closing CTA ────────────────────────────────────────────── */}
        <section className="px-5 sm:px-8 pb-24">
          <div className="max-w-[1200px] mx-auto">
            <Reveal>
              <div
                className="relative rounded-3xl p-8 sm:p-12 overflow-hidden text-center"
                style={{ background: PANEL, border: '1px solid rgba(124,58,237,0.3)' }}
              >
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: 'radial-gradient(circle at 50% 0%, rgba(124,58,237,0.22), transparent 65%)' }}
                  aria-hidden="true"
                />
                <div className="relative">
                  <h2 className="font-display text-[26px] sm:text-[34px] font-bold tracking-[-0.02em] leading-tight text-white">
                    Give your whole team a card <span style={gradText}>this week</span>
                  </h2>
                  <p className="mt-4 leading-relaxed max-w-2xl mx-auto" style={{ color: BODY }}>
                    Create the account, upload your logo, import your people from a spreadsheet, and send
                    the invitations. Everyone claims their own card with one click, already branded.
                  </p>
                  <div className="flex flex-wrap gap-3 mt-8 justify-center">
                    <Link
                      href="/signup"
                      className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white transition-transform hover:scale-[1.02]"
                      style={{ background: grad, boxShadow: '0 8px 30px rgba(124,58,237,0.4)' }}
                    >
                      Start a team
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </Link>
                    <Link
                      href="/contact"
                      className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white"
                      style={{ border: `1px solid ${HAIR}`, background: 'rgba(255,255,255,0.04)' }}
                    >
                      Ask a question
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
