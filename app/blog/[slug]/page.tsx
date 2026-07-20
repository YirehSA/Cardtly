import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import Reveal from '@/components/marketing/Reveal'
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react'
import { POSTS, getPost } from '../posts'

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

export function generateStaticParams() {
  return POSTS.map(p => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return {}
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      publishedTime: post.date,
      images: [{ url: `/api/og/blog/${post.slug}`, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [`/api/og/blog/${post.slug}`],
    },
  }
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  const url = `https://cardtly.com/blog/${post.slug}`
  const related = POSTS.filter(p => p.slug !== post.slug).slice(0, 3)

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    // Per-post, drawn by /api/og/blog/[slug]. This was the Cardtly logo on
    // every post, which gives Google nothing to distinguish one article from
    // another and nothing worth showing in a result.
    image: `https://cardtly.com/api/og/blog/${post.slug}`,
    author: { '@type': 'Organization', name: 'Cardtly', url: 'https://cardtly.com' },
    publisher: {
      '@type': 'Organization',
      name: 'Cardtly',
      logo: { '@type': 'ImageObject', url: 'https://cardtly.com/cardtly-icon.png' },
    },
  }

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: post.faq.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <div className="overflow-x-hidden" style={{ background: '#000', color: '#fff' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <Navbar />

      <article className="pt-28 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          <Link href="/blog"
            className="inline-flex items-center gap-1.5 text-sm mb-8 transition hover:text-white"
            style={{ color: 'rgba(255,255,255,0.5)' }}>
            <ArrowLeft className="w-4 h-4" /> All guides
          </Link>

          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight mb-4">{post.title}</h1>
          <div className="flex items-center gap-3 text-sm mb-10" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <span>{fmtDate(post.date)}</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{post.readMins} min read</span>
          </div>

          {/* Article body - trusted, hand-reviewed HTML */}
          <div className="article-prose" dangerouslySetInnerHTML={{ __html: post.body }} />

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-2xl font-black tracking-tight mb-5">Frequently asked questions</h2>
            <div className="space-y-3">
              {post.faq.map(({ q, a }) => (
                <details key={q} className="group rounded-2xl border overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
                  <summary className="px-5 py-4 cursor-pointer list-none font-semibold text-white text-[15px] [&::-webkit-details-marker]:hidden">
                    {q}
                  </summary>
                  <p className="px-5 pb-5 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* CTA */}
          <div className="mt-14 rounded-3xl p-8 text-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(124,58,237,0.15), rgba(236,72,153,0.1))', border: '1px solid rgba(124,58,237,0.25)' }}>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2">
              Make your <span style={gradText}>card</span>
            </h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Build a digital business card in 2 minutes. Free for 60 days, no credit card.
            </p>
            <Link href="/signup"
              className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-base font-bold text-white transition hover:scale-[1.03]"
              style={{ background: grad, boxShadow: '0 8px 40px rgba(124,58,237,0.5)' }}>
              Start your 60-day trial
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </article>

      {/* Related */}
      <section className="pb-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold mb-6 text-center" style={{ color: 'rgba(255,255,255,0.8)' }}>Keep reading</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {related.map(p => (
              <Link key={p.slug} href={`/blog/${p.slug}`}
                className="group block rounded-2xl p-6 lift-card"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h3 className="font-bold text-white text-base mb-2 leading-snug">{p.title}</h3>
                <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: '#00d4ff' }}>
                  Read <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
