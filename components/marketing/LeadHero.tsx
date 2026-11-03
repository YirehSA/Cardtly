import Link from 'next/link'
import { ArrowRight, Check, Inbox, Lock, Mail, MessageCircle } from 'lucide-react'
import PriceEstimate from './PriceEstimate'
import { SEAT_PRICE_RAND } from '@/lib/org-billing'

// The home page hero since 2026-11-03, when the scroll-driven WebGL scene came
// out. The page now sells what happens behind the card, so the picture is the
// card as the small thing in front (the face) and the team's contacts as the
// big thing behind it (the back office).
//
// A server component with CSS-only motion: nothing to download before the page
// is usable, which the 1.4MB scene never managed.
//
// The panel is an illustration, and says "Example" on it. The people and
// companies in it are made up; the four sources are the dashboard's own
// (components/dashboard/ExportContactsButton SOURCE_LABEL), and each thing the
// rows show is shipped: the lead email to the rep with a copy to the department
// head and company admin (lib/lead-notify), WhatsApp from the lead.

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

const LEADS = [
  { name: 'Thandi Mokoena', company: 'Ridgeway Logistics', source: 'Contact form', tone: '#34d399', rep: 'Sipho D.', when: 'Just now', fresh: true },
  { name: 'Pieter van Wyk', company: 'Brightfield Solar', source: 'Meeting request', tone: '#f59e0b', rep: 'Lerato K.', when: '12 min' },
  { name: 'Ayesha Patel', company: 'Northgate Build', source: 'Questionnaire', tone: '#38bdf8', rep: 'Jan P.', when: '1 h' },
  { name: 'Michael Botha', company: 'Harbour & Co', source: 'Scanned card', tone: '#a78bfa', rep: 'Sipho D.', when: 'Yesterday' },
]

const STATS = [
  { n: '18', label: 'New leads' },
  { n: '4', label: 'Meetings' },
  { n: '236', label: 'Card opens' },
]

