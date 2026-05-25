'use client'

import { useState } from 'react'
import { Card, extractLinks } from '@/types/database'
import { parseDesign, FONTS, getBgColors, calcPhotoSize, calcLogoHeight, getAccentHex, getReadableTextOn, getButtonBg, getButtonText, getButtonBorder, getCardStyleEffect, TEXT_POSITION_TEMPLATES } from '@/types/design'
import {
  Phone, Mail, MapPin, Globe, MessageCircle,
  ExternalLink, Share2, Download, ChevronRight,
  Instagram, Linkedin, Twitter, Facebook
} from 'lucide-react'
import { toast } from 'sonner'
import { isNativeApp, shareNative, saveContactNative } from '@/lib/capacitor'
import InAppBackButton from '@/components/InAppBackButton'
import AvailabilityBadge from './AvailabilityBadge'
import BookingModal from './BookingModal'

interface Props {
  card: Card & { _team_card_id?: string }
  isPro: boolean
  isTeamCard?: boolean
  lastActiveAt?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// ALL sub-components are defined at the TOP LEVEL of the module.
// Defining them inside the parent component causes React to treat them as new
// component types on every render, which unmounts/remounts them and loses focus.
// ─────────────────────────────────────────────────────────────────────────────

interface Shared {
  card: Card
  isPro: boolean
  accentHex: string
  bg: { page: string; card: string; surface: string; text: string; subtext: string; border: string }
  font: { heading: string; body: string }
  cardEffect: { surfaceBg: string; borderStyle: string; heroBg: string }
  design: ReturnType<typeof parseDesign>
}

// ── LogoZone ──────────────────────────────────────────────────────────────────
function LogoZone({ card, design, accentHex }: Pick<Shared, 'card' | 'design' | 'accentHex'>) {
  if (!card.company_logo_url || design.logoPosition === 'hidden') return null
  const h = calcLogoHeight(40, design)
  const justify = design.logoPosition === 'left' ? 'flex-start' : design.logoPosition === 'right' ? 'flex-end' : 'center'
  return (
    <div style={{ display: 'flex', justifyContent: justify, margin: '0 0 16px' }}>
      <img src={card.company_logo_url} style={{ height: h, width: 'auto', objectFit: 'contain', maxWidth: 160 }} />
    </div>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ card, bg, accentHex, font, design, size = 112, rounded = 'full', extraStyle = {} }: Pick<Shared, 'card' | 'bg' | 'accentHex' | 'font' | 'design'> & {
  size?: number; rounded?: string; extraStyle?: React.CSSProperties
}) {
  const scaledSize = calcPhotoSize(size, design)
  const borderRadius = rounded === 'full' ? '50%' : rounded === 'xl' ? 18 : 12
  const baseStyle: React.CSSProperties = {
    width: scaledSize, height: scaledSize, objectFit: 'cover', flexShrink: 0,
    borderRadius, border: `4px solid ${bg.page}`, ...extraStyle,
  }
  if (card.profile_image_url) return <img src={card.profile_image_url} style={baseStyle} />
  return (
    <div style={{ ...baseStyle, backgroundColor: accentHex + '33', color: accentHex, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: scaledSize * 0.36, fontWeight: 700, fontFamily: font.heading }}>
      {card.name?.[0]?.toUpperCase()}
    </div>
  )
}

// ── ContactBtn ────────────────────────────────────────────────────────────────
function ContactBtn({ icon, label, sublabel, href, accentHex, bg, cardEffect }: {
  icon: React.ReactNode; label: string; sublabel?: string; href: string
  accentHex: string
  bg: Shared['bg']
  cardEffect: Shared['cardEffect']
}) {
  return (
    <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="flex items-center gap-4 rounded-2xl px-4 py-3.5 transition hover:opacity-80"
      style={{ backgroundColor: cardEffect.surfaceBg, border: cardEffect.borderStyle }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: accentHex + '22', color: accentHex }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: bg.text }}>{label}</p>
        {sublabel && <p className="text-xs" style={{ color: bg.subtext }}>{sublabel}</p>}
      </div>
      <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: bg.subtext }} />
    </a>
  )
}

