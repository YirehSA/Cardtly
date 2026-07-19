'use client'

import { useState, useMemo } from 'react'
import { Search, Building2, ArrowLeft, ExternalLink, Users, X } from 'lucide-react'
import { INDUSTRIES } from '@/lib/industries'
import { searchCompanies, type NetworkCompany, type NetworkCard } from '@/lib/network'
import { parseDesign, getAccentHex } from '@/types/design'

interface Props {
  companies: NetworkCompany[]
  totalCards: number
}

export default function NetworkDirectory({ companies, totalCards }: Props) {
  const [query, setQuery] = useState('')
  const [industry, setIndustry] = useState<string | null>(null)
  const [selected, setSelected] = useState<NetworkCompany | null>(null)

  const results = useMemo(
    () => searchCompanies(companies, query, industry),
    [companies, query, industry]
  )

  // Only offer industries that somebody is actually in. A filter list full of
  // options that return nothing is worse than a short one.
  const availableIndustries = useMemo(() => {
    const present = new Set(companies.map(c => c.industry).filter(Boolean))
    return INDUSTRIES.filter(i => present.has(i.id))
  }, [companies])

  if (selected) {
    return <CompanyDetail company={selected} onBack={() => setSelected(null)} />
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Network</h1>
        <p className="mt-2 text-slate-600">
          {totalCards} {totalCards === 1 ? 'card' : 'cards'} across {companies.length}{' '}
          {companies.length === 1 ? 'company' : 'companies'}. Search for a company, a
          person or a job title.
        </p>
      </header>

      <div className="sticky top-0 z-10 -mx-4 px-4 py-4 bg-slate-50/95 backdrop-blur border-b border-slate-200 mb-8">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <label htmlFor="network-search" className="sr-only">
              Search the network
            </label>
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="network-search"
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search company, name or position"
              className="w-full h-12 pl-11 pr-10 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div>
            <label htmlFor="network-industry" className="sr-only">
              Filter by industry
            </label>
            <select
              id="network-industry"
              value={industry ?? ''}
              onChange={e => setIndustry(e.target.value || null)}
              className="w-full sm:w-64 h-12 px-4 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All industries</option>
              {availableIndustries.map(i => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {results.length === 0 ? (
        <EmptyState
          title="Nothing matched"
          body={
            query
              ? `No company, person or position matches "${query}".`
              : 'No cards in this industry yet.'
          }
          action={
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setIndustry(null)
              }}
              className="min-h-[44px] px-5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map(company => (
            <li key={company.key}>
              <button
                type="button"
                onClick={() => setSelected(company)}
                className="group w-full h-full text-left p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <div className="flex items-start gap-4">
                  <CompanyLogo company={company} />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                      {company.name}
                    </h2>
                    {company.industryLabel && (
                      <p className="mt-1 text-xs text-slate-500 truncate">
                        {company.industryLabel}
                      </p>
                    )}
                    <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-600">
                      <Users className="w-4 h-4 text-slate-400" aria-hidden="true" />
                      {company.cardCount} {company.cardCount === 1 ? 'person' : 'people'}
                    </p>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CompanyDetail({
  company,
  onBack,
}: {
  company: NetworkCompany
  onBack: () => void
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 min-h-[44px] px-3 -ml-3 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to network
      </button>

      <header className="mt-6 mb-8 flex items-start gap-5">
        <CompanyLogo company={company} large />
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-slate-900 break-words">{company.name}</h1>
          <p className="mt-2 text-slate-600">
            {company.industryLabel ? `${company.industryLabel} - ` : ''}
            {company.cardCount} {company.cardCount === 1 ? 'person' : 'people'}
          </p>
        </div>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {company.cards.map(card => (
          <li key={card.id}>
            <PersonCard card={card} />
          </li>
        ))}
      </ul>
    </div>
  )
}

// A small stand-in for the real card: the person's own accent colour, their
// photo, name and position. Rendering the full card preview for every person
// would mean parsing and laying out dozens of templates on one screen, and the
// point of this tile is only to be recognisable enough to click.
function PersonCard({ card }: { card: NetworkCard }) {
  const accent = getAccentHex(parseDesign(card.colorTheme))
  const initials = card.name
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()

  return (
    <a
      href={`/card/${card.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block h-full rounded-2xl bg-white border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      <div className="h-2" style={{ backgroundColor: accent }} aria-hidden="true" />
      <div className="p-5">
        <div className="flex items-center gap-4">
          {card.profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.profileImageUrl}
              alt=""
              width={56}
              height={56}
              className="w-14 h-14 rounded-full object-cover bg-slate-100 shrink-0"
            />
          ) : (
            <span
              className="w-14 h-14 rounded-full shrink-0 grid place-items-center font-semibold text-white"
              style={{ backgroundColor: accent }}
              aria-hidden="true"
            >
              {initials || '?'}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 truncate group-hover:text-blue-700 transition-colors">
              {card.name}
            </h3>
            {card.title && (
              <p className="text-sm text-slate-600 truncate">{card.title}</p>
            )}
          </div>
        </div>
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 group-hover:text-blue-700 transition-colors">
          Open card
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
        </p>
      </div>
    </a>
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
        className={`${size} rounded-xl object-contain bg-slate-50 border border-slate-200 p-1 shrink-0`}
      />
    )
  }
  return (
    <span
      className={`${size} rounded-xl bg-slate-100 border border-slate-200 grid place-items-center shrink-0`}
      aria-hidden="true"
    >
      <Building2 className={large ? 'w-7 h-7 text-slate-400' : 'w-5 h-5 text-slate-400'} />
    </span>
  )
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-slate-300 bg-white">
      <Search className="w-8 h-8 mx-auto text-slate-300" aria-hidden="true" />
      <h2 className="mt-4 font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-slate-600">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
