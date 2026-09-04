import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

// The top of every dashboard page.
//
// Each page used to write its own: an h1 at text-2xl here, text-xl there, a
// couple with tracking-tight and most without, some inside a tinted panel and
// some not. The Overview then got a 42px treatment and the difference between
// it and everything else read as "one page was designed and the rest were
// assembled".
//
// One component, so a page says what it is called and gets the size, the
// spacing, the accent wash and the rule for free.

interface Props {
  /** Small tracked line above the title: a date, a section, a breadcrumb. */
  eyebrow?: React.ReactNode
  title: React.ReactNode
  /** One line saying what the page is for. Worth writing. */
  subtitle?: React.ReactNode
  /** Status chips, counts, badges. Sits under the subtitle. */
  meta?: React.ReactNode
  /** Buttons, pinned right and wrapping under on a narrow screen. */
  actions?: React.ReactNode
  /** Rendered above the eyebrow, for pages that are inside something else. */
  back?: { href: string; label: string }
}

export default function PageHeader({ eyebrow, title, subtitle, meta, actions, back }: Props) {
  return (
    <header className="header-wash pb-6 pt-1 border-b border-border">
      {back && (
        <Link href={back.href}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition mb-2">
          <ArrowLeft className="w-3.5 h-3.5" />{back.label}
        </Link>
      )}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="section-label">{eyebrow}</p>}
          <h1 className={`page-title ${eyebrow ? 'mt-2' : ''}`}>{title}</h1>
          {subtitle && <p className="page-subtitle mt-2 max-w-2xl">{subtitle}</p>}
          {meta && <div className="flex items-center gap-2.5 mt-3 flex-wrap">{meta}</div>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
      </div>
    </header>
  )
}