// ── AllContacts ───────────────────────────────────────────────────────────────
function AllContacts({ card, isPro, accentHex, bg, cardEffect, socialLinks }: Pick<Shared, 'card' | 'isPro' | 'accentHex' | 'bg' | 'cardEffect'> & {
  socialLinks: { platform: string; url: string; icon: React.ReactNode }[]
}) {
  return (
    <div className="space-y-2.5">
      {card.phone && <ContactBtn icon={<Phone className="w-4 h-4" />} label={card.phone} href={`tel:${card.phone}`} accentHex={accentHex} bg={bg} cardEffect={cardEffect} />}
      {isPro && card.work_phone && <ContactBtn icon={<Phone className="w-4 h-4" />} label={card.work_phone} sublabel="Work" href={`tel:${card.work_phone}`} accentHex={accentHex} bg={bg} cardEffect={cardEffect} />}
      {isPro && card.whatsapp && <ContactBtn icon={<MessageCircle className="w-4 h-4" />} label={card.whatsapp} sublabel="WhatsApp" href={`https://wa.me/${card.whatsapp.replace(/\D/g, '')}`} accentHex={accentHex} bg={bg} cardEffect={cardEffect} />}
      {card.email && <ContactBtn icon={<Mail className="w-4 h-4" />} label={card.email} href={`mailto:${card.email}`} accentHex={accentHex} bg={bg} cardEffect={cardEffect} />}
      {isPro && card.address && <ContactBtn icon={<MapPin className="w-4 h-4" />} label={card.address} href={`https://maps.google.com/?q=${encodeURIComponent(card.address)}`} accentHex={accentHex} bg={bg} cardEffect={cardEffect} />}
      {card.website && <ContactBtn icon={<Globe className="w-4 h-4" />} label={card.website.replace(/^https?:\/\//, '')} href={card.website.startsWith('http') ? card.website : `https://${card.website}`} accentHex={accentHex} bg={bg} cardEffect={cardEffect} />}
      {socialLinks.map(s => <ContactBtn key={s.platform} icon={s.icon} label={`${s.platform} Profile`} href={s.url} accentHex={accentHex} bg={bg} cardEffect={cardEffect} />)}
    </div>
  )
}

// ── BottomSection ─────────────────────────────────────────────────────────────
interface BottomProps {
  card: Card & { _team_card_id?: string }
  isPro: boolean
  isTeamCard?: boolean
  links: { index: number; title: string; url: string }[]
  certifications: string[]
  galleryImages: { url: string; link?: string }[]
  accentHex: string
  buttonBg: string
  buttonText: string
  buttonBorder: string | null
  bg: Shared['bg']
  cardEffect: Shared['cardEffect']
  handleShare: () => void
}

// Helper that renders the Book a Meeting button. Encapsulates the modal
// state so the BottomSection JSX stays clean.
function BookingTrigger({ card, accentHex, buttonBg, buttonText, buttonBorder }: { card: Card; accentHex: string; buttonBg: string; buttonText: string; buttonBorder: string | null }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm hover:opacity-90 transition"
        style={{
          backgroundColor: 'transparent',
          color: accentHex,
          border: `1.5px solid ${accentHex}`,
        }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
        Book a meeting
      </button>
      <BookingModal
        open={open}
        onClose={() => setOpen(false)}
        cardId={card.id}
        cardName={card.name || ''}
        accentHex={accentHex}
      />
    </>
  )
}

function BottomSection({ card, isPro, isTeamCard, links, certifications, galleryImages, accentHex, buttonBg, buttonText, buttonBorder, bg, cardEffect, handleShare }: BottomProps) {
  const [showContactForm, setShowContactForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function submitContact(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, phone, message,
          card_id: isTeamCard ? null : card.id,
          team_card_id: isTeamCard ? (card as any)._team_card_id : null,
        }),
      })
      if (res.ok) { setSubmitted(true); toast.success('Message sent!') }
      else toast.error('Something went wrong')
    } catch { toast.error('Something went wrong') }
    setSubmitting(false)
  }

  return (
    <>
      {certifications.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: bg.subtext }}>Certifications</p>
          <div className="flex flex-wrap gap-2">
            {certifications.map(c => (
              <span key={c} className="text-xs px-3 py-1.5 rounded-full" style={{ backgroundColor: accentHex + '22', color: accentHex, border: `1px solid ${accentHex}44` }}>#{c}</span>
            ))}
          </div>
        </div>
      )}

      {links.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: bg.subtext }}>Links</p>
          <div className="space-y-2.5">
            {links.map(l => (
              <a key={l.index} href={l.url.startsWith('http') ? l.url : `https://${l.url}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-4 rounded-2xl px-4 py-3.5 transition hover:opacity-80"
                style={{ backgroundColor: cardEffect.surfaceBg, border: cardEffect.borderStyle }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: accentHex + '22', color: accentHex }}>
                  <ExternalLink className="w-4 h-4" />
                </div>
                <p className="flex-1 text-sm font-medium truncate" style={{ color: bg.text }}>{l.title}</p>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: bg.subtext }} />
              </a>
            ))}
          </div>
        </div>
      )}

      {galleryImages.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: bg.subtext }}>Gallery</p>
          <div className="grid grid-cols-2 gap-2">
            {galleryImages.map((item, i) => (
              <a key={i} href={item.link || item.url} target="_blank" rel="noopener noreferrer">
                <img src={item.url} alt={`Gallery ${i + 1}`} className="w-full aspect-video object-cover rounded-xl hover:opacity-80 transition" />
              </a>
            ))}
          </div>
        </div>
      )}

      {isPro && (
        <BookingTrigger card={card} accentHex={accentHex} buttonBg={buttonBg} buttonText={buttonText} buttonBorder={buttonBorder} />
      )}
      <div className="mt-8 flex gap-3">
        <button onClick={async (e) => {
          // In the Cardtly Android app: use the native Contacts API to add
          // directly to the device address book. On the web: fall through to
          // the vCard download href.
          if (isNativeApp()) {
            e.preventDefault()
            try {
              await saveContactNative({
                name: card.name,
                title: card.title,
                company: card.company,
                email: card.email,
                phone: card.phone,
                whatsapp: card.whatsapp,
                website: card.website,
                address: card.address,
              })
              toast.success('Saved to contacts')
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Could not save contact'
              toast.error(msg)
            }
            return
          }
          // Web fallback: navigate to the vCard download endpoint
          window.location.href = `/api/vcf/${card.slug}`
        }}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm hover:opacity-90 transition"
          style={{
            backgroundColor: buttonBg,
            color: buttonText,
            border: buttonBorder ? `2px solid ${buttonBorder}` : 'none',
          }}>
          <Download className="w-4 h-4" />Save Contact
        </button>
        <button onClick={handleShare}
          className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-semibold text-sm hover:opacity-80 transition"
          style={{ border: `1px solid ${bg.border}`, color: bg.text }}>
          <Share2 className="w-4 h-4" />Share
        </button>
      </div>

      {isPro && (
        <div className="mt-8">
          {!showContactForm && !submitted ? (
            <button onClick={() => setShowContactForm(true)}
              className="w-full py-3.5 rounded-2xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-80 transition"
              style={{ border: `1px solid ${bg.border}`, color: bg.subtext }}>
              Share your info with {card.name.split(' ')[0]}
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : submitted ? (
            <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: bg.surface }}>
              <p className="text-sm" style={{ color: bg.subtext }}>Thanks! {card.name.split(' ')[0]} will be in touch.</p>
            </div>
          ) : (
            <form onSubmit={submitContact} className="rounded-2xl p-5 space-y-3" style={{ backgroundColor: bg.surface, border: `1px solid ${bg.border}` }}>
              <h3 className="font-semibold text-sm mb-4" style={{ color: bg.text }}>Share your info with {card.name.split(' ')[0]}</h3>
              <input required placeholder="Your name" value={name} onChange={e => setName(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                style={{ backgroundColor: bg.card, border: `1px solid ${bg.border}`, color: bg.text }} />
              <input required type="email" placeholder="Your email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                style={{ backgroundColor: bg.card, border: `1px solid ${bg.border}`, color: bg.text }} />
              <input type="tel" placeholder="Your phone (optional)" value={phone} onChange={e => setPhone(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                style={{ backgroundColor: bg.card, border: `1px solid ${bg.border}`, color: bg.text }} />
              <textarea placeholder="Message (optional)" value={message} rows={3} onChange={e => setMessage(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
                style={{ backgroundColor: bg.card, border: `1px solid ${bg.border}`, color: bg.text }} />
              <button type="submit" disabled={submitting}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: accentHex }}>
                {submitting ? 'Sending...' : 'Send'}
              </button>
            </form>
          )}
        </div>
      )}

      {!isPro && (
        <div className="mt-10 text-center">
          <a href="/" className="text-xs hover:opacity-70 transition" style={{ color: bg.subtext }}>
            Powered by <span className="font-semibold">Cardtly</span>
          </a>
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component — only computes values and renders layout
// ─────────────────────────────────────────────────────────────────────────────

export default function PublicCardView({ card, isPro, isTeamCard, lastActiveAt }: Props) {
  const design = parseDesign(card.color_theme)
  const font = FONTS[design.fontId]
  const bg = getBgColors(design.bgMode, design.templateId)
  const accentHex = getAccentHex(design)
  const buttonBg = getButtonBg(design)
  const buttonText = getButtonText(design)
  const buttonBorder = getButtonBorder(design)
  const cardEffect = getCardStyleEffect(design.cardStyle, accentHex, bg.page)
  const textNudge = TEXT_POSITION_TEMPLATES.includes(design.templateId)
    ? { transform: `translate(${design.textX ?? 0}px, ${design.textY ?? 0}px)` }
    : {}
  const isLight = design.bgMode === 'light'

  const links = isPro ? extractLinks(card) : []
  const certifications = isPro && card.certifications
    ? card.certifications.split(',').map(c => c.trim()).filter(Boolean)
    : []
  const galleryImages = isPro ? [
    { url: card.image_1_url, link: (card as any).image_1_link },
    { url: card.image_2_url, link: (card as any).image_2_link },
    { url: card.image_3_url, link: (card as any).image_3_link },
    { url: card.image_4_url, link: (card as any).image_4_link },
    { url: card.image_5_url, link: (card as any).image_5_link },
  ].filter(item => item.url) as { url: string; link?: string }[] : []
  const socialLinks = isPro ? [
    card.linkedin_url && { platform: 'LinkedIn', url: card.linkedin_url, icon: <Linkedin className="w-4 h-4" /> },
    card.twitter_url && { platform: 'Twitter / X', url: card.twitter_url, icon: <Twitter className="w-4 h-4" /> },
    card.instagram_url && { platform: 'Instagram', url: card.instagram_url, icon: <Instagram className="w-4 h-4" /> },
    (card as any).facebook_url && { platform: 'Facebook', url: (card as any).facebook_url, icon: <Facebook className="w-4 h-4" /> },
  ].filter(Boolean) as { platform: string; url: string; icon: React.ReactNode }[] : []

  async function handleShare() {
    const url = window.location.href
    const title = `${card.name} - Digital Business Card`
    try {
      await shareNative({ title, url, dialogTitle: 'Share card' })
      if (!isNativeApp() && !('share' in navigator)) {
        toast.success('Link copied')
      }
    } catch (err) {
      console.warn('Share failed', err)
      toast.error('Could not share')
    }
  }

  // Shared prop bundles
  const shared: Shared = { card, isPro, accentHex, bg, font, cardEffect, design }
  const bottomProps: BottomProps = { card, isPro, isTeamCard, links, certifications, galleryImages, accentHex, buttonBg, buttonText, buttonBorder, bg, cardEffect, handleShare }

  const pageStyle: React.CSSProperties = { minHeight: '100vh', backgroundColor: bg.page, color: bg.text, fontFamily: font.body }

  // Floating availability badge (Online now / Active 2h ago). Rendered
  // fixed at top-center over every template so it doesn't conflict
  // with template-specific layouts. Hidden entirely when there's no
  // last_active_at timestamp.
  const floatingBadge = lastActiveAt ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40">
      <AvailabilityBadge lastActiveAt={lastActiveAt} textColor={bg.text} />
    </div>
  ) : null

  if (design.templateId === 'classic') {
    return (
      <div style={pageStyle} className="animate-fade-up">
        <InAppBackButton bgMode={design.bgMode} />
        {floatingBadge}
        <button onClick={handleShare} className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }}>
          <Share2 className="w-4 h-4" style={{ color: bg.text }} />
        </button>
        <div className="max-w-md mx-auto">
          <div style={{ height: 90, background: cardEffect.heroBg }} />
          <div className="px-6 pb-10" style={{ marginTop: -56 }}>
            <div className="text-center mb-6">
              <div style={{ display: 'inline-block', position: 'relative', zIndex: 2 }}>
                <Avatar {...shared} size={112} />
              </div>
              <h1 className="text-2xl font-bold mt-4 leading-tight" style={{ fontFamily: font.heading }}>{card.name}</h1>
              {isPro && card.title && <p className="font-medium mt-1" style={{ color: accentHex }}>{card.title}</p>}
              {card.company && <p className="text-sm mt-0.5" style={{ color: bg.subtext }}>{card.company}</p>}
              <div className="mt-2"><LogoZone {...shared} /></div>
              {card.bio && <p className="text-sm mt-4 leading-relaxed" style={{ color: bg.subtext }}>{card.bio}</p>}
            </div>
            <AllContacts {...shared} socialLinks={socialLinks} />
            <BottomSection {...bottomProps} />
          </div>
        </div>
      </div>
    )
  }

  if (design.templateId === 'modern') {
    return (
      <div style={pageStyle} className="animate-fade-up">
        <div style={{ height: 6, background: `linear-gradient(90deg, ${accentHex}, ${accentHex}44)` }} />
        <InAppBackButton bgMode={design.bgMode} />
        {floatingBadge}
        <button onClick={handleShare} className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }}>
          <Share2 className="w-4 h-4" style={{ color: bg.text }} />
        </button>
        <div className="max-w-md mx-auto px-6 py-8">
          <div className="flex items-start gap-5 mb-6">
            <div style={{ flexShrink: 0 }}>
              <Avatar {...shared} size={100} rounded="xl" extraStyle={{ border: `3px solid ${accentHex}44`, borderRadius: 18 }} />
            </div>
            <div className="flex-1 min-w-0 pt-2" style={textNudge}>
              <h1 className="text-2xl font-bold leading-tight" style={{ fontFamily: font.heading }}>{card.name}</h1>
              {isPro && card.title && <p className="text-sm font-semibold mt-1" style={{ color: accentHex, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.title}</p>}
              {card.company && <p className="text-sm mt-0.5" style={{ color: bg.subtext }}>{card.company}</p>}
            </div>
          </div>
          <div className="w-10 h-1 rounded-full mb-4" style={{ backgroundColor: accentHex }} />
          <LogoZone {...shared} />
          {card.bio && <p className="text-sm mb-6 leading-relaxed" style={{ color: bg.subtext }}>{card.bio}</p>}
          <AllContacts {...shared} socialLinks={socialLinks} />
          <BottomSection {...bottomProps} />
        </div>
      </div>
    )
  }

  if (design.templateId === 'bold') {
    const heroPhotoSize = calcPhotoSize(90, design)
    const heroBg = design.cardStyle === 'gradient'
      ? `linear-gradient(135deg, ${accentHex} 0%, ${accentHex}88 100%)`
      : design.cardStyle === 'glass'
        ? `linear-gradient(135deg, ${accentHex}cc 0%, ${accentHex}66 100%)`
        : accentHex
    return (
      <div style={pageStyle} className="animate-fade-up">
        <InAppBackButton bgMode={design.bgMode} />
        {floatingBadge}
        <button onClick={handleShare} className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
          <Share2 className="w-4 h-4 text-white" />
        </button>
        <div className="max-w-md mx-auto">
          <div style={{ background: heroBg, padding: '32px 24px', display: 'flex', alignItems: 'center', gap: 20, minHeight: 160, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <div style={{ position: 'absolute', right: 30, bottom: -30, width: 80, height: 80, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <div style={{ flexShrink: 0, position: 'relative', zIndex: 2 }}>
              <div style={{ borderRadius: '50%', overflow: 'hidden', width: heroPhotoSize, height: heroPhotoSize, border: '3px solid rgba(255,255,255,0.4)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
                {card.profile_image_url
                  ? <img src={card.profile_image_url} style={{ width: heroPhotoSize, height: heroPhotoSize, objectFit: 'cover' }} />
                  : <div style={{ width: heroPhotoSize, height: heroPhotoSize, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: heroPhotoSize * 0.36, fontWeight: 700, color: '#fff', fontFamily: font.heading }}>{card.name?.[0]?.toUpperCase()}</div>}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 2, ...textNudge }}>
              <h1 style={{ margin: '0 0 5px', fontSize: 22, fontWeight: 800, fontFamily: font.heading, color: '#fff', lineHeight: 1.1 }}>{card.name}</h1>
              {isPro && card.title && <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.2 }}>{card.title}</p>}
              {card.company && <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.2 }}>{card.company}</p>}
            </div>
          </div>
          <div className="px-6 py-6">
            <LogoZone {...shared} />
            {card.bio && <p className="text-sm mb-6 leading-relaxed" style={{ color: bg.subtext }}>{card.bio}</p>}
            <AllContacts {...shared} socialLinks={socialLinks} />
            <BottomSection {...bottomProps} />
          </div>
        </div>
      </div>
    )
  }

  if (design.templateId === 'minimal') {
    // Vibrant action-card layout. Pure black or white background, pink-purple
    // gradient ring around the avatar (fixed, not accent-driven), company logo
    // forced to top-centre above the photo, four fixed-colour circular
    // quick-action buttons (green/red/blue/purple), and a gradient cardtly.com
    // footer. Other templates still honour the accent colour; Minimal uses a
    // signature palette so the look matches the design reference exactly.
    const pageBg = isLight ? '#ffffff' : '#000000'
    const ink = isLight ? '#0f172a' : '#ffffff'
    const muted = isLight ? '#64748b' : 'rgba(255,255,255,0.55)'
    const titleColor = isLight ? '#475569' : 'rgba(255,255,255,0.85)'
    // Neon blue → purple → pink, matching the design reference. Goes
    // top-left to bottom-right so the blue starts at the top of the ring.
    const RING_GRADIENT = 'linear-gradient(135deg, #00d4ff 0%, #8b5cf6 50%, #ec4899 100%)'
    const URL_GRADIENT  = 'linear-gradient(90deg, #00d4ff, #8b5cf6, #ec4899)'
    const ICON_COLORS = {
      phone:    '#22c55e',  // green
      email:    '#ef4444',  // red
      linkedin: '#3b82f6',  // blue
      website:  '#a855f7',  // purple
      twitter:  '#1f2937',  // dark slate (X brand modern look, visible on black bg)
      facebook: '#1877f2',  // facebook brand blue
    }
    type CircleProps = { href: string; color: string; icon: React.ReactNode; label: string }
    const Circle = ({ href, color, icon, label }: CircleProps) => (
      <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
        aria-label={label}
        className="w-14 h-14 rounded-full flex items-center justify-center transition hover:scale-110 active:scale-95"
        style={{ backgroundColor: color, color: '#ffffff', boxShadow: `0 8px 24px ${color}88` }}>
        {icon}
      </a>
    )
    return (
      <div style={{ ...pageStyle, backgroundColor: pageBg }} className="animate-fade-up">
        <InAppBackButton bgMode={design.bgMode} />
        {floatingBadge}
        <button onClick={handleShare} className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>
          <Share2 className="w-4 h-4" style={{ color: ink }} />
        </button>
        <div className="max-w-md mx-auto px-6 py-10">
          {/* Company logo forced to top-centre above the photo. Overrides
              design.logoPosition for this template only. */}
          {card.company_logo_url && design.logoPosition !== 'hidden' && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <img src={card.company_logo_url} style={{ height: calcLogoHeight(48, design), width: 'auto', objectFit: 'contain', maxWidth: 220 }} />
            </div>
          )}
          {/* Photo with neon-blue → purple → pink gradient ring. Avatar
              gets backgroundColor: pageBg so transparent PNGs (bg-removed
              photos) show the page background through, not the gradient. */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div style={{ padding: 4, borderRadius: '50%', background: RING_GRADIENT, boxShadow: '0 0 12px rgba(0, 212, 255, 0.22), 0 0 18px rgba(236, 72, 153, 0.16)' }}>
              <Avatar {...shared} size={140} rounded="full" extraStyle={{ border: `3px solid ${pageBg}`, backgroundColor: pageBg }} />
            </div>
          </div>
          <h1 style={{ margin: '0 0 6px', fontSize: 30, fontWeight: 800, color: ink, textAlign: 'center', fontFamily: font.heading, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{card.name}</h1>
          {isPro && card.title && <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: titleColor, textAlign: 'center' }}>{card.title}</p>}
          {card.company && <p style={{ margin: '4px 0 0', fontSize: 14, color: muted, textAlign: 'center' }}>{card.company}</p>}
          {card.bio && <p style={{ fontSize: 13, color: muted, textAlign: 'center', lineHeight: 1.6, margin: '12px 0 0' }}>{card.bio}</p>}
          {/* Up to 6 vibrant circular quick-actions (phone, email, linkedin,
              website, twitter/X, facebook). Wraps to a second row on narrow
              phones when 5+ are filled in. */}
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 14, margin: '28px 0 32px' }}>
            {card.phone && <Circle href={`tel:${card.phone}`} color={ICON_COLORS.phone} label="Call" icon={<Phone className="w-6 h-6" />} />}
            {card.email && <Circle href={`mailto:${card.email}`} color={ICON_COLORS.email} label="Email" icon={<Mail className="w-6 h-6" />} />}
            {isPro && (card as any).linkedin_url && <Circle href={(card as any).linkedin_url} color={ICON_COLORS.linkedin} label="LinkedIn" icon={<Linkedin className="w-6 h-6" />} />}
            {card.website && <Circle href={card.website.startsWith('http') ? card.website : `https://${card.website}`} color={ICON_COLORS.website} label="Website" icon={<Globe className="w-6 h-6" />} />}
            {isPro && (card as any).twitter_url && <Circle href={(card as any).twitter_url} color={ICON_COLORS.twitter} label="X / Twitter" icon={<Twitter className="w-6 h-6" />} />}
            {isPro && (card as any).facebook_url && <Circle href={(card as any).facebook_url} color={ICON_COLORS.facebook} label="Facebook" icon={<Facebook className="w-6 h-6" />} />}
          </div>
          {/* Pro extras that don't fit in the circle row */}
          <div className="space-y-2.5">
            {isPro && card.work_phone && <ContactBtn icon={<Phone className="w-4 h-4" />} label={card.work_phone} sublabel="Work" href={`tel:${card.work_phone}`} accentHex={accentHex} bg={bg} cardEffect={cardEffect} />}
            {isPro && card.whatsapp && <ContactBtn icon={<MessageCircle className="w-4 h-4" />} label={card.whatsapp} sublabel="WhatsApp" href={`https://wa.me/${card.whatsapp.replace(/\D/g, '')}`} accentHex={accentHex} bg={bg} cardEffect={cardEffect} />}
            {isPro && card.address && <ContactBtn icon={<MapPin className="w-4 h-4" />} label={card.address} href={`https://maps.google.com/?q=${encodeURIComponent(card.address)}`} accentHex={accentHex} bg={bg} cardEffect={cardEffect} />}
          </div>
          <BottomSection {...bottomProps} />
          {/* URL footer in gradient */}
          <p style={{ textAlign: 'center', fontSize: 14, marginTop: 32, letterSpacing: '0.02em', fontWeight: 600, background: URL_GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>cardtly.com/{card.slug}</p>
        </div>
      </div>
    )
  }

  if (design.templateId === 'executive') {
    // Cinematic editorial cover. Full-bleed hero photo with a soft vignette,
    // magazine masthead at top, big name + accent rule + spaced-caps title
    // at the bottom of the hero. A glass card overlaps the bottom of the hero
    // and floats above the page, holding the bio and contact grid. Accent
    // colour drives the rails, dividers, icon tiles, and CTA highlights.
    const pageBg  = isLight ? '#fafafa' : '#000000'
    const ink     = isLight ? '#0f172a' : '#ffffff'
    const muted   = isLight ? '#64748b' : 'rgba(255,255,255,0.6)'
    const glassBg = isLight ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.04)'
    const glassBorder = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
    const tileBg  = isLight ? '#ffffff' : 'rgba(255,255,255,0.04)'
    const ContactTile = ({ icon, label, value, href, span }: { icon: React.ReactNode; label: string; value: string; href: string; span?: boolean }) => (
      <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
        style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16, backgroundColor: tileBg, border: `1px solid ${glassBorder}`, borderRadius: 16, textDecoration: 'none', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', gridColumn: span ? '1 / -1' : undefined }}
        className="transition hover:scale-[1.02] active:scale-[0.98]">
        <div style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: accentHex + '22', color: accentHex, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}>{icon}</div>
        <p style={{ margin: 0, fontSize: 9, fontWeight: 800, color: accentHex, textTransform: 'uppercase', letterSpacing: '0.18em' }}>{label}</p>
        <p style={{ margin: 0, fontSize: 13, color: ink, fontWeight: 600, wordBreak: 'break-word', lineHeight: 1.35 }}>{value}</p>
      </a>
    )
    return (
      <div style={{ ...pageStyle, backgroundColor: pageBg, position: 'relative', overflow: 'hidden' }} className="animate-fade-up">
        {/* Soft accent bloom at the top to add visual depth */}
        <div style={{ position: 'absolute', top: -180, left: '50%', transform: 'translateX(-50%)', width: '140%', height: 600, background: `radial-gradient(ellipse at center, ${accentHex}28 0%, transparent 65%)`, pointerEvents: 'none' }} />
        <InAppBackButton bgMode={design.bgMode} />
        {floatingBadge}
        <button onClick={handleShare} className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
          <Share2 className="w-4 h-4" style={{ color: ink }} />
        </button>
        <div className="max-w-md mx-auto relative">
          {/* Dedicated header band ABOVE the photo. paddingTop reserves
              space for the fixed "Online now" availability badge that
              floats at top-4. Masthead "EXECUTIVE PROFILE" sits cleanly
              below the badge with no overlap. */}
          <div style={{ paddingTop: 60, paddingBottom: 16, paddingLeft: 24, paddingRight: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${accentHex})` }} />
              <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: ink, textTransform: 'uppercase', letterSpacing: '0.35em' }}>Executive Profile</p>
              <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${accentHex}, transparent)` }} />
            </div>
          </div>
          {/* Cinematic photo - now lives below the header band. Object
              position centred so portrait headshots are framed naturally.
              Height scales with the design.profilePhotoSize slider
              (60-160%) so the user can tune the hero size from the
              design panel - 380px is the 100% baseline. */}
          <div style={{ position: 'relative', width: '100%', height: Math.round(380 * ((design.profilePhotoSize ?? 100) / 100)), overflow: 'hidden' }}>
            {card.profile_image_url
              ? <>
                  {/* Blurred photo fills the letterbox area so the whole
                      portrait is visible (object-fit: contain) without ugly
                      black bars on the sides. */}
                  <img src={card.profile_image_url} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', filter: 'blur(40px) brightness(0.55) saturate(1.1)', transform: 'scale(1.15)' }} />
                  {/* Foreground: full photo, contained so nothing is
                      cropped. boldImageZoom slider applies on top. */}
                  <img src={card.profile_image_url} style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', transform: `scale(${(design.boldImageZoom ?? 100) / 100})`, transformOrigin: 'center', transition: 'transform 0.3s ease' }} />
                </>
              : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${accentHex} 0%, ${accentHex}66 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 130, fontWeight: 800, color: '#ffffff' }}>{card.name?.[0]?.toUpperCase()}</div>}
            {/* Bottom-only vignette so the name overlay reads */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.95) 100%)' }} />
            {/* Name + accent rule + title + company at the bottom */}
            <div style={{ position: 'absolute', bottom: 48, left: 24, right: 24 }}>
              <h1 style={{ margin: '0 0 12px', fontSize: 36, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.025em', lineHeight: 0.96, fontFamily: font.heading, textShadow: '0 4px 24px rgba(0,0,0,0.6)' }}>{card.name}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ width: 36, height: 3, background: accentHex, boxShadow: `0 0 16px ${accentHex}aa` }} />
                {isPro && card.title && <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.28em' }}>{card.title}</p>}
              </div>
              {card.company && <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', letterSpacing: '0.02em' }}>{card.company}</p>}
            </div>
          </div>
          {/* Glass card - reduced overlap from -36 to -20 so there's clear
              breathing room between the company text and the card edge */}
          <div style={{ position: 'relative', marginTop: -20, marginLeft: 16, marginRight: 16, padding: '28px 22px', backgroundColor: glassBg, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: `1px solid ${glassBorder}`, borderRadius: 28, boxShadow: '0 24px 70px rgba(0,0,0,0.5)', zIndex: 2 }}>
            <LogoZone {...shared} />
            {card.bio && (
              <div style={{ position: 'relative', padding: '8px 12px', textAlign: 'center' }}>
                <span style={{ position: 'absolute', top: -10, left: 0, fontSize: 56, color: accentHex, fontFamily: 'Georgia, serif', lineHeight: 1, opacity: 0.5 }}>&ldquo;</span>
                <p style={{ margin: 0, fontSize: 14, color: muted, lineHeight: 1.75, fontStyle: 'italic' }}>{card.bio}</p>
                <span style={{ position: 'absolute', bottom: -28, right: 0, fontSize: 56, color: accentHex, fontFamily: 'Georgia, serif', lineHeight: 1, opacity: 0.5 }}>&rdquo;</span>
              </div>
            )}
          </div>
          {/* Contact grid */}
          <div style={{ padding: '28px 16px 0' }}>
            <p style={{ margin: '0 0 16px', fontSize: 10, fontWeight: 800, color: ink, textTransform: 'uppercase', letterSpacing: '0.3em', textAlign: 'center' }}>Get In Touch</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Order is tuned so the grid fills neatly: Call | Email on
                  row 1, then WhatsApp | Website pair on row 2, Work alone
                  or paired with another short field, then Visit takes a
                  full-width row at the bottom because the address is
                  always too long for a 2-column tile. */}
              {card.phone && <ContactTile icon={<Phone className="w-4 h-4" />} label="Call" value={card.phone} href={`tel:${card.phone}`} />}
              {card.email && <ContactTile icon={<Mail className="w-4 h-4" />} label="Email" value={card.email} href={`mailto:${card.email}`} />}
              {isPro && card.whatsapp && <ContactTile icon={<MessageCircle className="w-4 h-4" />} label="WhatsApp" value={card.whatsapp} href={`https://wa.me/${card.whatsapp.replace(/\D/g, '')}`} />}
              {card.website && <ContactTile icon={<Globe className="w-4 h-4" />} label="Website" value={card.website.replace(/^https?:\/\//, '')} href={card.website.startsWith('http') ? card.website : `https://${card.website}`} />}
              {isPro && card.work_phone && <ContactTile icon={<Phone className="w-4 h-4" />} label="Work" value={card.work_phone} href={`tel:${card.work_phone}`} />}
              {isPro && card.address && <ContactTile icon={<MapPin className="w-4 h-4" />} label="Visit" value={card.address} href={`https://maps.google.com/?q=${encodeURIComponent(card.address)}`} span />}
            </div>
          </div>
          {/* Connect section with glass-square social icons */}
          {socialLinks.length > 0 && (
            <div style={{ padding: '32px 16px 0', textAlign: 'center' }}>
              <p style={{ margin: '0 0 16px', fontSize: 10, fontWeight: 800, color: ink, textTransform: 'uppercase', letterSpacing: '0.3em' }}>Connect</p>
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 12 }}>
                {socialLinks.map(s => (
                  <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer"
                    aria-label={s.platform}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center transition hover:scale-110 active:scale-95"
                    style={{ backgroundColor: tileBg, color: accentHex, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>
          )}
          <div style={{ padding: '0 16px 24px' }}>
            <BottomSection {...bottomProps} />
          </div>
          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 28 }}>
            <div style={{ width: 24, height: 1, background: accentHex }} />
            <p style={{ margin: 0, fontSize: 12, color: muted, letterSpacing: '0.15em', fontWeight: 700, textTransform: 'uppercase' }}>cardtly.com/{card.slug}</p>
            <div style={{ width: 24, height: 1, background: accentHex }} />
          </div>
        </div>
      </div>
    )
  }

  if (design.templateId === 'creative') {
    return (
      <div style={{ ...pageStyle, overflow: 'hidden', position: 'relative' }} className="animate-fade-up">
        <div style={{ position: 'fixed', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(circle, ${accentHex}44 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'fixed', bottom: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${accentHex}33 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <InAppBackButton bgMode={design.bgMode} />
        {floatingBadge}
        <button onClick={handleShare} className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }}>
          <Share2 className="w-4 h-4" style={{ color: bg.text }} />
        </button>
        <div className="max-w-md mx-auto px-6 py-8 relative">
          <div className="mb-5" style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'inline-block', padding: 4, borderRadius: '50%', background: `linear-gradient(135deg, ${accentHex}, ${accentHex}55)` }}>
              {(() => {
                const photoSize = calcPhotoSize(96, design)
                return (
                  <div style={{ borderRadius: '50%', overflow: 'hidden', width: photoSize, height: photoSize, border: `4px solid ${bg.page}` }}>
                    {card.profile_image_url
                      ? <img src={card.profile_image_url} style={{ width: photoSize, height: photoSize, objectFit: 'cover' }} />
                      : <div style={{ width: photoSize, height: photoSize, backgroundColor: accentHex + '33', color: accentHex, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: photoSize * 0.33, fontWeight: 700 }}>{card.name?.[0]?.toUpperCase()}</div>}
                  </div>
                )
              })()}
            </div>
          </div>
          <h1 className="text-2xl font-bold leading-tight" style={{ fontFamily: font.heading }}>{card.name}</h1>
          {isPro && card.title && <p className="font-semibold mt-1" style={{ color: accentHex }}>{card.title}</p>}
          {card.company && <p className="text-sm mt-0.5" style={{ color: bg.subtext }}>{card.company}</p>}
          <LogoZone {...shared} />
          {card.bio && <p className="text-sm mt-2 mb-6 leading-relaxed" style={{ color: bg.subtext }}>{card.bio}</p>}
          <AllContacts {...shared} socialLinks={socialLinks} />
          <BottomSection {...bottomProps} />
        </div>
      </div>
    )
  }

  if (design.templateId === 'wave') {
    const waveHeroBg = design.cardStyle === 'gradient'
      ? `linear-gradient(135deg, ${accentHex}55 0%, ${accentHex}22 100%)`
      : design.cardStyle === 'glass'
        ? `linear-gradient(135deg, ${accentHex}44 0%, ${accentHex}11 100%)`
        : `linear-gradient(135deg, ${accentHex}44 0%, ${bg.page} 100%)`
    return (
      <div style={pageStyle} className="animate-fade-up">
        <InAppBackButton bgMode={design.bgMode} />
        {floatingBadge}
        <button onClick={handleShare} className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }}>
          <Share2 className="w-4 h-4" style={{ color: bg.text }} />
        </button>
        <div className="max-w-md mx-auto">
          <div style={{ background: waveHeroBg, position: 'relative' }}>
            <div style={{ display: 'flex', gap: 0, padding: '28px 24px 52px' }}>
              <div style={{ flexShrink: 0, position: 'relative', zIndex: 2 }}>
                <Avatar {...shared} size={100} rounded="xl" extraStyle={{ border: `3px solid ${accentHex}44`, borderRadius: 18 }} />
              </div>
              <div style={{ flex: 1, paddingLeft: 18, ...textNudge }}>
                <h1 style={{ margin: '4px 0 6px', fontSize: 22, fontWeight: 800, fontFamily: font.heading, color: bg.text, lineHeight: 1.2 }}>{card.name}</h1>
                {isPro && card.title && <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: accentHex }}>{card.title}</p>}
                {card.company && <p style={{ margin: 0, fontSize: 12, color: bg.subtext }}>{card.company}</p>}
              </div>
            </div>
            <svg viewBox="0 0 400 56" style={{ display: 'block', width: '100%', height: 56, position: 'absolute', bottom: 0 }} preserveAspectRatio="none">
              <path d="M0,28 C80,56 160,0 240,28 C320,56 360,14 400,28 L400,56 L0,56 Z" fill={bg.page} />
            </svg>
          </div>
          <div className="px-6 py-4 pb-10">
            <LogoZone {...shared} />
            {card.bio && <p className="text-sm mb-6 leading-relaxed" style={{ color: bg.subtext }}>{card.bio}</p>}
            <AllContacts {...shared} socialLinks={socialLinks} />
            <BottomSection {...bottomProps} />
          </div>
        </div>
      </div>
    )
  }

  if (design.templateId === 'split') {
    const sidebarBg = design.cardStyle === 'gradient'
      ? `linear-gradient(180deg, ${accentHex} 0%, ${accentHex}cc 100%)`
      : design.cardStyle === 'glass'
        ? `linear-gradient(180deg, ${accentHex}cc 0%, ${accentHex}88 100%)`
        : accentHex
    return (
      <div style={{ ...pageStyle, display: 'flex', minHeight: '100vh' }} className="animate-fade-up">
        <InAppBackButton bgMode={design.bgMode} />
        {floatingBadge}
        <div style={{ width: 80, flexShrink: 0, background: sidebarBg, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 8px', gap: 16, position: 'fixed', top: 0, bottom: 0, left: 0 }}>
          <Avatar {...shared} size={60} rounded="full" extraStyle={{ border: '3px solid rgba(255,255,255,0.3)' }} />
          <div style={{ width: '60%', height: 1, backgroundColor: 'rgba(255,255,255,0.3)' }} />
          {card.company_logo_url && design.logoPosition !== 'hidden' && (
            <img src={card.company_logo_url} style={{ width: 50, height: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.85 }} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 8 }}>
            {card.phone && <Phone style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.8)' }} />}
            {card.email && <Mail style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.8)' }} />}
            {card.website && <Globe style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.8)' }} />}
          </div>
          <button onClick={handleShare} style={{ marginTop: 'auto' }}>
            <Share2 style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.6)' }} />
          </button>
        </div>
        <div style={{ flex: 1, marginLeft: 80, padding: '28px 24px', maxWidth: 460 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, fontFamily: font.heading, color: bg.text }}>{card.name}</h1>
          {isPro && card.title && <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: 600, color: accentHex, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{card.title}</p>}
          {card.company && <p style={{ margin: '0 0 16px', fontSize: 13, color: bg.subtext }}>{card.company}</p>}
          <div style={{ width: 32, height: 3, backgroundColor: accentHex, marginBottom: 12, borderRadius: 2 }} />
          <LogoZone {...shared} />
          {card.bio && <p className="text-sm mb-6 leading-relaxed" style={{ color: bg.subtext }}>{card.bio}</p>}
          <AllContacts {...shared} socialLinks={socialLinks} />
          <BottomSection {...bottomProps} />
        </div>
      </div>
    )
  }

  if (design.templateId === 'neon') {
    const glow = `0 0 12px ${accentHex}66`
    return (
      <div style={{ ...pageStyle, backgroundColor: '#050510' }} className="animate-fade-up">
        <InAppBackButton bgMode={design.bgMode} />
        {floatingBadge}
        <button onClick={handleShare} className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center" style={{ border: `1px solid ${accentHex}44`, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <Share2 className="w-4 h-4" style={{ color: accentHex }} />
        </button>
        <div className="max-w-md mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-4" style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ borderRadius: '50%', padding: 3, background: `linear-gradient(135deg, ${accentHex}, ${accentHex}44)`, boxShadow: glow, flexShrink: 0 }}>
              {(() => {
                const photoSize = calcPhotoSize(80, design)
                return (
                  <div style={{ borderRadius: '50%', overflow: 'hidden', width: photoSize, height: photoSize, backgroundColor: '#0a0a1a' }}>
                    {card.profile_image_url
                      ? <img src={card.profile_image_url} style={{ width: photoSize, height: photoSize, objectFit: 'cover' }} />
                      : <div style={{ width: photoSize, height: photoSize, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: photoSize * 0.35, fontWeight: 700, color: accentHex }}>{card.name?.[0]?.toUpperCase()}</div>}
                  </div>
                )
              })()}
            </div>
            <div className="flex-1 min-w-0" style={textNudge}>
              <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, fontFamily: font.heading, color: '#e8e8ff' }}>{card.name}</h1>
              {isPro && card.title && <p style={{ margin: '0 0 3px', fontSize: 12, color: accentHex, fontWeight: 600, textShadow: `0 0 8px ${accentHex}` }}>{card.title}</p>}
              {card.company && <p style={{ margin: 0, fontSize: 12, color: '#404070' }}>{card.company}</p>}
            </div>
          </div>
          <div style={{ height: 1, background: `linear-gradient(90deg, ${accentHex}, transparent)`, marginBottom: 16, boxShadow: `0 0 6px ${accentHex}` }} />
          <LogoZone {...shared} />
          {card.bio && <p className="text-sm mb-6 leading-relaxed" style={{ color: '#6060a0' }}>{card.bio}</p>}
          <div className="space-y-3">
            {[
              card.phone && { icon: <Phone className="w-4 h-4" />, label: card.phone, href: `tel:${card.phone}` },
              card.email && { icon: <Mail className="w-4 h-4" />, label: card.email, href: `mailto:${card.email}` },
              card.website && { icon: <Globe className="w-4 h-4" />, label: card.website.replace(/^https?:\/\//, ''), href: card.website },
              ...links.map(l => ({ icon: <ExternalLink className="w-4 h-4" />, label: l.title, href: l.url.startsWith('http') ? l.url : `https://${l.url}` })),
            ].filter(Boolean).map((item: any, i) => (
              <a key={i} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 14, backgroundColor: accentHex + '0d', borderRadius: 10, padding: '12px 16px', border: `1px solid ${accentHex}33`, textDecoration: 'none' }}>
                <span style={{ color: accentHex }}>{item.icon}</span>
                <span style={{ fontSize: 14, color: '#c0c0e8' }}>{item.label}</span>
              </a>
            ))}
          </div>
          <BottomSection {...bottomProps} />
        </div>
      </div>
    )
  }

  // ── 10. STUDIO ────────────────────────────────────────────────────────────
  // Photographer-style template based on the user's reference image. Black
  // top band with logo box + COMPANY NAME on the right, large circular
  // portrait STRADDLING the boundary between the black and light areas,
  // huge uppercase name + designation, then an orange diagonal accent slice
  // at the bottom with brand-coloured social action circles scattered in an
  // arc (Call pill, WhatsApp yellow, social icons, Email, Website) and a
  // services bullet list rendered over the orange.
  if (design.templateId === 'studio') {
    const black = '#000000'
    const lightArea = '#f0f0ef'
    const darkInk = '#0a0a0a'
    // Brand-coloured social action circles, matching the reference vibe.
    const STUDIO_COLORS = {
      whatsapp: '#FCC419',  // warm yellow
      twitter:  '#1f2937',  // dark slate (X brand)
      instagram:'#E1306C',  // instagram pink
      facebook: '#1877F2',  // facebook blue
      linkedin: '#0a66c2',  // linkedin blue
      email:    '#404040',  // dark grey
      website:  '#ffffff',  // white with dark icon
    }
    type CircleProps = { href: string; color: string; icon: React.ReactNode; label: string; iconColor?: string }
    const Circle = ({ href, color, icon, label, iconColor }: CircleProps) => (
      <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined} aria-label={label}
        className="w-12 h-12 rounded-full flex items-center justify-center transition hover:scale-110 active:scale-95"
        style={{ backgroundColor: color, color: iconColor || '#ffffff', boxShadow: `0 6px 18px rgba(0,0,0,0.35), inset 0 -2px 6px rgba(0,0,0,0.2)`, flexShrink: 0 }}>
        {icon}
      </a>
    )
    return (
      <div style={{ ...pageStyle, backgroundColor: lightArea }} className="animate-fade-up">
        <InAppBackButton bgMode={design.bgMode} />
        {floatingBadge}
        <button onClick={handleShare} className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.9)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
          <Share2 className="w-4 h-4" style={{ color: darkInk }} />
        </button>
        <div className="max-w-md mx-auto" style={{ backgroundColor: lightArea, position: 'relative' }}>
          {/* Black top band: logo (transparent, no white box) on the left,
              COMPANY NAME on the right. Extends down so the photo
              (positioned absolutely below) can straddle the boundary. The
              SVG overlay at the bottom cuts a moon-shaped curve into the
              bottom edge so the black isn't a flat rectangle. */}
          {/* Black header shape - LONG side edges, curve dips almost to
              the bottom of the photo wrapping it nearly entirely. Only
              the bottom edge of the photo extends below the curve. */}
          <div style={{ position: 'relative', height: 400 }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', zIndex: 0 }}>
              {/*  M 0 0           top-left corner
                   L 100 0         flat top edge to top-right corner
                   L 100 65        LONG right edge - black extends down
                                   65% of container before the curve
                                   starts. Wraps the right side of the
                                   photo all the way to its bottom area.
                   Q 50 115 0 65   curve from upper-right (100, 65)
                                   through deep control (50, 115) back
                                   up to (0, 65) on the left. Both ends
                                   at the same height so the shape is
                                   symmetric. Control well below bounds
                                   makes the dip reach the photo's
                                   bottom edge area.
                   Z               close back up the LONG left edge */}
              <path d="M 0 0 L 100 0 L 100 65 Q 50 115 0 65 Z" fill={black} />
            </svg>
            {/* Logo + COMPANY NAME on top of the black shape */}
            <div style={{ position: 'relative', padding: '50px 20px 0', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {card.company_logo_url ? (
                  <img src={card.company_logo_url} style={{ height: 60, maxWidth: 140, objectFit: 'contain', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 76, height: 76, border: '2px dashed rgba(255,255,255,0.3)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>
                    Your<br />Logo
                  </div>
                )}
                {card.company && <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em', wordBreak: 'break-word', flex: 1, lineHeight: 1.1 }}>{card.company}</p>}
              </div>
            </div>
          </div>
          {/* Photo - absolute, sits inside the dip of the smile-curve.
              Top adjusted so the photo's centre lands where the curve
              dips lowest, giving the "wrapped by black" look from the
              user's annotated reference. */}
          <div style={{ position: 'absolute', top: 140, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
            <div style={{ width: 220, height: 220, borderRadius: '50%', overflow: 'hidden', border: `5px solid #ffffff`, boxShadow: '0 12px 36px rgba(0,0,0,0.55)' }}>
              {card.profile_image_url
                ? <img src={card.profile_image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', backgroundColor: accentHex + '44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80, fontWeight: 800, color: accentHex }}>{card.name?.[0]?.toUpperCase()}</div>}
            </div>
          </div>
          {/* Name + designation - top padding leaves room for the
              overlapping photo above. Bio renders AFTER the action arc
              below, not here. */}
          <div style={{ backgroundColor: lightArea, paddingTop: 30, paddingBottom: 0, paddingLeft: 20, paddingRight: 20, textAlign: 'center' }}>
            <h1 style={{ margin: '0 0 8px', fontSize: 40, fontWeight: 900, color: darkInk, textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.0, fontFamily: font.heading }}>{card.name}</h1>
            {isPro && card.title && <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: darkInk, textTransform: 'uppercase', letterSpacing: '0.22em' }}>{card.title}</p>}
          </div>
          {/* Orange section with a CURVED left edge (SVG path), and action
              circles distributed along the SAME Bezier so the icons sit
              naturally on or beside that curve - bottom-left CORNER to
              top-right CORNER like the user's annotated reference. */}
          {(() => {
            const STUDIO_H = 250            // halved from 500 per user feedback
            const CIRCLE = 48               // a touch smaller so icons fit the shorter wedge
            // Shared Bezier for both the wedge SVG and the icon arc.
            // The control point is now centred (0.35, 0.45) instead of
            // pulled to the upper-left - this gives a gentler arc so
            // icons distribute with roughly equal spacing along it.
            const P0 = { x: 0.00, y: 1.00 }
            const P1 = { x: 0.35, y: 0.45 }
            const P2 = { x: 1.00, y: 0.00 }
            const bezier = (t: number, p0: number, p1: number, p2: number) => {
              const u = 1 - t
              return u * u * p0 + 2 * u * t * p1 + t * t * p2
            }
            // T range pulled in so icons get ~10% horizontal padding on
            // each side and don't touch the wedge container edges.
            const T_START = 0.18
            const T_END = 0.82
            // Build the list of social actions. FIRST = bottom-left of arc
            // (Website / WWW), LAST = top-right (WhatsApp yellow standout).
            const actions: { color: string; href: string; icon: React.ReactNode; label: string; iconColor?: string }[] = [
              card.website ? { color: STUDIO_COLORS.website, href: card.website.startsWith('http') ? card.website : `https://${card.website}`, icon: <Globe className="w-6 h-6" />, label: 'Website', iconColor: darkInk } : null,
              card.email ? { color: STUDIO_COLORS.email, href: `mailto:${card.email}`, icon: <Mail className="w-6 h-6" />, label: 'Email' } : null,
              isPro && (card as any).facebook_url ? { color: STUDIO_COLORS.facebook, href: (card as any).facebook_url, icon: <Facebook className="w-6 h-6" />, label: 'Facebook' } : null,
              isPro && (card as any).linkedin_url ? { color: STUDIO_COLORS.linkedin, href: (card as any).linkedin_url, icon: <Linkedin className="w-6 h-6" />, label: 'LinkedIn' } : null,
              isPro && (card as any).instagram_url ? { color: STUDIO_COLORS.instagram, href: (card as any).instagram_url, icon: <Instagram className="w-6 h-6" />, label: 'Instagram' } : null,
              isPro && (card as any).twitter_url ? { color: STUDIO_COLORS.twitter, href: (card as any).twitter_url, icon: <Twitter className="w-6 h-6" />, label: 'Twitter / X' } : null,
              isPro && card.whatsapp ? { color: STUDIO_COLORS.whatsapp, href: `https://wa.me/${card.whatsapp.replace(/\D/g, '')}`, icon: <MessageCircle className="w-6 h-6" />, label: 'WhatsApp' } : null,
            ].filter(Boolean) as { color: string; href: string; icon: React.ReactNode; label: string; iconColor?: string }[]
            const n = actions.length
            // Wedge SVG path uses 0-100 viewBox coordinates. The curve
            // is the left edge of the orange. After the curve ends at the
            // top-right corner, we drop down the right side and across the
            // bottom to close the shape.
            const wedgePath = `M ${P0.x * 100} ${P0.y * 100} Q ${P1.x * 100} ${P1.y * 100} ${P2.x * 100} ${P2.y * 100} L 100 100 Z`
            return (
              <div style={{ position: 'relative', backgroundColor: lightArea, height: STUDIO_H, overflow: 'hidden' }}>
                {/* Coloured wedge - linear gradient (brighter top-left to
                    darker bottom-right) plus a soft radial highlight in the
                    upper area plus a few decorative dots. Stops the wedge
                    reading as a flat boring block. */}
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}>
                  <defs>
                    {/* Brighter top-left to slightly transparent bottom-right
                        so the accent gets natural depth */}
                    <linearGradient id="studioWedgeFill" x1="20%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={accentHex} stopOpacity="1" />
                      <stop offset="100%" stopColor={accentHex} stopOpacity="0.75" />
                    </linearGradient>
                    {/* A black-to-transparent overlay deepens the bottom-right
                        corner for dimensional shading */}
                    <linearGradient id="studioWedgeShade" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="black" stopOpacity="0" />
                      <stop offset="100%" stopColor="black" stopOpacity="0.18" />
                    </linearGradient>
                    {/* Bright spot near the top of the curve */}
                    <radialGradient id="studioWedgeShine" cx="55%" cy="20%" r="40%">
                      <stop offset="0%" stopColor="white" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <path d={wedgePath} fill="url(#studioWedgeFill)" />
                  <path d={wedgePath} fill="url(#studioWedgeShade)" />
                  <path d={wedgePath} fill="url(#studioWedgeShine)" />
                  {/* Decorative dots scattered in the wedge for interest.
                      Sized in viewBox units so they scale with the card. */}
                  <circle cx="90" cy="14" r="1.6" fill="white" opacity="0.45" />
                  <circle cx="78" cy="36" r="1.0" fill="white" opacity="0.4" />
                  <circle cx="92" cy="58" r="1.3" fill="white" opacity="0.3" />
                  <circle cx="83" cy="78" r="0.9" fill="white" opacity="0.5" />
                  <circle cx="70" cy="62" r="0.7" fill="white" opacity="0.35" />
                  <circle cx="95" cy="38" r="0.6" fill="white" opacity="0.4" />
                </svg>
                {/* Call pill: anchored top-left, off the arc */}
                {card.phone && (
                  <a href={`tel:${card.phone}`}
                    style={{ position: 'absolute', top: 24, left: 20, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 28px', background: 'linear-gradient(180deg, #fafafa 0%, #c4c4c4 100%)', borderRadius: 999, boxShadow: '0 6px 18px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.8)', textDecoration: 'none', zIndex: 5 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: darkInk, letterSpacing: '0.02em' }}>Call</span>
                    <Phone className="w-5 h-5" style={{ color: darkInk }} />
                  </a>
                )}
                {/* Social circles strung along the SAME Bezier, sampling
                    the middle portion so they ride the curve cleanly. */}
                {actions.map((item, i) => {
                  const t = n === 1 ? 0.5 : T_START + (i / (n - 1)) * (T_END - T_START)
                  const xPct = bezier(t, P0.x, P1.x, P2.x)
                  const yPct = bezier(t, P0.y, P1.y, P2.y)
                  return (
                    <div key={item.label}
                      style={{ position: 'absolute', top: `calc(${yPct * 100}% - ${CIRCLE / 2}px)`, left: `calc(${xPct * 100}% - ${CIRCLE / 2}px)`, zIndex: 4 }}>
                      <Circle href={item.href} color={item.color} label={item.label} icon={item.icon} iconColor={item.iconColor} />
                    </div>
                  )
                })}
                {/* Services bullet list - inline-block trick: outer div
                    right-anchors, inner ul keeps bullets aligned via
                    text-align: left */}
                {certifications.length > 0 && (
                  <div style={{ position: 'absolute', bottom: 28, right: 20, textAlign: 'right', maxWidth: '55%', zIndex: 3 }}>
                    <ul style={{ display: 'inline-block', textAlign: 'left', margin: 0, padding: 0, listStyle: 'none' }}>
                      {certifications.slice(0, 6).map(cert => (
                        <li key={cert} style={{ fontSize: 16, color: '#ffffff', fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>• {cert}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          })()}
          {/* Bio sits BELOW the action arc as per the reference image */}
          {card.bio && (
            <div style={{ backgroundColor: lightArea, padding: '24px 24px 8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 14, color: '#525252', lineHeight: 1.7, fontStyle: 'italic' }}>{card.bio}</p>
            </div>
          )}
          {/* Footer with custom links / save contact / share / contact form */}
          <div style={{ backgroundColor: lightArea, padding: '8px 20px 24px' }}>
            <BottomSection {...bottomProps} />
            <p style={{ textAlign: 'center', fontSize: 11, color: '#737373', marginTop: 16, letterSpacing: '0.05em' }}>cardtly.com/{card.slug}</p>
          </div>
        </div>
      </div>
    )
  }

  // ── 11. FROST ─────────────────────────────────────────────────────────────
  // Soft pastel mesh gradient background + a single floating glassmorphic
  // card containing everything. Heavy backdrop-blur, light-mode dominant.
  if (design.templateId === 'frost') {
    return (
      <div style={{ ...pageStyle, position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #fef3c7 0%, #fce7f3 25%, #e0e7ff 60%, #ccfbf1 100%)' }} className="animate-fade-up">
        {/* Decorative gradient blobs for the mesh-y feel */}
        <div style={{ position: 'absolute', top: -120, right: -80, width: 320, height: 320, borderRadius: '50%', background: `radial-gradient(circle, ${accentHex}55 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -80, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.4) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <InAppBackButton bgMode={design.bgMode} />
        {floatingBadge}
        <button onClick={handleShare} className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md" style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}>
          <Share2 className="w-4 h-4" style={{ color: '#0f172a' }} />
        </button>
        <div className="max-w-md mx-auto px-5 py-12 relative" style={{ zIndex: 1 }}>
          {/* Single big glass card */}
          <div style={{ backgroundColor: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', border: '1px solid rgba(255,255,255,0.6)', borderRadius: 32, padding: '36px 28px', boxShadow: '0 32px 80px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <Avatar {...shared} size={120} rounded="full" extraStyle={{ border: '4px solid rgba(255,255,255,0.9)', boxShadow: '0 12px 28px rgba(0,0,0,0.15)' }} />
            </div>
            <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 800, color: '#0f172a', textAlign: 'center', fontFamily: font.heading, letterSpacing: '-0.01em' }}>{card.name}</h1>
            {isPro && card.title && <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: accentHex, textAlign: 'center' }}>{card.title}</p>}
            {card.company && <p style={{ margin: '4px 0 16px', fontSize: 13, color: '#64748b', textAlign: 'center' }}>{card.company}</p>}
            <LogoZone {...shared} />
            {card.bio && <p style={{ fontSize: 13, color: '#475569', textAlign: 'center', lineHeight: 1.65, margin: '0 0 20px' }}>{card.bio}</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                card.phone && { icon: <Phone className="w-4 h-4" />, label: card.phone, href: `tel:${card.phone}` },
                card.email && { icon: <Mail className="w-4 h-4" />, label: card.email, href: `mailto:${card.email}` },
                isPro && card.whatsapp && { icon: <MessageCircle className="w-4 h-4" />, label: card.whatsapp, href: `https://wa.me/${card.whatsapp.replace(/\D/g, '')}` },
                isPro && card.address && { icon: <MapPin className="w-4 h-4" />, label: card.address, href: `https://maps.google.com/?q=${encodeURIComponent(card.address)}` },
                card.website && { icon: <Globe className="w-4 h-4" />, label: card.website.replace(/^https?:\/\//, ''), href: card.website.startsWith('http') ? card.website : `https://${card.website}` },
              ].filter(Boolean).map((item: any, i) => (
                <a key={i} href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', backgroundColor: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 14, textDecoration: 'none' }}>
                  <span style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: accentHex + '22', color: accentHex, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 500, wordBreak: 'break-word' }}>{item.label}</span>
                </a>
              ))}
            </div>
            {socialLinks.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 20 }}>
                {socialLinks.map(s => (
                  <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full flex items-center justify-center transition hover:scale-110"
                    style={{ backgroundColor: 'rgba(255,255,255,0.7)', color: accentHex, border: '1px solid rgba(255,255,255,0.6)' }}>
                    {s.icon}
                  </a>
                ))}
              </div>
            )}
          </div>
          <div className="mt-6">
            <BottomSection {...bottomProps} />
          </div>
        </div>
      </div>
    )
  }

  // ── 12. EDITORIAL ─────────────────────────────────────────────────────────
  // Serif typography on warm paper bg. Newspaper-style: massive name, drop
  // capital lead, classical contact list with rules.
  if (design.templateId === 'editorial') {
    const paper = '#fafaf9'
    const ink = '#1c1917'
    const rule = '#a8a29e'
    const muted = '#78716c'
    return (
      <div style={{ ...pageStyle, backgroundColor: paper }} className="animate-fade-up">
        <InAppBackButton bgMode={design.bgMode} />
        {floatingBadge}
        <button onClick={handleShare} className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(28,25,23,0.08)' }}>
          <Share2 className="w-4 h-4" style={{ color: ink }} />
        </button>
        <div className="max-w-md mx-auto px-6 py-12">
          {/* Masthead */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.4em', fontFamily: 'Georgia, serif' }}>The Profile</p>
            <div style={{ width: '100%', borderTop: `2px solid ${ink}`, marginTop: 8 }} />
            <div style={{ width: '100%', borderTop: `1px solid ${ink}`, marginTop: 2 }} />
          </div>
          {/* Name in giant serif */}
          <h1 style={{ margin: '0 0 8px', fontSize: 52, fontWeight: 900, color: ink, fontFamily: 'Georgia, "Times New Roman", serif', lineHeight: 0.95, letterSpacing: '-0.02em', textAlign: 'center' }}>{card.name}</h1>
          {isPro && card.title && <p style={{ margin: 0, fontSize: 16, color: muted, textAlign: 'center', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>{card.title}</p>}
          {card.company && <p style={{ margin: '4px 0 0', fontSize: 13, color: muted, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 600 }}>{card.company}</p>}
          <div style={{ width: 60, borderTop: `2px solid ${accentHex}`, margin: '24px auto' }} />
          {/* Centered portrait with serif rule */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <Avatar {...shared} size={140} rounded="full" extraStyle={{ border: `1px solid ${rule}`, boxShadow: '0 1px 0 #fff, 0 8px 24px rgba(0,0,0,0.1)' }} />
          </div>
          <LogoZone {...shared} />
          {/* Bio as a leading paragraph with drop-cap first letter */}
          {card.bio && (
            <p style={{ fontSize: 15, color: '#3c2c20', lineHeight: 1.75, margin: '0 0 28px', fontFamily: 'Georgia, serif', textAlign: 'justify' }}>
              <span style={{ float: 'left', fontSize: 56, fontFamily: 'Georgia, serif', fontWeight: 900, lineHeight: 0.85, marginRight: 8, marginTop: 6, color: accentHex }}>{card.bio.charAt(0)}</span>
              {card.bio.slice(1)}
            </p>
          )}
          {/* Contact list with classical rules */}
          <div style={{ borderTop: `1px solid ${rule}`, paddingTop: 16 }}>
            <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.3em' }}>Correspondence</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                card.phone && { label: 'Telephone', value: card.phone, href: `tel:${card.phone}` },
                card.email && { label: 'Electronic mail', value: card.email, href: `mailto:${card.email}` },
                isPro && card.whatsapp && { label: 'WhatsApp', value: card.whatsapp, href: `https://wa.me/${card.whatsapp.replace(/\D/g, '')}` },
                isPro && card.address && { label: 'Address', value: card.address, href: `https://maps.google.com/?q=${encodeURIComponent(card.address)}` },
                card.website && { label: 'Web', value: card.website.replace(/^https?:\/\//, ''), href: card.website.startsWith('http') ? card.website : `https://${card.website}` },
              ].filter(Boolean).map((item: any, i) => (
                <a key={i} href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14, padding: '14px 0', borderBottom: `1px solid ${rule}`, textDecoration: 'none' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: 'Georgia, serif', flexShrink: 0 }}>{item.label}</span>
                  <span style={{ fontSize: 14, color: ink, fontFamily: 'Georgia, serif', textAlign: 'right', wordBreak: 'break-word' }}>{item.value}</span>
                </a>
              ))}
            </div>
          </div>
          <BottomSection {...bottomProps} />
          <div style={{ width: 60, borderTop: `2px solid ${accentHex}`, margin: '32px auto 8px' }} />
          <p style={{ textAlign: 'center', fontSize: 11, color: muted, fontFamily: 'Georgia, serif', letterSpacing: '0.15em', textTransform: 'uppercase' }}>cardtly.com/{card.slug}</p>
        </div>
      </div>
    )
  }

  return null
}
