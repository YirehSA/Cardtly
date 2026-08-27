'use client'

import { useState, useMemo } from 'react'
import { Search, Building2, ArrowLeft, ExternalLink, Users, X, Network, Flag } from 'lucide-react'
import ReportCardDialog from '@/components/network/ReportCardDialog'
import { INDUSTRIES } from '@/lib/industries'
import {
  searchCompanies,
  searchIndependents,
  companyFacets,
  filterCompanyCards,
  type NetworkCompany,
  type NetworkCard,
} from '@/lib/network'
import { parseDesign, getAccentHex } from '@/types/design'

interface Props {
  companies: NetworkCompany[]
  independents: NetworkCard[]
  totalCards: number
  /** How many this person has blocked, so the count can be explained. */
  blockedCount?: number
}

const HOUSE_GRADIENT = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

export default function NetworkDirectory({
  companies,
  independents,
  totalCards,
  blockedCount = 0,
}: Props) {
  const [query, setQuery] = useState('')
  const [industry, setIndustry] = useState<string | null>(null)
  const [selected, setSelected] = useState<NetworkCompany | null>(null)
  // Which card is being reported. Held here rather than in the tile so the
  // dialog is not nested inside the anchor that opens the card.
  const [reporting, setReporting] = useState<NetworkCard | null>(null)

  const results = useMemo(
    () => searchCompanies(companies, query, industry),
    [companies, query, industry]
  )

  const soloResults = useMemo(
    () => searchIndependents(independents, query, industry),
    [independents, query, industry]
  )

  const nothingFound = results.length === 0 && soloResults.length === 0

  // Count what someone can actually browse to, not every grouped key: the
  // low-signal one-person entries are hidden from the grid, so counting them
  // would promise more than the page shows.
  const listedCount = useMemo(
    () => companies.filter(c => !c.lowSignal).length,
    [companies]
  )

  // Only offer industries somebody is actually in, and carry the count on the
  // chip so the filter says how much is behind it before you commit to a click.
  const industryChips = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of companies) {
      if (c.lowSignal || !c.industry) continue
      counts.set(c.industry, (counts.get(c.industry) || 0) + 1)
    }
    for (const p of independents) {
      if (!p.industry) continue
      counts.set(p.industry, (counts.get(p.industry) || 0) + 1)
    }
    return INDUSTRIES.filter(i => counts.has(i.id)).map(i => ({
      ...i,
      count: counts.get(i.id)!,
    }))
  }, [companies, independents])

  if (selected) {
    return <CompanyDetail company={selected} onBack={() => setSelected(null)} />
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {reporting && (
        <ReportCardDialog
          cardId={reporting.isTeamCard ? null : reporting.id}
          teamCardId={reporting.isTeamCard ? reporting.id : null}
          cardName={reporting.name}
          canBlock
          // Reloaded rather than filtered in place: the count in the header,
          // the company groupings and the industry chips are all computed on
          // the server from the same list, and patching one of them would
          // leave the other two saying something different.
          onBlocked={() => window.location.reload()}
          onClose={() => setReporting(null)}
        />
      )}

      {/* Header, in the same shape as the other dashboard pages */}
      <div className="rounded-3xl border border-border overflow-hidden">
        <div
          className="p-6 sm:p-8"
          style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.14), transparent 65%)' }}
        >
          <div className="flex items-start justify-between flex-wrap gap-5">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl grid place-items-center text-white shrink-0"
                style={{ background: HOUSE_GRADIENT }}
              >
                <Network className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold leading-tight">Network</h1>
                <p className="text-muted-foreground text-sm">
                  Everyone on Cardtly, by company. Find a business, see who works there,
                  open their card.
                </p>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Stat value={listedCount} label={listedCount === 1 ? 'company' : 'companies'} />
              <Stat value={totalCards} label={totalCards === 1 ? 'card' : 'cards'} />
              <Stat value={industryChips.length} label="industries" />
            </div>
          </div>
          {/* Said out loud, because a directory that is quietly shorter than
              it should be is indistinguishable from one that is broken. */}
          {blockedCount > 0 && (
            <div className="mt-4 text-xs text-muted-foreground">
              {blockedCount} card{blockedCount === 1 ? ' is' : 's are'} hidden because you blocked
              {blockedCount === 1 ? ' it' : ' them'}.{' '}
              <a href="/dashboard/settings#blocked" className="underline hover:text-foreground">Manage blocked cards</a>
            </div>
          )}
        </div>
      </div>

      {/* Search + industry filter */}
      <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 space-y-4">
        <div className="relative">
          <label htmlFor="network-search" className="sr-only">
            Search the network
          </label>
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="network-search"
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search a company, a person or a job title"
            className="w-full h-12 pl-11 pr-14 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {industryChips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Chip active={!industry} onClick={() => setIndustry(null)}>
              All industries
            </Chip>
            {industryChips.map(i => (
              <Chip
                key={i.id}
                active={industry === i.id}
                onClick={() => setIndustry(industry === i.id ? null : i.id)}
              >
                {i.label}
                <span className="ml-1.5 opacity-60 tabular-nums">{i.count}</span>
              </Chip>
            ))}
          </div>
        )}
      </div>

      {nothingFound ? (
        <div className="rounded-3xl border border-dashed border-border bg-card text-center py-16 px-4">
          <div className="w-12 h-12 rounded-2xl bg-muted grid place-items-center mx-auto">
            <Search className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <h2 className="mt-4 font-semibold">Nothing matched</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {query
              ? `No company, person or position matches "${query}".`
              : 'Nobody has set this industry on their card yet.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setIndustry(null)
            }}
            className="mt-6 min-h-[44px] px-5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: HOUSE_GRADIENT }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {/* grid-cols-1 is load-bearing, not decoration. Without an
              explicit template the mobile column is an implicit `auto`
              track, which sizes to the widest item's min-content and
              overflows its container - one company name long enough
              ("Glue Devil Nation Adhesive Distributors (Pty) Ltd", 427px)
              pushed the whole page 68px wider than the viewport and every
              dashboard page scrolled sideways. grid-cols-1 is
              repeat(1, minmax(0, 1fr)), whose zero minimum lets the track
              shrink and the truncate on each label do its job. */}
          {results.length > 0 && (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map(company => (
                <li key={company.key}>
                  <CompanyTile company={company} onOpen={() => setSelected(company)} />
                </li>
              ))}
            </ul>
          )}

          {soloResults.length > 0 && (
            <section className={results.length > 0 ? 'pt-4' : ''}>
              <div className="flex items-baseline gap-2 mb-3 px-1">
                <h2 className="font-semibold text-sm">Independent</h2>
                <p className="text-xs text-muted-foreground">
                  No company set on their card
                </p>
              </div>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {soloResults.map(card => (
                  <li key={card.id}>
                    <PersonCard card={card} onReport={() => setReporting(card)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}

// Black or white on the member's accent colour, whichever actually measures
// better. getReadableTextOn() exists for this but switches on luminance alone,
// so on a mid-tone accent like the default blue it returns white at 3.7:1 when
// black would have given 5.7:1. Card rendering depends on that helper, so this
// stays local rather than changing it underneath everything else.
function inkOn(hex: string): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  if (full.length !== 6) return '#ffffff'
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  const [r, g, b] = [0, 2, 4].map(i => lin(parseInt(full.slice(i, i + 2), 16) / 255))
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b
  // Contrast against white vs against black; take the winner.
  return (1.05) / (L + 0.05) >= (L + 0.05) / 0.05 ? '#ffffff' : '#111111'
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 px-4 py-2.5 min-w-[92px]">
      <p className="text-xl font-black tracking-tight tabular-nums leading-none">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  )
}

// A labelled row of filter chips. Capped, because a company where everyone
// has a distinct job title would otherwise render four hundred chips and bury
// the people underneath them; the search box still reaches whatever the cap
// leaves out, and the count says how many that is.
function FacetRow({
  label, facets, value, onChange,
}: {
  label: string
  facets: Array<{ value: string; count: number }>
  value: string | null
  onChange: (v: string | null) => void
}) {
  const MAX = 8
  // A selected value must stay visible even if it sits outside the top few,
  // or clearing the filter becomes impossible from the UI.
  const head = facets.slice(0, MAX)
  const shown = value && !head.some(f => f.value === value)
    ? [...head, facets.find(f => f.value === value)!]
    : head
  const hidden = facets.length - head.length

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
        {label}
      </span>
      <Chip active={!value} onClick={() => onChange(null)}>All</Chip>
      {shown.map(f => (
        <Chip key={f.value} active={value === f.value}
          onClick={() => onChange(value === f.value ? null : f.value)}>
          {f.value} <span className="opacity-60 tabular-nums">{f.count}</span>
        </Chip>
      ))}
      {hidden > 0 && (
        <span className="text-[11px] text-muted-foreground">
          +{hidden} more, use search
        </span>
      )}
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[36px] px-3.5 rounded-full text-xs font-semibold border transition focus:outline-none focus:ring-2 focus:ring-ring ${
        active
          ? 'text-white border-transparent'
          : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/25'
      }`}
      style={active ? { background: HOUSE_GRADIENT } : undefined}
    >
      {children}
    </button>
  )
}

function CompanyTile({
  company,
  onOpen,
}: {
  company: NetworkCompany
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full h-full text-left rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <div className="flex items-start gap-4">
        <CompanyLogo company={company} />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-sm truncate">{company.name}</h2>
          {company.industryLabel && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {company.industryLabel}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" aria-hidden="true" />
          {company.cardCount} {company.cardCount === 1 ? 'person' : 'people'}
        </span>
        {/* A glance at who is actually in there, which a bare number does not
            give you. Capped at four so a big team does not overrun the row. */}
        <AvatarStack cards={company.cards} />
      </div>
    </button>
  )
}

function AvatarStack({ cards }: { cards: NetworkCard[] }) {
  const shown = cards.slice(0, 4)
  const extra = cards.length - shown.length
  return (
    <span className="flex items-center -space-x-2">
      {shown.map(card => (
        <Avatar key={card.id} card={card} />
      ))}
      {extra > 0 && (
        <span className="w-7 h-7 rounded-full bg-muted border-2 border-card grid place-items-center text-[10px] font-bold text-muted-foreground tabular-nums">
          +{extra}
        </span>
      )}
    </span>
  )
}

function Avatar({ card, size = 28 }: { card: NetworkCard; size?: number }) {
  const accent = getAccentHex(parseDesign(card.colorTheme))
  const initials = card.name
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase()

  if (card.profileImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={card.profileImageUrl}
        alt=""
        className="rounded-full object-cover border-2 border-card bg-muted"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className="rounded-full border-2 border-card grid place-items-center font-bold"
      style={{
        width: size,
        height: size,
        background: accent,
        color: inkOn(accent),
        fontSize: size * 0.36,
      }}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  )
}

function CompanyDetail({
  company,
  onBack,
}: {
  company: NetworkCompany
  onBack: () => void
}) {
  // Its own state: this screen renders the same tiles, so it needs the same
  // dialog. Sharing one with the parent would mean lifting it through a
  // component that is only ever shown instead of the parent, never with it.
  const [reporting, setReporting] = useState<NetworkCard | null>(null)

  // Finding one person inside a company was a scroll, and inside a group with
  // several hundred it was not possible at all.
  const [q, setQ] = useState('')
  const [dept, setDept] = useState<string | null>(null)
  const [title, setTitle] = useState<string | null>(null)

  const { departments, titles } = useMemo(() => companyFacets(company.cards), [company.cards])
  const shown = useMemo(
    () => filterCompanyCards(company.cards, q, dept, title),
    [company.cards, q, dept, title]
  )
  const filtered = !!(q.trim() || dept || title)

  return (
    <div className="space-y-5 animate-fade-in">
      {reporting && (
        <ReportCardDialog
          cardId={reporting.isTeamCard ? null : reporting.id}
          teamCardId={reporting.isTeamCard ? reporting.id : null}
          cardName={reporting.name}
          canBlock
          onBlocked={() => window.location.reload()}
          onClose={() => setReporting(null)}
        />
      )}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 min-h-[44px] px-3 -ml-1 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to network
      </button>

      <div className="rounded-3xl border border-border overflow-hidden">
        <div
          className="p-6 sm:p-8"
          style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.14), transparent 65%)' }}
        >
          <div className="flex items-center gap-4">
            <CompanyLogo company={company} large />
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold leading-tight break-words">
                {company.name}
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {company.industryLabel ? `${company.industryLabel} · ` : ''}
                {company.cardCount} {company.cardCount === 1 ? 'person' : 'people'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Shown once a company is big enough for scrolling to be annoying.
          The first version of this required more than five people, which was
          a guess, and measured against the real data it hid the whole block
          from every company except one: the largest has ten, the rest have
          one or two. A threshold set by imagining the customer is the same
          mistake the Team Cards search made at six.

          Each filter row still needs two or more distinct values of its own,
          because a control with one option cannot change what you see. That
          is the rule doing the real work; this outer gate only stops a
          three-person company carrying a search box it does not need. */}
      {company.cards.length > 2 && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={`Search ${company.name} by name, position or business unit`}
              aria-label={`Search within ${company.name}`}
              className="w-full min-h-[44px] pl-10 pr-10 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
            />
            {q && (
              <button type="button" onClick={() => setQ('')} aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {departments.length > 1 && (
            <FacetRow label="Business unit" facets={departments} value={dept} onChange={setDept} />
          )}
          {titles.length > 1 && (
            <FacetRow label="Position" facets={titles} value={title} onChange={setTitle} />
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Users className="w-6 h-6 mx-auto text-muted-foreground mb-2" aria-hidden="true" />
          <p className="text-sm font-medium">Nobody in {company.name} matches that</p>
          <button type="button"
            onClick={() => { setQ(''); setDept(null); setTitle(null) }}
            className="mt-3 min-h-[44px] px-4 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition">
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {filtered && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {shown.length} of {company.cards.length} {company.cards.length === 1 ? 'person' : 'people'}
            </p>
          )}
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map(card => (
              <li key={card.id}>
                <PersonCard card={card} onReport={() => setReporting(card)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

// A stand-in for the real card: the person's own accent colour, their photo,
// name and position. Rendering a full card preview for everyone would mean
// laying out dozens of templates on one screen, and this tile only has to be
// recognisable enough to click.
function PersonCard({ card, onReport }: { card: NetworkCard; onReport: () => void }) {
  const accent = getAccentHex(parseDesign(card.colorTheme))

  return (
    <div className="relative h-full group/tile">
      {/* Outside the anchor, not inside it: a button nested in a link is
          invalid, and the click would race the navigation. */}
      <button
        type="button"
        onClick={onReport}
        title={`Report or block ${card.name}`}
        aria-label={`Report or block ${card.name}`}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted transition opacity-0 focus:opacity-100 group-hover/tile:opacity-100"
      >
        <Flag className="w-3.5 h-3.5" />
      </button>
    <a
      href={`/card/${card.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block h-full rounded-2xl border border-border bg-card overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <div className="h-1.5" style={{ background: accent }} aria-hidden="true" />
      <div className="p-5">
        <div className="flex items-center gap-3">
          <Avatar card={card} size={48} />
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{card.name}</h3>
            {card.title && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{card.title}</p>
            )}
          </div>
        </div>
        <p className="mt-4 pt-4 border-t border-border text-xs font-semibold text-muted-foreground group-hover:text-foreground transition inline-flex items-center gap-1.5">
          Open card
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </p>
      </div>
    </a>
    </div>
  )
}

function CompanyLogo({
  company,
  large = false,
}: {
  company: NetworkCompany
  large?: boolean
}) {
  const size = large ? 'w-16 h-16' : 'w-12 h-12'
  if (company.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={company.logoUrl}
        alt=""
        className={`${size} rounded-xl object-contain bg-muted border border-border p-1.5 shrink-0`}
      />
    )
  }
  return (
    <span
      className={`${size} rounded-xl bg-muted border border-border grid place-items-center shrink-0`}
      aria-hidden="true"
    >
      <Building2 className={`${large ? 'w-6 h-6' : 'w-5 h-5'} text-muted-foreground`} />
    </span>
  )
}
