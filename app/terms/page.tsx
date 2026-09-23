import type { Metadata } from 'next'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'

export const metadata: Metadata = {
  title: 'Terms of Service for Digital Business Cards',
  description:
    'The terms for using Cardtly: accounts, the trial, subscriptions, team accounts, cancellation, and how we process personal information for you under POPIA.',
  // The root layout deliberately omits a canonical so it cannot point every
  // page at the homepage, which means pages without one have none at all.
  alternates: { canonical: '/terms' },
}

// READ BY CORPORATE LEGAL TEAMS AS A CONTRACT, so every factual statement was
// checked against the code on 2026-09-23. Change behaviour, change this page.
//
// NO PRICES ON THIS PAGE, deliberately. /terms is reachable inside the iOS app
// (Apple requires it, so it is not on IOS_BLOCKED_ROUTES), and a price or a
// route to a checkout inside the app is a Guideline 3.1.1 rejection. The fees
// are "those published on our website"; the numbers live on the pages the app
// cannot reach. No links to pricing, checkout, /nfc, /signup or /blog either.
//
// Section "data-protection" is the POPIA section 21 operator contract that
// the privacy policy links to by anchor. Keep the id.

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

const sectionStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
}

const link = { color: '#00d4ff' }

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="p-8 md:p-10 rounded-3xl mb-6 scroll-mt-28" style={sectionStyle}>
      <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-5">{title}</h2>
      <div className="space-y-4 text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
        {children}
      </div>
    </div>
  )
}

function B({ children }: { children: React.ReactNode }) {
  return <strong className="text-white">{children}</strong>
}

const CONTENTS: [string, string][] = [
  ['about', 'About these terms'],
  ['account', 'Your account'],
  ['trial', 'The trial and subscriptions'],
  ['teams', 'Organisations and team accounts'],
  ['data-protection', 'Personal information and POPIA'],
  ['use', 'Acceptable use'],
  ['content', 'Your content and your public card'],
  ['nfc', 'Physical NFC cards'],
  ['apps', 'The mobile apps'],
  ['availability', 'Availability and changes to the service'],
  ['termination', 'Suspension and termination'],
  ['liability', 'Disclaimers and liability'],
  ['indemnity', 'Indemnity'],
  ['changes', 'Changes to these terms'],
  ['law', 'Governing law'],
  ['contact', 'Contact'],
]

