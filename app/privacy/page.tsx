import type { Metadata } from 'next'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'

export const metadata: Metadata = {
  title: 'Privacy Policy: How We Handle Your Data',
  description:
    'How Cardtly collects, uses and protects personal information under POPIA: what we store, who processes it, where it is kept, and how to export or delete it.',
  alternates: { canonical: '/privacy' },
}

// EVERY FACTUAL STATEMENT ON THIS PAGE WAS CHECKED AGAINST THE CODE on
// 2026-09-23, and corporate procurement and legal teams read it as a
// representation, so keep it that way. Before changing a line, find the code
// that makes it true. Before adding a service to the app, add it to section 7.
//
// What the audit found wrong in the previous version, so nobody reintroduces
// it: OpenAI (card scanning, the bio writer), ipapi.co (signup location) and
// Firebase Analytics (Android app) were all live and all undisclosed; signup
// location was described as "country level" when it is city; deletion was
// described as "within 30 days" when it is immediate; and uploaded photos
// survived account deletion entirely (fixed in app/api/account/delete).
//
// This page is reachable INSIDE THE iOS APP - it is not on IOS_BLOCKED_ROUTES
// and must not be, because Apple requires it. So: no prices, and no links to
// pricing, checkout, /nfc, /signup or /blog (all blocked in the app).

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

