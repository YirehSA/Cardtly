import type { Metadata } from 'next'
import { FileText, Scale, BookOpen, Trash2, ClipboardCheck } from 'lucide-react'
import LegalPage, { Section, B, A, Table, sectionStyle } from '@/components/marketing/LegalPage'
import { COMPANY } from '@/lib/company'
import { GA_ENABLED } from '@/lib/analytics'

export const metadata: Metadata = {
  title: 'Trust Centre: Security, POPIA and Compliance',
  description:
    'How Cardtly protects your information: where it is stored, who can see it, how it is secured, our POPIA documents, our PAIA manual and our service providers.',
  alternates: { canonical: '/trust' },
}

// A procurement team's first stop, written 2026-10-22 after Andre compared us
// with a competitor's trust page. That page listed SOC 2 and ISO 27001 as
// "actively preparing", which reads like certification to a buyer who skims.
// This one states only what is true today and points at the documents that
// prove it, so:
//   - never say Cardtly is certified, audited or "preparing for" SOC 2 or ISO
//     27001, a penetration test, its own two-factor sign-in, or standard
//     contractual clauses. The providers' certifications are theirs, and are
//     described as theirs;
//   - every provider named in section 7 of the privacy policy is listed here,
//     which scripts/check-privacy-disclosures enforces;
//   - like the other legal pages it is reachable inside the iOS app, so no
//     prices and no links to IOS_BLOCKED_ROUTES.
// Provider certifications were read from each provider's own pages on
// 2026-10-22. Check them again before relying on this in a tender.

const DOCUMENTS = [
  { href: '/privacy', icon: FileText, title: 'Privacy Policy', text: 'What we collect, why, who processes it, where it is stored and for how long.' },
  { href: '/terms#data-protection', icon: Scale, title: 'POPIA operator agreement', text: 'Section 5 of our terms: what we commit to when we process your leads and staff details for you.' },
  { href: '/paia', icon: BookOpen, title: 'PAIA manual', text: 'The records we hold and how to request one, as section 51 of PAIA requires.' },
  { href: '/delete-account', icon: Trash2, title: 'Deleting an account', text: 'How to remove an account and everything in it, readable without signing in.' },
  { href: `mailto:${COMPANY.email}?subject=Security%20questionnaire`, icon: ClipboardCheck, title: 'Security questionnaire', text: 'Send us your procurement questionnaire or data processing agreement and we will complete it.' },
]

const PROVIDERS: [string, string][] = [
  ['Supabase', 'Database, sign-in and file storage'],
  ['Vercel', 'Hosts the website and serves cards'],
  ['Paystack', 'Card payments'],
  ['Resend', 'Sends our email'],
  ['OpenAI', 'The AI bio writer and paper card scanning, only when someone uses them'],
  ['ipapi.co', 'Looks up the city a new account signed up from'],
  ['Google', GA_ENABLED
    ? 'Google Wallet passes, Firebase Analytics in the Android app, Google Play, and Google Analytics on our marketing pages (never on cards)'
    : 'Google Wallet passes, Firebase Analytics in the Android app, and Google Play'],
  ['Apple', 'The App Store'],
  ['Microsoft', 'Sign in with Microsoft, for those who choose it'],
]

