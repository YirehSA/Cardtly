'use client'

import {
  CardDesign, FONTS, getBgColors, calcPhotoSize, calcLogoHeight,
  getAccentHex, getReadableTextOn, getButtonBg, getButtonText, getButtonBorder,
  getCardStyleEffect, TEXT_POSITION_TEMPLATES,
  calcNameSize, calcTitleSize, calcCompanySize, calcBioSize,
  getNameColor, getTitleColor, getCompanyColor, getBioColor,
  getBodyFontSize, getButtonFontSize, isLightBg, companionHex
} from '@/types/design'
import { Phone, Mail, Globe, MapPin, MessageCircle, ExternalLink, ChevronRight, Twitter, Facebook, Linkedin } from 'lucide-react'

// Circuit's star field, thinned for a thumbnail. A fixed table rather than
// random placement, so the server and the client draw the same stars.
const CIRCUIT_PREVIEW_STARS: [number, number][] = [
  [8, 18], [19, 40], [12, 62], [31, 26], [44, 54], [39, 12], [57, 34],
  [63, 68], [72, 22], [84, 48], [91, 30], [26, 76], [51, 84], [78, 80],
]

interface PreviewData {
  name: string; title: string; company: string; bio: string
  email: string; phone: string; whatsapp: string; address: string; website: string
  profile_image_url: string; company_logo_url: string; certifications: string
  link_1_title: string; link_1_url: string
  link_2_title: string; link_2_url: string
  link_3_title: string; link_3_url: string
}

interface Props { form: PreviewData; isPro: boolean; design: CardDesign }

