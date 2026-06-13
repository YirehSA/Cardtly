'use client'

import { useEffect, useState } from 'react'
import { Megaphone, X, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Announcement {
  id: string
  message: string
  link_url: string | null
  link_text: string | null
  variant: 'info' | 'success' | 'warning'
  display_style?: 'banner' | 'modal'
}

// Reads the single active announcement from the app_announcements table
// and shows it as a dismissible banner at the top of the dashboard.
// Dismissal is per-announcement-per-browser via localStorage so the
// same user gets a fresh banner the next time the admin posts a new
// one (different id = different dismiss key).
//
// Announcements set to display_style='modal' are skipped here - they
// render via AnnouncementModal instead so we never double up.

export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('app_announcements')
      .select('id, message, link_url, link_text, variant, display_style')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        const a = data as unknown as Announcement
        // Modal-style announcements render via AnnouncementModal, not here.
        if (a.display_style === 'modal') return
        // Check if this announcement was already dismissed
        try {
          if (localStorage.getItem(`cardtly:announce-${a.id}`) === '1') {
            setDismissed(true)
            return
          }
        } catch {}
        setAnnouncement(a)
      })
  }, [])

  if (!announcement || dismissed) return null

  function dismiss() {
    if (!announcement) return
    try { localStorage.setItem(`cardtly:announce-${announcement.id}`, '1') } catch {}
    setDismissed(true)
  }

  const colors = {
    info:    { bg: 'rgba(0,212,255,0.10)',  border: 'rgba(0,212,255,0.30)',  icon: '#00d4ff' },
    success: { bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.30)',  icon: '#22c55e' },
    warning: { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)', icon: '#fbbf24' },
  }
  const c = colors[announcement.variant] || colors.info

  return (
    <div className="mb-6 rounded-2xl border px-5 py-3 flex items-start gap-3 animate-fade-up"
      style={{ background: c.bg, borderColor: c.border }}>
      <Megaphone className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: c.icon }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>
          {announcement.message}
        </p>
        {announcement.link_url && (
          <a href={announcement.link_url}
            target={announcement.link_url.startsWith('http') ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs font-semibold hover:underline"
            style={{ color: c.icon }}>
            {announcement.link_text || 'Learn more'}
            <ArrowRight className="w-3 h-3" />
          </a>
        )}
      </div>
      <button onClick={dismiss}
        aria-label="Dismiss announcement"
        className="text-muted-foreground hover:text-foreground transition flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
