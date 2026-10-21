import type { Metadata } from 'next'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import Reveal from '@/components/marketing/Reveal'
import ResellerApplyForm from '@/components/marketing/ResellerApplyForm'
import { Tags, LayoutDashboard, Wifi, Receipt, Server, Users, ArrowDown } from 'lucide-react'

// Become a reseller: what it is, then the application form.
//
// NO PRICES HERE, on purpose. What a reseller pays Cardtly is agreed once an
// application is approved (and set per reseller in admin), and a public page
// quoting it would also be one more price inside the iOS app's reach. The page
// is on IOS_BLOCKED_ROUTES anyway: selling Cardtly is not something the app is
// for.

export const metadata: Metadata = {
  title: { absolute: 'Become a Cardtly Reseller | Digital Business Cards South Africa' },
  description:
    'Resell Cardtly digital business cards and NFC cards to your clients at your own price. For agencies, print shops and anyone whose clients need business cards. Apply online.',
  alternates: { canonical: '/resellers' },
}

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
}

const BENEFITS = [
  { icon: Tags, colour: '#00d4ff', title: 'Your price, your clients', body: 'Charge your clients whatever you like. They deal with you, and their dashboard never shows a Cardtly price.' },
  { icon: LayoutDashboard, colour: '#7c3aed', title: 'Your own reseller panel', body: 'Add a client and their team is live in a minute. Give them seats, pause them or cancel them, all from one page.' },
  { icon: Wifi, colour: '#ec4899', title: 'NFC cards your way', body: 'Buy blank NFC cards and print them yourself, or have us print and programme them for each of your client\'s people.' },
  { icon: Receipt, colour: '#22c55e', title: 'One invoice a month', body: 'On the 1st we invoice you for the seats your clients had the month before. Your invoices are always in your panel.' },
  { icon: Users, colour: '#f59e0b', title: 'Your clients run their own teams', body: 'Each client\'s admin builds their cards, sets their company look and invites their people, so you are not stuck doing it for them.' },
  { icon: Server, colour: '#38bdf8', title: 'We run the platform', body: 'Hosting, updates, card analytics, lead capture and the apps are ours to run. You sell, we keep it working.' },
]

const STEPS = [
  { n: 1, title: 'Apply', body: 'Fill in the form below. It takes about five minutes.' },
  { n: 2, title: 'We review it', body: 'We read every application ourselves, usually within two working days.' },
  { n: 3, title: 'Get your login', body: 'Approved resellers get their own panel, and we take you through pricing.' },
  { n: 4, title: 'Add your clients', body: 'Create a client, give them seats, and their admin takes it from there.' },
]

// A picture of the reseller panel, so "your own panel" is something you can
// see before applying. Illustrative clients, and deliberately no money on it.
const PREVIEW_CLIENTS = [
  { name: 'Coastal Realty', seats: 30, made: 27, state: 'Live', tone: '#22c55e' },
  { name: 'Umhlanga Dental', seats: 12, made: 12, state: 'Live', tone: '#22c55e' },
  { name: 'Brightside Logistics', seats: 8, made: 3, state: 'Paused', tone: '#f59e0b' },
]

function PanelPreview() {
  return (
    <div aria-hidden="true" className="hidden lg:block relative">
      <div className="absolute -inset-6 rounded-[36px] blur-2xl pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(124,58,237,0.16), rgba(236,72,153,0.12))' }} />
      <div className="relative rounded-3xl p-6" style={{ background: 'rgba(14,14,18,0.92)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: '#a78bfa' }}>Reseller</p>
        <p className="text-xl font-black mt-1 mb-4">Your agency</p>
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {[['Seats in your pool', '100'], ['Given to clients', '50'], ['Still free', '50']].map(([k, v]) => (
            <div key={k} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>{k}</p>
              <p className="text-2xl font-black mt-1 tabular-nums">{v}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {PREVIEW_CLIENTS.map(c => (
            <div key={c.name} className="flex items-center gap-3 rounded-xl px-3.5 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.name}</p>
                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{c.made} of {c.seats} cards made</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: `${c.tone}22`, color: c.tone, border: `1px solid ${c.tone}55` }}>{c.state}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl py-2.5 text-center text-sm font-bold" style={{ background: grad }}>+ Add client</div>
      </div>
    </div>
  )
}

export default function ResellersPage() {
  return (
    <div style={{ background: '#000', color: '#fff' }}>
      <Navbar />

      <section className="relative overflow-hidden px-6 lg:px-12 xl:px-16 pt-32 pb-14 lg:pt-40 lg:pb-16">
        <div className="absolute -top-32 left-[10%] w-[620px] h-[480px] rounded-full blur-[140px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 72%)' }} />
        <div className="absolute top-20 right-[5%] w-[420px] h-[380px] rounded-full blur-[140px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 72%)' }} />
        <div className="relative mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center" style={{ maxWidth: 1300, zIndex: 2 }}>
          <div className="max-w-3xl text-center lg:text-left mx-auto lg:mx-0">
            <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#7c3aed' }}>Resellers</p>
            <h1 className="font-black tracking-[-0.02em] leading-[1.04] mb-6" style={{ fontSize: 'clamp(2.5rem, 4.4vw, 4.25rem)' }}>
              Sell Cardtly to your clients.<br /><span style={gradText}>At your own price.</span>
            </h1>
            <p className="text-lg xl:text-xl leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.62)' }}>
              For marketing agencies, print shops and anyone whose clients need business cards. You bring the clients and set the price.
              We run the platform, and your clients never see ours.
            </p>
            <a href="#apply"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: grad, boxShadow: '0 4px 24px rgba(124,58,237,0.35)' }}>
              Apply to become a reseller <ArrowDown className="w-4 h-4" />
            </a>
          </div>
          <PanelPreview />
        </div>
      </section>

      <section className="px-6 lg:px-12 xl:px-16 py-12">
        <div className="max-w-[1200px] mx-auto grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={i * 60}>
              <div className="h-full rounded-3xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${b.colour}1f` }}>
                  <b.icon className="w-5 h-5" style={{ color: b.colour }} aria-hidden="true" />
                </div>
                <h2 className="text-lg font-bold mb-2">{b.title}</h2>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{b.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-6 lg:px-12 xl:px-16 py-12">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-8 text-center lg:text-left">How it works</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 70}>
                <div className="h-full rounded-3xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span className="inline-flex w-9 h-9 rounded-full items-center justify-center text-sm font-black mb-4" style={{ background: grad }} aria-label={`Step ${s.n}`}>{s.n}</span>
                  <h3 className="font-bold mb-1.5">{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="apply" className="px-6 lg:px-12 xl:px-16 py-16 scroll-mt-24">
        <div className="max-w-[900px] mx-auto">
          <div className="mb-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">Apply to become a <span style={gradText}>reseller</span></h2>
            <p className="text-base" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Everything we need to review your application and, once it is approved, to set you up and invoice you.
            </p>
          </div>
          <ResellerApplyForm />
        </div>
      </section>

      <Footer />
    </div>
  )
}
