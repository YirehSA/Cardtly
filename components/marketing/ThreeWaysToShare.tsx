'use client'

import { Wifi, QrCode, Link2, ArrowRight } from 'lucide-react'

// Three ways to share section — visual demos of NFC tap, QR scan, link.
// Each card has a subtle interactive animation that loops.

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

export default function ThreeWaysToShare() {
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="absolute top-0 left-1/3 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 70%)' }} />

      <div className="max-w-6xl mx-auto relative">
        <div className="text-center mb-16">
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#00d4ff' }}>Three ways. Zero apps.</p>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-tight mb-4">
            Whichever way they prefer,
            <br />
            <span style={gradText}>your card meets them there.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* TAP — NFC */}
          <ShareCard
            icon={<Wifi className="w-6 h-6" />}
            accent="#00d4ff"
            title="Tap"
            subtitle="NFC card or phone"
            desc="Hold your Cardtly NFC card or phone against theirs. Their browser opens your card instantly. No app on either side."
            demo={<TapDemo />}
          />
          {/* SCAN — QR */}
          <ShareCard
            icon={<QrCode className="w-6 h-6" />}
            accent="#7c3aed"
            title="Scan"
            subtitle="QR code"
            desc="Your QR code is on your phone, in your email signature, on every print piece. Phone camera does the rest."
            demo={<ScanDemo />}
          />
          {/* LINK */}
          <ShareCard
            icon={<Link2 className="w-6 h-6" />}
            accent="#ec4899"
            title="Link"
            subtitle="cardtly.com/yourname"
            desc="Your own short URL. Paste it into a chat, an email, a bio, a CV. Works the same everywhere."
            demo={<LinkDemo />}
          />
        </div>

        <p className="text-center text-sm mt-10" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Pro tip: Use all three. Most professionals find one of the three lands every connection.
        </p>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(0.6); opacity: 0.8; }
          80%  { transform: scale(2.2); opacity: 0;   }
          100% { transform: scale(2.2); opacity: 0;   }
        }
        @keyframes scan-line {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(220%);  }
        }
        @keyframes blink-cursor {
          0%, 49%   { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes type-url {
          0%   { width: 0; }
          70%  { width: 100%; }
          100% { width: 100%; }
        }
        .animate-pulse-ring   { animation: pulse-ring   2s ease-out infinite; }
        .animate-pulse-ring-2 { animation: pulse-ring   2s ease-out 0.6s infinite; }
        .animate-scan-line    { animation: scan-line    2.4s linear infinite; }
        .animate-blink-cursor { animation: blink-cursor 0.8s steps(1) infinite; }
        .animate-type-url     { animation: type-url     3s ease-out infinite; overflow: hidden; white-space: nowrap; }
      `}</style>
    </section>
  )
}

function ShareCard({
  icon, accent, title, subtitle, desc, demo,
}: {
  icon: React.ReactNode
  accent: string
  title: string
  subtitle: string
  desc: string
  demo: React.ReactNode
}) {
  return (
    <div
      className="group rounded-3xl p-6 transition-all hover:scale-[1.02]"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Demo area */}
      <div
        className="relative h-48 rounded-2xl overflow-hidden mb-5 flex items-center justify-center"
        style={{
          background: `radial-gradient(circle at center, ${accent}20 0%, ${accent}05 60%, transparent 100%)`,
          border: `1px solid ${accent}22`,
        }}
      >
        {demo}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
          style={{ background: accent }}
        >
          {icon}
        </div>
        <div>
          <p className="font-bold text-lg text-white leading-none">{title}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{subtitle}</p>
        </div>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{desc}</p>
    </div>
  )
}

// ── Demos ────────────────────────────────────────────────────────

function TapDemo() {
  return (
    <div className="relative">
      {/* Pulse rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-20 h-20 rounded-full animate-pulse-ring" style={{ border: '2px solid #00d4ff', background: 'rgba(0,212,255,0.05)' }} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-20 h-20 rounded-full animate-pulse-ring-2" style={{ border: '2px solid #00d4ff', background: 'rgba(0,212,255,0.05)' }} />
      </div>
      {/* Two phones touching */}
      <div className="flex items-center gap-1 relative" style={{ zIndex: 1 }}>
        <PhoneShape orient="left" />
        <PhoneShape orient="right" highlight />
      </div>
    </div>
  )
}

function PhoneShape({ orient, highlight }: { orient: 'left' | 'right'; highlight?: boolean }) {
  return (
    <div
      className="w-12 h-20 rounded-xl flex flex-col items-center justify-center"
      style={{
        background: highlight ? 'linear-gradient(180deg, rgba(0,212,255,0.3), rgba(0,212,255,0.1))' : 'rgba(255,255,255,0.06)',
        border: highlight ? '1px solid rgba(0,212,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
        transform: orient === 'left' ? 'rotate(-15deg)' : 'rotate(15deg)',
      }}
    >
      <div className="w-7 h-1 rounded-full bg-white/10 mb-2" />
      <div className="w-7 h-7 rounded-md" style={{ background: highlight ? 'rgba(0,212,255,0.35)' : 'rgba(255,255,255,0.08)' }} />
    </div>
  )
}

function ScanDemo() {
  return (
    <div className="relative w-28 h-28 rounded-2xl overflow-hidden" style={{ background: 'white' }}>
      {/* Fake QR pattern */}
      <div className="grid grid-cols-7 gap-0.5 p-2 w-full h-full">
        {[
          1,1,1,0,1,1,1,
          1,0,1,1,0,0,1,
          1,1,0,1,1,0,1,
          0,1,1,0,1,1,0,
          1,0,0,1,0,1,1,
          1,0,1,0,1,0,1,
          1,1,1,0,1,1,0,
        ].map((v, i) => (
          <div key={i} className="rounded-[1px]" style={{ background: v ? '#000' : 'transparent' }} />
        ))}
      </div>
      {/* Scan line */}
      <div
        className="absolute left-0 right-0 h-0.5 animate-scan-line"
        style={{ background: 'linear-gradient(90deg, transparent, #7c3aed, transparent)', boxShadow: '0 0 12px #7c3aed' }}
      />
      {/* Corner markers */}
      {(['top-1 left-1', 'top-1 right-1', 'bottom-1 left-1'] as const).map(pos => (
        <div key={pos} className={`absolute ${pos} w-3 h-3`} style={{ border: '2px solid #7c3aed', borderRadius: '3px' }} />
      ))}
    </div>
  )
}

function LinkDemo() {
  return (
    <div
      className="w-56 rounded-xl px-3 py-3 font-mono text-sm"
      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(236,72,153,0.3)' }}
    >
      <div className="flex items-center gap-2 mb-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500/50" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
          <div className="w-2 h-2 rounded-full bg-green-500/50" />
        </div>
        <span>cardtly.com</span>
      </div>
      <div className="flex items-center" style={{ color: '#ec4899' }}>
        <span className="animate-type-url inline-block">cardtly.com/andrenel</span>
        <span className="animate-blink-cursor inline-block w-0.5 h-4 bg-pink-400 ml-0.5" />
      </div>
    </div>
  )
}
