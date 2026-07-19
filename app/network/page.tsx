import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import { INDUSTRIES } from '@/lib/industries'
import {
  Search, Building2, Users, ShieldCheck, Filter, ArrowRight,
  IdCard, Lock, ChevronDown,
} from 'lucide-react'

// The public page for the Network, the in-dashboard directory built in
// migrations 036-040. Everything here has to stay true to that build, so:
// no claim about who is listed that contradicts the opt-out, no claim about
// contact details, and the industry count comes from the list itself rather
// than a number typed here that would quietly rot.
export const metadata: Metadata = {
  title: { absolute: 'Business Networking Directory for SA Companies | Cardtly' },
  description:
    'Search South African businesses by company, industry or job title, see who works there and open their card. Included with every Cardtly Pro account.',
  alternates: { canonical: '/network' },
  openGraph: {
    title: 'Business Networking Directory for SA Companies | Cardtly',
    description:
      'Search businesses by company, industry or job title, see who works there, and open their card. Included with Cardtly Pro.',
    url: 'https://cardtly.com/network',
    type: 'website',
  },
}

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

const STEPS = [
  {
    n: '01',
    icon: Search,
    title: 'Search a company, a person or a job title',
    body:
      'One box covers all three, because you do not always remember which one you know. Type "Sicon", "Dlamini" or "site foreman" and you land in the same place.',
  },
  {
    n: '02',
    icon: Filter,
    title: 'Or narrow it to your industry',
    body:
      `Filter by any of ${INDUSTRIES.length} industries, from construction and logistics to legal, medical and travel. Only industries someone is actually in are shown, so you never click into an empty result.`,
  },
  {
    n: '03',
    icon: Building2,
    title: 'Open the company, see the people',
    body:
      'Companies are listed with their logo and how many people are on Cardtly. Open one and you get the team: name, position and photo.',
  },
  {
    n: '04',
    icon: IdCard,
    title: 'Open their card',
    body:
      'One tap opens their full digital business card, exactly as they built it, with every way to reach them and a save-to-contacts button.',
  },
]

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'What is the Cardtly Network?',
    a: 'It is a searchable directory of everyone using Cardtly, built into your dashboard. You can look up a business by name, browse by industry, see who works there and open their digital business card. It is designed for finding the right person at a company you already want to reach, rather than cold-scrolling a feed.',
  },
  {
    q: 'Is business networking included in my plan?',
    a: 'Yes. The Network is part of Cardtly Pro at no extra cost, and it works during your 60-day free trial too. Team members on a company account get it as part of their seat.',
  },
  {
    q: 'Can anyone on the internet see my details?',
    a: 'No. The Network is only reachable once you are signed in to Cardtly, so it is a members directory rather than a public page a search engine or scraper can crawl. The listing itself shows your name, position, company and photo, which are already on your public card, and never your phone number or email address.',
  },
  {
    q: 'Can I keep myself out of the directory?',
    a: 'Yes, at any time. There is a switch in Settings for a personal card, and in the card editor for a team card. Turn it off and you stop appearing immediately, while your card itself keeps working exactly as before.',
  },
  {
    q: 'Can a company control which of its staff are listed?',
    a: 'Yes. A team admin can switch any individual team card in or out of the Network from the Team Cards page. That decision and the staff member’s own choice are kept separate: either side can remove a card from the directory, and neither can force one back in.',
  },
  {
    q: 'How do people find my business in the Network?',
    a: 'By your company name, your name, your job title, or by filtering to your industry. Setting your industry is the single thing that makes the biggest difference, and it takes a few seconds in Settings or on your dashboard.',
  },
]

