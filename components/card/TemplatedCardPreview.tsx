'use client'

import {
  CardDesign, FONTS, getBgColors, calcPhotoSize, calcLogoHeight,
  getAccentHex, getReadableTextOn, getButtonBg, getButtonText, getButtonBorder,
  getCardStyleEffect, TEXT_POSITION_TEMPLATES
} from '@/types/design'
import { Phone, Mail, Globe, MessageCircle, ExternalLink, ChevronRight, Twitter, Facebook } from 'lucide-react'

interface PreviewData {
  name: string; title: string; company: string; bio: string
  email: string; phone: string; whatsapp: string; address: string; website: string
  profile_image_url: string; company_logo_url: string; certifications: string
  link_1_title: string; link_1_url: string
  link_2_title: string; link_2_url: string
  link_3_title: string; link_3_url: string
}

interface Props { form: PreviewData; isPro: boolean; design: CardDesign }

export default function TemplatedCardPreview({ form, isPro, design }: Props) {
  const accentHex = getAccentHex(design)
  const buttonBg = getButtonBg(design)
  const buttonText = getButtonText(design)
  const buttonBorder = getButtonBorder(design)
  const font = FONTS[design.fontId]
  const bg = getBgColors(design.bgMode, design.templateId, design.customBgColor)
  const isLight = design.bgMode === 'light'
  const cardEffect = getCardStyleEffect(design.cardStyle, accentHex, bg.page)

  const certs = form.certifications ? form.certifications.split(',').map(c => c.trim()).filter(Boolean) : []
  const links = [
    form.link_1_title && form.link_1_url && { title: form.link_1_title },
    form.link_2_title && form.link_2_url && { title: form.link_2_title },
    form.link_3_title && form.link_3_url && { title: form.link_3_title },
  ].filter(Boolean) as { title: string }[]

  const pageStyle: React.CSSProperties = {
    fontFamily: font.body,
    backgroundColor: bg.page,
    color: bg.text,
    minHeight: '100%',
  }

  // Text nudge — only for supported templates
  const textNudge = TEXT_POSITION_TEMPLATES.includes(design.templateId)
    ? { transform: `translate(${design.textX ?? 0}px, ${design.textY ?? 0}px)` }
    : {}

  // ── Shared helpers ────────────────────────────────────────────────────────

  function LogoZone({ filter }: { filter?: string }) {
    if (!form.company_logo_url || design.logoPosition === 'hidden') return null
    const h = calcLogoHeight(28, design)
    const justify = design.logoPosition === 'left' ? 'flex-start' : design.logoPosition === 'right' ? 'flex-end' : 'center'
    return (
      <div style={{ display: 'flex', justifyContent: justify, margin: '10px 0 8px' }}>
        <img src={form.company_logo_url} style={{ height: h, width: 'auto', objectFit: 'contain', maxWidth: 120, display: 'block', filter }} />
      </div>
    )
  }

  function Avatar({ base = 64, rounded = 'full', extraStyle = {} }: { base?: number; rounded?: string; extraStyle?: React.CSSProperties }) {
    const size = calcPhotoSize(base, design)
    const borderRadius = rounded === 'full' ? '50%' : rounded === 'xl' ? 14 : 10
    const style: React.CSSProperties = { width: size, height: size, objectFit: 'cover', flexShrink: 0, borderRadius, border: `3px solid ${bg.page}`, ...extraStyle }
    if (form.profile_image_url) return <img src={form.profile_image_url} style={style} />
    return <div style={{ ...style, backgroundColor: accentHex + '33', color: accentHex, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, fontFamily: font.heading }}>{form.name?.[0]?.toUpperCase() || '?'}</div>
  }

  function Row({ icon, label, sublabel }: { icon: React.ReactNode; label: string; sublabel?: string }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, backgroundColor: cardEffect.surfaceBg, borderRadius: 10, padding: '8px 12px', border: cardEffect.borderStyle }}>
        <span style={{ color: accentHex, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 500, margin: 0, color: bg.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</p>
          {sublabel && <p style={{ fontSize: 10, margin: 0, color: bg.subtext }}>{sublabel}</p>}
        </div>
        <ChevronRight style={{ width: 12, height: 12, color: bg.subtext, flexShrink: 0 }} />
      </div>
    )
  }

  function ContactList() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {form.phone && <Row icon={<Phone style={{ width: 12, height: 12 }} />} label={form.phone} />}
        {form.email && <Row icon={<Mail style={{ width: 12, height: 12 }} />} label={form.email} />}
        {isPro && form.whatsapp && <Row icon={<MessageCircle style={{ width: 12, height: 12 }} />} label={form.whatsapp} sublabel="WhatsApp" />}
        {form.website && <Row icon={<Globe style={{ width: 12, height: 12 }} />} label={form.website.replace(/^https?:\/\//, '')} />}
        {links.map(l => <Row key={l.title} icon={<ExternalLink style={{ width: 12, height: 12 }} />} label={l.title} />)}
      </div>
    )
  }

  function SaveBtn({ label = 'Save Contact', outline = false }: { label?: string; outline?: boolean }) {
    return (
      <div style={{
        marginTop: 12, padding: '10px 0', borderRadius: 12, textAlign: 'center',
        fontSize: 12, fontWeight: 700, fontFamily: font.heading,
        color: outline ? accentHex : buttonText,
        backgroundColor: outline ? 'transparent' : buttonBg,
        border: outline
          ? `2px solid ${accentHex}`
          : (buttonBorder ? `2px solid ${buttonBorder}` : 'none'),
        background: !outline && design.cardStyle === 'gradient'
          ? `linear-gradient(135deg, ${buttonBg}, ${buttonBg}bb)`
          : undefined,
        boxShadow: design.cardStyle === 'glass' ? `0 0 12px ${accentHex}44` : undefined,
      }}>
        {label}
      </div>
    )
  }

  function Certs() {
    if (!certs.length) return null
    return (
      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {certs.slice(0, 4).map(c => <span key={c} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, backgroundColor: accentHex + '22', color: accentHex, border: `1px solid ${accentHex}44` }}>#{c}</span>)}
      </div>
    )
  }

  // ── 1. CLASSIC ────────────────────────────────────────────────────────────
  if (design.templateId === 'classic') {
    const photoSize = calcPhotoSize(76, design)
    return (
      <div style={pageStyle}>
        <div style={{ height: 72, background: cardEffect.heroBg }} />
        <div style={{ padding: '0 16px 20px', marginTop: -(photoSize / 2) }}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ display: 'inline-block', zIndex: 2, position: 'relative' }}><Avatar base={76} /></div>
            <h2 style={{ margin: '8px 0 2px', fontSize: 17, fontWeight: 700, fontFamily: font.heading, color: bg.text }}>{form.name || 'Your Name'}</h2>
            {isPro && form.title && <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 600, color: accentHex }}>{form.title}</p>}
            {form.company && <p style={{ margin: 0, fontSize: 11, color: bg.subtext }}>{form.company}</p>}
            <LogoZone />
            {isPro && form.bio && <p style={{ margin: '4px 0 0', fontSize: 11, color: bg.subtext, lineHeight: 1.5 }}>{form.bio}</p>}
          </div>
          <ContactList /><Certs /><SaveBtn />
          {!isPro && <p style={{ textAlign: 'center', fontSize: 10, color: bg.border, marginTop: 8 }}>Powered by Cardtly</p>}
        </div>
      </div>
    )
  }

  // ── 2. MODERN ─────────────────────────────────────────────────────────────
  if (design.templateId === 'modern') {
    return (
      <div style={pageStyle}>
        {/* Glass/gradient top bar */}
        <div style={{ height: 6, background: `linear-gradient(90deg, ${accentHex}, ${accentHex}44)` }} />
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{ flexShrink: 0 }}><Avatar base={84} rounded="xl" /></div>
            <div style={{ flex: 1, minWidth: 0, ...textNudge }}>
              <h2 style={{ margin: '0 0 3px', fontSize: 18, fontWeight: 800, fontFamily: font.heading, color: bg.text, lineHeight: 1.2 }}>{form.name || 'Your Name'}</h2>
              {isPro && form.title && <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 600, color: accentHex, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{form.title}</p>}
              {form.company && <p style={{ margin: 0, fontSize: 11, color: bg.subtext }}>{form.company}</p>}
            </div>
          </div>
          <div style={{ width: 32, height: 3, borderRadius: 2, backgroundColor: accentHex, marginBottom: 10,
            boxShadow: design.cardStyle === 'glass' ? `0 0 8px ${accentHex}88` : undefined }} />
          <LogoZone />
          {isPro && form.bio && <p style={{ fontSize: 11, color: bg.subtext, lineHeight: 1.6, marginBottom: 12 }}>{form.bio}</p>}
          <ContactList /><Certs /><SaveBtn />
        </div>
      </div>
    )
  }

  // ── 3. BOLD — Split hero ──────────────────────────────────────────────────
  if (design.templateId === 'bold') {
    const heroPhotoSize = calcPhotoSize(90, design)
    const heroBg = design.cardStyle === 'gradient'
      ? `linear-gradient(135deg, ${accentHex} 0%, ${accentHex}88 100%)`
      : design.cardStyle === 'glass'
        ? `linear-gradient(135deg, ${accentHex}cc 0%, ${accentHex}66 100%)`
        : accentHex
    return (
      <div style={pageStyle}>
        <div style={{ background: heroBg, padding: '24px 16px', display: 'flex', alignItems: 'center', gap: 16, minHeight: 120, position: 'relative', overflow: 'hidden',
          boxShadow: design.cardStyle === 'glass' ? `0 4px 30px ${accentHex}44` : undefined }}>
          <div style={{ position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', right: 20, bottom: -20, width: 60, height: 60, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)' }} />
          <div style={{ flexShrink: 0, position: 'relative', zIndex: 2 }}>
            <div style={{ borderRadius: '50%', overflow: 'hidden', width: heroPhotoSize, height: heroPhotoSize, border: '3px solid rgba(255,255,255,0.4)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
              {form.profile_image_url
                ? <img src={form.profile_image_url} style={{ width: heroPhotoSize, height: heroPhotoSize, objectFit: 'cover' }} />
                : <div style={{ width: heroPhotoSize, height: heroPhotoSize, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: heroPhotoSize * 0.36, fontWeight: 700, color: '#fff', fontFamily: font.heading }}>{form.name?.[0]?.toUpperCase() || '?'}</div>}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 2, ...textNudge }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, fontFamily: font.heading, color: '#fff', lineHeight: 1.1, textShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>{form.name || 'Your Name'}</h2>
            {isPro && form.title && <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.2 }}>{form.title}</p>}
            {form.company && <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.65)', lineHeight: 1.2 }}>{form.company}</p>}
          </div>
        </div>
        <div style={{ padding: '14px 14px 16px' }}>
          <LogoZone />
          {isPro && form.bio && <p style={{ fontSize: 11, color: bg.subtext, lineHeight: 1.5, marginBottom: 12 }}>{form.bio}</p>}
          <ContactList /><Certs /><SaveBtn />
          {!isPro && <p style={{ textAlign: 'center', fontSize: 10, color: bg.border, marginTop: 8 }}>Powered by Cardtly</p>}
        </div>
      </div>
    )
  }

  // ── 4. MINIMAL ────────────────────────────────────────────────────────────
  // Vibrant action-card layout matching PublicCardView: pure black/white,
  // pink-purple-blue gradient ring, company logo forced to top-centre, four
  // fixed-colour quick-action circles, gradient URL footer.
  if (design.templateId === 'minimal') {
    const pageBg = isLight ? '#ffffff' : '#000000'
    const ink = isLight ? '#0f172a' : '#ffffff'
    const muted = isLight ? '#64748b' : 'rgba(255,255,255,0.55)'
    const titleColor = isLight ? '#475569' : 'rgba(255,255,255,0.85)'
    const RING_GRADIENT = 'linear-gradient(135deg, #00d4ff 0%, #8b5cf6 50%, #ec4899 100%)'
    const URL_GRADIENT  = 'linear-gradient(90deg, #00d4ff, #8b5cf6, #ec4899)'
    const ICON_COLORS = {
      phone:    '#22c55e',
      email:    '#ef4444',
      linkedin: '#3b82f6',
      website:  '#a855f7',
      twitter:  '#1f2937',
      facebook: '#1877f2',
    }
    const Circle = ({ color, children }: { color: string; children: React.ReactNode }) => (
      <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: color, color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 16px ${color}77` }}>
        {children}
      </div>
    )
    const hasLinkedin = isPro && !!(form as any).linkedin_url
    const hasTwitter  = isPro && !!(form as any).twitter_url
    const hasFacebook = isPro && !!(form as any).facebook_url
    return (
      <div style={{ ...pageStyle, backgroundColor: pageBg }}>
        <div style={{ padding: '20px 18px', textAlign: 'center' }}>
          {/* Company logo forced to top centre, above the photo */}
          {form.company_logo_url && design.logoPosition !== 'hidden' && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <img src={form.company_logo_url} style={{ height: 24, width: 'auto', objectFit: 'contain', maxWidth: 140 }} />
            </div>
          )}
          {/* Photo with neon-blue → purple → pink gradient ring. Inner wrap
              gets pageBg so transparent-bg PNGs show the page through. */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <div style={{ padding: 3, borderRadius: '50%', background: RING_GRADIENT, boxShadow: '0 0 8px rgba(0,212,255,0.22), 0 0 12px rgba(236,72,153,0.16)' }}>
              <div style={{ borderRadius: '50%', overflow: 'hidden', border: `2px solid ${pageBg}`, backgroundColor: pageBg }}>
                <Avatar base={76} />
              </div>
            </div>
          </div>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: ink, fontFamily: font.heading, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{form.name || 'Your Name'}</h2>
          {isPro && form.title && <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: titleColor }}>{form.title}</p>}
          {form.company && <p style={{ margin: '3px 0 0', fontSize: 10, color: muted }}>{form.company}</p>}
          {isPro && form.bio && <p style={{ fontSize: 10, color: muted, lineHeight: 1.5, margin: '8px 0 0' }}>{form.bio}</p>}
          {/* Up to 6 vibrant circular quick-actions; wraps on narrow widths */}
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 8, margin: '16px 0 14px' }}>
            {form.phone && <Circle color={ICON_COLORS.phone}><Phone style={{ width: 16, height: 16 }} /></Circle>}
            {form.email && <Circle color={ICON_COLORS.email}><Mail style={{ width: 16, height: 16 }} /></Circle>}
            {hasLinkedin && <Circle color={ICON_COLORS.linkedin}><ExternalLink style={{ width: 16, height: 16 }} /></Circle>}
            {form.website && <Circle color={ICON_COLORS.website}><Globe style={{ width: 16, height: 16 }} /></Circle>}
            {hasTwitter && <Circle color={ICON_COLORS.twitter}><Twitter style={{ width: 16, height: 16 }} /></Circle>}
            {hasFacebook && <Circle color={ICON_COLORS.facebook}><Facebook style={{ width: 16, height: 16 }} /></Circle>}
          </div>
          <Certs />
          {/* Save Contact action button */}
          <div style={{ marginTop: 10, padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 700,
            color: design.buttonTextColor || '#ffffff',
            backgroundColor: design.buttonBgColor || accentHex,
            border: design.buttonBorderColor ? `1px solid ${design.buttonBorderColor}` : 'none',
            borderRadius: 12, letterSpacing: '0.05em',
            boxShadow: design.cardStyle === 'glass' ? `0 0 8px ${accentHex}44` : `0 4px 14px ${accentHex}55` }}>Save Contact</div>
          {/* URL footer in gradient */}
          <p style={{ marginTop: 12, fontSize: 10, letterSpacing: '0.05em', fontWeight: 600, background: URL_GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>cardtly.com/your-card</p>
        </div>
      </div>
    )
  }

  // ── 5. EXECUTIVE ─────────────────────────────────────────────────────────
  // Cinematic editorial cover: full-bleed hero photo with vignette,
  // magazine masthead, big name + accent rule, glass card overlap,
  // 2-column contact tile grid, glass-square social icons.
  if (design.templateId === 'executive') {
    const pageBg = isLight ? '#fafafa' : '#000000'
    const ink = isLight ? '#0f172a' : '#ffffff'
    const muted = isLight ? '#64748b' : 'rgba(255,255,255,0.6)'
    const glassBg = isLight ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.05)'
    const tileBg = isLight ? '#ffffff' : 'rgba(255,255,255,0.05)'
    const glassBorder = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
    const hasTwitter  = isPro && !!(form as any).twitter_url
    const hasFacebook = isPro && !!(form as any).facebook_url
    const hasLinkedin = isPro && !!(form as any).linkedin_url
    const Tile = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: 8, backgroundColor: tileBg, border: `1px solid ${glassBorder}`, borderRadius: 10 }}>
        <div style={{ width: 18, height: 18, borderRadius: 6, backgroundColor: accentHex + '22', color: accentHex, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <p style={{ margin: 0, fontSize: 6, fontWeight: 800, color: accentHex, textTransform: 'uppercase', letterSpacing: '0.18em' }}>{label}</p>
        <p style={{ margin: 0, fontSize: 8, color: ink, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
      </div>
    )
    return (
      <div style={{ ...pageStyle, backgroundColor: pageBg, position: 'relative', overflow: 'hidden' }}>
        {/* Accent bloom */}
        <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: '140%', height: 220, background: `radial-gradient(ellipse at center, ${accentHex}30 0%, transparent 65%)`, pointerEvents: 'none' }} />
        {/* Cinematic hero - height scales with profilePhotoSize slider */}
        <div style={{ position: 'relative', width: '100%', height: Math.round(175 * ((design.profilePhotoSize ?? 100) / 100)), overflow: 'hidden' }}>
          {form.profile_image_url
            ? <>
                {/* Blurred fill so the contained foreground photo doesn't
                    have black side-bars when aspect ratios differ. */}
                <img src={form.profile_image_url} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(20px) brightness(0.55)', transform: 'scale(1.15)' }} />
                <img src={form.profile_image_url} style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', transform: `scale(${(design.boldImageZoom ?? 100) / 100})`, transformOrigin: 'center' }} />
              </>
            : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${accentHex}, ${accentHex}66)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60, fontWeight: 800, color: '#ffffff' }}>{form.name?.[0]?.toUpperCase() || '?'}</div>}
          {/* Vignette */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 22%, transparent 48%, rgba(0,0,0,0.95) 100%)' }} />
          {/* Masthead */}
          <div style={{ position: 'absolute', top: 12, left: 14, right: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6))' }} />
            <p style={{ margin: 0, fontSize: 6, fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.32em' }}>Executive Profile</p>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(255,255,255,0.6), transparent)' }} />
          </div>
          {/* Name + rule + title */}
          <div style={{ position: 'absolute', bottom: 18, left: 14, right: 14 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.025em', lineHeight: 0.96, fontFamily: font.heading, textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>{form.name || 'Your Name'}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 20, height: 2, background: accentHex, boxShadow: `0 0 8px ${accentHex}aa` }} />
              {isPro && form.title && <p style={{ margin: 0, fontSize: 7, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.28em' }}>{form.title}</p>}
            </div>
            {form.company && <p style={{ margin: 0, fontSize: 8, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic' }}>{form.company}</p>}
          </div>
        </div>
        {/* Glass overlap card */}
        <div style={{ position: 'relative', marginTop: -14, marginLeft: 10, marginRight: 10, padding: '10px 12px', backgroundColor: glassBg, border: `1px solid ${glassBorder}`, borderRadius: 14, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          <LogoZone />
          {isPro && form.bio && <p style={{ margin: 0, fontSize: 8, color: muted, lineHeight: 1.6, fontStyle: 'italic', textAlign: 'center' }}>&ldquo;{form.bio}&rdquo;</p>}
        </div>
        {/* Contact grid */}
        <div style={{ padding: '14px 10px 0' }}>
          <p style={{ margin: '0 0 8px', fontSize: 7, fontWeight: 800, color: ink, textTransform: 'uppercase', letterSpacing: '0.3em', textAlign: 'center' }}>Get In Touch</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {form.phone && <Tile icon={<Phone style={{ width: 10, height: 10 }} />} label="Call" value={form.phone} />}
            {form.email && <Tile icon={<Mail style={{ width: 10, height: 10 }} />} label="Email" value={form.email} />}
            {form.website && <Tile icon={<Globe style={{ width: 10, height: 10 }} />} label="Website" value={form.website.replace(/^https?:\/\//, '')} />}
          </div>
        </div>
        {/* Connect */}
        {(hasLinkedin || hasTwitter || hasFacebook) && (
          <div style={{ padding: '12px 10px 0', textAlign: 'center' }}>
            <p style={{ margin: '0 0 6px', fontSize: 7, fontWeight: 800, color: ink, textTransform: 'uppercase', letterSpacing: '0.3em' }}>Connect</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              {hasLinkedin && <div style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: tileBg, color: accentHex, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${glassBorder}` }}><ExternalLink style={{ width: 10, height: 10 }} /></div>}
              {hasTwitter && <div style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: tileBg, color: accentHex, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${glassBorder}` }}><Twitter style={{ width: 10, height: 10 }} /></div>}
              {hasFacebook && <div style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: tileBg, color: accentHex, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${glassBorder}` }}><Facebook style={{ width: 10, height: 10 }} /></div>}
            </div>
          </div>
        )}
        <div style={{ padding: '12px 10px 14px' }}>
          <Certs />
          <SaveBtn label="SAVE CONTACT" />
        </div>
      </div>
    )
  }

  // ── 6. CREATIVE ───────────────────────────────────────────────────────────
  if (design.templateId === 'creative') {
    const photoSize = calcPhotoSize(72, design)
    return (
      <div style={{ ...pageStyle, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${accentHex}55 0%, transparent 70%)`, pointerEvents: 'none' }} />
        {design.cardStyle === 'gradient' && <div style={{ position: 'absolute', bottom: -40, left: -40, width: 150, height: 150, borderRadius: '50%', background: `radial-gradient(circle, ${accentHex}33 0%, transparent 70%)`, pointerEvents: 'none' }} />}
        <div style={{ padding: 16, position: 'relative' }}>
          <div style={{ marginBottom: 6, display: 'inline-block', padding: design.cardStyle === 'glass' ? 4 : 3, borderRadius: '50%',
            background: `linear-gradient(135deg, ${accentHex}, ${accentHex}55)`,
            boxShadow: design.cardStyle === 'glass' ? `0 0 20px ${accentHex}66` : undefined }}>
            <div style={{ borderRadius: '50%', overflow: 'hidden', width: photoSize, height: photoSize, border: `3px solid ${bg.page}` }}>
              {form.profile_image_url
                ? <img src={form.profile_image_url} style={{ width: photoSize, height: photoSize, objectFit: 'cover' }} />
                : <div style={{ width: photoSize, height: photoSize, backgroundColor: accentHex + '33', color: accentHex, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: photoSize * 0.35, fontWeight: 700 }}>{form.name?.[0]?.toUpperCase() || '?'}</div>}
            </div>
          </div>
          <h2 style={{ margin: '4px 0 3px', fontSize: 20, fontWeight: 800, fontFamily: font.heading, color: bg.text }}>{form.name || 'Your Name'}</h2>
          {isPro && form.title && <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 600, color: accentHex }}>{form.title}</p>}
          {form.company && <p style={{ margin: 0, fontSize: 11, color: bg.subtext }}>{form.company}</p>}
          <LogoZone />
          {isPro && form.bio && <p style={{ fontSize: 11, color: bg.subtext, lineHeight: 1.5, marginBottom: 10 }}>{form.bio}</p>}
          <ContactList /><Certs />
          <div style={{ marginTop: 12, padding: '10px 0', borderRadius: 12, textAlign: 'center', fontSize: 12, fontWeight: 700, color: buttonText,
            background: `linear-gradient(135deg, ${buttonBg}, ${buttonBg}aa)`,
            border: buttonBorder ? `2px solid ${buttonBorder}` : 'none',
            boxShadow: design.cardStyle === 'glass' ? `0 0 12px ${accentHex}66` : undefined }}>Save Contact</div>
        </div>
      </div>
    )
  }

  // ── 7. WAVE ───────────────────────────────────────────────────────────────
  if (design.templateId === 'wave') {
    const waveHeroBg = design.cardStyle === 'gradient'
      ? `linear-gradient(135deg, ${accentHex}55 0%, ${accentHex}22 100%)`
      : design.cardStyle === 'glass'
        ? `linear-gradient(135deg, ${accentHex}44 0%, ${accentHex}11 100%)`
        : `linear-gradient(135deg, ${accentHex}33 0%, ${bg.page} 100%)`
    return (
      <div style={pageStyle}>
        <div style={{ background: waveHeroBg, position: 'relative' }}>
          <div style={{ display: 'flex', padding: '20px 16px 44px', gap: 0 }}>
            <div style={{ flexShrink: 0 }}><Avatar base={80} rounded="xl" /></div>
            <div style={{ flex: 1, paddingLeft: 14, ...textNudge }}>
              <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, fontFamily: font.heading, color: bg.text, lineHeight: 1.2 }}>{form.name || 'Your Name'}</h2>
              {isPro && form.title && <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 600, color: accentHex }}>{form.title}</p>}
              {form.company && <p style={{ margin: 0, fontSize: 11, color: bg.subtext }}>{form.company}</p>}
            </div>
          </div>
          <svg viewBox="0 0 400 48" style={{ display: 'block', width: '100%', height: 48, position: 'absolute', bottom: 0 }} preserveAspectRatio="none">
            <path d="M0,24 C80,48 160,0 240,24 C320,48 360,12 400,24 L400,48 L0,48 Z" fill={bg.page} />
          </svg>
        </div>
        <div style={{ padding: '8px 16px 20px' }}>
          <LogoZone />
          {isPro && form.bio && <p style={{ fontSize: 11, color: bg.subtext, lineHeight: 1.6, marginBottom: 12 }}>{form.bio}</p>}
          <ContactList /><Certs /><SaveBtn />
        </div>
      </div>
    )
  }

  // ── 8. SPLIT ──────────────────────────────────────────────────────────────
  if (design.templateId === 'split') {
    const photoSize = calcPhotoSize(56, design)
    const sidebarBg = design.cardStyle === 'gradient'
      ? `linear-gradient(180deg, ${accentHex} 0%, ${accentHex}cc 100%)`
      : design.cardStyle === 'glass'
        ? `linear-gradient(180deg, ${accentHex}cc 0%, ${accentHex}88 100%)`
        : accentHex
    return (
      <div style={{ ...pageStyle, display: 'flex', minHeight: 380 }}>
        <div style={{ width: 80, flexShrink: 0, background: sidebarBg, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 8px', gap: 14,
          boxShadow: design.cardStyle === 'glass' ? `4px 0 20px ${accentHex}44` : undefined }}>
          <div style={{ borderRadius: '50%', overflow: 'hidden', width: photoSize, height: photoSize, border: '3px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>
            {form.profile_image_url
              ? <img src={form.profile_image_url} style={{ width: photoSize, height: photoSize, objectFit: 'cover' }} />
              : <div style={{ width: photoSize, height: photoSize, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: photoSize * 0.35, fontWeight: 700, color: '#fff' }}>{form.name?.[0]?.toUpperCase() || '?'}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 }}>
            {form.phone && <Phone style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.8)' }} />}
            {form.email && <Mail style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.8)' }} />}
            {form.website && <Globe style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.8)' }} />}
          </div>
        </div>
        <div style={{ flex: 1, padding: '16px 14px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ margin: '0 0 3px', fontSize: 16, fontWeight: 800, fontFamily: font.heading, color: bg.text, lineHeight: 1.2 }}>{form.name || 'Your Name'}</h2>
          {isPro && form.title && <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, color: accentHex, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{form.title}</p>}
          {form.company && <p style={{ margin: '0 0 4px', fontSize: 10, color: bg.subtext }}>{form.company}</p>}
          <div style={{ width: 24, height: 2, backgroundColor: accentHex, marginBottom: 8,
            boxShadow: design.cardStyle === 'glass' ? `0 0 6px ${accentHex}` : undefined }} />
          <LogoZone />
          {isPro && form.bio && <p style={{ fontSize: 10, color: bg.subtext, lineHeight: 1.6, marginBottom: 10 }}>{form.bio}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
            {form.phone && <span style={{ fontSize: 10, color: bg.text }}>{form.phone}</span>}
            {form.email && <span style={{ fontSize: 10, color: bg.text }}>{form.email}</span>}
            {form.website && <span style={{ fontSize: 10, color: bg.text }}>{form.website.replace(/^https?:\/\//, '')}</span>}
            {links.map(l => <span key={l.title} style={{ fontSize: 10, color: accentHex }}>{l.title}</span>)}
          </div>
          <Certs />
          <div style={{ marginTop: 10, padding: '8px 0', borderRadius: 8, textAlign: 'center', fontSize: 11, fontWeight: 700, color: buttonText, backgroundColor: buttonBg, border: buttonBorder ? `2px solid ${buttonBorder}` : 'none' }}>Save Contact</div>
        </div>
      </div>
    )
  }

  // ── 9. NEON ───────────────────────────────────────────────────────────────
  if (design.templateId === 'neon') {
    const glow = `0 0 10px ${accentHex}66`
    const photoSize = calcPhotoSize(60, design)
    const neonBorder = design.cardStyle === 'glass' ? `0 0 20px ${accentHex}44` : glow
    return (
      <div style={{ ...pageStyle, backgroundColor: '#050510' }}>
        {design.cardStyle === 'gradient' && (
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at top, ${accentHex}11 0%, transparent 60%)`, pointerEvents: 'none' }} />
        )}
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
            <div style={{ borderRadius: '50%', padding: 2, background: `linear-gradient(135deg, ${accentHex}, ${accentHex}44)`, boxShadow: neonBorder, flexShrink: 0 }}>
              <div style={{ borderRadius: '50%', overflow: 'hidden', width: photoSize, height: photoSize, backgroundColor: '#0a0a1a' }}>
                {form.profile_image_url
                  ? <img src={form.profile_image_url} style={{ width: photoSize, height: photoSize, objectFit: 'cover' }} />
                  : <div style={{ width: photoSize, height: photoSize, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: photoSize * 0.35, fontWeight: 700, color: accentHex }}>{form.name?.[0]?.toUpperCase() || '?'}</div>}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0, ...textNudge }}>
              <h2 style={{ margin: '0 0 3px', fontSize: 16, fontWeight: 700, fontFamily: font.heading, color: '#e8e8ff' }}>{form.name || 'Your Name'}</h2>
              {isPro && form.title && <p style={{ margin: '0 0 2px', fontSize: 10, color: accentHex, fontWeight: 600, textShadow: `0 0 8px ${accentHex}` }}>{form.title}</p>}
              {form.company && <p style={{ margin: 0, fontSize: 10, color: '#404070' }}>{form.company}</p>}
            </div>
          </div>
          <div style={{ height: 1, background: `linear-gradient(90deg, ${accentHex}, transparent)`, marginBottom: 8, boxShadow: `0 0 4px ${accentHex}` }} />
          <LogoZone filter="brightness(2) saturate(0.5)" />
          {isPro && form.bio && <p style={{ fontSize: 10, color: '#6060a0', lineHeight: 1.6, marginBottom: 12 }}>{form.bio}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              form.phone && { icon: <Phone style={{ width: 11, height: 11 }} />, label: form.phone },
              form.email && { icon: <Mail style={{ width: 11, height: 11 }} />, label: form.email },
              form.website && { icon: <Globe style={{ width: 11, height: 11 }} />, label: form.website.replace(/^https?:\/\//, '') },
              ...links.map(l => ({ icon: <ExternalLink style={{ width: 11, height: 11 }} />, label: l.title })),
            ].filter(Boolean).map((item: any, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, backgroundColor: accentHex + '0d', borderRadius: 8, padding: '7px 10px', border: `1px solid ${accentHex}33` }}>
                <span style={{ color: accentHex }}>{item.icon}</span>
                <span style={{ fontSize: 10, color: '#c0c0e8' }}>{item.label}</span>
              </div>
            ))}
          </div>
          <Certs />
          <div style={{ marginTop: 12, padding: '10px 0', borderRadius: 8, textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: design.buttonTextColor || accentHex, backgroundColor: design.buttonBgColor || 'transparent', border: `1px solid ${design.buttonBorderColor || accentHex}`, boxShadow: neonBorder, fontFamily: font.heading, textTransform: 'uppercase' as any }}>SAVE CONTACT</div>
        </div>
      </div>
    )
  }

  // ── 10. STUDIO ────────────────────────────────────────────────────────────
  if (design.templateId === 'studio') {
    const black = '#000'
    const lightArea = '#f5f5f5'
    const Mini = ({ color, children }: { color: string; children: React.ReactNode }) => (
      <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>{children}</div>
    )
    return (
      <div style={{ ...pageStyle, backgroundColor: lightArea }}>
        {/* Black top band */}
        <div style={{ backgroundColor: black, padding: '14px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          {form.company_logo_url ? (
            <div style={{ width: 28, height: 28, backgroundColor: '#fff', borderRadius: 5, padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <img src={form.company_logo_url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
          ) : (
            <div style={{ width: 28, height: 28, backgroundColor: accentHex, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 800, color: '#fff' }}>{(form.company || form.name || 'C')[0].toUpperCase()}</div>
          )}
          {form.company && <p style={{ margin: 0, fontSize: 9, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1, wordBreak: 'break-word' }}>{form.company}</p>}
        </div>
        {/* Photo on black */}
        <div style={{ backgroundColor: black, padding: '4px 12px 20px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 92, height: 92, borderRadius: '50%', overflow: 'hidden', border: '2px solid #fff', boxShadow: '0 6px 14px rgba(0,0,0,0.5)' }}>
            <Avatar base={88} />
          </div>
        </div>
        {/* Wave divider */}
        <svg viewBox="0 0 100 6" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 18, marginTop: -1 }}>
          <path d="M 0 6 L 0 3 Q 25 0, 50 2.5 T 100 3 L 100 6 Z" fill={lightArea} />
        </svg>
        {/* Name + designation */}
        <div style={{ padding: '0 14px 12px', textAlign: 'center', backgroundColor: lightArea }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 900, color: '#0a0a0a', textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.05, fontFamily: font.heading }}>{form.name || 'Your Name'}</h2>
          {isPro && form.title && <p style={{ margin: 0, fontSize: 8, fontWeight: 700, color: '#0a0a0a', textTransform: 'uppercase', letterSpacing: '0.18em' }}>{form.title}</p>}
        </div>
        {/* Accent diagonal section */}
        <div style={{ position: 'relative', backgroundColor: lightArea, padding: '10px 12px 16px', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: accentHex, clipPath: 'polygon(55% 0, 100% 0, 100% 100%, 0 100%)' }} />
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            {form.phone && <div style={{ padding: '6px 12px', background: 'linear-gradient(180deg, #f5f5f5, #d4d4d4)', borderRadius: 999, fontSize: 9, fontWeight: 700, color: '#0a0a0a', flexShrink: 0 }}>Call</div>}
            {form.email && <Mini color="#374151"><Mail style={{ width: 11, height: 11 }} /></Mini>}
            {form.website && <Mini color="#374151"><Globe style={{ width: 11, height: 11 }} /></Mini>}
            {isPro && form.whatsapp && <Mini color="#22c55e"><MessageCircle style={{ width: 11, height: 11 }} /></Mini>}
          </div>
        </div>
      </div>
    )
  }

  // ── 11. FROST ─────────────────────────────────────────────────────────────
  if (design.templateId === 'frost') {
    return (
      <div style={{ ...pageStyle, position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #fef3c7 0%, #fce7f3 25%, #e0e7ff 60%, #ccfbf1 100%)' }}>
        <div style={{ position: 'absolute', top: -40, right: -30, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle, ${accentHex}55 0%, transparent 70%)` }} />
        <div style={{ position: 'absolute', bottom: -30, left: -30, width: 100, height: 100, borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.4) 0%, transparent 70%)' }} />
        <div style={{ position: 'relative', padding: '16px 14px', zIndex: 1 }}>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.6)', borderRadius: 18, padding: '16px 12px', boxShadow: '0 12px 32px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <div style={{ borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.9)' }}>
                <Avatar base={64} />
              </div>
            </div>
            <h2 style={{ margin: '0 0 3px', fontSize: 15, fontWeight: 800, color: '#0f172a', textAlign: 'center', fontFamily: font.heading }}>{form.name || 'Your Name'}</h2>
            {isPro && form.title && <p style={{ margin: 0, fontSize: 9, fontWeight: 600, color: accentHex, textAlign: 'center' }}>{form.title}</p>}
            {form.company && <p style={{ margin: '3px 0 8px', fontSize: 8, color: '#64748b', textAlign: 'center' }}>{form.company}</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {form.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', backgroundColor: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 7 }}><span style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: accentHex + '22', color: accentHex, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Phone style={{ width: 9, height: 9 }} /></span><span style={{ fontSize: 8, color: '#0f172a' }}>{form.phone}</span></div>}
              {form.email && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', backgroundColor: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 7 }}><span style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: accentHex + '22', color: accentHex, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Mail style={{ width: 9, height: 9 }} /></span><span style={{ fontSize: 8, color: '#0f172a' }}>{form.email}</span></div>}
              {form.website && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', backgroundColor: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 7 }}><span style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: accentHex + '22', color: accentHex, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Globe style={{ width: 9, height: 9 }} /></span><span style={{ fontSize: 8, color: '#0f172a' }}>{form.website.replace(/^https?:\/\//, '')}</span></div>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── 12. EDITORIAL ─────────────────────────────────────────────────────────
  if (design.templateId === 'editorial') {
    const paper = '#fafaf9'
    const ink = '#1c1917'
    const rule = '#a8a29e'
    const muted = '#78716c'
    return (
      <div style={{ ...pageStyle, backgroundColor: paper, padding: '18px 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 6, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.4em', fontFamily: 'Georgia, serif' }}>The Profile</p>
          <div style={{ width: '100%', borderTop: `1.5px solid ${ink}`, marginTop: 4 }} />
          <div style={{ width: '100%', borderTop: `0.5px solid ${ink}`, marginTop: 2 }} />
        </div>
        <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 900, color: ink, fontFamily: 'Georgia, "Times New Roman", serif', lineHeight: 0.95, letterSpacing: '-0.02em', textAlign: 'center' }}>{form.name || 'Your Name'}</h2>
        {isPro && form.title && <p style={{ margin: 0, fontSize: 9, color: muted, textAlign: 'center', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>{form.title}</p>}
        {form.company && <p style={{ margin: '2px 0 0', fontSize: 7, color: muted, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 600 }}>{form.company}</p>}
        <div style={{ width: 28, borderTop: `1.5px solid ${accentHex}`, margin: '10px auto' }} />
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ borderRadius: '50%', overflow: 'hidden', border: `1px solid ${rule}` }}>
            <Avatar base={64} />
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${rule}`, paddingTop: 8 }}>
          <p style={{ margin: '0 0 5px', fontSize: 6, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.3em' }}>Correspondence</p>
          {form.phone && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${rule}`, fontFamily: 'Georgia, serif' }}><span style={{ fontSize: 7, color: muted, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700 }}>Tel</span><span style={{ fontSize: 9, color: ink }}>{form.phone}</span></div>}
          {form.email && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${rule}`, fontFamily: 'Georgia, serif' }}><span style={{ fontSize: 7, color: muted, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700 }}>Email</span><span style={{ fontSize: 9, color: ink }}>{form.email}</span></div>}
          {form.website && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${rule}`, fontFamily: 'Georgia, serif' }}><span style={{ fontSize: 7, color: muted, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700 }}>Web</span><span style={{ fontSize: 9, color: ink }}>{form.website.replace(/^https?:\/\//, '')}</span></div>}
        </div>
      </div>
    )
  }

  return null
}
