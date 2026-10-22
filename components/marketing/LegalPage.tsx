import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'

// The look of the legal pages (privacy, terms, trust, PAIA): black page,
// gradient title, one rounded panel per section. The privacy and terms pages
// still carry their own copies of these; the trust page and the PAIA manual
// share this one.

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
export const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

export const sectionStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
}

export const link = { color: '#00d4ff' }

export function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="p-8 md:p-10 rounded-3xl mb-6 scroll-mt-28" style={sectionStyle}>
      <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-5">{title}</h2>
      <div className="space-y-4 text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
        {children}
      </div>
    </div>
  )
}

export function B({ children }: { children: React.ReactNode }) {
  return <strong className="text-white">{children}</strong>
}

export function A({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} className="underline" style={link}>{children}</a>
}

/** A plain two-or-three column table that reads on a phone. Leave out the
 *  head for a list of labelled values, whose labels are the first column. */
export function Table({ head, rows }: { head?: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm border-collapse">
        {head && (
          <thead>
            <tr>
              {head.map(h => (
                <th key={h} className="text-left font-bold text-white px-2 py-2 align-bottom" style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>{h}</th>
              ))}
            </tr>
          </thead>
        )}
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

/** Numbered contents, for pages read by someone hunting for one answer. */
export function Contents({ items }: { items: [string, string][] }) {
  return (
    <nav aria-label="Contents" className="p-8 md:p-10 rounded-3xl mb-6" style={sectionStyle}>
      <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>Contents</p>
      <ol className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm list-decimal pl-5" style={{ color: 'rgba(255,255,255,0.7)' }}>
        {items.map(([id, label]) => (
          <li key={id}><a href={`#${id}`} className="hover:underline">{label}</a></li>
        ))}
      </ol>
    </nav>
  )
}

export default function LegalPage({ eyebrow, title, accent, intro, updated, children }: {
  eyebrow: string
  title: string
  accent: string
  intro: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <div style={{ background: '#000', color: '#fff' }}>
      <Navbar />

      <section className="pt-32 pb-12 px-6 text-center relative overflow-hidden">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] max-w-full h-[400px] rounded-full blur-[120px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.12) 0%, rgba(124,58,237,0.08) 50%, transparent 70%)' }}
        />
        <div className="relative max-w-3xl mx-auto">
          <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#00d4ff' }}>{eyebrow}</p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6">
            {title} <span style={gradText}>{accent}</span>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{intro}</p>
          <p className="text-sm mt-4" style={{ color: 'rgba(255,255,255,0.4)' }}>Last updated: {updated}</p>
        </div>
      </section>

      <section className="pb-24 px-6">
        <div className="max-w-3xl mx-auto">{children}</div>
      </section>

      <Footer />
    </div>
  )
}