// Mixes a hex toward black. Kept identical to the copy in PublicCardView so the
// Creative backdrop and ring resolve to the same colours in both places.
function darkenHex(hex: string, amount: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  if (full.length !== 6) return hex
  const mix = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amount))))
  const r = mix(parseInt(full.slice(0, 2), 16))
  const g = mix(parseInt(full.slice(2, 4), 16))
  const b = mix(parseInt(full.slice(4, 6), 16))
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`
}

export default function TemplatedCardPreview({ form, isPro, design }: Props) {
  const accentHex = getAccentHex(design)
  const buttonBg = getButtonBg(design)
  const buttonText = getButtonText(design)
  const buttonBorder = getButtonBorder(design)
  const font = FONTS[design.fontId]
  const bg = getBgColors(design.bgMode, design.templateId, design.customBgColor)
  // Mirrors PublicCardView: a custom background colour decides light vs dark.
  const isLight = design.customBgColor ? isLightBg(design.customBgColor) : design.bgMode === 'light'
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

  // Brand colours for the social pills (mirror PublicCardView)
  const SOCIAL_BRAND_COLORS = {
    linkedin: '#0a66c2',
    twitter:  '#000000',
    instagram: '#E4405F',
    facebook: '#1877F2',
    whatsapp: '#25D366',
  }
  function Avatar({ base = 64, rounded = 'full', extraStyle = {} }: { base?: number; rounded?: string; extraStyle?: React.CSSProperties }) {
    const size = calcPhotoSize(base, design)
    const borderRadius = rounded === 'full' ? '50%' : rounded === 'xl' ? 14 : 10
    const style: React.CSSProperties = { width: size, height: size, objectFit: 'cover', flexShrink: 0, borderRadius, border: `3px solid ${bg.page}`, ...extraStyle }
    if (design.profileBorder === false) style.border = 'none'
    if (form.profile_image_url) return <img src={form.profile_image_url} style={style} />
    return <div style={{ ...style, backgroundColor: accentHex + '33', color: accentHex, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, fontFamily: font.heading }}>{form.name?.[0]?.toUpperCase() || '?'}</div>
  }

  function Row({ icon, label, sublabel }: { icon: React.ReactNode; label: string; sublabel?: string }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: cardEffect.surfaceBg, backdropFilter: cardEffect.backdropFilter, WebkitBackdropFilter: cardEffect.backdropFilter, boxShadow: cardEffect.surfaceShadow, borderRadius: 10, padding: '8px 12px', border: cardEffect.borderStyle }}>
        <span style={{ color: accentHex, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: getBodyFontSize(design) - 3, fontWeight: 500, margin: 0, color: bg.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</p>
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
        {/* WhatsApp moved to socials row (brand-coloured pill) */}
        {form.website && <Row icon={<Globe style={{ width: 12, height: 12 }} />} label={form.website.replace(/^https?:\/\//, '')} />}
        {links.map(l => <Row key={l.title} icon={<ExternalLink style={{ width: 12, height: 12 }} />} label={l.title} />)}
      </div>
    )
  }

  function SaveBtn({ label = 'Save Contact', outline = false }: { label?: string; outline?: boolean }) {
    // The fill is spread in as either `background` or `backgroundColor`, never
    // both. Listing `background: undefined` alongside `backgroundColor` looks
    // harmless but is not: React writes an undefined style as the empty string,
    // and clearing the `background` shorthand also clears the background-color
    // set just above it. That left this button fully transparent on every
    // non-gradient card, so the button colour picker appeared to do nothing.
    const useGradient = !outline && design.cardStyle === 'gradient'
    const fill: React.CSSProperties = useGradient
      ? { background: `linear-gradient(135deg, ${buttonBg}, ${buttonBg}bb)` }
      : { backgroundColor: outline ? 'transparent' : buttonBg }
    return (
      <div style={{
        marginTop: 12, padding: '10px 0', borderRadius: 12, textAlign: 'center',
        fontSize: getButtonFontSize(design) - 2, fontWeight: 700, fontFamily: font.heading,
        color: outline ? accentHex : buttonText,
        ...fill,
        border: outline
          ? `2px solid ${accentHex}`
          : (buttonBorder ? `2px solid ${buttonBorder}` : 'none'),
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
    // Mirror PublicCardView Classic: gradient hero by default, solid
    // accent block when solidBackground is on. Same accent rule below
    // the title/company so the live preview matches the real card.
    const heroBackground = design.solidBackground ? accentHex : cardEffect.heroBg
    return (
      <div style={pageStyle}>
        <div style={{ height: 104, background: heroBackground, position: 'relative', overflow: 'hidden' }}>
          {!design.solidBackground && (
            <>
              <div style={{ position: 'absolute', top: '-40%', left: '-10%', width: 190, height: 190, background: `radial-gradient(circle, ${accentHex}38 0%, transparent 70%)`, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: '10%', right: '-15%', width: 150, height: 150, background: `radial-gradient(circle, ${accentHex}28 0%, transparent 70%)`, pointerEvents: 'none' }} />
            </>
          )}
          {/* Scoops the page colour into the band, as on the real card. */}
          <div aria-hidden style={{ position: 'absolute', left: '-8%', right: '-8%', bottom: -1, height: 30, backgroundColor: bg.page, borderRadius: '50% 50% 0 0 / 100% 100% 0 0' }} />
        </div>
        <div style={{ padding: '0 16px 20px', marginTop: -(photoSize / 2) - 8 }}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{
              display: 'inline-block', zIndex: 2, position: 'relative', borderRadius: '50%',
              padding: design.profileBorder === false ? 0 : 3,
              background: design.profileBorder === false ? 'none' : `linear-gradient(140deg, ${accentHex} 0%, ${accentHex}44 60%, ${accentHex}22 100%)`,
            }}><Avatar base={76} extraStyle={{ border: `2px solid ${bg.page}`, display: 'block' }} /></div>
            <h2 style={{ margin: '10px 0 3px', fontSize: calcNameSize(18, design), fontWeight: 700, fontFamily: font.heading, color: getNameColor(design, bg.text), letterSpacing: '-0.02em' }}>{form.name || 'Your Name'}</h2>
            {isPro && form.title && <p style={{ margin: '0 0 3px', fontSize: calcTitleSize(9, design), fontWeight: 700, color: getTitleColor(design, accentHex), letterSpacing: '0.16em', textTransform: 'uppercase' }}>{form.title}</p>}
            {form.company && <p style={{ margin: 0, fontSize: calcCompanySize(9, design), fontWeight: 600, color: getCompanyColor(design, bg.subtext), letterSpacing: '0.12em', textTransform: 'uppercase' }}>{form.company}</p>}
            {/* A rule that fades at both ends, matching PublicCardView. */}
            <div style={{ width: 80, height: 1, margin: '10px auto 0', background: `linear-gradient(90deg, transparent, ${accentHex}, transparent)` }} />
            <LogoZone />
            {isPro && form.bio && <p style={{ margin: '6px 0 0', fontSize: 11, color: bg.subtext, lineHeight: 1.5 }}>{form.bio}</p>}
          </div>
          <ContactList /><Certs /><SaveBtn />
          {!isPro && <p style={{ textAlign: 'center', fontSize: 10, color: bg.border, marginTop: 8 }}>Powered by Cardtly</p>}
        </div>
      </div>
    )
  }

  // ── 2. MODERN ─────────────────────────────────────────────────────────────
  if (design.templateId === 'modern') {
    // Mirrors PublicCardView Modern: gradient orbs + glass panel +
    // inline social icons next to the logo.
    const nameFontSize = calcNameSize(15, design)
    const titleColor = getTitleColor(design, accentHex)
    const bioColor = getBioColor(design, bg.subtext)
    const hasLinkedin = isPro && !!(form as any).linkedin_url
    const hasTwitter  = isPro && !!(form as any).twitter_url
    const hasFacebook = isPro && !!(form as any).facebook_url
    const hasInstagram = isPro && !!(form as any).instagram_url
    const hasYoutube  = isPro && !!(form as any).youtube
    const hasTiktok   = isPro && !!(form as any).tiktok
    const hasAnySocial = hasLinkedin || hasTwitter || hasFacebook || hasInstagram || hasYoutube || hasTiktok
    return (
      <div style={{ ...pageStyle, position: 'relative', overflow: 'hidden', minHeight: 480 }}>
        {/* Static gradient orbs (preview thumbnail) - same colours as
            the real card, no animation since this is just a thumbnail */}
        <div style={{ position: 'absolute', top: -40, left: -40, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${accentHex}99 0%, transparent 65%)`, filter: 'blur(20px)', zIndex: 0 }} />
        <div style={{ position: 'absolute', top: 80, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.65) 0%, transparent 65%)', filter: 'blur(20px)', zIndex: 0 }} />
        <div style={{ position: 'absolute', bottom: -60, left: 20, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.65) 0%, transparent 65%)', filter: 'blur(20px)', zIndex: 0 }} />
        <div style={{ padding: 12, position: 'relative', zIndex: 1 }}>
          <div style={{
            backgroundColor: isLight ? 'rgba(255,255,255,0.6)' : 'rgba(20,20,30,0.45)',
            backdropFilter: 'blur(28px) saturate(180%)',
            WebkitBackdropFilter: 'blur(28px) saturate(180%)',
            border: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.14)'}`,
            borderRadius: 18,
            padding: 14,
            boxShadow: '0 12px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ flexShrink: 0 }}><Avatar base={64} rounded="full" extraStyle={{ border: `2px solid ${accentHex}66` }} /></div>
              <div style={{ flex: 1, minWidth: 0, ...textNudge, paddingTop: 2 }}>
                <h2 style={{ margin: 0, fontSize: nameFontSize, fontWeight: 800, fontFamily: font.heading, color: getNameColor(design, bg.text), lineHeight: 1.1, letterSpacing: '-0.02em' }}>{form.name || 'Your Name'}</h2>
                {isPro && form.title && <p style={{ margin: '4px 0 0', fontSize: calcTitleSize(8, design), fontWeight: 700, color: titleColor, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{form.title}</p>}
                {form.company && <p style={{ margin: '2px 0 0', fontSize: calcCompanySize(9, design), color: getCompanyColor(design, bg.subtext) }}>{form.company}</p>}
              </div>
            </div>
            <div style={{ width: 28, height: 2, borderRadius: 2, backgroundColor: accentHex, marginBottom: 8, boxShadow: `0 0 10px ${accentHex}88` }} />
            <LogoZone />
            {isPro && form.bio && <p style={{ fontSize: Math.max(9, getBodyFontSize(design) - 4), color: bioColor, lineHeight: 1.6, marginBottom: 10 }}>{form.bio}</p>}
            {/* Socials row - centered UNDER the bio, in brand colours */}
            {(hasAnySocial || (isPro && form.whatsapp)) && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
                {hasLinkedin && <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: SOCIAL_BRAND_COLORS.linkedin, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 6px ${SOCIAL_BRAND_COLORS.linkedin}66` }}><ExternalLink style={{ width: 10, height: 10 }} /></div>}
                {hasTwitter && <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: SOCIAL_BRAND_COLORS.twitter, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 6px ${SOCIAL_BRAND_COLORS.twitter}66` }}><Twitter style={{ width: 10, height: 10 }} /></div>}
                {hasInstagram && <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: SOCIAL_BRAND_COLORS.instagram, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 6px ${SOCIAL_BRAND_COLORS.instagram}66` }}><ExternalLink style={{ width: 10, height: 10 }} /></div>}
                {hasFacebook && <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: SOCIAL_BRAND_COLORS.facebook, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 6px ${SOCIAL_BRAND_COLORS.facebook}66` }}><Facebook style={{ width: 10, height: 10 }} /></div>}
                {isPro && form.whatsapp && <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: SOCIAL_BRAND_COLORS.whatsapp, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 6px ${SOCIAL_BRAND_COLORS.whatsapp}66` }}><MessageCircle style={{ width: 10, height: 10 }} /></div>}
              </div>
            )}
            <ContactList /><Certs /><SaveBtn />
          </div>
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
            <div style={{ borderRadius: '50%', overflow: 'hidden', width: heroPhotoSize, height: heroPhotoSize, border: design.profileBorder === false ? 'none' : '3px solid rgba(255,255,255,0.4)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
              {form.profile_image_url
                ? <img src={form.profile_image_url} style={{ width: heroPhotoSize, height: heroPhotoSize, objectFit: 'cover' }} />
                : <div style={{ width: heroPhotoSize, height: heroPhotoSize, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: heroPhotoSize * 0.36, fontWeight: 700, color: '#fff', fontFamily: font.heading }}>{form.name?.[0]?.toUpperCase() || '?'}</div>}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 2, ...textNudge }}>
            <h2 style={{ margin: '0 0 4px', fontSize: calcNameSize(17, design), fontWeight: 800, fontFamily: font.heading, color: getNameColor(design, '#fff'), lineHeight: 1.1, textShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>{form.name || 'Your Name'}</h2>
            {isPro && form.title && <p style={{ margin: '0 0 3px', fontSize: calcTitleSize(11, design), fontWeight: 600, color: getTitleColor(design, 'rgba(255,255,255,0.85)'), lineHeight: 1.2 }}>{form.title}</p>}
            {form.company && <p style={{ margin: 0, fontSize: calcCompanySize(10, design), color: getCompanyColor(design, 'rgba(255,255,255,0.65)'), lineHeight: 1.2 }}>{form.company}</p>}
          </div>
        </div>
        <div style={{ padding: '14px 14px 16px' }}>
          <LogoZone />
          {isPro && form.bio && <p style={{ fontSize: calcBioSize(11, design), color: getBioColor(design, bg.subtext), lineHeight: 1.5, marginBottom: 12 }}>{form.bio}</p>}
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
    const pageBg = design.customBgColor || (isLight ? '#ffffff' : '#000000')
    const ink = design.customBgColor ? getReadableTextOn(design.customBgColor) : (isLight ? '#0f172a' : '#ffffff')
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
              <img src={form.company_logo_url} style={{ height: calcLogoHeight(24, design), width: 'auto', objectFit: 'contain', maxWidth: 140 }} />
            </div>
          )}
          {/* Photo with neon-blue → purple → pink gradient ring. Inner wrap
              gets pageBg so transparent-bg PNGs show the page through.
              When profileBorder is OFF the gradient ring is dropped. */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            {design.profileBorder === false ? (
              <Avatar base={76} />
            ) : (
              <div style={{ padding: 3, borderRadius: '50%', background: RING_GRADIENT, boxShadow: '0 0 8px rgba(0,212,255,0.22), 0 0 12px rgba(236,72,153,0.16)' }}>
                <div style={{ borderRadius: '50%', overflow: 'hidden', border: `2px solid ${pageBg}`, backgroundColor: pageBg }}>
                  <Avatar base={76} />
                </div>
              </div>
            )}
          </div>
          <h2 style={{ margin: '0 0 4px', fontSize: calcNameSize(18, design), fontWeight: 800, color: getNameColor(design, ink), fontFamily: font.heading, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{form.name || 'Your Name'}</h2>
          {isPro && form.title && <p style={{ margin: 0, fontSize: calcTitleSize(11, design), fontWeight: 500, color: getTitleColor(design, titleColor) }}>{form.title}</p>}
          {form.company && <p style={{ margin: '3px 0 0', fontSize: calcCompanySize(10, design), color: getCompanyColor(design, muted) }}>{form.company}</p>}
          {isPro && form.bio && <p style={{ fontSize: calcBioSize(10, design), color: getBioColor(design, muted), lineHeight: 1.5, margin: '8px 0 0' }}>{form.bio}</p>}
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
          <div style={{ marginTop: 10, padding: '10px 0', textAlign: 'center', fontSize: getButtonFontSize(design) - 3, fontWeight: 700,
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
    const pageBg = design.customBgColor || (isLight ? '#fafafa' : '#000000')
    const ink = design.customBgColor ? getReadableTextOn(design.customBgColor) : (isLight ? '#0f172a' : '#ffffff')
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
            <h2 style={{ margin: '0 0 6px', fontSize: calcNameSize(20, design), fontWeight: 800, color: getNameColor(design, '#ffffff'), letterSpacing: '-0.025em', lineHeight: 0.96, fontFamily: font.heading, textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>{form.name || 'Your Name'}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 20, height: 2, background: accentHex, boxShadow: `0 0 8px ${accentHex}aa` }} />
              {isPro && form.title && <p style={{ margin: 0, fontSize: calcTitleSize(7, design), fontWeight: 700, color: getTitleColor(design, '#ffffff'), textTransform: 'uppercase', letterSpacing: '0.28em' }}>{form.title}</p>}
            </div>
            {form.company && <p style={{ margin: 0, fontSize: calcCompanySize(8, design), color: getCompanyColor(design, 'rgba(255,255,255,0.7)'), fontStyle: 'italic' }}>{form.company}</p>}
          </div>
        </div>
        {/* Glass overlap card */}
        <div style={{ position: 'relative', marginTop: -14, marginLeft: 10, marginRight: 10, padding: '10px 12px', backgroundColor: glassBg, border: `1px solid ${glassBorder}`, borderRadius: 14, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          <LogoZone />
          {isPro && form.bio && <p style={{ margin: 0, fontSize: calcBioSize(8, design), color: getBioColor(design, muted), lineHeight: 1.6, fontStyle: 'italic', textAlign: 'center' }}>&ldquo;{form.bio}&rdquo;</p>}
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
  // ── CREATIVE ──────────────────────────────────────────────────────────────
  // A bento grid, the one shape nothing else in the set uses. See the same
  // template in PublicCardView.
  if (design.templateId === 'creative') {
    const deep = darkenHex(accentHex, 0.3)
    const onAccent = getReadableTextOn(accentHex)
    const parts = (form.name || '').trim().split(/\s+/).filter(Boolean)
    const initials = parts.length
      ? ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
      : '?'

    const tile: React.CSSProperties = {
      borderRadius: 12, padding: '9px 10px',
      background: cardEffect.surfaceBg,
      border: `1px solid ${accentHex}26`,
    }
    const tileLabel: React.CSSProperties = {
      display: 'block', fontSize: 6, fontWeight: 700, letterSpacing: '0.14em',
      textTransform: 'uppercase', color: bg.subtext, marginBottom: 2,
    }

    const contacts = [
      form.phone && { key: 'tel', label: 'Call', value: form.phone, icon: <Phone style={{ width: 10, height: 10 }} /> },
      form.email && { key: 'eml', label: 'Email', value: form.email, icon: <Mail style={{ width: 10, height: 10 }} />, wide: true },
      form.website && { key: 'web', label: 'Website', value: form.website.replace(/^https?:\/\//, '').replace(/\/$/, ''), icon: <Globe style={{ width: 10, height: 10 }} />, wide: true },
    ].filter(Boolean) as any[]

    return (
      <div style={{ ...pageStyle, overflow: 'hidden', position: 'relative', minHeight: 380 }}>
        {/* The same three-wash colour field as the live card, sized to the
            preview box. Absolute rather than fixed, since this is in a frame. */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-18%', right: '-22%', width: 230, height: 230, borderRadius: '50%', background: `radial-gradient(circle, ${accentHex}55 0%, transparent 68%)`, filter: 'blur(18px)' }} />
          <div style={{ position: 'absolute', bottom: '-14%', left: '-24%', width: 210, height: 210, borderRadius: '50%', background: `radial-gradient(circle, ${deep}44 0%, transparent 70%)`, filter: 'blur(20px)' }} />
          <div style={{ position: 'absolute', top: '34%', left: '38%', width: 160, height: 160, borderRadius: '50%', background: `radial-gradient(circle, ${accentHex}22 0%, transparent 72%)`, filter: 'blur(22px)' }} />
        </div>

        <div style={{ position: 'relative', padding: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            <div style={{ ...tile, padding: 0, overflow: 'hidden', aspectRatio: '1 / 1' }}>
              {form.profile_image_url
                ? <img src={form.profile_image_url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: `linear-gradient(150deg, ${accentHex}55, ${deep}22)`, color: accentHex, fontFamily: font.heading, fontSize: 26, fontWeight: 800 }}>{initials}</div>}
            </div>

            {/* The one solid accent tile: a bento where every cell has the same
                weight is a spreadsheet, and this is what stops it being one. */}
            <div style={{ ...tile, aspectRatio: '1 / 1', background: accentHex, border: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <svg aria-hidden width="14" height="14" viewBox="0 0 30 30">
                <g stroke={onAccent} strokeWidth="3" strokeLinecap="round" opacity="0.9">
                  <line x1="15" y1="4" x2="15" y2="26" /><line x1="5" y1="9" x2="25" y2="21" /><line x1="25" y1="9" x2="5" y2="21" />
                </g>
              </svg>
              {isPro && form.title && (
                <span style={{ fontFamily: font.heading, fontSize: calcTitleSize(10, design), fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.02em', color: onAccent }}>{form.title}</span>
              )}
            </div>

            <div style={{ ...tile, gridColumn: '1 / -1' }}>
              <h2 style={{
                margin: 0, fontFamily: font.heading, fontSize: calcNameSize(20, design), fontWeight: 800,
                letterSpacing: '-0.035em', lineHeight: 1.02,
                ...(design.nameColor
                  ? { color: design.nameColor }
                  : {
                      background: `linear-gradient(120deg, ${bg.text} 12%, ${accentHex} 92%)`,
                      WebkitBackgroundClip: 'text', backgroundClip: 'text',
                      WebkitTextFillColor: 'transparent', color: 'transparent',
                    }),
              }}>{form.name || 'Your Name'}</h2>
              {form.company && <p style={{ margin: '5px 0 0', fontSize: calcCompanySize(8, design), fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: getCompanyColor(design, bg.subtext) }}>{form.company}</p>}
              <LogoZone />
            </div>

            {isPro && form.bio && (
              <div style={{ ...tile, gridColumn: '1 / -1' }}>
                <span style={tileLabel}>About</span>
                <p style={{ margin: 0, fontSize: calcBioSize(9, design), color: getBioColor(design, bg.subtext), lineHeight: 1.55 }}>{form.bio}</p>
              </div>
            )}

            {contacts.map(c => (
              <div key={c.key} style={{ ...tile, gridColumn: c.wide ? '1 / -1' : undefined }}>
                <span style={{ display: 'block', color: accentHex, marginBottom: 5 }}>{c.icon}</span>
                <span style={tileLabel}>{c.label}</span>
                <span style={{ display: 'block', fontSize: getBodyFontSize(design) - 5, fontWeight: 600, color: bg.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.value}</span>
              </div>
            ))}
          </div>

          <Certs />
          <div style={{ marginTop: 10, padding: '9px 0', borderRadius: 12, textAlign: 'center', fontSize: getButtonFontSize(design) - 2, fontWeight: 700, color: buttonText,
            background: `linear-gradient(135deg, ${buttonBg}, ${buttonBg}aa)`,
            border: buttonBorder ? `2px solid ${buttonBorder}` : 'none' }}>Save Contact</div>
        </div>
      </div>
    )
  }

  if (design.templateId === 'wave') {
    // Mirror PublicCardView Wave: solid accent block when
    // solidBackground, otherwise the accent gradient. Brand-coloured
    // socials row centred under the bio.
    const waveGradient = design.cardStyle === 'gradient'
      ? `linear-gradient(135deg, ${accentHex}55 0%, ${accentHex}22 100%)`
      : design.cardStyle === 'glass'
        ? `linear-gradient(135deg, ${accentHex}44 0%, ${accentHex}11 100%)`
        : `linear-gradient(135deg, ${accentHex}33 0%, ${bg.page} 100%)`
    const waveHeroBg = design.solidBackground ? accentHex : waveGradient
    const nameFontSize = calcNameSize(17, design)
    const titleColor = getTitleColor(design, accentHex)
    const bioColor = getBioColor(design, bg.subtext)
    const hasLinkedin = isPro && !!(form as any).linkedin_url
    const hasTwitter  = isPro && !!(form as any).twitter_url
    const hasFacebook = isPro && !!(form as any).facebook_url
    const hasInstagram = isPro && !!(form as any).instagram_url
    const hasYoutube  = isPro && !!(form as any).youtube
    const hasTiktok   = isPro && !!(form as any).tiktok
    return (
      <div style={pageStyle}>
        <div style={{ background: waveHeroBg, position: 'relative' }}>
          <div style={{ display: 'flex', padding: '20px 16px 44px', gap: 0 }}>
            <div style={{ flexShrink: 0 }}><Avatar base={80} rounded="full" /></div>
            <div style={{ flex: 1, paddingLeft: 14, ...textNudge }}>
              <h2 style={{ margin: '0 0 4px', fontSize: nameFontSize, fontWeight: 800, fontFamily: font.heading, color: getNameColor(design, bg.text), lineHeight: 1.2 }}>{form.name || 'Your Name'}</h2>
              {isPro && form.title && <p style={{ margin: '0 0 3px', fontSize: calcTitleSize(11, design), fontWeight: 600, color: titleColor }}>{form.title}</p>}
              {form.company && <p style={{ margin: 0, fontSize: calcCompanySize(11, design), color: getCompanyColor(design, bg.subtext) }}>{form.company}</p>}
            </div>
          </div>
          <svg viewBox="0 0 400 48" style={{ display: 'block', width: '100%', height: 48, position: 'absolute', bottom: 0 }} preserveAspectRatio="none">
            <path d="M0,24 C80,48 160,0 240,24 C320,48 360,12 400,24 L400,48 L0,48 Z" fill={bg.page} />
          </svg>
        </div>
        <div style={{ padding: '8px 16px 20px' }}>
          <LogoZone />
          {isPro && form.bio && <p style={{ fontSize: Math.max(9, getBodyFontSize(design) - 3), color: bioColor, lineHeight: 1.6, marginBottom: 10 }}>{form.bio}</p>}
          {(hasLinkedin || hasTwitter || hasInstagram || hasFacebook || (isPro && form.whatsapp)) && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
              {hasLinkedin && <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: SOCIAL_BRAND_COLORS.linkedin, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 6px ${SOCIAL_BRAND_COLORS.linkedin}66` }}><ExternalLink style={{ width: 10, height: 10 }} /></div>}
              {hasTwitter && <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: SOCIAL_BRAND_COLORS.twitter, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 6px ${SOCIAL_BRAND_COLORS.twitter}66` }}><Twitter style={{ width: 10, height: 10 }} /></div>}
              {hasInstagram && <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: SOCIAL_BRAND_COLORS.instagram, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 6px ${SOCIAL_BRAND_COLORS.instagram}66` }}><ExternalLink style={{ width: 10, height: 10 }} /></div>}
              {hasFacebook && <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: SOCIAL_BRAND_COLORS.facebook, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 6px ${SOCIAL_BRAND_COLORS.facebook}66` }}><Facebook style={{ width: 10, height: 10 }} /></div>}
              {isPro && form.whatsapp && <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: SOCIAL_BRAND_COLORS.whatsapp, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 6px ${SOCIAL_BRAND_COLORS.whatsapp}66` }}><MessageCircle style={{ width: 10, height: 10 }} /></div>}
            </div>
          )}
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
          <div style={{ borderRadius: '50%', overflow: 'hidden', width: photoSize, height: photoSize, border: design.profileBorder === false ? 'none' : '3px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>
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
          <h2 style={{ margin: '0 0 3px', fontSize: calcNameSize(16, design), fontWeight: 800, fontFamily: font.heading, color: getNameColor(design, bg.text), lineHeight: 1.2 }}>{form.name || 'Your Name'}</h2>
          {isPro && form.title && <p style={{ margin: '0 0 2px', fontSize: calcTitleSize(10, design), fontWeight: 600, color: getTitleColor(design, accentHex), textTransform: 'uppercase', letterSpacing: '0.06em' }}>{form.title}</p>}
          {form.company && <p style={{ margin: '0 0 4px', fontSize: calcCompanySize(10, design), color: getCompanyColor(design, bg.subtext) }}>{form.company}</p>}
          <div style={{ width: 24, height: 2, backgroundColor: accentHex, marginBottom: 8,
            boxShadow: design.cardStyle === 'glass' ? `0 0 6px ${accentHex}` : undefined }} />
          <LogoZone />
          {isPro && form.bio && <p style={{ fontSize: calcBioSize(10, design), color: getBioColor(design, bg.subtext), lineHeight: 1.6, marginBottom: 10 }}>{form.bio}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
            {form.phone && <span style={{ fontSize: getBodyFontSize(design) - 4, color: bg.text }}>{form.phone}</span>}
            {form.email && <span style={{ fontSize: getBodyFontSize(design) - 4, color: bg.text }}>{form.email}</span>}
            {form.website && <span style={{ fontSize: 10, color: bg.text }}>{form.website.replace(/^https?:\/\//, '')}</span>}
            {links.map(l => <span key={l.title} style={{ fontSize: getBodyFontSize(design) - 4, color: accentHex }}>{l.title}</span>)}
          </div>
          <Certs />
          <div style={{ marginTop: 10, padding: '8px 0', borderRadius: 8, textAlign: 'center', fontSize: getButtonFontSize(design) - 3, fontWeight: 700, color: buttonText, backgroundColor: buttonBg, border: buttonBorder ? `2px solid ${buttonBorder}` : 'none' }}>Save Contact</div>
        </div>
      </div>
    )
  }

  // ── SPLIT PRO ─────────────────────────────────────────────────────────────
  // Split, with the rail running the whole way down to just above the gallery.
  // Every icon that speaks for itself lives in the rail (call, mail, map, site,
  // socials); the name block and the named links sit beside it. See the same
  // template in PublicCardView.
  if (design.templateId === 'splitpro') {
    const railW = 52
    const photoSize = Math.min(railW - 14, calcPhotoSize(36, design))
    const railBg = design.cardStyle === 'gradient'
      ? `linear-gradient(180deg, ${accentHex} 0%, ${accentHex}cc 100%)`
      : design.cardStyle === 'glass'
        ? `linear-gradient(180deg, ${accentHex}cc 0%, ${accentHex}88 100%)`
        : accentHex
    const onRail = getReadableTextOn(accentHex)
    const rows = (links.slice(0, 2) as { title: string }[]).map(l => ({ key: l.title, label: l.title }))

    return (
      <div style={{ ...pageStyle, minHeight: 380, display: 'flex', flexDirection: 'column' }}>
        {/* The rail is absolute inside this region rather than the page, so it
            ends exactly where the Save Contact block begins. Guessing at the
            bottom block's height put the button on top of the rail. */}
        <div style={{ position: 'relative', flex: 1 }}>
        <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: railW, background: railBg }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', padding: '16px 14px 10px 0' }}>
          {/* Photo, then the socials under it - the icon is the whole message,
              so they need no label and take none. */}
          <div style={{ width: railW, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ borderRadius: '50%', overflow: 'hidden', width: photoSize, height: photoSize, marginBottom: 6, border: design.profileBorder === false ? 'none' : `2px solid ${onRail === '#ffffff' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)'}` }}>
              {form.profile_image_url
                ? <img src={form.profile_image_url} style={{ width: photoSize, height: photoSize, objectFit: 'cover' }} />
                : <div style={{ width: photoSize, height: photoSize, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: photoSize * 0.35, fontWeight: 700, color: '#fff' }}>{form.name?.[0]?.toUpperCase() || '?'}</div>}
            </div>
            {[
              form.phone && <Phone key="ph" style={{ width: 13, height: 13 }} />,
              form.email && <Mail key="em" style={{ width: 13, height: 13 }} />,
              isPro && (form as any).address && <MapPin key="ad" style={{ width: 13, height: 13 }} />,
              form.website && <Globe key="we" style={{ width: 13, height: 13 }} />,
              isPro && (form as any).linkedin_url && <Linkedin key="li" style={{ width: 13, height: 13 }} />,
              isPro && (form as any).instagram_url && <ExternalLink key="ig" style={{ width: 13, height: 13 }} />,
              isPro && (form as any).facebook_url && <Facebook key="fb" style={{ width: 13, height: 13 }} />,
              isPro && (form as any).twitter_url && <Twitter key="tw" style={{ width: 13, height: 13 }} />,
              isPro && form.whatsapp && <MessageCircle key="wa" style={{ width: 13, height: 13 }} />,
            ].filter(Boolean).map((icon, i) => (
              <span key={i} style={{
                width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', color: onRail,
                background: onRail === '#ffffff' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
              }}>{icon}</span>
            ))}
          </div>
          {/* Centred, matching the real card, and padded off the rail. */}
          <div style={{ flex: 1, minWidth: 0, textAlign: 'center', paddingLeft: 12 }}>
            <h2 style={{ margin: '0 0 3px', fontSize: calcNameSize(16, design), fontWeight: 800, fontFamily: font.heading, color: getNameColor(design, bg.text), lineHeight: 1.2 }}>{form.name || 'Your Name'}</h2>
            {isPro && form.title && <p style={{ margin: '0 0 2px', fontSize: calcTitleSize(10, design), fontWeight: 600, color: getTitleColor(design, accentHex), textTransform: 'uppercase', letterSpacing: '0.06em' }}>{form.title}</p>}
            {form.company && <p style={{ margin: 0, fontSize: calcCompanySize(10, design), color: getCompanyColor(design, bg.subtext) }}>{form.company}</p>}
            <LogoZone />
            {isPro && form.bio && <p style={{ fontSize: calcBioSize(10, design), color: getBioColor(design, bg.subtext), lineHeight: 1.6, margin: '6px 0 0' }}>{form.bio}</p>}
            {/* Beside the rail, not below it: the rail is a stack of chips and
                the name block is four lines, so anything below the pair would
                start level with the BOTTOM of the rail and leave a dead gap. */}
            {rows.map(r => (
              <div key={r.key} style={{
                marginTop: 8, padding: '6px 9px',
                fontSize: getBodyFontSize(design) - 4, color: bg.text,
                border: `1px solid ${accentHex}`, borderRadius: 8,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{r.label}</div>
            ))}
            <div style={{ marginTop: 8 }}><Certs /></div>
          </div>
        </div>
        </div>

        {/* Closes the rail off across the card, as on the real one. */}
        <div style={{ height: 2, backgroundColor: accentHex }} />

        <div style={{ padding: '12px 14px 14px' }}>
          <div style={{ padding: '8px 0', borderRadius: 8, textAlign: 'center', fontSize: getButtonFontSize(design) - 3, fontWeight: 700, color: buttonText, backgroundColor: buttonBg, border: buttonBorder ? `2px solid ${buttonBorder}` : 'none' }}>Save Contact</div>
        </div>
      </div>
    )
  }

  // ── CIRCUIT ───────────────────────────────────────────────────────────────
  // Ribbon top and bottom, a scatter of stars, and the contact traces. See the
  // same template in PublicCardView.
  if (design.templateId === 'circuit') {
    const companion = companionHex(accentHex)
    const avatar = calcPhotoSize(54, design)
    const arcBox = avatar + 20
    const traces = [
      form.phone && { key: 'ph', icon: <Phone style={{ width: 11, height: 11 }} />, label: form.phone },
      form.email && { key: 'em', icon: <Mail style={{ width: 11, height: 11 }} />, label: form.email },
      isPro && (form as any).address && { key: 'ad', icon: <MapPin style={{ width: 11, height: 11 }} />, label: (form as any).address },
      form.website && { key: 'we', icon: <Globe style={{ width: 11, height: 11 }} />, label: form.website.replace(/^https?:\/\//, '') },
      isPro && (form as any).linkedin_url && { key: 'li', icon: <Linkedin style={{ width: 11, height: 11 }} />, label: 'LinkedIn' },
    ].filter(Boolean) as { key: string; icon: React.ReactNode; label: string }[]

    // The same rising arc the real card has, not a horizontal band: the sweep
    // is what makes it read as a ribbon laid over the card rather than a
    // stripe printed across it.
    const sweep = (flip: boolean) => (
      <svg aria-hidden viewBox="0 0 400 220" preserveAspectRatio="none"
        style={{ position: 'absolute', left: 0, width: '100%', height: 92, [flip ? 'bottom' : 'top']: 0, transform: flip ? 'scale(-1,-1)' : undefined }}>
        <defs>
          <linearGradient id={`pw-${flip ? 'b' : 't'}-${accentHex.replace('#', '')}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={accentHex} stopOpacity="0.95" />
            <stop offset="48%" stopColor={companion} stopOpacity="0.75" />
            <stop offset="100%" stopColor={accentHex} stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <path d="M-10,150 C60,150 96,96 168,62 C244,26 320,34 410,-30 L410,26 C326,78 250,72 178,106 C104,142 66,186 -10,186 Z"
          fill={`url(#pw-${flip ? 'b' : 't'}-${accentHex.replace('#', '')})`} />
        <path d="M-10,196 C70,196 108,138 182,102 C258,64 332,66 410,6" fill="none" stroke={companion} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        <path d="M-10,208 C74,208 114,150 190,114 C266,76 340,80 410,20" fill="none" stroke={accentHex} strokeWidth="1.5" opacity="0.7" vectorEffect="non-scaling-stroke" />
      </svg>
    )

    return (
      <div style={{ ...pageStyle, minHeight: 380, position: 'relative', overflow: 'hidden' }}>
        {sweep(false)}
        {sweep(true)}
        {CIRCUIT_PREVIEW_STARS.map(([x, y], i) => (
          <span key={i} aria-hidden style={{
            position: 'absolute', left: `${x}%`, top: `${y}%`, width: 2, height: 2, borderRadius: '50%',
            backgroundColor: i % 3 === 0 ? companion : '#ffffff', opacity: 0.45,
          }} />
        ))}

        <div style={{ position: 'relative', padding: '54px 14px 62px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}><LogoZone /></div>
            {/* Arcs curling round the photo, as on the real card. Square
                viewBox and fixed size, so they stay arcs. */}
            <div style={{ position: 'relative', flexShrink: 0, width: arcBox, height: arcBox }}>
              <svg aria-hidden width={arcBox} height={arcBox} viewBox="0 0 200 200" style={{ position: 'absolute', left: 0, top: 0 }}>
                <path d="M96,6 A94,94 0 0 1 194,104" fill="none" stroke={accentHex} strokeWidth="9" strokeLinecap="round" />
                <path d="M194,104 A94,94 0 0 1 150,180" fill="none" stroke={companion} strokeWidth="6" strokeLinecap="round" />
                <path d="M6,104 A94,94 0 0 0 58,182" fill="none" stroke={accentHex} strokeWidth="5" strokeLinecap="round" opacity="0.6" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <div style={{
                  borderRadius: '50%', padding: 2, lineHeight: 0,
                  background: `linear-gradient(135deg, ${companion} 0%, ${accentHex} 100%)`,
                }}>
                  <div style={{ borderRadius: '50%', overflow: 'hidden', width: avatar, height: avatar, border: `2px solid ${bg.page}` }}>
                    {form.profile_image_url
                      ? <img src={form.profile_image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', backgroundColor: accentHex + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: avatar * 0.36, fontWeight: 700, color: accentHex }}>{form.name?.[0]?.toUpperCase() || '?'}</div>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <h2 style={{ margin: '0 0 2px', fontSize: calcNameSize(17, design), fontWeight: 800, fontFamily: font.heading, textTransform: 'uppercase', lineHeight: 1.1, color: getNameColor(design, accentHex) }}>{form.name || 'Your Name'}</h2>
          {isPro && form.title && <p style={{ margin: '0 0 2px', fontSize: calcTitleSize(9, design), fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: getTitleColor(design, accentHex), opacity: 0.85 }}>{form.title}</p>}
          {form.company && <p style={{ margin: 0, fontSize: calcCompanySize(10, design), color: getCompanyColor(design, bg.subtext) }}>{form.company}</p>}
          {isPro && form.bio && <p style={{ margin: '8px 0 0', fontSize: calcBioSize(10, design), color: getBioColor(design, bg.subtext), lineHeight: 1.6 }}>{form.bio}</p>}

          {/* Accent at the icon running to companion at the node on every row.
              Alternating the whole row between the two tones made every second
              one look like a warning. What alternates is the step direction. */}
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {traces.map((t, i) => (
              <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 24, height: 24, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', border: `1px solid ${accentHex}`, color: accentHex, backgroundColor: accentHex + '1f' }}>{t.icon}</span>
                <span style={{ fontSize: getBodyFontSize(design) - 4, color: bg.text, maxWidth: '52%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
                {/* A flowing curve, as on the real card. Wires flow there,
                    they do not step. */}
                <svg aria-hidden viewBox="0 0 120 24" preserveAspectRatio="none"
                  style={{ flex: 1, minWidth: 24, height: 24, overflow: 'visible' }}>
                  <path d={i % 2 === 0 ? 'M0,20 C46,20 60,12 120,12' : 'M0,4 C46,4 60,12 120,12'}
                    fill="none" stroke={companion} strokeWidth="1.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </svg>
                <span style={{ width: 4, height: 4, flexShrink: 0, borderRadius: '50%', backgroundColor: companion }} />
              </div>
            ))}
          </div>

          {/* Book on the left, scan on the right, as on the real card. The QR
              is a placeholder grid here: a thumbnail is far too small to scan,
              and generating a real one per preview keystroke is wasted work. */}
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 6px', fontSize: 8, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: accentHex }}>Schedule a chat</p>
              <div style={{ padding: '5px 0', borderRadius: 999, textAlign: 'center', fontSize: 9, fontWeight: 600, color: companion, border: `1px solid ${accentHex}`, backgroundColor: accentHex + '1f' }}>Book a slot</div>
            </div>
            <div aria-hidden style={{
              width: 44, height: 44, flexShrink: 0, borderRadius: 8, padding: 3,
              border: `1px solid ${companion}`, backgroundColor: '#ffffff',
              display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1,
            }}>
              {[1,1,1,0,1, 1,0,1,0,1, 1,1,0,1,1, 0,0,1,0,1, 1,1,0,1,1].map((on, i) => (
                <span key={i} style={{ backgroundColor: on ? '#0a1428' : 'transparent', borderRadius: 1 }} />
              ))}
            </div>
          </div>

          <Certs />
          <div style={{ marginTop: 12, padding: '8px 0', borderRadius: 8, textAlign: 'center', fontSize: getButtonFontSize(design) - 3, fontWeight: 700, color: buttonText, backgroundColor: buttonBg, border: buttonBorder ? `2px solid ${buttonBorder}` : 'none' }}>Save Contact</div>
        </div>
      </div>
    )
  }

  // ── MERIDIAN ──────────────────────────────────────────────────────────────
  // Full-bleed portrait with the name over the fade, then labelled tiles.
  // See the same template in PublicCardView.
  if (design.templateId === 'meridian') {
    const parts = (form.name || '').trim().split(/\s+/).filter(Boolean)
    const initials = parts.length
      ? ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
      : '?'
    const tiles = [
      form.phone && { key: 'tel', label: 'Telephone', value: form.phone, icon: <Phone style={{ width: 9, height: 9 }} /> },
      form.email && { key: 'eml', label: 'Email', value: form.email, icon: <Mail style={{ width: 9, height: 9 }} /> },
      isPro && (form as any).address && { key: 'off', label: 'Office', value: (form as any).address, icon: <MapPin style={{ width: 9, height: 9 }} /> },
      form.website && { key: 'web', label: 'Website', value: form.website.replace(/^https?:\/\//, '').replace(/\/$/, ''), icon: <Globe style={{ width: 9, height: 9 }} /> },
    ].filter(Boolean) as { key: string; label: string; value: string; icon: React.ReactNode }[]

    const label: React.CSSProperties = {
      display: 'block', fontSize: 6, fontWeight: 600, letterSpacing: '0.14em',
      textTransform: 'uppercase', color: bg.subtext, marginBottom: 2,
    }

    return (
      <div style={{ ...pageStyle, minHeight: 380 }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: 100 / calcPhotoSize(80, design), maxHeight: calcPhotoSize(134, design), overflow: 'hidden', backgroundColor: bg.card }}>
          {form.profile_image_url
            ? <img src={form.profile_image_url} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 18%', transform: `scale(${Math.max(1, (design.boldImageZoom ?? 100) / 100)})`, transformOrigin: '50% 18%' }} />
            : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: `linear-gradient(150deg, ${accentHex}44 0%, ${bg.card} 55%, ${bg.page} 100%)` }}>
                <span style={{ fontFamily: font.heading, fontSize: calcPhotoSize(46, design), fontWeight: 300, letterSpacing: '0.06em', color: accentHex, opacity: 0.9 }}>{initials}</span>
              </div>}
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${bg.page} 0px, ${bg.page}e8 26px, ${bg.page}00 72px), linear-gradient(to bottom, ${bg.page}00 30%, ${bg.page}70 68%, ${bg.page}c0 100%)` }} />
          {form.company_logo_url && design.logoPosition !== 'hidden' && (
            <img src={form.company_logo_url} style={{ position: 'absolute', right: 10, top: 10, height: calcLogoHeight(18, design), width: 'auto', maxWidth: '42%', objectFit: 'contain' }} />
          )}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 12px 10px' }}>
            {isPro && form.title && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <span style={{ width: 14, height: 1.5, backgroundColor: accentHex, flexShrink: 0 }} />
                <span style={{ fontSize: calcTitleSize(6.5, design), fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: getTitleColor(design, accentHex) }}>{form.title}</span>
              </div>
            )}
            <h2 style={{ margin: 0, fontFamily: font.heading, fontSize: calcNameSize(19, design), fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.02, color: getNameColor(design, bg.text) }}>{form.name || 'Your Name'}</h2>
            {form.company && <p style={{ margin: '4px 0 0', fontSize: calcCompanySize(8, design), color: getCompanyColor(design, bg.subtext) }}>{form.company}</p>}
          </div>
        </div>

        <div style={{ padding: '2px 12px 14px' }}>
          {isPro && form.bio && (
            <div style={{ marginBottom: 12, padding: '7px 8px', border: `1px solid ${bg.border}`, borderLeft: `2px solid ${accentHex}`, borderRadius: 6, background: cardEffect.surfaceBg, backdropFilter: cardEffect.backdropFilter, WebkitBackdropFilter: cardEffect.backdropFilter, boxShadow: cardEffect.surfaceShadow }}>
              <span style={label}>About</span>
              <p style={{ margin: 0, fontSize: calcBioSize(9, design), color: getBioColor(design, bg.subtext), lineHeight: 1.6 }}>{form.bio}</p>
            </div>
          )}

          {tiles.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {tiles.map(t => (
                <div key={t.key} style={{ padding: '6px 7px', border: `1px solid ${bg.border}`, borderRadius: 6, background: cardEffect.surfaceBg, backdropFilter: cardEffect.backdropFilter, WebkitBackdropFilter: cardEffect.backdropFilter, boxShadow: cardEffect.surfaceShadow }}>
                  <span style={label}>
                    <span style={{ display: 'inline-flex', verticalAlign: '-1px', marginRight: 3, color: accentHex }}>{t.icon}</span>
                    {t.label}
                  </span>
                  <span style={{ display: 'block', fontSize: getBodyFontSize(design) - 5, fontWeight: 500, color: bg.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.value}</span>
                </div>
              ))}
            </div>
          )}

          <Certs />
          <div style={{ marginTop: 12, padding: '8px 0', borderRadius: 8, textAlign: 'center', fontSize: getButtonFontSize(design) - 3, fontWeight: 700, color: buttonText, backgroundColor: buttonBg, border: buttonBorder ? `2px solid ${buttonBorder}` : 'none' }}>Save Contact</div>
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
      <div style={{ ...pageStyle, backgroundColor: design.customBgColor || '#050510', position: 'relative', overflow: 'hidden' }}>
        {/* The room the neon sits in, mirrored from the live card: horizon glow,
            perspective grid floor, scanline wash. */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '140%', height: 150, background: `radial-gradient(ellipse at top, ${accentHex}33 0%, transparent 70%)` }} />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '38%',
            backgroundImage: `linear-gradient(${accentHex}22 1px, transparent 1px), linear-gradient(90deg, ${accentHex}22 1px, transparent 1px)`,
            backgroundSize: '26px 26px',
            transform: 'perspective(200px) rotateX(62deg)', transformOrigin: 'bottom',
            maskImage: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
            WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
          }} />
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.5,
            backgroundImage: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 3px)',
          }} />
        </div>
        <div style={{ padding: 16, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
            {design.profileBorder === false ? (
              <div style={{ borderRadius: '50%', overflow: 'hidden', width: photoSize, height: photoSize, backgroundColor: '#0a0a1a', flexShrink: 0 }}>
                {form.profile_image_url
                  ? <img src={form.profile_image_url} style={{ width: photoSize, height: photoSize, objectFit: 'cover' }} />
                  : <div style={{ width: photoSize, height: photoSize, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: photoSize * 0.35, fontWeight: 700, color: accentHex }}>{form.name?.[0]?.toUpperCase() || '?'}</div>}
              </div>
            ) : (
              <div style={{ borderRadius: '50%', padding: 2, background: `linear-gradient(135deg, ${accentHex}, ${accentHex}44)`, boxShadow: `${neonBorder}, 0 0 24px ${accentHex}55`, flexShrink: 0 }}>
                <div style={{ borderRadius: '50%', overflow: 'hidden', width: photoSize, height: photoSize, backgroundColor: '#0a0a1a' }}>
                  {form.profile_image_url
                    ? <img src={form.profile_image_url} style={{ width: photoSize, height: photoSize, objectFit: 'cover' }} />
                    : <div style={{ width: photoSize, height: photoSize, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: photoSize * 0.35, fontWeight: 700, color: accentHex }}>{form.name?.[0]?.toUpperCase() || '?'}</div>}
                </div>
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0, ...textNudge }}>
              <h2 style={{ margin: '0 0 3px', fontSize: calcNameSize(16, design), fontWeight: 700, fontFamily: font.heading, color: getNameColor(design, '#e8e8ff'),
                textShadow: design.nameColor ? undefined : `0 0 6px ${accentHex}88, 0 0 22px ${accentHex}55` }}>{form.name || 'Your Name'}</h2>
              {isPro && form.title && <p style={{ margin: '0 0 2px', fontSize: calcTitleSize(10, design), color: getTitleColor(design, accentHex), fontWeight: 600, textShadow: `0 0 8px ${accentHex}`, textTransform: 'uppercase' as any, letterSpacing: '0.14em' }}>{form.title}</p>}
              {form.company && <p style={{ margin: 0, fontSize: calcCompanySize(10, design), color: getCompanyColor(design, '#6a6aa8') }}>{form.company}</p>}
            </div>
          </div>
          <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${accentHex}, transparent)`, marginBottom: 10, boxShadow: `0 0 10px ${accentHex}, 0 0 24px ${accentHex}66` }} />
          <LogoZone filter="brightness(2) saturate(0.5)" />
          {isPro && form.bio && <p style={{ fontSize: calcBioSize(10, design), color: getBioColor(design, '#6060a0'), lineHeight: 1.6, marginBottom: 12 }}>{form.bio}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              form.phone && { icon: <Phone style={{ width: 11, height: 11 }} />, label: form.phone },
              form.email && { icon: <Mail style={{ width: 11, height: 11 }} />, label: form.email },
              form.website && { icon: <Globe style={{ width: 11, height: 11 }} />, label: form.website.replace(/^https?:\/\//, '') },
              ...links.map(l => ({ icon: <ExternalLink style={{ width: 11, height: 11 }} />, label: l.title })),
            ].filter(Boolean).map((item: any, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, backgroundColor: accentHex + '0d', borderRadius: 8, padding: '7px 10px', border: `1px solid ${accentHex}33` }}>
                <span style={{ color: accentHex }}>{item.icon}</span>
                <span style={{ fontSize: getBodyFontSize(design) - 4, color: '#c0c0e8' }}>{item.label}</span>
              </div>
            ))}
          </div>
          <Certs />
          <div style={{ marginTop: 12, padding: '10px 0', borderRadius: 8, textAlign: 'center', fontSize: getButtonFontSize(design) - 3, fontWeight: 700, letterSpacing: '0.08em', color: design.buttonTextColor || accentHex, backgroundColor: design.buttonBgColor || 'transparent', border: `1px solid ${design.buttonBorderColor || accentHex}`, boxShadow: neonBorder, fontFamily: font.heading, textTransform: 'uppercase' as any }}>SAVE CONTACT</div>
        </div>
      </div>
    )
  }

  // ── 10. STUDIO ────────────────────────────────────────────────────────────
  if (design.templateId === 'studio') {
    const black = '#000'
    const lightArea = design.customBgColor || '#f5f5f5'
    const Mini = ({ color, children }: { color: string; children: React.ReactNode }) => (
      <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>{children}</div>
    )
    return (
      <div style={{ ...pageStyle, backgroundColor: lightArea }}>
        {/* Black top band */}
        <div style={{ backgroundColor: black, padding: '14px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          {form.company_logo_url ? (
            <div style={{ width: calcLogoHeight(28, design), height: calcLogoHeight(28, design), backgroundColor: '#fff', borderRadius: 5, padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <img src={form.company_logo_url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
          ) : (
            <div style={{ width: calcLogoHeight(28, design), height: calcLogoHeight(28, design), backgroundColor: accentHex, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 800, color: '#fff' }}>{(form.company || form.name || 'C')[0].toUpperCase()}</div>
          )}
          {form.company && <p style={{ margin: 0, fontSize: calcCompanySize(9, design), fontWeight: 800, color: getCompanyColor(design, '#fff'), textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1, wordBreak: 'break-word' }}>{form.company}</p>}
        </div>
        {/* Photo on black */}
        <div style={{ backgroundColor: black, padding: '4px 12px 20px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 92, height: 92, borderRadius: '50%', overflow: 'hidden', border: design.profileBorder === false ? 'none' : '2px solid #fff', boxShadow: '0 6px 14px rgba(0,0,0,0.5)' }}>
            <Avatar base={88} />
          </div>
        </div>
        {/* Wave divider */}
        <svg viewBox="0 0 100 6" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 18, marginTop: -1 }}>
          <path d="M 0 6 L 0 3 Q 25 0, 50 2.5 T 100 3 L 100 6 Z" fill={lightArea} />
        </svg>
        {/* Name + designation */}
        <div style={{ padding: '0 14px 12px', textAlign: 'center', backgroundColor: lightArea }}>
          <h2 style={{ margin: '0 0 4px', fontSize: calcNameSize(18, design), fontWeight: 900, color: getNameColor(design, '#0a0a0a'), textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.05, fontFamily: font.heading }}>{form.name || 'Your Name'}</h2>
          {isPro && form.title && <p style={{ margin: 0, fontSize: calcTitleSize(8, design), fontWeight: 700, color: getTitleColor(design, '#0a0a0a'), textTransform: 'uppercase', letterSpacing: '0.18em' }}>{form.title}</p>}
          {/* The live card shows the bio here. The preview used to drop it. */}
          {isPro && form.bio && <p style={{ margin: '6px 0 0', fontSize: calcBioSize(9, design), color: getBioColor(design, '#525252'), lineHeight: 1.6, fontStyle: 'italic' }}>{form.bio}</p>}
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
        {/* The live card ends with the Save Contact button. Without it here the
            button colour and size controls had nothing to act on. */}
        <div style={{ padding: '0 12px 14px', backgroundColor: lightArea }}>
          <SaveBtn />
        </div>
      </div>
    )
  }

  // ── 11. FROST ─────────────────────────────────────────────────────────────
  if (design.templateId === 'frost') {
    const frostBg = design.customBgColor || 'linear-gradient(135deg, #fef3c7 0%, #fce7f3 25%, #e0e7ff 60%, #ccfbf1 100%)'
    return (
      <div style={{ ...pageStyle, position: 'relative', overflow: 'hidden', background: frostBg }}>
        <div style={{ position: 'absolute', top: -40, right: -30, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle, ${accentHex}55 0%, transparent 70%)` }} />
        <div style={{ position: 'absolute', bottom: -30, left: -30, width: 100, height: 100, borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.4) 0%, transparent 70%)' }} />
        <div style={{ position: 'relative', padding: '16px 14px', zIndex: 1 }}>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.6)', borderRadius: 18, padding: '16px 12px', boxShadow: '0 12px 32px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <div style={{ borderRadius: '50%', overflow: 'hidden', border: design.profileBorder === false ? 'none' : '2px solid rgba(255,255,255,0.9)' }}>
                <Avatar base={64} />
              </div>
            </div>
            <h2 style={{ margin: '0 0 3px', fontSize: calcNameSize(15, design), fontWeight: 800, color: getNameColor(design, '#0f172a'), textAlign: 'center', fontFamily: font.heading }}>{form.name || 'Your Name'}</h2>
            {isPro && form.title && <p style={{ margin: 0, fontSize: calcTitleSize(9, design), fontWeight: 600, color: getTitleColor(design, accentHex), textAlign: 'center' }}>{form.title}</p>}
            {form.company && <p style={{ margin: '3px 0 8px', fontSize: calcCompanySize(8, design), color: getCompanyColor(design, '#64748b'), textAlign: 'center' }}>{form.company}</p>}
            {/* Logo and bio both render on the live card. The preview showed
                neither, so a user's logo was invisible until they published. */}
            <LogoZone />
            {isPro && form.bio && <p style={{ fontSize: calcBioSize(9, design), color: getBioColor(design, '#475569'), lineHeight: 1.6, marginBottom: 8, textAlign: 'center' }}>{form.bio}</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {form.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', backgroundColor: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 7 }}><span style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: accentHex + '22', color: accentHex, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Phone style={{ width: 9, height: 9 }} /></span><span style={{ fontSize: getBodyFontSize(design) - 6, color: '#0f172a' }}>{form.phone}</span></div>}
              {form.email && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', backgroundColor: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 7 }}><span style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: accentHex + '22', color: accentHex, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Mail style={{ width: 9, height: 9 }} /></span><span style={{ fontSize: getBodyFontSize(design) - 6, color: '#0f172a' }}>{form.email}</span></div>}
              {form.website && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', backgroundColor: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 7 }}><span style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: accentHex + '22', color: accentHex, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Globe style={{ width: 9, height: 9 }} /></span><span style={{ fontSize: getBodyFontSize(design) - 6, color: '#0f172a' }}>{form.website.replace(/^https?:\/\//, '')}</span></div>}
            </div>
            <SaveBtn />
          </div>
        </div>
      </div>
    )
  }

  // ── 12. EDITORIAL ─────────────────────────────────────────────────────────
  if (design.templateId === 'editorial') {
    // Mirrors PublicCardView: this template prints straight onto the page, so
    // the ink has to follow the paper or a dark background hides the type.
    const paper = design.customBgColor || '#fafaf9'
    const darkPaper = !isLightBg(paper)
    const ink = darkPaper ? '#f5f5f4' : '#1c1917'
    const rule = darkPaper ? '#57534e' : '#a8a29e'
    const muted = darkPaper ? '#a8a29e' : '#78716c'
    return (
      <div style={{ ...pageStyle, backgroundColor: paper, padding: '18px 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 6, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.4em', fontFamily: 'Georgia, serif' }}>The Profile</p>
          <div style={{ width: '100%', borderTop: `1.5px solid ${ink}`, marginTop: 4 }} />
          <div style={{ width: '100%', borderTop: `0.5px solid ${ink}`, marginTop: 2 }} />
        </div>
        <h2 style={{ margin: '0 0 4px', fontSize: calcNameSize(22, design), fontWeight: 900, color: getNameColor(design, ink), fontFamily: 'Georgia, "Times New Roman", serif', lineHeight: 0.95, letterSpacing: '-0.02em', textAlign: 'center' }}>{form.name || 'Your Name'}</h2>
        {isPro && form.title && <p style={{ margin: 0, fontSize: calcTitleSize(9, design), color: getTitleColor(design, muted), textAlign: 'center', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>{form.title}</p>}
        {form.company && <p style={{ margin: '2px 0 0', fontSize: calcCompanySize(7, design), color: getCompanyColor(design, muted), textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 600 }}>{form.company}</p>}
        <div style={{ width: 28, borderTop: `1.5px solid ${accentHex}`, margin: '10px auto' }} />
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ borderRadius: '50%', overflow: 'hidden', border: design.profileBorder === false ? 'none' : `1px solid ${rule}` }}>
            <Avatar base={64} />
          </div>
        </div>
        {/* Both render on the live card; the preview was dropping them. */}
        <LogoZone />
        {isPro && form.bio && <p style={{ fontSize: calcBioSize(9, design), color: getBioColor(design, darkPaper ? '#e7e5e4' : '#3c2c20'), lineHeight: 1.7, marginBottom: 10, textAlign: 'center', fontFamily: 'Georgia, serif' }}>{form.bio}</p>}
        <div style={{ borderTop: `1px solid ${rule}`, paddingTop: 8 }}>
          <p style={{ margin: '0 0 5px', fontSize: 6, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.3em' }}>Correspondence</p>
          {form.phone && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${rule}`, fontFamily: 'Georgia, serif' }}><span style={{ fontSize: 7, color: muted, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700 }}>Tel</span><span style={{ fontSize: getBodyFontSize(design) - 5, color: ink }}>{form.phone}</span></div>}
          {form.email && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${rule}`, fontFamily: 'Georgia, serif' }}><span style={{ fontSize: 7, color: muted, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700 }}>Email</span><span style={{ fontSize: getBodyFontSize(design) - 5, color: ink }}>{form.email}</span></div>}
          {form.website && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${rule}`, fontFamily: 'Georgia, serif' }}><span style={{ fontSize: 7, color: muted, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700 }}>Web</span><span style={{ fontSize: getBodyFontSize(design) - 5, color: ink }}>{form.website.replace(/^https?:\/\//, '')}</span></div>}
        </div>
        <SaveBtn />
      </div>
    )
  }

  return null
}
