import type { Metadata } from 'next'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Cardtly collects, uses, and protects your personal information.',
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

export default function PrivacyPage() {
  return (
    <div style={{ background: '#000', color: '#fff' }}>
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-12 px-6 text-center relative overflow-hidden">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[120px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.12) 0%, rgba(124,58,237,0.08) 50%, transparent 70%)' }}
        />
        <div className="relative max-w-3xl mx-auto">
          <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#00d4ff' }}>Legal</p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6">
            Privacy <span style={gradText}>Policy</span>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            How we collect, use, and protect your personal information.
          </p>
          <p className="text-sm mt-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Last updated: 20 May 2026
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="pb-24 px-6">
        <div className="max-w-3xl mx-auto">

          <Section title="1. Who we are">
            <p>
              Cardtly is a digital business card platform registered in South Africa. We are the data controller for the personal information described in this policy.
            </p>
            <p>
              For any privacy questions, contact us at <a href="mailto:andre@cardtly.com" className="underline" style={{ color: '#00d4ff' }}>andre@cardtly.com</a>.
            </p>
          </Section>

          <Section title="2. What we collect">
            <p><strong className="text-white">Account information.</strong> When you sign up we collect your name, email address, and a hashed password.</p>
            <p><strong className="text-white">Card content.</strong> Anything you put on your business card is stored by us, including your job title, company, phone number, WhatsApp number, business address, website, profile photo, company logo, bio, certifications, and social media links. This information is published at your card URL and is intentionally public.</p>
            <p><strong className="text-white">Contacts you collect.</strong> When someone uses the Save Contact button or fills out a lead form on your card, their name, email, phone number, and any message they send are stored in your Cardtly contacts list so you can follow up with them.</p>
            <p><strong className="text-white">Payment information.</strong> If you subscribe to Cardtly Pro, our payment processor Paystack handles your card details directly. We never see or store your card number. We only store your subscription tier, status, and a Paystack customer identifier.</p>
            <p><strong className="text-white">Usage data.</strong> We log basic interaction data such as card view counts, page requests, IP address, browser type, and approximate location at country level. This helps us run the service and show you analytics on your own card.</p>
            <p><strong className="text-white">Device and app data.</strong> If you use the Cardtly Android app, we collect the same data as above plus your device model, Android version, and a Play install identifier. We do not access your phone contacts, photos, camera, or NFC tags unless you explicitly tap a feature that needs them.</p>
            <p><strong className="text-white">Cookies.</strong> We use first-party cookies for authentication and to remember your settings. We do not use third-party advertising cookies.</p>
          </Section>

          <Section title="3. How we use your information">
            <ul className="list-disc pl-6 space-y-2">
              <li>To create your account and serve your business card to the public.</li>
              <li>To process subscription payments and manage your Pro plan.</li>
              <li>To send transactional emails such as sign-up confirmations, password resets, and billing receipts.</li>
              <li>To show you analytics about how your card is being viewed.</li>
              <li>To improve the product based on aggregated usage patterns.</li>
              <li>To respond to support requests.</li>
              <li>To prevent fraud, abuse, and security incidents.</li>
              <li>To meet our legal obligations.</li>
            </ul>
            <p>
              We do not sell your personal information. We do not use it to train AI models. We do not show you third-party advertising.
            </p>
          </Section>

          <Section title="4. Who we share data with">
            <p>We use a small number of trusted service providers to run Cardtly. Each one is named below with a link to their own privacy policy.</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">Supabase</strong> hosts our database and handles authentication. <a className="underline" href="https://supabase.com/privacy" style={{ color: '#00d4ff' }}>supabase.com/privacy</a></li>
              <li><strong className="text-white">Vercel</strong> hosts the website and serves card pages. <a className="underline" href="https://vercel.com/legal/privacy-policy" style={{ color: '#00d4ff' }}>vercel.com/legal/privacy-policy</a></li>
              <li><strong className="text-white">Paystack</strong> processes subscription payments. <a className="underline" href="https://paystack.com/privacy" style={{ color: '#00d4ff' }}>paystack.com/privacy</a></li>
              <li><strong className="text-white">Resend</strong> delivers transactional email from hello@cardtly.com. <a className="underline" href="https://resend.com/legal/privacy-policy" style={{ color: '#00d4ff' }}>resend.com/legal/privacy-policy</a></li>
              <li><strong className="text-white">Google Play</strong> if you install our Android app, Google may collect install and crash data subject to their own policy.</li>
            </ul>
            <p>
              We may also disclose information when required by law, to enforce our terms of service, or to protect the rights, property, or safety of Cardtly, our users, or others.
            </p>
          </Section>

          <Section title="5. International transfers">
            <p>
              Our service providers operate data centres in multiple countries, including the United States and the European Union. By using Cardtly you understand that your information may be processed outside of South Africa. Where the law requires it, we rely on standard contractual clauses and equivalent safeguards to protect your data during these transfers.
            </p>
          </Section>

          <Section title="6. How long we keep your data">
            <p>
              We keep your account and card data for as long as your Cardtly account is active. If you delete your account we remove your personal information from our active systems within 30 days, except where we are required to keep it for legal, tax, or fraud-prevention reasons.
            </p>
            <p>
              Backups are retained for up to 90 days before being permanently deleted.
            </p>
          </Section>

          <Section title="7. Your rights">
            <p>
              Depending on where you live, you have the following rights over your personal information:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">Access.</strong> Ask us for a copy of the data we hold about you.</li>
              <li><strong className="text-white">Correction.</strong> Ask us to fix data that is inaccurate or incomplete.</li>
              <li><strong className="text-white">Deletion.</strong> Ask us to delete your account and personal information.</li>
              <li><strong className="text-white">Portability.</strong> Ask us for your data in a machine-readable format.</li>
              <li><strong className="text-white">Objection.</strong> Object to certain types of processing.</li>
              <li><strong className="text-white">Withdraw consent.</strong> Withdraw consent at any time where processing is based on consent.</li>
              <li><strong className="text-white">Complain.</strong> Lodge a complaint with the South African Information Regulator (inforegulator.org.za) or your local data protection authority.</li>
            </ul>
            <p>
              To exercise any of these rights, email <a href="mailto:andre@cardtly.com" className="underline" style={{ color: '#00d4ff' }}>andre@cardtly.com</a>. We respond within 30 days.
            </p>
            <p>
              You can also delete your account at any time from <a href="/dashboard/settings" className="underline" style={{ color: '#00d4ff' }}>Dashboard, Settings</a>.
            </p>
          </Section>

          <Section title="8. Security">
            <p>
              We protect your data with encryption in transit (HTTPS everywhere), encryption at rest (Supabase managed Postgres), hashed passwords (handled by Supabase Auth), and strict access controls inside our team. No system is perfectly secure, but we take reasonable steps to keep your information safe.
            </p>
            <p>
              If we ever become aware of a data breach that affects you, we will notify you and the relevant regulators as required by law.
            </p>
          </Section>

          <Section title="9. Children">
            <p>
              Cardtly is built for adults using it as a professional networking tool. We do not knowingly collect personal information from anyone under the age of 18. If you believe a child has created an account, contact us and we will delete it.
            </p>
          </Section>

          <Section title="10. Android app permissions">
            <p>
              When you install the Cardtly Android app it may request the following permissions. Each one is optional and is only used for the feature it describes.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">NFC.</strong> Used so you can tap a blank NFC tag to write your card URL to it, or read a Cardtly NFC tag someone hands you. We do not scan tags in the background.</li>
              <li><strong className="text-white">Contacts.</strong> Used only when you tap Save Contact, so we can add the card you are viewing to your phone address book. We never read your existing contacts.</li>
              <li><strong className="text-white">Internet.</strong> Required so the app can talk to our servers.</li>
              <li><strong className="text-white">Camera.</strong> Optional, used only if you choose to update your profile photo from inside the app.</li>
            </ul>
          </Section>

          <Section title="11. Changes to this policy">
            <p>
              We may update this policy from time to time. When we make material changes we will email registered users and display a notice on the website. Continued use of Cardtly after a change means you accept the updated policy.
            </p>
          </Section>

          <Section title="12. Contact us">
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
