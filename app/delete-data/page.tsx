import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'

export const metadata: Metadata = {
  title: 'Delete specific data from Cardtly',
  description: 'How to delete parts of your Cardtly data without deleting your whole account.',
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

export default function DeleteDataPage() {
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
            Delete <span style={gradText}>specific data</span>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            How to delete parts of your Cardtly data without deleting your whole account.
          </p>
          <p className="text-sm mt-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Last updated: 20 May 2026
          </p>
        </div>
      </section>

      <section className="pb-24 px-6">
        <div className="max-w-3xl mx-auto">

          <Section title="Overview">
            <p>
              You can delete most of your Cardtly data piece by piece from inside the app or website, without losing your account. This page lists the categories of data you can remove on your own and the steps to do it. If you want to delete your whole account instead, see <Link href="/delete-account" className="underline" style={{ color: '#00d4ff' }}>Delete your account</Link>.
            </p>
          </Section>

          <Section title="Edit or clear fields on your card">
            <p>Every piece of personal information on your card can be edited or cleared at any time.</p>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Open the Cardtly Android app, or go to <a href="https://cardtly.com/login" className="underline" style={{ color: '#00d4ff' }}>cardtly.com/login</a>, and sign in.</li>
              <li>Go to <strong className="text-white">Dashboard, My Card</strong>.</li>
              <li>Clear any field you no longer want public (name, title, company, phone, WhatsApp, address, website, bio, certifications, social links).</li>
              <li>Click <strong className="text-white">Save</strong>.</li>
            </ol>
            <p>Cleared fields are removed from the public card URL immediately and are not retained in our active database.</p>
          </Section>

          <Section title="Remove your profile photo or company logo">
            <ol className="list-decimal pl-6 space-y-2">
              <li>Go to <strong className="text-white">Dashboard, My Card</strong>.</li>
              <li>Click the image you want to remove.</li>
              <li>Click <strong className="text-white">Remove</strong>.</li>
              <li>Save the card.</li>
            </ol>
            <p>The image is deleted from our storage and replaced with a placeholder on your public card.</p>
          </Section>

          <Section title="Delete a card (Pro users with multiple cards)">
            <p>If you have a Pro plan and have created more than one card, you can delete any card you no longer want.</p>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Go to <strong className="text-white">Dashboard, My Card</strong>.</li>
              <li>Switch to the card you want to delete.</li>
              <li>Click <strong className="text-white">Delete card</strong>.</li>
              <li>Confirm.</li>
            </ol>
            <p>The card, its public URL, and all contacts collected through it are deleted immediately.</p>
          </Section>

          <Section title="Delete contacts that have been collected through your card">
            <p>When someone uses the Save Contact button or fills out the lead form on your card, their details are added to your Contacts list. You can delete any of these contacts at any time.</p>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Go to <strong className="text-white">Dashboard, Contacts</strong>.</li>
              <li>Find the contact you want to remove.</li>
              <li>Click the delete icon next to that row.</li>
              <li>Confirm.</li>
            </ol>
            <p>The contact and any message they sent through the lead form is deleted from our active systems immediately.</p>
          </Section>

          <Section title="Cancel a Pro subscription">
            <p>Cancelling stops Paystack from billing you again. Your account and card stay live on the free tier.</p>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Go to <strong className="text-white">Dashboard, Settings, Subscription</strong>.</li>
              <li>Click <strong className="text-white">Manage subscription</strong>.</li>
              <li>Cancel through the Paystack portal.</li>
            </ol>
            <p>Cancellation takes effect at the end of the current billing period. We do not retain your Paystack card details. Paystack manages those on their side, subject to <a className="underline" href="https://paystack.com/privacy" style={{ color: '#00d4ff' }}>their privacy policy</a>.</p>
          </Section>

          <Section title="Email a deletion request for anything else">
            <p>For data you cannot delete from the app yourself (such as analytics, server logs, or backup records), email us and we will handle it.</p>
            <p>
              Send an email to <a href="mailto:andre@cardtly.com" className="underline" style={{ color: '#00d4ff' }}>andre@cardtly.com</a> from your Cardtly account email. Tell us exactly which data you want removed. We respond within 30 days, usually much sooner.
            </p>
          </Section>

          <Section title="What we retain after partial deletion">
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">Encrypted backups</strong> may contain the deleted data for up to 90 days before being permanently rotated out.</li>
              <li><strong className="text-white">Anonymised analytics</strong> such as aggregated view counts persist, but contain no information that can identify you.</li>
              <li><strong className="text-white">Billing records</strong> we must keep for South African tax law are retained for the legally required period.</li>
            </ul>
          </Section>

          <Section title="Questions">
            <p>
              For anything related to deletion or privacy, contact us at <a href="mailto:andre@cardtly.com" className="underline" style={{ color: '#00d4ff' }}>andre@cardtly.com</a>. You can also read our full <Link href="/privacy" className="underline" style={{ color: '#00d4ff' }}>Privacy Policy</Link> or our <Link href="/delete-account" className="underline" style={{ color: '#00d4ff' }}>full account deletion guide</Link>.
            </p>
          </Section>

        </div>
      </section>

      <Footer />
    </div>
  )
}