export default function NetworkPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <>
      {/* Schema is generated from the same FAQS array the page renders, so the
          two cannot drift. Google penalises structured data that does not match
          what is visible on the page. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <Navbar />

      <main className="bg-black text-white">
        {/* Hero */}
        <section className="relative overflow-hidden pt-32 lg:pt-40 pb-20">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(60% 50% at 50% 0%, rgba(0,212,255,0.16), transparent 70%)' }}
            aria-hidden="true"
          />
          <div className="relative max-w-5xl mx-auto px-6 text-center">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/50">
              Included with Cardtly Pro
            </p>
            <h1
              className="mt-5 font-display font-black leading-[1.05]"
              style={{ fontSize: 'clamp(2.15rem, 4.4vw, 4rem)' }}
            >
              Business networking that{' '}
              <span style={gradText}>starts with the right person</span>
            </h1>
            <p className="mt-6 text-lg text-white/70 max-w-2xl mx-auto leading-relaxed">
              The Cardtly Network is a searchable directory of the businesses and
              people already using Cardtly. Find a company, see who works there, and
              open their card. No feed, no requests, no waiting to be accepted.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 min-h-[52px] px-7 rounded-2xl font-bold transition hover:opacity-90"
                style={{ background: grad }}
              >
                Start your free trial
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-2xl font-bold border border-white/15 hover:bg-white/5 transition"
              >
                See pricing
              </Link>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 border-t border-white/10">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="font-display text-3xl sm:text-4xl font-black text-center">
              How networking works on Cardtly
            </h2>
            <p className="mt-4 text-white/60 text-center max-w-2xl mx-auto leading-relaxed">
              It lives inside your dashboard, next to your card and your analytics.
              Sign in and it is already there.
            </p>

            <ol className="mt-14 grid gap-5 sm:grid-cols-2">
              {STEPS.map(({ n, icon: Icon, title, body }) => (
                <li
                  key={n}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-7"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-11 h-11 rounded-2xl grid place-items-center shrink-0"
                      style={{ background: grad }}
                    >
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <span className="text-xs font-black tracking-widest text-white/35">
                      {n}
                    </span>
                  </div>
                  <h3 className="mt-5 font-bold text-lg leading-snug">{title}</h3>
                  <p className="mt-3 text-white/60 leading-relaxed">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* For companies */}
        <section className="py-20 border-t border-white/10">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-2xl">
              <h2 className="font-display text-3xl sm:text-4xl font-black">
                Built for companies, not just individuals
              </h2>
              <p className="mt-4 text-white/60 leading-relaxed">
                A team on Cardtly appears in the Network as one company, with one
                logo, and every person under it. Your staff show up together as the
                business rather than as a scatter of unconnected names.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {[
                {
                  icon: Building2,
                  title: 'One company, one entry',
                  body:
                    'Everyone who works for you is grouped under your company logo, with your industry on it, however each person typed the company name.',
                },
                {
                  icon: Users,
                  title: 'You choose who appears',
                  body:
                    'A team admin can switch any individual card in or out of the directory from the Team Cards page, so only the people you want listed are listed.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Your people keep their say',
                  body:
                    'A staff member can always remove their own card. Either side can take a card out; neither can force one back in.',
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-7"
                >
                  <span
                    className="w-11 h-11 rounded-2xl grid place-items-center"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  >
                    <Icon className="w-5 h-5 text-white/80" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-bold">{title}</h3>
                  <p className="mt-3 text-white/60 text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section className="py-20 border-t border-white/10">
          <div className="max-w-4xl mx-auto px-6">
            <div className="rounded-3xl border border-white/10 p-8 sm:p-10"
              style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.08), transparent 65%)' }}>
              <span
                className="w-12 h-12 rounded-2xl grid place-items-center"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <Lock className="w-5 h-5" aria-hidden="true" />
              </span>
              <h2 className="mt-6 font-display text-2xl sm:text-3xl font-black">
                A members&rsquo; directory, not a public list
              </h2>
              <div className="mt-6 space-y-4 text-white/70 leading-relaxed">
                <p>
                  The Network is only reachable once you are signed in to Cardtly. It
                  is not a public page, so it is not something a search engine or a
                  scraper can walk.
                </p>
                <p>
                  A listing shows your name, your position, your company and your
                  photo, all of which already appear on your public card. It never
                  shows your phone number or your email address. Reaching those still
                  takes a deliberate visit to your card, exactly as it does when you
                  hand someone your card in person.
                </p>
                <p>
                  You can switch your listing off whenever you like, from Settings for
                  a personal card or the card editor for a team card. Your card itself
                  carries on working either way.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 border-t border-white/10">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="font-display text-3xl sm:text-4xl font-black text-center">
              Networking questions, answered
            </h2>
            <div className="mt-10 space-y-3">
              {FAQS.map(({ q, a }) => (
                <details
                  key={q}
                  className="group rounded-2xl border border-white/10 bg-white/[0.03] px-6"
                >
                  <summary className="flex items-center justify-between gap-4 py-5 cursor-pointer list-none font-semibold">
                    {q}
                    <ChevronDown
                      className="w-4 h-4 shrink-0 text-white/40 transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="pb-5 text-white/65 leading-relaxed">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Close */}
        <section className="py-24 border-t border-white/10">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="font-display text-3xl sm:text-4xl font-black">
              Get listed, and get found
            </h2>
            <p className="mt-4 text-white/60 leading-relaxed">
              Every Cardtly Pro account includes the Network, and so does the 60-day
              free trial. Set your industry when you sign up and the people looking
              for what you do can find you.
            </p>
            <Link
              href="/signup"
              className="mt-9 inline-flex items-center justify-center gap-2 min-h-[52px] px-8 rounded-2xl font-bold transition hover:opacity-90"
              style={{ background: grad }}
            >
              Start your free trial
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
