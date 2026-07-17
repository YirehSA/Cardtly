import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import Reveal from '@/components/marketing/Reveal'
import { ArrowRight, Clock } from 'lucide-react'
import { POSTS } from './posts'

export const metadata: Metadata = {
  title: 'Blog — Digital Business Card Guides & Tips',
  description:
    'Guides on digital and NFC business cards: what they are, how to make one free, NFC vs paper, and using digital business cards in South Africa.',
  alternates: { canonical: '/blog' },
}

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function BlogIndexPage() {
  // Newest first.
  const posts = [...POSTS].sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <div className="overflow-x-hidden" style={{ background: '#000', color: '#fff' }}>
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-12 px-6 text-center relative overflow-hidden">
        <div className="blob-drift absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-[110px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.16) 0%, transparent 70%)' }} />
        <div className="relative max-w-3xl mx-auto">
          <p className="animate-fade-up text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#00d4ff' }}>Blog</p>
          <h1 className="animate-fade-up text-4xl md:text-6xl font-black tracking-tight mb-5">
            Digital business card <span style={gradText}>guides.</span>
          </h1>
          <p className="animate-fade-up-delayed text-lg max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Plain-English guides on digital and NFC business cards, how to make one, and getting the most out of yours.
          </p>
        </div>
      </section>

      {/* Post grid */}
      <section className="pb-24 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
          {posts.map((post, i) => (
            <Reveal key={post.slug} delay={i * 70} className="h-full">
              <Link href={`/blog/${post.slug}`}
                className="group block h-full rounded-2xl p-7 lift-card"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-3 text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <span>{fmtDate(post.date)}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{post.readMins} min read</span>
                </div>
                <h2 className="text-xl font-bold text-white mb-2 leading-snug group-hover:opacity-90">{post.title}</h2>
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.55)' }}>{post.excerpt}</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: '#00d4ff' }}>
                  Read guide <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24 px-6">
        <Reveal className="max-w-3xl mx-auto text-center">
          <div className="rounded-3xl p-10 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(124,58,237,0.15), rgba(236,72,153,0.1))', border: '1px solid rgba(124,58,237,0.25)' }}>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
              Ready for your own <span style={gradText}>card?</span>
            </h2>
            <p className="text-base mb-7" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Build a digital business card in 2 minutes, free for 60 days. No credit card needed.
            </p>
            <Link href="/signup"
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:scale-[1.03]"
              style={{ background: grad, boxShadow: '0 8px 40px rgba(124,58,237,0.5)' }}>
              Start your 60-day trial
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  )
}
