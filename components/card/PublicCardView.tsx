'use client'

import { useState } from 'react'
import { Card, extractLinks } from '@/types/database'
import { parseDesign, FONTS, getBgColors, calcPhotoSize, calcLogoHeight, getAccentHex, getCardStyleEffect, TEXT_POSITION_TEMPLATES } from '@/types/design'
import {
  Phone, Mail, MapPin, Globe, MessageCircle,
  ExternalLink, Share2, Download, ChevronRight,
  Instagram, Linkedin, Twitter
} from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  card: Card & { _team_card_id?: string }
  isPro: boolean
  isTeamCard?: boolean
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
  const borderRadius = rounded === 'full' ? '50%' : rounded === 'xl' ? 18 : 12
  const baseStyle: React.CSSProperties = {
    width: size, height: size, objectFit: 'cover', flexShrink: 0,
    borderRadius, border: `4px solid ${bg.page}`, ...extraStyle,
  }
  if (card.profile_image_url) return <img src={card.profile_image_url} style={baseStyle} />
  return (
    <div style={{ ...baseStyle, backgroundColor: accentHex + '33', color: accentHex, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, fontFamily: font.heading }}>
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
      {isPro && card.website && <ContactBtn icon={<Globe className="w-4 h-4" />} label={card.website.replace(/^https?:\/\//, '')} href={card.website.startsWith('http') ? card.website : `https://${card.website}`} accentHex={accentHex} bg={bg} cardEffect={cardEffect} />}
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
  galleryImages: string[]
  accentHex: string
  bg: Shared['bg']
  cardEffect: Shared['cardEffect']
  handleShare: () => void
}

function BottomSection({ card, isPro, isTeamCard, links, certifications, galleryImages, accentHex, bg, cardEffect, handleShare }: BottomProps) {
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
            {galleryImages.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt={`Gallery ${i + 1}`} className="w-full aspect-video object-cover rounded-xl hover:opacity-80 transition" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex gap-3">
        <a href={`/api/vcf/${card.slug}`} download={`${card.name}.vcf`}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm text-white hover:opacity-90 transition"
          style={{ backgroundColor: accentHex }}>
          <Download className="w-4 h-4" />Save Contact
        </a>
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

export default function PublicCardView({ card, isPro, isTeamCard }: Props) {
  const design = parseDesign(card.color_theme)
  const font = FONTS[design.fontId]
  const bg = getBgColors(design.bgMode, design.templateId)
  const accentHex = getAccentHex(design)
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
    card.image_1_url, card.image_2_url, card.image_3_url,
    card.image_4_url, card.image_5_url,
  ].filter(Boolean) as string[] : []
  const socialLinks = isPro ? [
    card.linkedin_url && { platform: 'LinkedIn', url: card.linkedin_url, icon: <Linkedin className="w-4 h-4" /> },
    card.twitter_url && { platform: 'Twitter / X', url: card.twitter_url, icon: <Twitter className="w-4 h-4" /> },
    card.instagram_url && { platform: 'Instagram', url: card.instagram_url, icon: <Instagram className="w-4 h-4" /> },
  ].filter(Boolean) as { platform: string; url: string; icon: React.ReactNode }[] : []

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title: `${card.name} — Digital Business Card`, url })
    } else {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    }
  }

  // Shared prop bundles
  const shared: Shared = { card, isPro, accentHex, bg, font, cardEffect, design }
  const bottomProps: BottomProps = { card, isPro, isTeamCard, links, certifications, galleryImages, accentHex, bg, cardEffect, handleShare }

  const pageStyle: React.CSSProperties = { minHeight: '100vh', backgroundColor: bg.page, color: bg.text, fontFamily: font.body }

  if (design.templateId === 'classic') {
    return (
      <div style={pageStyle}>
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
              {isPro && card.bio && <p className="text-sm mt-4 leading-relaxed" style={{ color: bg.subtext }}>{card.bio}</p>}
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
      <div style={pageStyle}>
        <div style={{ height: 6, background: `linear-gradient(90deg, ${accentHex}, ${accentHex}44)` }} />
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
          {isPro && card.bio && <p className="text-sm mb-6 leading-relaxed" style={{ color: bg.subtext }}>{card.bio}</p>}
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
      <div style={pageStyle}>
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
            {isPro && card.bio && <p className="text-sm mb-6 leading-relaxed" style={{ color: bg.subtext }}>{card.bio}</p>}
            <AllContacts {...shared} socialLinks={socialLinks} />
            <BottomSection {...bottomProps} />
          </div>
        </div>
      </div>
    )
  }

  if (design.templateId === 'minimal') {
    const cream = isLight ? '#faf7f2' : '#0e0e0e'
    const ink = isLight ? '#1a1a1a' : '#f0ede8'
    const muted = isLight ? '#8a7f72' : '#6a6560'
    const lineColor = isLight ? '#d4cdc4' : '#2a2a2a'
    return (
      <div style={{ ...pageStyle, backgroundColor: cream }}>
        <button onClick={handleShare} className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>
          <Share2 className="w-4 h-4" style={{ color: ink }} />
        </button>
        <div className="max-w-md mx-auto px-6 py-10">
          <h1 style={{ margin: '0', fontSize: 48, fontWeight: 900, fontFamily: 'Georgia, serif', color: ink, lineHeight: 1, letterSpacing: '-0.03em' }}>{(card.name || '').split(' ')[0]}</h1>
          <h1 style={{ margin: '0 0 16px', fontSize: 48, fontWeight: 900, fontFamily: 'Georgia, serif', color: accentHex, lineHeight: 1, letterSpacing: '-0.03em' }}>{(card.name || '').split(' ').slice(1).join(' ')}</h1>
          <div style={{ height: 1, backgroundColor: lineColor, marginBottom: 16 }} />
          <div className="flex items-center gap-4 mb-4">
            <Avatar {...shared} size={72} rounded="full" extraStyle={{ border: `2px solid ${lineColor}` }} />
            <div>
              {isPro && card.title && <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: accentHex, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{card.title}</p>}
              {card.company && <p style={{ margin: 0, fontSize: 13, color: muted, fontStyle: 'italic' }}>{card.company}</p>}
            </div>
          </div>
          <LogoZone {...shared} />
          {isPro && card.bio && <p style={{ fontSize: 13, color: muted, lineHeight: 1.8, marginBottom: 20, fontStyle: 'italic', borderLeft: `2px solid ${accentHex}`, paddingLeft: 14 }}>{card.bio}</p>}
          <div className="space-y-4 mb-8">
            {[
              card.phone && { icon: <Phone className="w-4 h-4" />, label: card.phone, href: `tel:${card.phone}` },
              card.email && { icon: <Mail className="w-4 h-4" />, label: card.email, href: `mailto:${card.email}` },
              isPro && card.website && { icon: <Globe className="w-4 h-4" />, label: card.website.replace(/^https?:\/\//, ''), href: card.website },
              ...links.map(l => ({ icon: <ExternalLink className="w-4 h-4" />, label: l.title, href: l.url.startsWith('http') ? l.url : `https://${l.url}` })),
            ].filter(Boolean).map((item: any, i) => (
              <a key={i} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 14, borderBottom: `1px solid ${lineColor}`, textDecoration: 'none' }}>
                <span style={{ color: accentHex }}>{item.icon}</span>
                <span style={{ fontSize: 14, color: ink }}>{item.label}</span>
              </a>
            ))}
          </div>
          <BottomSection {...bottomProps} />
        </div>
      </div>
    )
  }

  if (design.templateId === 'executive') {
    return (
      <div style={{ ...pageStyle, backgroundColor: '#09090b' }}>
        <button onClick={handleShare} className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
          <Share2 className="w-4 h-4 text-white" />
        </button>
        <div className="max-w-md mx-auto">
          <div style={{ display: 'flex', minHeight: 220 }}>
            <div style={{ width: '42%', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
              {card.profile_image_url
                ? <img src={card.profile_image_url} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', position: 'absolute', inset: 0 }} />
                : <div style={{ width: '100%', height: '100%', backgroundColor: accentHex + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, fontWeight: 700, color: accentHex, position: 'absolute', inset: 0 }}>{card.name?.[0]?.toUpperCase()}</div>}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent 50%, #09090b 100%)' }} />
            </div>
            <div style={{ flex: 1, padding: '24px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={textNudge}>
                <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, fontFamily: font.heading, color: '#fafafa', lineHeight: 1.2 }}>{card.name}</h1>
                {isPro && card.title && <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: accentHex, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{card.title}</p>}
                {card.company && <p style={{ margin: '0 0 12px', fontSize: 12, color: '#71717a' }}>{card.company}</p>}
              </div>
              <div style={{ height: 1, background: `linear-gradient(90deg, ${accentHex}, transparent)` }} />
            </div>
          </div>
          <div className="px-6 py-6">
            <LogoZone {...shared} />
            {isPro && card.bio && <p className="text-sm mb-6 leading-relaxed" style={{ color: '#71717a' }}>{card.bio}</p>}
            <AllContacts {...shared} socialLinks={socialLinks} />
            <BottomSection {...bottomProps} />
          </div>
        </div>
      </div>
    )
  }

  if (design.templateId === 'creative') {
    return (
      <div style={{ ...pageStyle, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'fixed', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(circle, ${accentHex}44 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'fixed', bottom: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${accentHex}33 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <button onClick={handleShare} className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }}>
          <Share2 className="w-4 h-4" style={{ color: bg.text }} />
        </button>
        <div className="max-w-md mx-auto px-6 py-8 relative">
          <div className="mb-5" style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'inline-block', padding: 4, borderRadius: '50%', background: `linear-gradient(135deg, ${accentHex}, ${accentHex}55)` }}>
              <div style={{ borderRadius: '50%', overflow: 'hidden', width: 96, height: 96, border: `4px solid ${bg.page}` }}>
                {card.profile_image_url
                  ? <img src={card.profile_image_url} style={{ width: 96, height: 96, objectFit: 'cover' }} />
                  : <div style={{ width: 96, height: 96, backgroundColor: accentHex + '33', color: accentHex, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700 }}>{card.name?.[0]?.toUpperCase()}</div>}
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-bold leading-tight" style={{ fontFamily: font.heading }}>{card.name}</h1>
          {isPro && card.title && <p className="font-semibold mt-1" style={{ color: accentHex }}>{card.title}</p>}
          {card.company && <p className="text-sm mt-0.5" style={{ color: bg.subtext }}>{card.company}</p>}
          <LogoZone {...shared} />
          {isPro && card.bio && <p className="text-sm mt-2 mb-6 leading-relaxed" style={{ color: bg.subtext }}>{card.bio}</p>}
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
      <div style={pageStyle}>
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
            {isPro && card.bio && <p className="text-sm mb-6 leading-relaxed" style={{ color: bg.subtext }}>{card.bio}</p>}
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
      <div style={{ ...pageStyle, display: 'flex', minHeight: '100vh' }}>
        <div style={{ width: 80, flexShrink: 0, background: sidebarBg, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 8px', gap: 16, position: 'fixed', top: 0, bottom: 0, left: 0 }}>
          <Avatar {...shared} size={60} rounded="full" extraStyle={{ border: '3px solid rgba(255,255,255,0.3)' }} />
          <div style={{ width: '60%', height: 1, backgroundColor: 'rgba(255,255,255,0.3)' }} />
          {card.company_logo_url && design.logoPosition !== 'hidden' && (
            <img src={card.company_logo_url} style={{ width: 80, height: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.85 }} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 8 }}>
            {card.phone && <Phone style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.8)' }} />}
            {card.email && <Mail style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.8)' }} />}
            {isPro && card.website && <Globe style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.8)' }} />}
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
          {isPro && card.bio && <p className="text-sm mb-6 leading-relaxed" style={{ color: bg.subtext }}>{card.bio}</p>}
          <AllContacts {...shared} socialLinks={socialLinks} />
          <BottomSection {...bottomProps} />
        </div>
      </div>
    )
  }

  if (design.templateId === 'neon') {
    const glow = `0 0 12px ${accentHex}66`
    return (
      <div style={{ ...pageStyle, backgroundColor: '#050510' }}>
        <button onClick={handleShare} className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center" style={{ border: `1px solid ${accentHex}44`, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <Share2 className="w-4 h-4" style={{ color: accentHex }} />
        </button>
        <div className="max-w-md mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-4" style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ borderRadius: '50%', padding: 3, background: `linear-gradient(135deg, ${accentHex}, ${accentHex}44)`, boxShadow: glow, flexShrink: 0 }}>
              <div style={{ borderRadius: '50%', overflow: 'hidden', width: 80, height: 80, backgroundColor: '#0a0a1a' }}>
                {card.profile_image_url
                  ? <img src={card.profile_image_url} style={{ width: 80, height: 80, objectFit: 'cover' }} />
                  : <div style={{ width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: accentHex }}>{card.name?.[0]?.toUpperCase()}</div>}
              </div>
            </div>
            <div className="flex-1 min-w-0" style={textNudge}>
              <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, fontFamily: font.heading, color: '#e8e8ff' }}>{card.name}</h1>
              {isPro && card.title && <p style={{ margin: '0 0 3px', fontSize: 12, color: accentHex, fontWeight: 600, textShadow: `0 0 8px ${accentHex}` }}>{card.title}</p>}
              {card.company && <p style={{ margin: 0, fontSize: 12, color: '#404070' }}>{card.company}</p>}
            </div>
          </div>
          <div style={{ height: 1, background: `linear-gradient(90deg, ${accentHex}, transparent)`, marginBottom: 16, boxShadow: `0 0 6px ${accentHex}` }} />
          <LogoZone {...shared} />
          {isPro && card.bio && <p className="text-sm mb-6 leading-relaxed" style={{ color: '#6060a0' }}>{card.bio}</p>}
          <div className="space-y-3">
            {[
              card.phone && { icon: <Phone className="w-4 h-4" />, label: card.phone, href: `tel:${card.phone}` },
              card.email && { icon: <Mail className="w-4 h-4" />, label: card.email, href: `mailto:${card.email}` },
              isPro && card.website && { icon: <Globe className="w-4 h-4" />, label: card.website.replace(/^https?:\/\//, ''), href: card.website },
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

  return null
}