/** A plain two-or-three column table that reads on a phone. */
function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {head.map(h => (
              <th key={h} className="text-left font-bold text-white px-2 py-2 align-bottom" style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="px-2 py-2.5 align-top" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const CONTENTS: [string, string][] = [
  ['who', 'Who we are'],
  ['roles', 'The two roles we play under POPIA'],
  ['collect', 'What we collect'],
  ['use', 'Why we use it'],
  ['public', 'Your public card and the Cardtly Network'],
  ['teams', 'Team accounts'],
  ['share', 'Who processes it for us'],
  ['where', 'Where it is stored'],
  ['keep', 'How long we keep it'],
  ['rights', 'Your rights'],
  ['security', 'Security and breaches'],
  ['marketing', 'Emails and direct marketing'],
  ['apps', 'The mobile apps'],
  ['children', 'Children'],
  ['changes', 'Changes to this policy'],
  ['contact', 'Contact and the Information Officer'],
]

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
            How we collect, use and protect personal information, written to meet the Protection of Personal Information Act (POPIA).
          </p>
          <p className="text-sm mt-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Last updated: 23 September 2026
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="pb-24 px-6">
        <div className="max-w-3xl mx-auto">

          {/* Contents. A policy this long is read by legal and procurement
              teams hunting for one answer, not front to back. */}
          <nav aria-label="Contents" className="p-8 md:p-10 rounded-3xl mb-6" style={sectionStyle}>
            <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>Contents</p>
            <ol className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm list-decimal pl-5" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {CONTENTS.map(([id, label]) => (
                <li key={id}><a href={`#${id}`} className="hover:underline">{label}</a></li>
              ))}
            </ol>
          </nav>

          <Section id="who" title="1. Who we are">
            <p>
              Cardtly is a South African digital business card platform. This policy explains how we handle personal information about the people who use Cardtly, the people who view and interact with Cardtly cards, and the people whose details are captured through them.
            </p>
            <p>
              We process personal information in line with the Protection of Personal Information Act 4 of 2013 (POPIA). Questions about this policy, or requests about your information, go to our Information Officer at{' '}
              <a href="mailto:andre@cardtly.com" className="underline" style={link}>andre@cardtly.com</a>.
            </p>
          </Section>

          <Section id="roles" title="2. The two roles we play under POPIA">
            <p>
              POPIA separates the <B>responsible party</B>, who decides why and how personal information is processed, from the <B>operator</B>, who processes it on someone else&apos;s behalf. Cardtly is one or the other depending on whose information it is, and this is the single most useful thing for an organisation to understand before using us.
            </p>
            <Table
              head={['Information', 'Responsible party', 'Cardtly is']}
              rows={[
                ['Your own account, login and billing details', 'Cardtly', 'The responsible party'],
                ['Contacts, leads and requests captured through your card', 'You, the card owner', 'Your operator'],
                ['Employees’ cards and details on a team account', 'The organisation', 'Its operator'],
                ['Leads captured by employees on a team account', 'The organisation', 'Its operator'],
              ]}
            />
            <p>
              Where we act as your operator, we process that information only to run the service for you, and our obligations to you are set out in the data protection section of our{' '}
              <a href="/terms#data-protection" className="underline" style={link}>Terms of Service</a>.
              You remain responsible for having a lawful reason to collect it and for telling people how you will use it.
            </p>
          </Section>

          <Section id="collect" title="3. What we collect">
            <p><B>Account information.</B> Your name, email address and a password, which is stored only as a one-way hash by our authentication provider. We never see or keep your password itself.</p>
            <p><B>Where you signed up from.</B> When you create an account we look up the approximate city, region and country of your internet connection, using the IP address it arrived from, and store that on your profile. The lookup is done by ipapi.co (see section 7). We do not store the IP address itself on your profile.</p>
            <p><B>Card content.</B> Everything you put on your card: name, job title, company, phone and WhatsApp numbers, email, address, website, bio, photographs, logos, gallery images and captions, links and social profiles. This is published at your card&apos;s address and is public by design (see section 5).</p>
            <p><B>People who view your card.</B> When someone opens a card or taps something on it, we record that it happened, which link or button they used, their device type, browser and operating system, and the website that sent them, reduced to the site&apos;s address rather than the full page. <B>We do not store the IP address of people who view a card.</B> To count unique visitors we derive a one-way code from the connection and browser that is different for every card and changes every day, so it cannot be used to follow a person between cards or from one day to the next.</p>
            <p><B>Details people submit through a card.</B> When a visitor saves your contact and shares their own, fills in a lead form, requests a meeting, or answers a questionnaire, we store what they submit (typically their name, email, phone number, company and message) so that you can follow up.</p>
            <p><B>Team account information.</B> For organisations: the organisation&apos;s details, its companies and departments, which fields are locked, the cards issued to staff, and any sales activity that staff choose to record in the activity log (the company, contact and subject of an email, LinkedIn contact or networking event).</p>
            <p><B>Payment information.</B> Card payments are handled by Paystack. We never see or store your card number. We keep your subscription status, a Paystack customer reference, and the email used for billing. Organisations invoiced directly also have their invoices, quotes and billing contact stored with us.</p>
            <p><B>Physical NFC card orders.</B> If you order a physical card, we store your name, delivery address and phone number so that it can be made and delivered.</p>
            <p><B>AI features.</B> If you use the bio writer, the details you give it are sent to generate a suggestion. If you scan a paper business card, the photograph is sent to be read, and the details on it are returned to you as a contact. Both are processed by OpenAI (see section 7).</p>
            <p><B>Cookies and similar storage.</B> We use first-party cookies to keep you signed in and to remember your settings, and your browser&apos;s local storage to avoid counting the same card view twice. We do not use advertising cookies or third-party tracking cookies on our website.</p>
            <p><B>The mobile apps.</B> See section 13.</p>
          </Section>

          <Section id="use" title="4. Why we use it">
            <p>POPIA requires a lawful reason for processing. These are ours:</p>
            <Table
              head={['Purpose', 'Lawful reason']}
              rows={[
                ['Creating your account and publishing your card', 'Needed to provide the service you signed up for'],
                ['Storing and showing you the contacts your card captures', 'Needed to provide the service, as your operator'],
                ['Taking payment and managing subscriptions', 'Needed to provide the service'],
                ['Service emails such as password resets, trial reminders, payment notices and new-lead alerts', 'Needed to provide the service'],
                ['Showing you views, taps and saves on your own card', 'Needed to provide the service'],
                ['Recording signup location, and preventing fraud and abuse', 'Our legitimate interest in running a secure service'],
                ['Improving the product from patterns across many accounts', 'Our legitimate interest'],
                ['The AI bio writer and card scanning', 'You choose to use them each time'],
                ['Keeping records the law requires', 'Legal obligation'],
              ]}
            />
            <p>
              We do not sell personal information. We do not use it for advertising. We do not use your information, or information captured through your card, to train AI models. We do not make decisions about anyone based solely on automated processing.
            </p>
          </Section>

          <Section id="public" title="5. Your public card and the Cardtly Network">
            <p>
              <B>A card is public by its link.</B> Anyone who has your card&apos;s address can see what is on it, exactly as if they had been handed a printed card. Put nothing on a card that you would not print on one. In particular, do not put special personal information (such as health, religion or political views) or information about children on a card.
            </p>
            <p>
              <B>Cards are listed in the Cardtly Network by default.</B> The Network is a public directory of Cardtly cards. You can remove your card from it at any time in your card settings, and an organisation can remove every card on its team account at once.
            </p>
            <p>
              <B>Being featured on our home page is opt-in.</B> We only feature a card there if its owner has switched that on.
            </p>
            <p>
              What is <B>not</B> public: who viewed your card, who saved it, the contacts it captured, and anything in your account or dashboard.
            </p>
          </Section>

          <Section id="teams" title="6. Team accounts">
            <p>
              When an organisation gives its staff Cardtly cards, the organisation is the responsible party for those cards and for the leads they capture, and Cardtly is its operator. In practice this means:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>The organisation&apos;s administrators can see and edit the team&apos;s cards, see the contacts those cards capture, see card analytics, and see the activity log staff choose to record.</li>
              <li>Administrators decide which details on a card staff may change and which are fixed.</li>
              <li>When someone leaves, the organisation keeps the card and the contacts it captured. It can archive the card, which takes it offline, or reissue it to someone else.</li>
              <li>Staff with questions about how their employer uses this information should start with their employer, who can also exercise the rights in section 10 on their behalf.</li>
            </ul>
          </Section>

          <Section id="share" title="7. Who processes it for us">
            <p>
              We use a small number of service providers to run Cardtly. Each is bound by its own published data protection terms and receives only what it needs for the job below.
            </p>
            <Table
              head={['Provider', 'What it does', 'What it receives']}
              rows={[
                [<B key="s">Supabase</B>, 'Database, sign-in and file storage', 'Everything in section 3 that we store'],
                [<B key="v">Vercel</B>, 'Hosts the website and serves cards', 'Requests to the site, including IP addresses in its request logs'],
                [<B key="p">Paystack</B>, 'Card payments (South Africa)', 'Billing email and payment details you enter with Paystack'],
                [<B key="r">Resend</B>, 'Sends our email, from hello@cardtly.com', 'Recipient address and the content of the email'],
                [<B key="o">OpenAI</B>, 'The AI bio writer and paper card scanning', 'What you give the bio writer; the photograph of a card you scan'],
                [<B key="i">ipapi.co</B>, 'Signup location lookup', 'The IP address a new account was created from'],
                [<B key="g">Google</B>, 'Google Wallet passes; Firebase Analytics in the Android app; Google Play', 'A card’s public details when a visitor chooses to save it to Google Wallet; app usage and device data from the Android app'],
                [<B key="a">Apple</B>, 'App Store', 'What Apple collects under its own terms when you install the iOS app'],
              ]}
            />
            <p>
              OpenAI states that it does not use data sent through its API to train its models. Links to each provider&apos;s own policy:{' '}
              <a className="underline" href="https://supabase.com/privacy" style={link}>Supabase</a>,{' '}
              <a className="underline" href="https://vercel.com/legal/privacy-policy" style={link}>Vercel</a>,{' '}
              <a className="underline" href="https://paystack.com/privacy" style={link}>Paystack</a>,{' '}
              <a className="underline" href="https://resend.com/legal/privacy-policy" style={link}>Resend</a>,{' '}
              <a className="underline" href="https://openai.com/policies/privacy-policy" style={link}>OpenAI</a>,{' '}
              <a className="underline" href="https://ipapi.co/privacy/" style={link}>ipapi.co</a>,{' '}
              <a className="underline" href="https://policies.google.com/privacy" style={link}>Google</a>,{' '}
              <a className="underline" href="https://www.apple.com/legal/privacy/" style={link}>Apple</a>.
            </p>
            <p>
              <B>We will update this list, and the date at the top of this page, before a new provider starts processing personal information for us.</B>
            </p>
            <p>
              We may also disclose information where the law requires it, to enforce our Terms of Service, or to protect the rights, property or safety of Cardtly, our users or others.
            </p>
          </Section>

          <Section id="where" title="8. Where it is stored">
            <p>
              <B>Our database and uploaded files are hosted by Supabase in its West Europe region, in the European Union.</B> Personal information stored by Cardtly is therefore processed outside South Africa. Our other providers may process the information they receive in other countries, including the United States, and our website is served through a global network.
            </p>
            <p>
              POPIA section 72 allows this where the recipient is bound by law or binding rules that give protection substantially similar to POPIA&apos;s, or where the transfer is needed to provide the service you asked for. We rely on both. The European Union&apos;s General Data Protection Regulation is at least as strict as POPIA.
            </p>
            <p>
              <B>If your organisation requires personal information to be stored only in South Africa,</B> tell us before you sign up. That is not something we offer as standard today.
            </p>
          </Section>

          <Section id="keep" title="9. How long we keep it">
            <Table
              head={['Information', 'Kept until']}
              rows={[
                ['Account and card', 'You delete your account'],
                ['Contacts captured through a card', 'You delete them, or delete the account'],
                ['Card view and tap records', 'You delete the account'],
                ['Team cards and team leads', 'The organisation deletes them, or its account'],
                ['Uploaded photographs and logos', 'You delete the account. A picture you replace is kept until then, at an address that is not shown anywhere'],
                ['Encrypted database backups', 'Overwritten within 90 days'],
              ]}
            />
            <p>
              <B>Deleting your account is immediate.</B> It removes your account, cards, the contacts they captured, any organisation you own with its team cards, your orders and subscription records, and the photographs and logos you uploaded, from our live systems straight away. Copies can remain in encrypted backups until those are overwritten, within 90 days, and are not used for anything in the meantime.
            </p>
            <p>
              We may keep a record for longer where the law requires it, for example for tax. Paystack keeps its own record of the payments you made, under its own obligations.
            </p>
          </Section>

          <Section id="rights" title="10. Your rights">
            <p>Under POPIA you may:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><B>Access</B> the personal information we hold about you, and ask who it has been shared with.</li>
              <li><B>Correct</B> it if it is wrong or incomplete, or <B>delete</B> it.</li>
              <li><B>Object</B> to processing based on our legitimate interest, and to direct marketing.</li>
              <li><B>Withdraw consent</B> where processing is based on consent.</li>
              <li><B>Complain</B> to the Information Regulator at{' '}
                <a className="underline" href="https://inforegulator.org.za" style={link}>inforegulator.org.za</a>.</li>
            </ul>
            <p>
              <B>Export and deletion are self-service.</B> In{' '}
              <a href="/dashboard/settings" className="underline" style={link}>Dashboard, Settings</a>,
              under Account, &ldquo;Download my data&rdquo; gives you everything we hold about your account as a machine-readable JSON file: your profile, cards, organisations, the contacts your cards captured, orders, bookings and billing history. Security tokens and payment authorisation codes are redacted, because they are credentials rather than information about you. Deletion is on the same screen, and cancels any active subscription before anything is removed. There are also{' '}
              <a href="/delete-account" className="underline" style={link}>instructions for deleting an account</a> that you can read without signing in.
            </p>
            <p>
              <B>If a Cardtly user captured your details</B>, that user or their organisation is the responsible party. You can ask them directly, or email us and we will pass your request on and help them deal with it.
            </p>
            <p>
              For anything else, email <a href="mailto:andre@cardtly.com" className="underline" style={link}>andre@cardtly.com</a>. We respond within 30 days, and may need to confirm your identity first.
            </p>
          </Section>

          <Section id="security" title="11. Security and breaches">
            <p>What protects the information we hold:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><B>Access enforced by the database.</B> Row-level security in the database itself refuses one customer&apos;s records to anyone else, so a fault in the website cannot expose them. Which columns a signed-in user may change is restricted in the database too.</li>
              <li><B>Encryption.</B> HTTPS only in transit, enforced so browsers will not attempt an insecure connection. Our database, files and backups are encrypted at rest by our hosting provider.</li>
              <li><B>Passwords</B> are stored only as one-way hashes, and sign-in attempts are rate limited.</li>
              <li><B>Logged administration.</B> Administrative actions by Cardtly staff, and every change to a subscription, are recorded with who made them and when.</li>
              <li><B>No card numbers.</B> Payment card details are handled only by Paystack.</li>
            </ul>
            <p>
              We are not currently certified under ISO 27001 or SOC 2. If your procurement process needs a security questionnaire completed, email us.
            </p>
            <p>
              <B>If a breach affects personal information,</B> we will notify the Information Regulator and the people affected as soon as reasonably possible, as POPIA section 22 requires. Where we hold the information as your operator, we will notify you without undue delay so that you can meet your own obligations.
            </p>
          </Section>

          <Section id="marketing" title="12. Emails and direct marketing">
            <p>
              We send service emails: sign-in and password resets, trial and payment notices, alerts when your card captures a lead or receives a request, and a weekly summary of your card&apos;s activity, which you can unsubscribe from. We do not send marketing newsletters, and we do not pass your details to anyone to market to you.
            </p>
            <p>
              If you contact the people your card captures, you are responsible for doing so lawfully, including POPIA section 69&apos;s rules on direct marketing by electronic communication.
            </p>
          </Section>

          <Section id="apps" title="13. The mobile apps">
            <p>
              The Cardtly apps for Android and iOS open the same service as the website, so everything above applies to them. In addition:
            </p>
            <p><B>Android.</B> The Android app uses Firebase Analytics, provided by Google, which collects app usage and device information such as the device model, operating system and app versions, and approximate country. It does not collect your advertising ID: those permissions are removed from the app. The app may ask for:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><B>NFC</B>, to read a Cardtly tag or write your card to a blank one. Tags are never scanned in the background.</li>
              <li><B>Contacts</B>, only to save a card you receive into your phone&apos;s contacts when you tap Save Contact. We never read your existing contacts.</li>
            </ul>
            <p><B>iOS.</B> The iOS app does not include Firebase or any third-party analytics. It may ask for:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><B>Camera</B>, to scan a paper business card.</li>
              <li><B>Contacts</B>, to save cards you receive into your phone&apos;s contacts. We never read your existing contacts.</li>
              <li><B>Photos</B>, to choose a picture for your card or a card to scan, and to save your QR code or virtual background to your photos.</li>
            </ul>
            <p>Every permission is optional and is only requested when you use the feature that needs it.</p>
          </Section>

          <Section id="children" title="14. Children">
            <p>
              Cardtly is a professional tool for adults. We do not knowingly collect personal information from anyone under 18. If you believe a child has created an account, contact us and we will delete it.
            </p>
          </Section>

          <Section id="changes" title="15. Changes to this policy">
            <p>
              We update this policy when what we do changes. The date at the top shows the last update. When a change is material we will email account holders and show a notice on the website.
            </p>
          </Section>

          <Section id="contact" title="16. Contact and the Information Officer">
            <p>
              Cardtly<br />
              South Africa<br />
              Information Officer: <a href="mailto:andre@cardtly.com" className="underline" style={link}>andre@cardtly.com</a>
            </p>
            <p>
              You also have the right to complain to the Information Regulator (South Africa) at{' '}
              <a className="underline" href="https://inforegulator.org.za" style={link}>inforegulator.org.za</a>.
            </p>
          </Section>

        </div>
      </section>

      <Footer />
    </div>
  )
}
