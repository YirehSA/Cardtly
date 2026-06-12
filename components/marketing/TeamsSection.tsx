import Link from 'next/link'
import { ArrowRight, Building2, Lock, UserPlus, BarChart2, Check } from 'lucide-react'

// Cardtly for Teams. This feature shipped (org admin creates branded
// member cards, invites by email, members claim their card and sign
// in on the app) but was never marketed anywhere on the site.
// Anchored #teams so the footer can deep-link to it.

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

const TEAM_POINTS = [
  {
    icon: Lock,
    title: 'Locked company branding',
    desc: 'You control the logo, colours, and template. Every card stays perfectly on-brand - members can\'t change it.',
  },
  {
    icon: UserPlus,
    title: 'Members own their details',
    desc: 'Invite by email. Each person claims their card, signs in on the app, and keeps their own info current.',
  },
  {
    icon: BarChart2,
    title: 'One dashboard for everything',
    desc: 'Add seats, manage cards, and see team-wide analytics from a single admin view.',
  },
]

const DEMO_MEMBERS = [
  { name: 'Sipho Dlamini',  role: 'Account Executive' },
  { name: 'Lerato Khumalo', role: 'Head of Sales' },
  { name: 'Jan Pretorius',  role: 'Business Development' },
]

export default function TeamsSection() {
  return (
    <section id="teams" className="py-24 px-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-6 border"
              style={{ border: '1px solid rgba(124,58,237,0.4)', color: '#a78bfa', background: 'rgba(124,58,237,0.1)' }}>
              <Building2 className="w-3 h-3" />
              Cardtly for Teams
            </div>

            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-5 leading-tight">
              Your whole team.<br /><span style={gradText}>One brand.</span>
            </h2>

            <p className="text-lg leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Give every rep, agent, and consultant a digital business card that looks exactly like
              your company - while they manage their own details and share from their own phone.
            </p>

            <div className="space-y-5 mb-9">
              {TEAM_POINTS.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
                    <Icon className="w-4 h-4" style={{ color: '#a78bfa' }} />
                  </div>
                  <div>
                    <p className="font-bold text-white mb-0.5">{title}</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/contact"
                className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white transition-all hover:scale-[1.02]"
                style={{ background: grad, boxShadow: '0 8px 30px rgba(124,58,237,0.4)' }}>
                Set up your team
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <p className="inline-flex items-center text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Works with NFC cards too - order a set for the whole team.
              </p>
            </div>
          </div>

          {/* Visual: three on-brand member cards */}
          <div className="relative flex justify-center items-center min-h-[420px]">
            <div className="absolute w-[400px] h-[400px] rounded-full blur-[100px] pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)' }} />
            {DEMO_MEMBERS.map(({ name, role }, i) => (
              <div key={name}
                className="absolute w-56 rounded-3xl p-5 transition-transform hover:scale-105 hover:z-10"
                style={{
                  background: 'linear-gradient(160deg, #12122a, #0a0a18)',
                  border: '1px solid rgba(124,58,237,0.3)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                  transform: `translateX(${(i - 1) * 110}px) translateY(${Math.abs(i - 1) * 26}px) rotate(${(i - 1) * 7}deg)`,
                  zIndex: i === 1 ? 2 : 1,
                }}>
                {/* Shared brand band - identical on every card */}
                <div className="flex items-center gap-2 pb-3 mb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black"
                    style={{ background: grad }}>
                    H
                  </div>
                  <span className="text-xs font-bold text-white/80">Horizon Group</span>
                  <Lock className="w-3 h-3 ml-auto" style={{ color: '#a78bfa' }} />
                </div>
                <div className="w-12 h-12 rounded-xl mb-3 flex items-center justify-center text-lg font-black text-white"
                  style={{ background: 'rgba(124,58,237,0.35)' }}>
                  {name.charAt(0)}
                </div>
                <p className="font-bold text-white text-sm">{name}</p>
                <p className="text-xs mb-3" style={{ color: '#a78bfa' }}>{role}</p>
                <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  <Check className="w-3 h-3" style={{ color: '#22c55e' }} />
                  Claimed &amp; managed by {name.split(' ')[0]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
