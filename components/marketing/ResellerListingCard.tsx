'use client'

import { Globe, Mail, MapPin, Phone } from 'lucide-react'
import { LevelBadge } from '@/components/reseller/ResellerLevelCard'
import { levelByKey } from '@/lib/reseller-levels'
import { placeLine, telHref, websiteLabel, type PublicReseller } from '@/lib/reseller-listing'

// One reseller on cardtly.com/find-a-reseller, and the preview of it on the
// reseller's own Listing tab. Dark, like the marketing site it sits on.

const action = 'inline-flex items-center gap-1.5 min-h-11 px-3.5 rounded-xl text-sm font-semibold transition hover:bg-white/10 break-all'
const actionStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }

export default function ResellerListingCard({ r }: { r: PublicReseller }) {
  const level = levelByKey(r.level)
  const place = placeLine(r)
  // Gold and Platinum stand out a little: the top of the ladder is meant to
  // be worth reaching.
  const top = r.level === 'gold' || r.level === 'platinum'
  return (
    <article className="h-full rounded-3xl p-6 flex flex-col"
      style={{ background: top ? `${level.colour}0f` : 'rgba(255,255,255,0.03)', border: `1px solid ${top ? `${level.colour}55` : 'rgba(255,255,255,0.08)'}` }}>
      <div className="flex items-start gap-3">
        <LevelBadge levelKey={r.level} />
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-tight break-words">{r.name}</h3>
          <p className="text-xs font-bold uppercase tracking-wider mt-1" style={{ color: level.colour }}>{level.name} reseller</p>
        </div>
      </div>
      {place && (
        <p className="text-sm mt-4 flex items-start gap-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />{place}
        </p>
      )}
      {r.blurb && <p className="text-sm leading-relaxed mt-3" style={{ color: 'rgba(255,255,255,0.78)' }}>{r.blurb}</p>}
      <div className="mt-auto pt-5 flex flex-wrap gap-2">
        {r.phone && (
          <a href={telHref(r.phone)} className={action} style={actionStyle}>
            <Phone className="w-4 h-4 flex-shrink-0" aria-hidden="true" />{r.phone}
          </a>
        )}
        {r.email && (
          <a href={`mailto:${r.email}`} className={action} style={actionStyle}>
            <Mail className="w-4 h-4 flex-shrink-0" aria-hidden="true" />{r.email}
          </a>
        )}
        {r.website && (
          <a href={r.website} target="_blank" rel="nofollow noopener noreferrer" className={action} style={actionStyle}>
            <Globe className="w-4 h-4 flex-shrink-0" aria-hidden="true" />{websiteLabel(r.website)}
          </a>
        )}
      </div>
    </article>
  )
}
