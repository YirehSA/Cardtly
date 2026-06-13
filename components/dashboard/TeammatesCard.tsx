'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Users, Copy, Share2, ExternalLink } from 'lucide-react'

interface Mate {
  id: string
  name: string | null
  title: string | null
  slug: string
  profile_image_url: string | null
}

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

// "Share a teammate's card" - shown on the dashboard for team
// members. Lists the other active cards in their org with copy +
// share actions, so anyone on the team can hand out a colleague's
// card in person ("let me give you our sales director's card").
// Renders nothing while loading or when the user isn't on a team.
export default function TeammatesCard() {
  const [mates, setMates] = useState<Mate[] | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/team/mates')
      .then(r => r.json())
      .then(data => {
        setMates(data.mates || [])
        setOrgName(data.org_name || null)
      })
      .catch(() => setMates([]))
  }, [])

  if (!mates || mates.length === 0) return null

  function cardUrl(slug: string) {
    return `https://cardtly.com/card/${slug}`
  }

  async function copyLink(mate: Mate) {
    try {
      await navigator.clipboard.writeText(cardUrl(mate.slug))
      toast.success(`${mate.name?.split(' ')[0] || 'Card'} link copied`)
    } catch {
      toast.error('Could not copy the link')
    }
  }

  async function shareCard(mate: Mate) {
    const url = cardUrl(mate.slug)
    // Native share sheet where available (the app + mobile browsers);
    // clipboard fallback on desktop.
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${mate.name} — digital business card`,
          url,
        })
      } catch {
        // User dismissed the sheet - not an error.
      }
    } else {
      copyLink(mate)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
          <Users className="w-4 h-4" style={{ color: '#a78bfa' }} />
        </div>
        <div>
          <p className="font-bold text-foreground text-sm">Share a teammate&apos;s card</p>
          <p className="text-xs text-muted-foreground">
            {orgName ? `${orgName} · ` : ''}hand out a colleague&apos;s card on the spot
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {mates.map(mate => (
          <div key={mate.id} className="flex items-center gap-3 p-3 rounded-xl border border-border transition hover:bg-muted">
            {mate.profile_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mate.profile_image_url} alt={mate.name || 'Teammate'}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                style={{ background: grad }}>
                {(mate.name || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">{mate.name || 'Unnamed'}</p>
              {mate.title && (
                <p className="text-xs text-muted-foreground truncate">{mate.title}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <a href={cardUrl(mate.slug)} target="_blank" rel="noopener noreferrer"
                title="Open card"
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button onClick={() => copyLink(mate)}
                title="Copy link"
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground">
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => shareCard(mate)}
                title="Share card"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white transition hover:opacity-90"
                style={{ background: grad }}>
                <Share2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
