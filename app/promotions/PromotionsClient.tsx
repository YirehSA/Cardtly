'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Copy, Check, Share2, Mail, Trophy, Globe, DollarSign, Sparkles, Users, Heart, Hash } from 'lucide-react'

interface Props {
  initialFilled: number
  initialRemaining: number
  total: number
  referralCode: string | null
  isSignedIn: boolean
}

export default function PromotionsClient({ initialFilled, initialRemaining, total, referralCode, isSignedIn }: Props) {
  const [filled, setFilled] = useState(initialFilled)
  const [remaining, setRemaining] = useState(initialRemaining)
  const [copied, setCopied] = useState(false)

  // Poll the founder count every 30 seconds so the counter feels live
  // without hammering Supabase. /api/promotions/counter is a public
  // route that just selects from the founder_count view.
  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch('/api/promotions/counter')
        if (!res.ok) return
        const data = await res.json()
        if (typeof data.filled === 'number') setFilled(data.filled)
        if (typeof data.remaining === 'number') setRemaining(data.remaining)
      } catch { /* swallow */ }
    }
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [])

  const referralUrl = referralCode ? `https://cardtly.com/?ref=${referralCode}` : ''
  const progressPct = total > 0 ? Math.min(100, Math.round((filled / total) * 100)) : 0

  function copyLink() {
    if (!referralUrl) return
    navigator.clipboard.writeText(referralUrl)
    setCopied(true)
    toast.success('Link copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  function shareNative() {
    if (!referralUrl) return
    if (navigator.share) {
      navigator.share({
        title: 'Cardtly — Get a digital business card',
        text: "I'm using Cardtly. Join with my link and we both win.",
        url: referralUrl,
      }).catch(() => {})
    } else {
      copyLink()
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero with ambient gradient bloom */}
      <div className="relative overflow-hidden">
        <div style={{ position: 'absolute', top: -200, left: '50%', transform: 'translateX(-50%)', width: '140%', height: 600, background: 'radial-gradient(ellipse at center, rgba(0,212,255,0.25) 0%, rgba(139,92,246,0.18) 30%, transparent 60%)', pointerEvents: 'none' }} />
        <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-12 text-center" style={{ zIndex: 1 }}>
          <p className="text-xs font-bold uppercase tracking-[0.4em] text-cyan-400 mb-4">Growth Promotions</p>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight mb-4" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Win Pro for life. <br className="hidden md:block" />And much more.
          </h1>
          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
            Four growing milestones. Better prizes the bigger we get. The fourth one will blow your mind &mdash; revealed when we hit 5,000 paid users.
          </p>
        </div>
      </div>

      {/* Live counter — Tier 1 progress */}
      <div className="max-w-3xl mx-auto px-6 pb-16">
        <div className="rounded-3xl border border-white/10 backdrop-blur-xl p-8" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-cyan-400 mb-3">
            <Trophy className="w-4 h-4" />
            Tier 1 · Founding Members
          </div>
          <div className="flex items-baseline gap-3 mb-1">
            <div className="text-5xl md:text-6xl font-bold tabular-nums">{filled}</div>
            <div className="text-2xl text-white/40">/ {total}</div>
          </div>
          <p className="text-sm text-white/60 mb-6">
            {remaining > 0 ? (
              <>only <span className="font-bold text-white">{remaining}</span> founder slots remaining</>
            ) : (
              <>all 100 founder slots have been claimed</>
            )}
          </p>
          {/* Progress bar */}
          <div className="h-2 rounded-full overflow-hidden mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full transition-all duration-500" style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #00d4ff, #8b5cf6, #ec4899)' }} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="rounded-2xl border border-cyan-400/30 p-4" style={{ background: 'rgba(0,212,255,0.04)' }}>
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-1">10 random winners</p>
              <p className="font-semibold mb-1">Cardtly Pro for life</p>
              <p className="text-white/50 text-xs">A lifetime account, free. Every Pro feature. Forever.</p>
            </div>
            <div className="rounded-2xl border border-white/10 p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-1">All 100 founders</p>
              <p className="font-semibold mb-1">3 months Pro free</p>
              <p className="text-white/50 text-xs">Plus a permanent founder badge on your card.</p>
            </div>
          </div>
          {remaining > 0 && !isSignedIn && (
            <Link href="/signup" className="block mt-6 text-center py-4 rounded-2xl font-semibold text-black hover:opacity-90 transition"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #8b5cf6, #ec4899)' }}>
              Claim a founder slot
            </Link>
          )}
        </div>
      </div>

      {/* Tier ladder */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-3">The full ladder</h2>
        <p className="text-center text-white/50 mb-12 max-w-2xl mx-auto">Each tier unlocks once the milestone is hit. Bigger prizes as we grow. The more paid users we have, the more we give back.</p>

        <div className="grid md:grid-cols-2 gap-4">
          <TierCard tier="1" icon={<Trophy className="w-5 h-5" />} accent="from-cyan-400 to-blue-500"
            milestone="First 100 signups"
            prize="10 win lifetime Pro · 90 get 3 months Pro"
            tag={remaining === 0 ? 'CLOSED' : 'OPEN'} tagColor={remaining === 0 ? 'bg-white/10' : 'bg-emerald-500'} />
          <TierCard tier="2" icon={<Globe className="w-5 h-5" />} accent="from-violet-500 to-purple-600"
            milestone="1,000 active accounts"
            prize="3 winners get a custom website built by Yireh"
            tag="UPCOMING" tagColor="bg-white/10" />
          <TierCard tier="3" icon={<DollarSign className="w-5 h-5" />} accent="from-pink-500 to-rose-500"
            milestone="1,000 / 2,500 / 5,000 paid"
            prize="Cash prizes of R25,000 · R75,000 · R150,000"
            tag="UPCOMING" tagColor="bg-white/10" />
          <TierCard tier="4" icon={<Sparkles className="w-5 h-5" />} accent="from-amber-400 to-orange-500"
            milestone="10,000 paid accounts"
            prize="The ultimate grand prize · revealed at 5,000 paid users"
            tag="MYSTERY" tagColor="bg-amber-500" />
        </div>
      </div>

      {/* Your referral link */}
      {isSignedIn && referralCode && (
        <div className="max-w-3xl mx-auto px-6 pb-20">
          <div className="rounded-3xl border border-white/10 p-8" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-pink-400 mb-3">
              <Heart className="w-4 h-4" />
              Your referral link
            </div>
            <p className="text-sm text-white/60 mb-4">Share this link. Every friend who signs up and stays paid earns you an extra entry in the Tier 3 + 4 draws (max 10 per person).</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 rounded-2xl border border-white/10 p-4 font-mono text-sm break-all" style={{ background: 'rgba(0,0,0,0.4)' }}>
                {referralUrl}
              </div>
              <div className="flex gap-2">
                <button onClick={copyLink} className="flex-1 sm:flex-initial px-5 py-3 rounded-2xl font-semibold border border-white/10 hover:bg-white/5 transition flex items-center justify-center gap-2">
                  {copied ? <><Check className="w-4 h-4 text-emerald-400" />Copied</> : <><Copy className="w-4 h-4" />Copy</>}
                </button>
                <button onClick={shareNative} className="flex-1 sm:flex-initial px-5 py-3 rounded-2xl font-semibold text-black transition hover:opacity-90 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #00d4ff, #8b5cf6, #ec4899)' }}>
                  <Share2 className="w-4 h-4" />Share
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isSignedIn && (
        <div className="max-w-3xl mx-auto px-6 pb-20">
          <div className="rounded-3xl border border-white/10 p-8 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <p className="text-white/70 mb-4">Sign up to get your personal referral link and start earning entries.</p>
            <Link href="/signup" className="inline-flex items-center justify-center px-6 py-3 rounded-2xl font-semibold text-black hover:opacity-90 transition"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #8b5cf6, #ec4899)' }}>
              Create your free card
            </Link>
          </div>
        </div>
      )}

      {/* How entries work */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-3">How entries work</h2>
        <p className="text-center text-white/50 mb-12 max-w-2xl mx-auto">Same mechanic across every Tier 3 + 4 milestone. Simple, fair, and viral.</p>

        <div className="grid md:grid-cols-2 gap-4">
          <RuleCard num="01" icon={<Trophy className="w-5 h-5" />} title="Every paid account earns one entry" desc="Automatic. Just being a paying subscriber gets you in the draw." />
          <RuleCard num="02" icon={<Users className="w-5 h-5" />} title="Refer friends, earn bonus entries" desc="Each verified paid referral (they stay paid for 30+ days) earns you one extra entry." />
          <RuleCard num="03" icon={<Hash className="w-5 h-5" />} title="Follow and share for bonus entries" desc="Follow Cardtly on Instagram and Facebook for an extra entry each. Share your card with #Cardtly for another." />
          <RuleCard num="04" icon={<Heart className="w-5 h-5" />} title="Cap at 10 entries per person" desc="Stops super-referrers from dominating. Keeps the draw fair while still rewarding sharing." />
        </div>
        <p className="text-center text-sm text-white/50 mt-8 max-w-2xl mx-auto italic">Entries carry forward and accumulate. The longer you're a paid user, the more chances at every prize.</p>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-12">Questions</h2>
        <div className="space-y-3">
          <FaqItem q="Is this real?" a="Yes. The promotions are registered with the South African National Consumer Commission. T&Cs lawyer-reviewed. Draws are random + recorded for transparency." />
          <FaqItem q="What counts as a paid account?" a="Any active Cardtly Pro subscription, monthly or yearly. Refunds and cancellations within 30 days don't count." />
          <FaqItem q="Do I need to follow Cardtly socially?" a="No, but it earns you bonus entries. Under SA consumer law there's always an email-only alternative entry route at contest@cardtly.com." />
          <FaqItem q="How are winners drawn?" a="Server-side random selection. Process is recorded or livestreamed for each Tier 3 + 4 milestone. Winners notified by email and listed publicly here." />
          <FaqItem q="Who is eligible?" a="South African residents, 18+. Each prize is awarded directly to the winner with all admin (registration, taxes, transfer fees) covered by Cardtly." />
          <FaqItem q="What's the Tier 4 grand prize?" a="That's the surprise. We'll reveal it publicly when we hit 5,000 paid users (the Tier 3 third milestone). It's bigger than everything else combined — that's all we're saying for now." />
          <FaqItem q="How long do I have to wait?" a="Tier 1 closes the moment we hit 100 founders. Tier 2 + 3 + 4 unlock as we hit the user milestones — no fixed dates, just growth." />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/5 py-12">
        <div className="max-w-3xl mx-auto px-6 text-center text-xs text-white/40 space-y-3">
          <p>Registered with the National Consumer Commission of South Africa. <Link href="/promotions/terms" className="text-white/60 underline hover:text-white">Read the full T&Cs.</Link></p>
          <p>No purchase necessary. Free entry route: email <a href="mailto:contest@cardtly.com" className="text-white/60 underline hover:text-white">contest@cardtly.com</a> with your name and ID number to enter the next eligible draw.</p>
          <p>© {new Date().getFullYear()} Cardtly · Yireh Business Solutions</p>
        </div>
      </div>
    </div>
  )
}

// ── Small components ─────────────────────────────────────────

function TierCard({ tier, icon, accent, milestone, prize, tag, tagColor }: { tier: string; icon: React.ReactNode; accent: string; milestone: string; prize: string; tag: string; tagColor: string }) {
  return (
    <div className="rounded-3xl border border-white/10 p-6 relative overflow-hidden group hover:border-white/20 transition" style={{ background: 'rgba(255,255,255,0.03)' }}>
      <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br ${accent} opacity-20 blur-2xl group-hover:opacity-30 transition`} />
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accent} text-white flex items-center justify-center`}>{icon}</div>
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${tagColor}`}>{tag}</span>
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/40 mb-2">Tier {tier}</p>
        <p className="text-sm font-bold text-white/80 mb-1">{milestone}</p>
        <p className="text-sm text-white/60">{prize}</p>
      </div>
    </div>
  )
}

function RuleCard({ num, icon, title, desc }: { num: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)' }}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs font-bold text-white/30 tabular-nums">{num}</span>
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/80">{icon}</div>
      </div>
      <p className="font-semibold mb-1">{title}</p>
      <p className="text-sm text-white/50">{desc}</p>
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="rounded-2xl border border-white/10 p-5 group" style={{ background: 'rgba(255,255,255,0.03)' }}>
      <summary className="cursor-pointer font-semibold list-none flex items-center justify-between gap-4">
        <span>{q}</span>
        <span className="text-white/30 text-xl group-open:rotate-45 transition-transform">+</span>
      </summary>
      <p className="mt-3 text-sm text-white/60 leading-relaxed">{a}</p>
    </details>
  )
}
