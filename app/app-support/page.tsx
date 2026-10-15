import type { Metadata } from 'next'

// The page the App Store listing points at, for its Marketing URL and Support
// URL.
//
// Apple opens those URLs in an ordinary browser, where the app's user-agent
// check does not apply, so they see the site exactly as the public does.
// Rejection 7 (2026-10-14) was the home page's Pricing link, reached from the
// Marketing URL: "links to your site that could indirectly provide access to
// external purchase mechanisms".
//
// So this page stands alone. No Navbar, no Footer, no logo that links home, and
// no link of any kind except email. No price, no sign-up, nothing to buy.
// scripts/check-app-store-page.mjs holds it to that.

export const metadata: Metadata = {
  title: 'App support',
  description: 'Help with the Cardtly app for company teams: signing in, what the app does, and how to reach support.',
  // A help page for the App Store listing, not something to rank.
  robots: { index: false, follow: false },
}

const SUPPORT_EMAIL = 'hello@cardtly.com'

const sectionStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="p-6 sm:p-8 rounded-2xl mb-5" style={sectionStyle}>
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-4">{title}</h2>
      <div className="space-y-3 text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>
        {children}
      </div>
    </section>
  )
}

export default function AppSupportPage() {
  return (
    <main className="min-h-dvh px-4 sm:px-6 py-12 sm:py-16" style={{ background: '#000', color: '#fff' }}>
      <div className="max-w-2xl mx-auto">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-8">
            {/* Not a link, on purpose: see the note at the top. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cardtly-icon.png" alt="" width={40} height={40} className="rounded-xl" />
            <span className="text-lg font-bold tracking-tight">Cardtly</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">App support</h1>
          <p className="text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
            The Cardtly app is for people whose company gives them a Cardtly digital business card.
          </p>
        </header>

        <Section title="Who the app is for">
          <p>
            Your company sets up its Cardtly team and invites you by email. Once you have accepted the
            invite, the app is where you keep your card up to date and share it.
          </p>
          <p>
            You cannot create an account in the app, and there is nothing to buy in it. If you do not have
            an invite yet, ask whoever looks after Cardtly at your company.
          </p>
        </Section>

        <Section title="Signing in">
          <p>Sign in with the work email address your company invited.</p>
          <p>
            If the app says the account you signed in with is not part of a company team, your invite may
            have gone to a different address, or it has not been accepted yet. Whoever manages your team can
            check and send it again.
          </p>
        </Section>

        <Section title="What you can do in the app">
          <ul className="list-disc pl-6 space-y-2">
            <li>Edit your card: photo, job title, phone numbers, links and more. Some details may be set by your company for everyone.</li>
            <li>Share your card with a QR code, a link, or by sending it to a phone number on WhatsApp or SMS.</li>
            <li>See the people who shared their details with you through your card.</li>
            <li>See how often your card is opened and which links people tap.</li>
          </ul>
          <p>
            If you manage your company&rsquo;s team, you can also look after your team&rsquo;s cards,
            departments and the shared company look.
          </p>
        </Section>

        <Section title="Deleting your account">
          <p>
            In the app, go to <strong className="text-white">Settings</strong>, open the{' '}
            <strong className="text-white">Danger zone</strong> tab and tap{' '}
            <strong className="text-white">Delete account</strong>. Or email us from the address on your
            account with the subject <strong className="text-white">Delete my account</strong> and we will do
            it for you.
          </p>
          <p>
            If you are the person who runs your company&rsquo;s Cardtly team, deleting your account also
            deletes the team and every card in it.
          </p>
        </Section>

        <Section title="Contact support">
          <p>
            Email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline font-semibold" style={{ color: '#00d4ff' }}>
              {SUPPORT_EMAIL}
            </a>{' '}
            and tell us the email address you sign in with and what went wrong. A screenshot helps.
          </p>
        </Section>
      </div>
    </main>
  )
}
