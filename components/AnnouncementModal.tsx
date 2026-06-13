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

// Big centered popup for announcements set to display_style='modal'.
// Used for broadcasts that must not be missed (new features, downtime,
// promos) - unlike the banner, it dims the screen and sits front and
// centre. Same per-announcement-per-browser dismissal as the banner
// (different id = shows again), so the admin posting a new modal
// reaches everyone once more.

export default function AnnouncementModal() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [show, setShow] = useState(false)

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
        // Only modal-style announcements render here.
        if (a.display_style !== 'modal') return
        try {
          if (localStorage.getItem(`cardtly:announce-${a.id}`) === '1') return
        } catch {}
        setAnnouncement(a)
        // Next frame so the entrance transition runs.
        requestAnimationFrame(() => setShow(true))
      })
  }, [])

  if (!announcement) return null

  function dismiss() {
    if (!announcement) return
    try { localStorage.setItem(`cardtly:announce-${announcement.id}`, '1') } catch {}
    setShow(false)
    // Unmount after the exit transition.
    setTimeout(() => setAnnouncement(null), 200)
  }

  const colors = {
    info:    { glow: 'rgba(0,212,255,0.35)',  icon: '#00d4ff', ring: 'rgba(0,212,255,0.3)' },
    success: { glow: 'rgba(34,197,94,0.35)',  icon: '#22c55e', ring: 'rgba(34,197,94,0.3)' },
    warning: { glow: 'rgba(245,158,11,0.35)', icon: '#fbbf24', ring: 'rgba(245,158,11,0.3)' },
  }
  const c = colors[announcement.variant] || colors.info

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        opacity: show ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }}
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #14142b, #0a0a18)',
          border: `1px solid ${c.ring}`,
          boxShadow: `0 30px 90px rgba(0,0,0,0.6), 0 0 80px ${c.glow}`,
          transform: show ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(12px)',
          opacity: show ? 1 : 0,
          transition: 'transform 0.22s cubic-bezier(0.2,0.8,0.2,1), opacity 0.22s ease',
        }}
      >
        {/* Top glow band */}
        <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at top, ${c.glow} 0%, transparent 70%)` }} />

        <button onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition hover:bg-white/10 z-10"
          style={{ color: 'rgba(255,255,255,0.6)' }}>
          <X className="w-5 h-5" />
        </button>

        <div className="relative px-8 pt-10 pb-8 text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{ background: `${c.icon}1f`, border: `1px solid ${c.ring}` }}>
            <Megaphone className="w-8 h-8" style={{ color: c.icon }} />
          </div>

          <p className="text-xl md:text-2xl font-black text-white leading-snug mb-2 whitespace-pre-wrap">
            {announcement.message}
          </p>

          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            {announcement.link_url && (
              <a href={announcement.link_url}
                target={announcement.link_url.startsWith('http') ? '_blank' : undefined}
                rel="noopener noreferrer"
                onClick={dismiss}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition hover:scale-[1.03]"
                style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)', boxShadow: '0 8px 30px rgba(124,58,237,0.4)' }}>
                {announcement.link_text || 'Learn more'}
                <ArrowRight className="w-4 h-4" />
              </a>
            )}
            <button onClick={dismiss}
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm font-semibold transition hover:bg-white/10"
              style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}>
              {announcement.link_url ? 'Dismiss' : 'Got it'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
