import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'

export const metadata: Metadata = {
  title: 'Delete your Cardtly account',
  description: 'How to delete your Cardtly account and what happens to your data.',
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

export default function DeleteAccountPage() {
  return (
    <div style={{ background: '#000', color: '#fff' }}>
      <Navbar />

      <section className="pt-32 pb-12 px-6 text-center relative overflow-hidden">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[120px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.12) 0%, rgba(124,58,237,0.08) 50%, transparent 70%)' }}
        />
        <div className="relative max-w-3xl mx-auto">
          <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#00d4ff' }}>Account</p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6">
            Delete your <span style={gradText}>Cardtly account</span>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            How to permanently remove your account and what happens to your data.
          </p>
          <p className="text-sm mt-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Last updated: 20 May 2026
          </p>
        </div>
      </section>

      <section className="pb-24 px-6">
        <div className="max-w-3xl mx-auto">

          <Section title="Option 1. Delete it yourself from the app or website">
            <p>This is the fastest way and it removes your data immediately.</p>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Open the Cardtly Android app, or go to <a href="https://cardtly.com/login" className="underline" style={{ color: '#00d4ff' }}>cardtly.com/login</a> in a browser, and sign in.</li>
              <li>Go to <strong className="text-white">Dashboard, Settings</strong>.</li>
              <li>Click the <strong className="text-white">Danger zone</strong> tab.</li>
              <li>Click <strong className="text-white">Delete account</strong>.</li>
              <li>Type your email address to confirm.</li>
              <li>Click <strong className="text-white">Yes, delete my account</strong>.</li>
            </ol>
            <p>You will be signed out and your account will be removed immediately.</p>
          </Section>

          <Section title="Option 2. Email us a deletion request">
            <p>Use this if you cannot sign in, you have lost access to your email, or you would prefer that we handle it for you.</p>
            <p>
              Send an email to <a href="mailto:andre@cardtly.com" className="underline" style={{ color: '#00d4ff' }}>andre@cardtly.com</a> from the address associated with your Cardtly account, with the subject line <strong className="text-white">Delete my account</strong>.
            </p>
            <p>
              We will verify the request and complete the deletion within 7 working days. We may ask one verification question to confirm you own the account before proceeding.
            </p>
          </Section>

          <Section title="What is deleted">
            <p>When your account is deleted we remove the following from our active systems:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your account credentials (email, hashed password).</li>
              <li>All cards you have created and everything on them (name, title, photos, logos, links, bio, certifications, contact details).</li>
              <li>The contacts you have collected through your card.</li>
              <li>Your subscription record and Paystack customer reference.</li>
              <li>Any team or organisation you own as admin, along with the team cards inside it.</li>
              <li>Any NFC orders linked to your account.</li>
              <li>Your profile.</li>
            </ul>
          </Section>

          <Section title="What may be retained briefly">
            <p>We retain a small amount of data for the reasons below. Retention is short and the data is not used to contact you or to power the service.</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">Encrypted backups</strong> are kept for up to 90 days before being permanently deleted.</li>
              <li><strong className="text-white">Anonymised analytics</strong> such as aggregated view counts may persist indefinitely. These contain no information that can identify you.</li>
              <li><strong className="text-white">Billing records</strong> required by South African tax law (invoices, transaction history) are kept for the minimum legal retention period.</li>
              <li><strong className="text-white">Public card URLs</strong> that someone else has bookmarked will return a 404 once your account is deleted. We do not keep a copy of the card content after deletion.</li>
            </ul>
          </Section>

          <Section title="Cancel a Pro subscription first (optional)">
            <p>
              If you have an active Pro subscription, cancelling before you delete your account stops Paystack from billing you again. You can cancel from <strong className="text-white">Dashboard, Settings, Subscription</strong>. Deleting your account also cancels the subscription, but cancelling first is cleaner if you have a renewal coming up soon.
            </p>
          </Section>

          <Section title="Questions">
            <p>
              For anything related to deletion or privacy, contact us at <a href="mailto:andre@cardtly.com" className="underline" style={{ color: '#00d4ff' }}>andre@cardtly.com</a>. You can also read our full <Link href="/privacy" className="underline" style={{ color: '#00d4ff' }}>Privacy Policy</Link>.
            </p>
          </Section>

        </div>
      </section>

      <Footer />
    </div>
  )
}
