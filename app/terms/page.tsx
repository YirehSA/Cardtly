import type { Metadata } from 'next'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms you agree to when using Cardtly: your account and card, billing in rand, free trials, cancellation, and how the service is run.',
  // The root layout deliberately omits a canonical so it cannot point every
  // page at the homepage, which means pages without one have none at all.
  alternates: { canonical: '/terms' },
}

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-8 md:p-10 rounded-3xl mb-6" style={sectionStyle}>
      <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-5">{title}</h2>
      <div className="space-y-4 text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
        {children}
      </div>
    </div>
  )
}

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
            Last updated: 20 May 2026
          </p>
        </div>
      </section>

      <section className="pb-24 px-6">
        <div className="max-w-3xl mx-auto">

          <Section title="1. Acceptance">
            <p>
              These Terms of Service govern your use of Cardtly, a digital business card platform operated by Cardtly, a company registered in South Africa. By creating an account or using the service you agree to these terms. If you do not agree, do not use the service.
            </p>
          </Section>

          <Section title="2. Your account">
            <p>
              You must be at least 18 years old to use Cardtly. You are responsible for keeping your password safe and for everything that happens under your account. Notify us immediately at andre@cardtly.com if you suspect any unauthorised access.
            </p>
            <p>
              You agree to provide accurate information when you sign up and to keep it current.
            </p>
          </Section>

          <Section title="3. Acceptable use">
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use Cardtly for anything illegal, fraudulent, or harmful.</li>
              <li>Impersonate another person or business.</li>
              <li>Upload content that is defamatory, obscene, or infringes someone else&apos;s rights.</li>
              <li>Send spam, phishing attempts, or unsolicited marketing through Cardtly.</li>
              <li>Attempt to break, probe, or interfere with our infrastructure.</li>
              <li>Scrape or automate access to the service without our written permission.</li>
              <li>Resell or repackage the service as your own.</li>
            </ul>
            <p>
              We may suspend or terminate accounts that violate these rules without notice.
            </p>
          </Section>

          <Section title="4. Your content">
            <p>
              You keep ownership of everything you put on your Cardtly card, including your name, photos, logos, links, and any other content (your &quot;Content&quot;). By uploading Content you grant Cardtly a worldwide, royalty-free licence to host, display, and serve that Content for the purpose of running the service.
            </p>
            <p>
              You are responsible for the Content you publish. Make sure you have the right to use any logos, photos, or trademarks that appear on your card.
            </p>
          </Section>

          <Section title="5. Subscriptions and payment">
            <p>
              Creating an account and building a card requires no payment details. A paid subscription is required to make your card live and keep it live. Free trial periods are offered at our discretion, usually by way of a trial code, and the length of any trial is the period stated when the code is issued. Subscriptions are billed in advance on a monthly or annual cycle through our payment processor Paystack. By subscribing you authorise Paystack to charge your card on each billing cycle until you cancel.
            </p>
            <p>
              You can cancel at any time from your account settings. Cancellation takes effect at the end of the current billing period. We do not offer refunds for partial periods, except where required by law.
            </p>
            <p>
              We may change subscription prices with 30 days&apos; written notice to active subscribers. Continued use after a price change means you accept the new price.
            </p>
            <p>
              If a payment fails we will attempt to retry. If we cannot collect payment within a reasonable period your card may be suspended and paid features will become inaccessible. Your content is retained so that your card can be restored if you resubscribe.
            </p>
          </Section>

          <Section title="6. Mobile app">
            <p>
              The Cardtly Android app provides access to the same service as the website. Some features such as NFC tag writing and saving contacts to your phone are only available in the app. Subscriptions purchased on cardtly.com apply equally to the app and the web.
            </p>
            <p>
              The app is distributed through Google Play and is subject to Google&apos;s terms in addition to ours.
            </p>
          </Section>

          <Section title="7. Service availability">
            <p>
              We work hard to keep Cardtly running but we do not guarantee uninterrupted access. The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. We may perform maintenance, release updates, or change features at any time.
            </p>
          </Section>

          <Section title="8. Termination">
            <p>
              You may delete your account at any time from your settings page. We may suspend or terminate your account if you violate these terms, fail to pay for a paid plan, or use the service in a way that puts us at legal risk.
            </p>
            <p>
              On termination we will delete your personal information in line with our <a href="/privacy" className="underline" style={{ color: '#00d4ff' }}>Privacy Policy</a>.
            </p>
          </Section>

          <Section title="9. Disclaimers and liability">
            <p>
              To the maximum extent allowed by law, Cardtly is not liable for indirect, incidental, or consequential damages arising from your use of the service. Our total liability for any claim is limited to the amount you paid us in the 12 months before the claim arose, or R1000, whichever is greater.
            </p>
            <p>
              We do not warrant that the service will be error-free, that defects will be corrected, or that the service will meet your specific needs.
            </p>
          </Section>

          <Section title="10. Indemnity">
            <p>
              You agree to indemnify Cardtly against any claim, loss, or expense arising from your Content, your use of the service, or your breach of these terms.
            </p>
          </Section>

          <Section title="11. Changes to these terms">
            <p>
              We may update these terms from time to time. When we make material changes we will email registered users and post a notice on the website. Continued use of Cardtly after a change means you accept the updated terms.
            </p>
          </Section>

          <Section title="12. Governing law">
            <p>
              These terms are governed by the laws of the Republic of South Africa. Any dispute will be subject to the exclusive jurisdiction of the courts of South Africa.
            </p>
          </Section>

          <Section title="13. Contact">
            <p>
              Cardtly<br />
              South Africa<br />
              <a href="mailto:andre@cardtly.com" className="underline" style={{ color: '#00d4ff' }}>andre@cardtly.com</a>
            </p>
          </Section>

        </div>
      </section>

      <Footer />
    </div>
  )
}