export default function TermsPage() {
  return (
    <div style={{ background: '#000', color: '#fff' }}>
      <Navbar />

      <section className="pt-32 pb-12 px-6 text-center relative overflow-hidden">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[120px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.12) 0%, rgba(124,58,237,0.08) 50%, transparent 70%)' }}
        />
        <div className="relative max-w-3xl mx-auto">
          <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#00d4ff' }}>Legal</p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6">
            Terms of <span style={gradText}>Service</span>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            The agreement between you and Cardtly.
          </p>
          <p className="text-sm mt-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Last updated: 23 September 2026
          </p>
        </div>
      </section>

      <section className="pb-24 px-6">
        <div className="max-w-3xl mx-auto">

          <nav aria-label="Contents" className="p-8 md:p-10 rounded-3xl mb-6" style={sectionStyle}>
            <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>Contents</p>
            <ol className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm list-decimal pl-5" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {CONTENTS.map(([id, label]) => (
                <li key={id}><a href={`#${id}`} className="hover:underline">{label}</a></li>
              ))}
            </ol>
          </nav>

          <Section id="about" title="1. About these terms">
            <p>
              These terms govern your use of Cardtly, a South African digital business card platform (&ldquo;Cardtly&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or using the service you agree to them. If you do not agree, do not use the service.
            </p>
            <p>
              <B>If you accept these terms for an organisation,</B> you confirm that you have authority to bind it, and &ldquo;you&rdquo; includes that organisation. Our <a href="/privacy" className="underline" style={link}>Privacy Policy</a> forms part of these terms.
            </p>
          </Section>

          <Section id="account" title="2. Your account">
            <p>
              You must be at least 18 years old to use Cardtly. You are responsible for keeping your password safe and for everything done under your account. Tell us immediately at{' '}
              <a href="mailto:andre@cardtly.com" className="underline" style={link}>andre@cardtly.com</a> if you suspect unauthorised access.
            </p>
            <p>
              You agree to give accurate information when you sign up and to keep it up to date.
            </p>
          </Section>

          <Section id="trial" title="3. The trial and subscriptions">
            <p>
              <B>Every new account starts with a 7-day trial</B> of the full service. No payment details are needed to start it. We may offer a longer trial through a code, in which case the length stated with the code applies.
            </p>
            <p>
              <B>After the trial, a paid subscription is needed for each card</B> to keep it live. Subscriptions are charged monthly in advance, per card, through our payment processor Paystack, at the fees published on our website when you subscribe. By subscribing you authorise Paystack to charge your payment method each month until you cancel.
            </p>
            <p>
              <B>Organisations billed by invoice</B> are charged on the cycle and terms set out in the quote they accepted, which may be monthly, quarterly or annually, and pay by EFT.
            </p>
            <p>
              <B>Cancelling.</B> You can cancel at any time by asking us, through the <a href="/contact" className="underline" style={link}>contact page</a> or at{' '}
              <a href="mailto:andre@cardtly.com" className="underline" style={link}>andre@cardtly.com</a>, and we will cancel it promptly. Cancellation takes effect at the end of the period you have paid for. We do not refund part periods, except where the law requires it. Deleting your account also cancels your subscription, automatically.
            </p>
            <p>
              <B>Price changes.</B> We give active subscribers at least 30 days&apos; written notice of a price change. If you continue after the change takes effect, the new price applies.
            </p>
            <p>
              <B>If a payment fails,</B> we will try again and tell you. If we still cannot collect it, your card goes offline until payment is made. Your content is kept so that the card can be restored when it is.
            </p>
          </Section>

          <Section id="teams" title="4. Organisations and team accounts">
            <p>
              An organisation can issue Cardtly cards to its staff from a team account. On a team account:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><B>The organisation is our customer,</B> and it owns the team&apos;s cards and the contacts those cards capture.</li>
              <li><B>Administrators</B> appointed by the organisation can create, edit, archive and reassign team cards; decide which details staff may change and which are fixed; and see the team&apos;s cards, the contacts they capture, their analytics, and the activity log staff record.</li>
              <li><B>Staff</B> use their card within the rules their organisation sets. When someone leaves, their card and the contacts it captured stay with the organisation.</li>
              <li><B>Groups</B> can hold several companies, each with its own branding, under one account and one invoice.</li>
              <li>Up to 20 cards can be set up without contacting us. For more, the size of the account and its billing are agreed with us directly.</li>
            </ul>
            <p>
              The organisation is responsible for its administrators&apos; actions, and for telling its staff how their information on Cardtly will be used.
            </p>
          </Section>

          <Section id="data-protection" title="5. Personal information and POPIA">
            <p>
              This section applies whenever Cardtly processes personal information on your behalf, and is the written agreement between a responsible party and its operator that the Protection of Personal Information Act 4 of 2013 (POPIA) requires in sections 20 and 21.
            </p>
            <p>
              <B>Who is responsible for what.</B> Cardtly is the responsible party for the information about you that we need to run your account. You are the responsible party, and Cardtly is your operator, for:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>the contacts, leads and requests captured through your cards; and</li>
              <li>on a team account, the details of your staff on the cards you issue them, and the activity they record.</li>
            </ul>
            <p><B>What we commit to as your operator.</B> We will:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>process that information only to provide the service to you, in line with the settings you choose, and not for any purpose of our own;</li>
              <li>keep it confidential, and allow access to it only to people at Cardtly who need it to run or support the service;</li>
              <li>maintain the security measures POPIA section 19 requires, as described in section 11 of our Privacy Policy;</li>
              <li>notify you without undue delay if we have reasonable grounds to believe that information has been accessed or acquired by someone not authorised to, so that you can meet your own notification obligations;</li>
              <li>use only the service providers named in our Privacy Policy, and update that list before adding a new one that will process your information;</li>
              <li>transfer information outside South Africa only as our Privacy Policy describes, which includes hosting our database in the European Union;</li>
              <li>help you respond to requests from the people whose information it is, including through the self-service export and deletion in your account; and</li>
              <li>when your account is deleted, delete that information as our Privacy Policy describes. You can export it first.</li>
            </ul>
            <p><B>What you commit to as the responsible party.</B> You will:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>have a lawful reason under POPIA for collecting the information your cards capture, and tell people how you will use it;</li>
              <li>contact the people your cards capture only as the law allows, including POPIA section 69&apos;s rules on direct marketing by electronic communication;</li>
              <li>not put special personal information, or personal information about children, on a card; and</li>
              <li>on a team account, tell your staff how their information on Cardtly is used and who in your organisation can see it.</li>
            </ul>
            <p>
              If your organisation needs a separately signed data processing agreement, email us.
            </p>
          </Section>

          <Section id="use" title="6. Acceptable use">
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use Cardtly for anything illegal, fraudulent or harmful.</li>
              <li>Impersonate another person or business.</li>
              <li>Publish content that is defamatory, obscene, or infringes someone else&apos;s rights.</li>
              <li>Send spam, phishing or unlawful marketing through Cardtly or to the contacts it captures.</li>
              <li>Attempt to break, probe or interfere with our infrastructure.</li>
              <li>Scrape or automate access to the service without our written permission.</li>
              <li>Resell or repackage the service as your own.</li>
            </ul>
            <p>
              We may suspend or close accounts that break these rules, without notice where the breach is serious.
            </p>
          </Section>

          <Section id="content" title="7. Your content and your public card">
            <p>
              You keep ownership of everything you put on Cardtly, including your name, photographs, logos, links and other material (&ldquo;Content&rdquo;). You give us a worldwide, royalty-free licence to host, display and serve your Content for the purpose of running the service, including showing your card to anyone who has its link and listing it in the Cardtly Network unless you switch that off.
            </p>
            <p>
              <B>A card is public by its link.</B> You are responsible for what you publish on it, and for having the right to use any photograph, logo or trademark that appears on it.
            </p>
          </Section>

          <Section id="nfc" title="8. Physical NFC cards">
            <p>
              You can order physical cards that open your Cardtly card when tapped against a phone. They are made to order with your details or branding, and delivered within South Africa only. The card works for as long as the Cardtly card it points to is live.
            </p>
            <p>
              If a card arrives damaged or does not work, email us. Nothing in these terms limits any right you have under the Consumer Protection Act 68 of 2008 or the Electronic Communications and Transactions Act 25 of 2002 that cannot lawfully be limited.
            </p>
          </Section>

          <Section id="apps" title="9. The mobile apps">
            <p>
              The Cardtly apps for Android and iOS give access to the same service as the website, and these terms apply to them. Some features, such as writing an NFC tag or saving a card to your phone&apos;s contacts, work only in an app.
            </p>
            <p>
              The Android app is distributed through Google Play and the iOS app through the Apple App Store, and each store&apos;s own terms also apply. For the iOS app, Apple&apos;s standard licensed application end user licence agreement applies; Apple is not a party to these terms and is not responsible for the app or its content.
            </p>
          </Section>

          <Section id="availability" title="10. Availability and changes to the service">
            <p>
              We work to keep Cardtly running but do not guarantee uninterrupted access. The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. We may carry out maintenance, release updates and change features at any time.
            </p>
          </Section>

          <Section id="termination" title="11. Suspension and termination">
            <p>
              You can delete your account at any time from your settings. Deleting it cancels any active subscription first, then removes your account and its data as our <a href="/privacy" className="underline" style={link}>Privacy Policy</a> describes. Export anything you want to keep beforehand.
            </p>
            <p>
              We may suspend or close your account if you break these terms, do not pay for a paid plan, or use the service in a way that exposes us to legal risk.
            </p>
          </Section>

          <Section id="liability" title="12. Disclaimers and liability">
            <p>
              To the maximum extent allowed by law, Cardtly is not liable for indirect, incidental or consequential damages arising from your use of the service. Our total liability for any claim is limited to the amount you paid us in the 12 months before the claim arose, or R1000, whichever is greater.
            </p>
            <p>
              We do not warrant that the service will be error-free, that defects will be corrected, or that it will meet your specific needs. Nothing in these terms excludes liability that cannot lawfully be excluded.
            </p>
          </Section>

          <Section id="indemnity" title="13. Indemnity">
            <p>
              You agree to indemnify Cardtly against any claim, loss or expense arising from your Content, your use of the service, or your breach of these terms.
            </p>
          </Section>

          <Section id="changes" title="14. Changes to these terms">
            <p>
              We may update these terms. The date at the top shows the last update. When a change is material we will email account holders and post a notice on the website. Continuing to use Cardtly after that means you accept the updated terms.
            </p>
          </Section>

          <Section id="law" title="15. Governing law">
            <p>
              These terms are governed by the laws of the Republic of South Africa. Any dispute is subject to the exclusive jurisdiction of the courts of South Africa.
            </p>
          </Section>

          <Section id="contact" title="16. Contact">
            <p>
              Cardtly<br />
              South Africa<br />
              <a href="mailto:andre@cardtly.com" className="underline" style={link}>andre@cardtly.com</a>
            </p>
          </Section>

        </div>
      </section>

      <Footer />
    </div>
  )
}