export default function TrustPage() {
  return (
    <LegalPage
      eyebrow="Trust"
      title="Trust"
      accent="Centre"
      intro="How Cardtly protects the information you give us, and the documents a procurement or legal team will ask for."
      updated="22 October 2026"
    >
      {/* The documents first: they are what a reviewer came for. */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {DOCUMENTS.map(({ href, icon: Icon, title, text }, i) => (
          <a key={title} href={href}
            // An odd tile out takes the whole last row rather than half of it.
            className={`group p-6 rounded-3xl flex gap-4 items-start transition hover:bg-white/[0.06] ${i === DOCUMENTS.length - 1 && DOCUMENTS.length % 2 ? 'sm:col-span-2' : ''}`}
            style={sectionStyle}>
            <span className="w-10 h-10 shrink-0 rounded-full grid place-items-center" style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff' }}>
              <Icon className="w-5 h-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-bold text-white group-hover:underline">{title}</span>
              <span className="block text-sm mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{text}</span>
            </span>
          </a>
        ))}
      </div>

      <Section id="glance" title="The short answers">
        <Table
          head={['Question', 'Answer']}
          rows={[
            [<B key="q">Where is our information stored?</B>, 'With Supabase, in its West Europe region, in the European Union. Storage only in South Africa is not offered as standard.'],
            [<B key="q">Who can see the leads our cards capture?</B>, 'Only your account, or on a team account your organisation’s administrators. The database itself enforces this, not just the website.'],
            [<B key="q">Do you store card numbers?</B>, 'No. Card payments are made on Paystack, and we never see the card number.'],
            [<B key="q">How do people sign in?</B>, 'With a password, a one-time link emailed to them, or Sign in with Microsoft. Cardtly has no two-factor sign-in of its own; with Microsoft, your organisation’s own multi-factor and conditional access rules apply.'],
            [<B key="q">Can we take our information out, or delete it?</B>, 'Yes, both self-service. Export gives a file of everything we hold about the account. Deletion is immediate from live systems, and encrypted backups are overwritten within 90 days.'],
            [<B key="q">What happens if there is a breach?</B>, 'We notify the Information Regulator and the people affected as soon as reasonably possible, as POPIA section 22 requires, and, where we process the information for you, we tell you without undue delay.'],
            [<B key="q">Who is responsible under POPIA?</B>, 'You are the responsible party for your leads and your staff’s card details, and Cardtly is your operator. Cardtly is the responsible party for account and billing details.'],
            [<B key="q">Is Cardtly certified?</B>, 'Cardtly is not certified under ISO 27001 or SOC 2. The platforms we run on are independently audited: see below.'],
          ]}
        />
      </Section>

      <Section id="security" title="How your information is protected">
        <ul className="list-disc pl-6 space-y-2">
          <li><B>Access enforced by the database.</B> Row-level security refuses one customer&apos;s records to anyone else, so a fault in the website cannot expose them. Which fields a signed-in user may change is restricted in the database too.</li>
          <li><B>Encrypted in transit and at rest.</B> HTTPS only, with browsers told to refuse an insecure connection to us for two years. The database, files and backups are encrypted at rest by Supabase.</li>
          <li><B>Browser protections.</B> Other sites cannot frame our pages, files cannot be reinterpreted as code, and a card&apos;s address is not passed on to the sites it links to.</li>
          <li><B>Passwords and limits.</B> Passwords are stored only as one-way hashes. Sign-in attempts are rate limited, and so is each key on our customer API.</li>
          <li><B>Logged administration.</B> Administrative actions by Cardtly staff, and every change to a subscription, are recorded with who made them and when.</li>
          <li><B>No IP addresses for card visitors.</B> We do not store the IP address of people who view a card, and the code used to count unique visitors changes daily and differs for every card.</li>
          <li><B>No card numbers.</B> Payment card details are handled only by Paystack.</li>
        </ul>
      </Section>

      <Section id="certifications" title="Our platforms’ certifications">
        <p>
          Cardtly runs on platforms that are independently audited and publish their own reports. Their certifications cover their platforms, not Cardtly&apos;s own processes.
        </p>
        <Table
          head={['Platform', 'What it does for us', 'What it states']}
          rows={[
            [<B key="s">Supabase</B>, 'Database, sign-in and file storage', <A key="sl" href="https://supabase.com/security">SOC 2 Type 2</A>],
            [<B key="v">Vercel</B>, 'Hosting', <A key="vl" href="https://vercel.com/docs/security/compliance">SOC 2 Type 2 and ISO 27001:2022</A>],
            [<B key="p">Paystack</B>, 'Card payments', <A key="pl" href="https://paystack.com/security">PCI DSS Level 1 service provider</A>],
          ]}
        />
      </Section>

      <Section id="providers" title="Who processes information for us">
        <p>
          The complete list of our service providers. What each one receives is set out in{' '}
          <A href="/privacy#share">section 7 of our Privacy Policy</A>, and we update it before a new provider starts processing personal information for us.
        </p>
        <Table
          head={['Provider', 'What it does']}
          rows={PROVIDERS.map(([name, does]) => [<B key={name}>{name}</B>, does])}
        />
      </Section>

      <Section id="contact" title="Questions">
        <p>
          Security questionnaires, data processing agreements and anything this page does not answer go to our Information Officer, {COMPANY.informationOfficer}, at{' '}
          <A href={`mailto:${COMPANY.email}`}>{COMPANY.email}</A> or {COMPANY.phone}.
        </p>
        <p>
          {COMPANY.name}, registration number {COMPANY.regNumber}, {COMPANY.address}.
        </p>
      </Section>
    </LegalPage>
  )
}