export default function LeadHero() {
  return (
    <section className="relative overflow-hidden px-6 lg:px-12 pt-32 pb-20 lg:pt-40 lg:pb-12">
      <div className="absolute -top-40 left-[4%] w-[720px] h-[720px] rounded-full blur-[150px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.16) 0%, rgba(124,58,237,0.09) 50%, transparent 72%)' }} />
      <div className="absolute -bottom-60 right-0 w-[640px] h-[640px] rounded-full blur-[140px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.14) 0%, transparent 72%)' }} />

      {/* Two columns from lg. Below that the picture goes under the copy,
          the card first and the back office after it, in the order a lead
          travels. */}
      <div className="relative mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.08fr] gap-14 lg:gap-12 xl:gap-20 items-center"
        style={{ maxWidth: 1400, zIndex: 2 }}>

        {/* ── The pitch ─────────────────────────────────────────── */}
        <div className="text-center lg:text-left">
          <p className="lh-rise inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-7"
            style={{ border: '1px solid rgba(0,212,255,0.35)', color: '#67e8f9', background: 'rgba(0,212,255,0.08)' }}>
            <Inbox className="w-3.5 h-3.5" aria-hidden />
            Lead capture for sales teams
          </p>

          <h1 className="lh-rise font-black tracking-[-0.02em] leading-[1.04] mb-6"
            style={{ fontSize: 'clamp(2.5rem, 4.6vw, 4.5rem)', animationDelay: '80ms' }}>
            Hand out a card.<br />
            <span style={gradText}>Get back a lead.</span>
          </h1>

          <p className="lh-rise text-lg xl:text-xl mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0"
            style={{ color: 'rgba(255,255,255,0.64)', animationDelay: '160ms' }}>
            The digital business card is just the face. Behind it, Cardtly catches everyone your team
            meets, emails each lead to the rep and their manager the moment it arrives, and keeps it in
            one place to follow up, report on and export.
          </p>

          {/* flex-wrap and nowrap: at 1024 the column is too narrow for both
              buttons side by side, and the labels were breaking mid-phrase. */}
          <div className="lh-rise flex flex-col sm:flex-row sm:flex-wrap gap-4 justify-center lg:justify-start mb-7"
            style={{ animationDelay: '240ms' }}>
            <Link href="/signup"
              className="group flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white whitespace-nowrap transition-all hover:scale-[1.03]"
              style={{ background: grad, boxShadow: '0 10px 44px rgba(124,58,237,0.5)' }}>
              Set your team up
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="#lead-flow"
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-medium whitespace-nowrap transition hover:bg-white/10"
              style={{ border: '1px solid rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.82)' }}>
              See where leads go
            </Link>
          </div>

          <div className="lh-rise flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-sm"
            style={{ color: 'rgba(255,255,255,0.5)', animationDelay: '320ms' }}>
            {['Free trial on request', 'Live in 2 minutes'].map(t => (
              <span key={t} className="flex items-center gap-1.5 whitespace-nowrap">
                <Check className="w-3.5 h-3.5" style={{ color: '#22c55e' }} aria-hidden />{t}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#22c55e' }} aria-hidden />
              <span>From R{SEAT_PRICE_RAND} a card a month<PriceEstimate zar={SEAT_PRICE_RAND} prefix=" (" suffix=")" /></span>
            </span>
          </div>
        </div>

        {/* ── The picture: the face in front, the back office behind ──── */}
        {/* lg:mb-24: the card hangs below the panel's bottom edge from lg, and
            an absolute element reserves no room for itself. */}
        <div className="relative lg:pl-20 xl:pl-24 lg:mb-36" aria-hidden>
          {/* The face: one rep's card. In the flow on a phone, in front of the
              panel's lower left corner from lg, so it covers the oldest leads
              and never the new one at the top. */}
          <div className="lh-rise relative z-10 mx-auto mb-4 w-full max-w-[330px] lg:absolute lg:left-0 lg:-bottom-36 lg:mb-0 lg:w-[210px] lg:max-w-none lh-tilt"
            style={{ animationDelay: '360ms' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2 text-center lg:text-left" style={{ color: 'rgba(255,255,255,0.45)' }}>
              The face
            </p>
            <div className="rounded-3xl p-4 lg:p-5"
              style={{
                background: 'linear-gradient(160deg, #15152e, #0a0a18)',
                border: '1px solid rgba(124,58,237,0.38)',
                boxShadow: '0 30px 70px rgba(0,0,0,0.65), 0 10px 40px rgba(124,58,237,0.28)',
              }}>
              <div className="flex items-center gap-2 pb-3 mb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <span className="w-6 h-6 rounded-md grid place-items-center text-white text-[11px] font-black" style={{ background: grad }}>H</span>
                <span className="text-[11px] font-bold text-white/80">Horizon Group</span>
                <Lock className="w-3 h-3 ml-auto" style={{ color: '#a78bfa' }} />
              </div>
              <div className="flex lg:block items-center gap-3">
                <span className="w-11 h-11 lg:mb-2.5 rounded-xl grid place-items-center text-base font-black text-white flex-shrink-0"
                  style={{ background: 'rgba(124,58,237,0.4)' }}>S</span>
                <span className="block text-left">
                  <span className="block font-bold text-white text-sm leading-tight">Sipho Dlamini</span>
                  <span className="block text-xs" style={{ color: '#a78bfa' }}>Account Executive</span>
                </span>
              </div>
              <div className="mt-3.5 grid grid-cols-2 lg:grid-cols-1 gap-2">
                <span className="py-2 rounded-xl text-[11px] font-bold text-center text-white" style={{ background: grad }}>Save Contact</span>
                <span className="lh-ping relative py-2 rounded-xl text-[11px] font-bold text-center"
                  style={{ border: '1px solid rgba(0,212,255,0.55)', color: '#67e8f9' }}>Share your info</span>
              </div>
            </div>
          </div>

          {/* The back office: the team's contacts. */}
          <div className="lh-rise relative rounded-3xl overflow-hidden"
            style={{
              animationDelay: '220ms',
              background: 'linear-gradient(180deg, rgba(20,20,38,0.96), rgba(10,10,22,0.98))',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.05)',
            }}>
            <div className="flex items-center gap-2 px-4 sm:px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="flex gap-1.5">
                {['#ff5f57', '#febc2e', '#28c840'].map(c => <span key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.75 }} />)}
              </span>
              <span className="ml-2 text-xs font-semibold text-white/80">Team contacts</span>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' }}>Example</span>
            </div>

            <div className="px-4 sm:px-5 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                The back office <span className="normal-case tracking-normal font-medium">· this week</span>
              </p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {STATS.map(({ n, label }) => (
                  <div key={label} className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-lg sm:text-xl font-black text-white leading-none">{n}</p>
                    <p className="text-[10px] sm:text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <ul className="px-2 sm:px-3 pb-3">
              {LEADS.map((l, i) => (
                <li key={l.name}
                  className={`lh-row relative rounded-2xl px-2.5 sm:px-3 py-2.5 ${l.fresh ? 'lh-fresh' : ''}`}
                  style={{ animationDelay: `${520 + i * 110}ms` }}>
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full grid place-items-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: `${l.tone}33`, border: `1px solid ${l.tone}66` }}>{l.name[0]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-white truncate">{l.name}</span>
                        {l.fresh && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{ background: '#00d4ff', color: '#001018' }}>New</span>
                        )}
                      </span>
                      <span className="block text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {l.company} · via {l.rep} · {l.when}
                      </span>
                    </span>
                    <span className="hidden sm:inline-block text-[10px] font-semibold px-2 py-1 rounded-md whitespace-nowrap"
                      style={{ background: `${l.tone}1f`, color: l.tone }}>{l.source}</span>
                    <span className="w-8 h-8 rounded-full grid place-items-center flex-shrink-0" style={{ background: 'rgba(37,211,102,0.16)', color: '#25D366' }}>
                      <MessageCircle className="w-4 h-4" />
                    </span>
                  </div>
                  {l.fresh && (
                    <p className="mt-2 ml-11 flex items-start gap-1.5 text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      <Mail className="w-3 h-3 mt-px flex-shrink-0" style={{ color: '#67e8f9' }} />
                      <span>Emailed to Sipho, copied to the head of sales</span>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes lh-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
        .lh-rise, .lh-row { animation: lh-rise .7s cubic-bezier(.2,.8,.2,1) both; }
        @media (min-width: 1024px) {
          .lh-tilt { rotate: -4deg; }
        }
        /* The new lead: a slow glow, so the eye goes to the row that just came in. */
        @keyframes lh-glow {
          0%, 100% { box-shadow: inset 0 0 0 1px rgba(0,212,255,0.22); background: rgba(0,212,255,0.05) }
          50%      { box-shadow: inset 0 0 0 1px rgba(0,212,255,0.5);  background: rgba(0,212,255,0.1) }
        }
        .lh-fresh { animation: lh-rise .7s cubic-bezier(.2,.8,.2,1) both, lh-glow 3.2s ease-in-out 1.4s infinite; }
        /* The button the lead came from. */
        @keyframes lh-ping { 0% { transform: scale(1); opacity: .6 } 100% { transform: scale(1.18, 1.5); opacity: 0 } }
        .lh-ping::after {
          content: ''; position: absolute; inset: 0; border-radius: inherit;
          border: 1px solid rgba(0,212,255,0.7); animation: lh-ping 2.4s ease-out 1.2s infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .lh-rise, .lh-row, .lh-fresh { animation: none; }
          .lh-ping::after { animation: none; opacity: 0; }
        }
      `}</style>
    </section>
  )
}
