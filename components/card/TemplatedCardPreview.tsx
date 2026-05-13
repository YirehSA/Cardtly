'use client'

import {
  CardDesign, FONTS, getBgColors, calcPhotoSize, calcLogoHeight,
  getAccentHex, getReadableTextOn, getCardStyleEffect, TEXT_POSITION_TEMPLATES
} from '@/types/design'
import { Phone, Mail, Globe, MessageCircle, ExternalLink, ChevronRight } from 'lucide-react'

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
  const font = FONTS[design.fontId]
  const bg = getBgColors(design.bgMode, design.templateId)
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
        {isPro && form.website && <Row icon={<Globe style={{ width: 12, height: 12 }} />} label={form.website.replace(/^https?:\/\//, '')} />}
        {links.map(l => <Row key={l.title} icon={<ExternalLink style={{ width: 12, height: 12 }} />} label={l.title} />)}
      </div>
    )
  }

  function SaveBtn({ label = 'Save Contact', outline = false }: { label?: string; outline?: boolean }) {
    return (
      <div style={{
        marginTop: 12, padding: '10px 0', borderRadius: 12, textAlign: 'center',
        fontSize: 12, fontWeight: 700, fontFamily: font.heading,
        color: outline ? accentHex : getReadableTextOn(accentHex),
        backgroundColor: outline ? 'transparent' : accentHex,
        border: outline ? `2px solid ${accentHex}` : 'none',
        background: !outline && design.cardStyle === 'gradient'
          ? `linear-gradient(135deg, ${accentHex}, ${accentHex}bb)`
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
  if (design.templateId === 'minimal') {
    const cream = isLight ? '#faf7f2' : '#0e0e0e'
    const ink = isLight ? '#1a1a1a' : '#f0ede8'
    const muted = isLight ? '#8a7f72' : '#6a6560'
    const lineColor = isLight ? '#d4cdc4' : '#2a2a2a'
    return (
      <div style={{ ...pageStyle, backgroundColor: cream }}>
        <div style={{ padding: '20px 18px' }}>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900, fontFamily: 'Georgia, serif', color: ink, lineHeight: 1, letterSpacing: '-0.03em' }}>{(form.name || 'Your Name').split(' ')[0]}</h2>
          <h2 style={{ margin: '0 0 10px', fontSize: 26, fontWeight: 900, fontFamily: 'Georgia, serif', color: accentHex, lineHeight: 1, letterSpacing: '-0.03em' }}>{(form.name || '').split(' ').slice(1).join(' ') || 'Name'}</h2>
          <div style={{ height: 1, backgroundColor: lineColor, marginBottom: 10 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <Avatar base={56} />
            <div>
              {isPro && form.title && <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, color: accentHex, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{form.title}</p>}
              {form.company && <p style={{ margin: 0, fontSize: 11, color: muted, fontStyle: 'italic' }}>{form.company}</p>}
            </div>
          </div>
          <LogoZone />
          {isPro && form.bio && <p style={{ fontSize: 11, color: muted, lineHeight: 1.8, marginBottom: 12, fontStyle: 'italic', borderLeft: `2px solid ${accentHex}`, paddingLeft: 10 }}>{form.bio}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {[
              form.phone && { icon: <Phone style={{ width: 11, height: 11 }} />, label: form.phone },
              form.email && { icon: <Mail style={{ width: 11, height: 11 }} />, label: form.email },
              isPro && form.website && { icon: <Globe style={{ width: 11, height: 11 }} />, label: form.website.replace(/^https?:\/\//, '') },
              ...links.map(l => ({ icon: <ExternalLink style={{ width: 11, height: 11 }} />, label: l.title })),
            ].filter(Boolean).map((item: any, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8, borderBottom: `1px solid ${lineColor}` }}>
                <span style={{ color: accentHex }}>{item.icon}</span>
                <span style={{ fontSize: 11, color: ink }}>{item.label}</span>
              </div>
            ))}
          </div>
          <Certs />
          <div style={{ marginTop: 12, padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: accentHex, border: `1px solid ${accentHex}`, letterSpacing: '0.1em', textTransform: 'uppercase' as any,
            boxShadow: design.cardStyle === 'glass' ? `0 0 8px ${accentHex}44` : undefined }}>SAVE CONTACT</div>
        </div>
      </div>
    )
  }

  // ── 5. EXECUTIVE ─────────────────────────────────────────────────────────
  if (design.templateId === 'executive') {
    return (
      <div style={{ ...pageStyle, backgroundColor: '#09090b' }}>
        <div style={{ display: 'flex', minHeight: 160 }}>
          <div style={{ width: '45%', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
            {form.profile_image_url
              ? <img src={form.profile_image_url} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', position: 'absolute', inset: 0 }} />
              : <div style={{ width: '100%', height: '100%', backgroundColor: accentHex + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700, color: accentHex, position: 'absolute', inset: 0 }}>{form.name?.[0]?.toUpperCase() || '?'}</div>}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent 60%, #09090b 100%)' }} />
          </div>
          <div style={{ flex: 1, padding: '16px 14px 16px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={textNudge}>
              <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, fontFamily: font.heading, color: '#fafafa', lineHeight: 1.2 }}>{form.name || 'Your Name'}</h2>
              {isPro && form.title && <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 600, color: accentHex, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{form.title}</p>}
              {form.company && <p style={{ margin: '0 0 6px', fontSize: 10, color: '#71717a' }}>{form.company}</p>}
            </div>
            <div style={{ width: '100%', height: 1, background: `linear-gradient(90deg, ${accentHex}, transparent)`,
              boxShadow: design.cardStyle === 'glass' ? `0 0 6px ${accentHex}` : undefined }} />
          </div>
        </div>
        <div style={{ padding: '12px 14px 16px', background: design.cardStyle === 'gradient' ? `linear-gradient(180deg, ${accentHex}11 0%, transparent 60%)` : undefined }}>
          <LogoZone />
          {isPro && form.bio && <p style={{ fontSize: 11, color: '#71717a', lineHeight: 1.6, marginBottom: 12 }}>{form.bio}</p>}
          <ContactList /><Certs /><SaveBtn label="SAVE CONTACT" />
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
          <div style={{ marginTop: 12, padding: '10px 0', borderRadius: 12, textAlign: 'center', fontSize: 12, fontWeight: 700, color: getReadableTextOn(accentHex),
            background: `linear-gradient(135deg, ${accentHex}, ${accentHex}aa)`,
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
            {isPro && form.website && <Globe style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.8)' }} />}
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
            {isPro && form.website && <span style={{ fontSize: 10, color: bg.text }}>{form.website.replace(/^https?:\/\//, '')}</span>}
            {links.map(l => <span key={l.title} style={{ fontSize: 10, color: accentHex }}>{l.title}</span>)}
          </div>
          <Certs />
          <div style={{ marginTop: 10, padding: '8px 0', borderRadius: 8, textAlign: 'center', fontSize: 11, fontWeight: 700, color: getReadableTextOn(accentHex), backgroundColor: accentHex }}>Save Contact</div>
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
              isPro && form.website && { icon: <Globe style={{ width: 11, height: 11 }} />, label: form.website.replace(/^https?:\/\//, '') },
              ...links.map(l => ({ icon: <ExternalLink style={{ width: 11, height: 11 }} />, label: l.title })),
            ].filter(Boolean).map((item: any, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, backgroundColor: accentHex + '0d', borderRadius: 8, padding: '7px 10px', border: `1px solid ${accentHex}33` }}>
                <span style={{ color: accentHex }}>{item.icon}</span>
                <span style={{ fontSize: 10, color: '#c0c0e8' }}>{item.label}</span>
              </div>
            ))}
          </div>
          <Certs />
          <div style={{ marginTop: 12, padding: '10px 0', borderRadius: 8, textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: accentHex, border: `1px solid ${accentHex}`, boxShadow: neonBorder, fontFamily: font.heading, textTransform: 'uppercase' as any }}>SAVE CONTACT</div>
        </div>
      </div>
    )
  }

  return null
}
