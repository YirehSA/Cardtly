import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Building2, Handshake } from 'lucide-react'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import ResellerDirectory from '@/components/marketing/ResellerDirectory'
import { publicListings } from '@/lib/reseller-listing-server'
import { LISTING_PATH } from '@/lib/reseller-listing'

// Find a reseller: the resellers that chose to be listed, from Bronze up
// (lib/reseller-listing has the rules). A level reward, see lib/reseller-levels.
//
// NO PRICES, like /resellers: a reseller sets its own. On IOS_BLOCKED_ROUTES
// all the same, because pointing people at somebody to buy from is selling.
//
// Until somebody is listed the page says so, is kept out of search (noindex)
// and out of the sitemap, so Google never files an empty directory.

export const revalidate = 600

export async function generateMetadata(): Promise<Metadata> {
  const listed = await publicListings()
  return {
    title: { absolute: 'Find a Cardtly Reseller Near You | Digital Business Cards South Africa' },
    description:
      'Local Cardtly resellers who set up digital business cards and NFC cards for companies across South Africa, and look after their teams. Find one in your province.',
    alternates: { canonical: LISTING_PATH },
    ...(listed.length ? {} : { robots: { index: false, follow: true } }),
  }
}

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
}
const muted = 'rgba(255,255,255,0.62)'
const panel: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }

export default async function FindAResellerPage() {
  const resellers = await publicListings()

  return (
    <div style={{ background: '#000', color: '#fff' }}>
      <Navbar />

      <section className="relative overflow-hidden px-6 lg:px-12 xl:px-16 pt-32 pb-10 lg:pt-40 lg:pb-12">
        <div className="absolute -top-32 left-[10%] w-[620px] h-[480px] rounded-full blur-[140px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 72%)' }} />
        <div className="relative max-w-[1200px] mx-auto" style={{ zIndex: 2 }}>
          <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#7c3aed' }}>Resellers</p>
          <h1 className="font-black tracking-[-0.02em] leading-[1.05] mb-5" style={{ fontSize: 'clamp(2.25rem, 4vw, 3.75rem)' }}>
            Find a Cardtly reseller <span style={gradText}>near you</span>
          </h1>
          <p className="text-lg leading-relaxed max-w-2xl" style={{ color: muted }}>
            Local partners who set up Cardtly digital business cards and NFC cards for companies, and look after their
            teams. Every reseller here is set up and approved by Cardtly.
          </p>
        </div>
      </section>

      <section className="px-6 lg:px-12 xl:px-16 pb-14">
        <div className="max-w-[1200px] mx-auto">
          {resellers.length ? (
            <ResellerDirectory resellers={resellers} />
          ) : (
            <div className="rounded-3xl p-8 max-w-2xl" style={panel}>
              <h2 className="text-xl font-bold mb-2">Our first resellers are on their way</h2>
              <p className="text-base leading-relaxed" style={{ color: muted }}>
                No reseller is listed here yet. Cardtly sets teams up directly too, so you do not have to wait.
              </p>
              <Link href="/contact"
                className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: grad }}>
                Talk to Cardtly <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="px-6 lg:px-12 xl:px-16 pb-20">
        <div className="max-w-[1200px] mx-auto grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl p-6" style={panel}>
            <Building2 className="w-6 h-6 mb-3" style={{ color: '#00d4ff' }} aria-hidden="true" />
            <h2 className="text-lg font-bold mb-1.5">Rather deal with Cardtly directly?</h2>
            <p className="text-sm leading-relaxed mb-4" style={{ color: muted }}>
              We set up company teams ourselves as well: every card, your company look, and NFC cards for your people.
            </p>
            <Link href="/teams" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline">
              Cardtly for teams <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="rounded-3xl p-6" style={panel}>
            <Handshake className="w-6 h-6 mb-3" style={{ color: '#ec4899' }} aria-hidden="true" />
            <h2 className="text-lg font-bold mb-1.5">Sell Cardtly in your area</h2>
            <p className="text-sm leading-relaxed mb-4" style={{ color: muted }}>
              Agencies, print shops and anyone whose clients need business cards can resell Cardtly at their own price.
            </p>
            <Link href="/resellers" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline">
              Become a reseller <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
