'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Card, extractLinks } from '@/types/database'
import { parseDesign, FONTS, getBgColors, calcPhotoSize, calcLogoHeight, getAccentHex, getReadableTextOn, companionHex, getButtonBg, getButtonText, getButtonBorder, getCardStyleEffect, TEXT_POSITION_TEMPLATES, calcNameSize, calcTitleSize, calcCompanySize, calcBioSize, getNameColor, getTitleColor, getCompanyColor, getBioColor, getBodyFontSize, getButtonFontSize, isLightBg, IMAGE_SLOTS } from '@/types/design'
import {
  Phone, Mail, MapPin, Globe, MessageCircle,
  ExternalLink, Share2, Download, ChevronRight,
  Instagram, Linkedin, Twitter, Facebook, Youtube, UserPlus, X, Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { TikTokGlyph } from '@/components/card/SocialIcons'
import { isNativeApp, shareNative, saveContactNative } from '@/lib/capacitor'
import { isInAppBrowser, detectInAppBrowser, isAndroid, chromeIntentUrl } from '@/lib/in-app-browser'
import { waShareLink } from '@/lib/whatsapp'
import SuspendedBanner from '@/components/card/SuspendedBanner'
import { track, useTrackLinkClicks } from '@/lib/track'
import ContactExchangeModal from './ContactExchangeModal'
import QuestionnaireForm from './QuestionnaireForm'
import InAppBackButton from '@/components/InAppBackButton'
import BookingModal from './BookingModal'
import AddToGoogleWalletButton from '@/components/wallet/AddToGoogleWalletButton'
import { describeContactError, CONTACT_NETWORK_ERROR } from '@/lib/contact-errors'

interface Props {
  card: Card & { _team_card_id?: string }
  isPro: boolean
  isTeamCard?: boolean
  lastActiveAt?: string | null
  // Tier 1 founder status - if set, render the gold founder ribbon
  // near the share button so it shows on every template without
  // having to touch each template's layout individually.
  founderNumber?: number | null
  // Set when the card's organization is suspended. An empty string means
  // suspended with the default wording; null means not suspended.
  suspendedMessage?: string | null
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
  cardEffect: ReturnType<typeof getCardStyleEffect>
  design: ReturnType<typeof parseDesign>
}

// ── Circuit backdrop ──────────────────────────────────────────────────────────
// The faint mesh behind the hero: thin triangles with a lit node at each
// corner, tiled. A tile rather than one stretched drawing, because a viewBox
// stretched to the height of a card turns every triangle into a sliver and
// every dot into a dash. Tiling keeps the geometry true at any size.
function circuitMeshUrl(accentHex: string, companion: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260' viewBox='0 0 260 260'>`
    // Faint. At 0.30 the triangles read as a wireframe cage over the card
    // rather than something behind it, and they cut through the body text.
    + `<g fill='none' stroke='${accentHex}' stroke-width='0.7' opacity='0.10'>`
    + `<path d='M14 44 L78 10 L132 66 L62 104 Z'/>`
    + `<path d='M132 66 L212 28 L248 98 L178 128 Z'/>`
    + `<path d='M62 104 L132 66 L178 128 L104 170 Z'/>`
    + `<path d='M104 170 L178 128 L230 192 L152 232 Z'/>`
    + `<path d='M10 162 L104 170 L152 232 L44 246 Z'/>`
    + `<path d='M14 44 L62 104 L10 162'/>`
    + `</g>`
    + `<g fill='${companion}' opacity='0.30'>`
    + `<circle cx='78' cy='10' r='1.8'/><circle cx='132' cy='66' r='1.8'/>`
    + `<circle cx='212' cy='28' r='1.5'/><circle cx='178' cy='128' r='1.8'/>`
    + `<circle cx='104' cy='170' r='1.6'/><circle cx='152' cy='232' r='1.5'/>`
    + `<circle cx='62' cy='104' r='1.5'/><circle cx='10' cy='162' r='1.4'/>`
    + `</g></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

// Loose stars over the mesh. Positioned in percentages but sized in pixels,
// so each stays round however tall the card grows; a fixed table rather than
// random placement, because this renders on the server and again on the
// client and Math.random() would blow up hydration.
const CIRCUIT_STARS: [number, number, number][] = [
  [6, 12, 1.6], [14, 30, 1], [9, 52, 2.1], [21, 8, 1.2], [27, 44, 1],
  [33, 22, 1.7], [41, 62, 1.1], [47, 14, 1], [52, 38, 2], [58, 55, 1.3],
  [63, 9, 1.5], [69, 33, 1], [74, 66, 1.8], [79, 20, 1.1], [85, 47, 1.4],
  [90, 28, 1], [94, 60, 1.9], [17, 71, 1.2], [37, 84, 1], [56, 78, 1.5],
  [71, 88, 1.1], [88, 76, 1.3], [3, 82, 1], [45, 95, 1.2], [66, 41, 1],
]

function CircuitStars({ companion }: { companion: string }) {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {CIRCUIT_STARS.map(([x, y, r], i) => (
        <span key={i} style={{
          position: 'absolute', left: `${x}%`, top: `${y}%`,
          width: r * 2, height: r * 2, borderRadius: '50%',
          backgroundColor: i % 3 === 0 ? companion : '#ffffff',
          opacity: i % 3 === 0 ? 0.5 : 0.3,
        }} />
      ))}
    </div>
  )
}

// The sweep across the top of the hero. Not a horizontal band: on the
// reference the ribbon rises from the left edge and arcs away to the right,
// which is what makes it read as a ribbon laid over the card rather than a
// stripe printed across it. Stretching is fine here and wanted - a long lazy
// curve is the point - so the stroke widths are pinned with non-scaling-stroke
// and only the geometry stretches.
function CircuitSweep({ accentHex, companion, flip = false }: { accentHex: string; companion: string; flip?: boolean }) {
  const id = `sw-${flip ? 'b' : 't'}`
  return (
    <svg aria-hidden viewBox="0 0 400 220" preserveAspectRatio="none"
      style={{
        position: 'absolute', left: 0, width: '100%', height: 220,
        [flip ? 'bottom' : 'top']: 0,
        transform: flip ? 'scale(-1,-1)' : undefined,
      }}>
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor={accentHex} stopOpacity="0.95" />
          <stop offset="48%" stopColor={companion} stopOpacity="0.75" />
          <stop offset="100%" stopColor={accentHex} stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {/* The body of the ribbon: rises out of the left edge and away up the
          right, thick at the shoulder and tapering as it leaves. */}
      <path d="M-10,150 C60,150 96,96 168,62 C244,26 320,34 410,-30 L410,26 C326,78 250,72 178,106 C104,142 66,186 -10,186 Z"
        fill={`url(#${id})`} />
      {/* Two lines riding the same arc, one in each tone. */}
      <path d="M-10,196 C70,196 108,138 182,102 C258,64 332,66 410,6"
        fill="none" stroke={companion} strokeWidth="2.5" opacity="0.95" vectorEffect="non-scaling-stroke" />
      <path d="M-10,208 C74,208 114,150 190,114 C266,76 340,80 410,20"
        fill="none" stroke={accentHex} strokeWidth="1.5" opacity="0.7" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// The arcs curling around the photo. Fixed size and a square viewBox, unlike
// the sweep: an arc is only an arc while both axes scale together, and
// stretched it becomes an ellipse that no longer follows the circle it is
// supposed to be hugging.
function CircuitPhotoArc({ box, accentHex, companion }: { box: number; accentHex: string; companion: string }) {
  return (
    <svg aria-hidden width={box} height={box} viewBox="0 0 200 200"
      style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
      <path d="M96,6 A94,94 0 0 1 194,104" fill="none" stroke={accentHex} strokeWidth="7" strokeLinecap="round" />
      <path d="M194,104 A94,94 0 0 1 150,180" fill="none" stroke={companion} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M6,104 A94,94 0 0 0 58,182" fill="none" stroke={accentHex} strokeWidth="4" strokeLinecap="round" opacity="0.6" />
      <path d="M18,62 A94,94 0 0 1 60,18" fill="none" stroke={companion} strokeWidth="3" strokeLinecap="round" opacity="0.75" />
    </svg>
  )
}

// The trace running off a contact row. A long curve that leaves the text at
// one height and settles into the node at the row's centre, alternating which
// side it comes from - the reference's wires flow, they do not step. The
// earlier version was a 34px elbow, which at seven rows read as a column of
// identical little brackets.
function CircuitTrace({ up, from, to }: { up: boolean; from: string; to: string }) {
  const id = `tr-${up ? 'u' : 'd'}-${from.replace('#', '')}-${to.replace('#', '')}`
  return (
    <svg aria-hidden viewBox="0 0 120 44" preserveAspectRatio="none"
      style={{ flex: 1, minWidth: 44, height: 44, overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={from} stopOpacity="0.1" />
          <stop offset="30%" stopColor={from} stopOpacity="0.95" />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <path d={up ? 'M0,36 C46,36 60,22 120,22' : 'M0,8 C46,8 60,22 120,22'}
        fill="none" stroke={`url(#${id})`} strokeWidth="1.5"
        strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// Circuit's own booking button. BookingTrigger's is a full-width pill styled
// for the foot of the card; this one sits in a two-up beside the QR.
function CircuitBookButton({ card, accentHex, companion }: { card: Card; accentHex: string; companion: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 hover:opacity-90 transition"
        style={{
          width: '100%', minHeight: 44, padding: '11px 18px', borderRadius: 999,
          backgroundColor: `${accentHex}1f`, border: `1.5px solid ${accentHex}`,
          color: companion, fontSize: 15, fontWeight: 600,
          boxShadow: `0 0 16px ${accentHex}33`,
        }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
        Book a slot
      </button>
      <BookingModal open={open} onClose={() => setOpen(false)} cardId={card.id} cardName={card.name || ''} accentHex={accentHex} />
    </>
  )
}

// Scan-to-connect. The visitor is on the card, but the person holding the
// phone is usually showing it to someone else - that second person scans this
// with their own phone, which is the whole reason a card on a screen carries
// a QR at all. Generated in the browser: it is derived from the slug and
// nothing needs to store it.
function CircuitQR({ slug, accentHex, companion, label, logoUrl }: {
  slug: string; accentHex: string; companion: string; label: string; logoUrl?: string | null
}) {
  const [svg, setSvg] = useState<string>('')
  useEffect(() => {
    let live = true
    import('qrcode')
      // Dark modules on a light panel, not the reference's glowing inverse.
      // Inverted codes are unreliable to scan - iOS Camera in particular often
      // will not read light-on-dark - and a QR nobody can scan is worse than
      // no QR at all. The neon frame around it carries the look instead.
      //
      // Error correction H, not the default M: the logo covers the middle of
      // the code, and only H's 30% redundancy can lose that much and still
      // decode. Raised unconditionally rather than only when there is a logo,
      // so the code a visitor scans does not change shape depending on whether
      // the card happens to have one.
      .then(m => m.default.toString(`https://cardtly.com/card/${slug}`, {
        type: 'svg', margin: 1, width: 200, errorCorrectionLevel: 'H',
        color: { dark: '#0a1428', light: '#ffffff' },
      }))
      .then(s => { if (live) setSvg(s) })
      .catch(() => {})
    return () => { live = false }
  }, [slug])

  return (
    <div style={{ flexShrink: 0, textAlign: 'center' }}>
      <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: companion }}>{label}</p>
      <div style={{
        position: 'relative',
        width: 132, height: 132, padding: 7, borderRadius: 18,
        border: `2px solid ${companion}`, boxShadow: `0 0 20px ${companion}66`,
        backgroundColor: '#ffffff', overflow: 'hidden',
      }}>
        {/* The generated SVG carries its own width and height attributes, so
            without this it ignores the frame and renders at its natural size,
            straight off the side of the card.
            Nothing until it resolves, rather than a broken frame. */}
        {svg && <div className="[&>svg]:block [&>svg]:w-full [&>svg]:h-full"
          style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: svg }} />}
        {/* Only once the code is there: a logo floating on an empty white
            panel while the generator resolves looks like a failure. The white
            backing is what keeps the modules it covers from being read as
            part of the pattern. */}
        {svg && logoUrl && (
          <span style={{
            position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
            width: 30, height: 30, borderRadius: 8, overflow: 'hidden',
            backgroundColor: '#ffffff', border: '2px solid #ffffff',
            display: 'grid', placeItems: 'center',
          }}>
            <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </span>
        )}
      </div>
    </div>
  )
}

// ── Meridian ──────────────────────────────────────────────────────────────────
// Initials for the hero when a card carries no photograph. Two letters at
// most: three-word names are common, and three letters set at hero size read
// as an acronym rather than a person.
function initialsOf(name: string | null | undefined): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0] || ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}


// ── LogoZone ──────────────────────────────────────────────────────────────────
function LogoZone({ card, design, accentHex }: Pick<Shared, 'card' | 'design' | 'accentHex'>) {
  if (!card.company_logo_url || design.logoPosition === 'hidden') return null
  const h = calcLogoHeight(40, design)
  const justify = design.logoPosition === 'left' ? 'flex-start' : design.logoPosition === 'right' ? 'flex-end' : 'center'
  return (
    <div style={{ display: 'flex', justifyContent: justify, margin: '0 0 16px' }}>
      {/* maxWidth was a flat 160px, so past about 200% the slider stopped
          doing anything for any logo wider than it is tall. The column is the
          only real limit; object-fit keeps it in proportion at the clamp. */}
      <img src={card.company_logo_url} style={{ height: h, width: 'auto', objectFit: 'contain', maxWidth: '100%' }} />
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
  // When the user toggles profileBorder OFF, force border: none. Must
  // override AFTER extraStyle so template-specific borders are also
  // suppressed.
  if (design.profileBorder === false) baseStyle.border = 'none'
  if (card.profile_image_url) return <img src={card.profile_image_url} style={baseStyle} />
  return (
    <div style={{ ...baseStyle, backgroundColor: accentHex + '33', color: accentHex, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: scaledSize * 0.36, fontWeight: 700, fontFamily: font.heading }}>
      {card.name?.[0]?.toUpperCase()}
    </div>
  )
}

// Brand colours for the social pills. White icon on coloured circle
// gives instant recognition vs accent-tinted everything-the-same look.
const SOCIAL_BRAND_COLORS = {
  linkedin: '#0a66c2',
  twitter:  '#000000',  // X uses pure black now
  instagram: '#E4405F',
  facebook: '#1877F2',
  whatsapp: '#25D366',
  youtube: '#FF0000',
  tiktok: '#000000',
}


// Mixes a hex toward black. Used by the templates that build a gradient or a
// second wash from the single accent colour the user picked.
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

// ── ContactBtn ────────────────────────────────────────────────────────────────
function ContactBtn({ icon, label, sublabel, href, accentHex, bg, cardEffect, bodyFontSize }: {
  icon: React.ReactNode; label: string; sublabel?: string; href: string
  accentHex: string
  bg: Shared['bg']
  cardEffect: Shared['cardEffect']
  bodyFontSize?: number
}) {
  return (
    <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="flex items-center gap-4 rounded-2xl px-4 py-3.5 transition hover:opacity-80"
      style={{ background: cardEffect.surfaceBg, backdropFilter: cardEffect.backdropFilter, WebkitBackdropFilter: cardEffect.backdropFilter, boxShadow: cardEffect.surfaceShadow, border: cardEffect.borderStyle }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: accentHex + '22', color: accentHex }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: bg.text, fontSize: bodyFontSize }}>{label}</p>
        {sublabel && <p className="text-xs" style={{ color: bg.subtext }}>{sublabel}</p>}
      </div>
      <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: bg.subtext }} />
    </a>
  )
}

// ── AllContacts ───────────────────────────────────────────────────────────────
function AllContacts({ card, isPro, accentHex, bg, cardEffect, design, socialLinks }: Pick<Shared, 'card' | 'isPro' | 'accentHex' | 'bg' | 'cardEffect' | 'design'> & {
  socialLinks: { platform: string; url: string; icon: React.ReactNode; color?: string }[]
}) {
  // bodySize was wired into the design panel but never read here, so the
  // control moved the editor preview and left the real card alone.
  const bodyFontSize = getBodyFontSize(design)
  return (
    <div className="space-y-2.5">
      {card.phone && <ContactBtn icon={<Phone className="w-4 h-4" />} label={card.phone} href={`tel:${card.phone}`} accentHex={accentHex} bg={bg} cardEffect={cardEffect} bodyFontSize={bodyFontSize} />}
      {isPro && card.work_phone && <ContactBtn icon={<Phone className="w-4 h-4" />} label={card.work_phone} sublabel="Work" href={`tel:${card.work_phone}`} accentHex={accentHex} bg={bg} cardEffect={cardEffect} bodyFontSize={bodyFontSize} />}
      {/* WhatsApp moved to socialLinks (brand-coloured pill) so it doesn't double-up here */}
      {card.email && <ContactBtn icon={<Mail className="w-4 h-4" />} label={card.email} href={`mailto:${card.email}`} accentHex={accentHex} bg={bg} cardEffect={cardEffect} bodyFontSize={bodyFontSize} />}
      {isPro && card.address && <ContactBtn icon={<MapPin className="w-4 h-4" />} label={card.address} href={`https://maps.google.com/?q=${encodeURIComponent(card.address)}`} accentHex={accentHex} bg={bg} cardEffect={cardEffect} bodyFontSize={bodyFontSize} />}
      {card.website && <ContactBtn icon={<Globe className="w-4 h-4" />} label={card.website.replace(/^https?:\/\//, '')} href={card.website.startsWith('http') ? card.website : `https://${card.website}`} accentHex={accentHex} bg={bg} cardEffect={cardEffect} bodyFontSize={bodyFontSize} />}
      {socialLinks.map(s => <ContactBtn key={s.platform} icon={s.icon} label={`${s.platform} Profile`} href={s.url} accentHex={accentHex} bg={bg} cardEffect={cardEffect} bodyFontSize={bodyFontSize} />)}
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
  buttonFontSize: number
  bg: Shared['bg']
  cardEffect: Shared['cardEffect']
  handleShare: () => void
  // Position in the first 100 members, if any. Rendered as a small "N/100"
  // badge under the wallet button.
  founderNumber?: number | null
  /** Split Pro renders the certifications and the link buttons itself, up in
   *  the sidebar zone where they hang off the rail. Without this they would
   *  appear twice - once attached to the rail and once again down here. */
  omitAboveGallery?: boolean
  /** Circuit puts Book a slot up in the hero, beside the QR. Without this it
   *  would appear again down here, and a card offering to book you twice is
   *  worse than one that never offers. */
  omitBooking?: boolean
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

function BottomSection({ card, isPro, isTeamCard, links, certifications, galleryImages, accentHex, buttonBg, buttonText, buttonBorder, buttonFontSize, bg, cardEffect, handleShare, founderNumber, omitAboveGallery = false, omitBooking = false }: BottomProps) {
  const [showContactForm, setShowContactForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  // The gallery image currently open full-screen, or null. A tall (9:16) image
  // opened as a raw file made the browser show it at full size, forcing the
  // viewer to scroll and drag; this fitted overlay scales any shape to the
  // screen instead.
  const [lightbox, setLightbox] = useState<string | null>(null)
  // Shown when Save Contact is tapped inside an in-app browser that cannot
  // download the .vcf. See lib/in-app-browser.ts.
  const [browserHint, setBrowserHint] = useState(false)

  // Per-card add-ons (off unless an admin enabled them for this client).
  const addons = (card as any).addons || {}
  // Contact-exchange: after the visitor saves this contact, offer to
  // share their details back.
  // On unless it has been switched off. It used to be off unless switched on,
  // which meant the single feature that turns a scanned card into a saved lead
  // was dark on every card until somebody found the toggle - and nothing on the
  // card said it existed.
  const contactExchangeOn = addons.contactExchange !== false
  const [exchangeOpen, setExchangeOpen] = useState(false)
  // Custom questionnaire: only show if enabled AND the client has
  // actually built at least one question.
  const questionnaireCfg = addons.questionnaireEnabled && addons.questionnaire?.questions?.length
    ? addons.questionnaire
    : null

  // "Saved your contact" is one of the few things on a card that shows real
  // intent, so it is counted where it actually happens: after a confirmed
  // native save, and as the web vCard download fires.
  const trackContactSave = () => track({
    cardId: isTeamCard ? undefined : card.id,
    teamCardId: isTeamCard ? (card as any)._team_card_id : undefined,
    eventType: 'contact_save',
  })

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
      else {
        // Say what actually failed. "Something went wrong" left the visitor
        // with nothing to fix and the owner with no idea a lead was lost.
        const data = await res.json().catch(() => ({}))
        const { message, detail } = describeContactError(res.status, data?.error)
        console.error('contact form failed:', detail)
        toast.error(message, { duration: 8000 })
      }
    } catch (err) {
      console.error('contact form network error:', err)
      toast.error(CONTACT_NETWORK_ERROR, { duration: 8000 })
    }
    setSubmitting(false)
  }

  return (
    <>
      {!omitAboveGallery && certifications.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: bg.subtext }}>Certifications</p>
          <div className="flex flex-wrap gap-2">
            {certifications.map(c => (
              <span key={c} className="text-xs px-3 py-1.5 rounded-full" style={{ backgroundColor: accentHex + '22', color: accentHex, border: `1px solid ${accentHex}44` }}>#{c}</span>
            ))}
          </div>
        </div>
      )}

      {!omitAboveGallery && links.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: bg.subtext }}>Links</p>
          <div className="space-y-2.5">
            {links.map(l => (
              <a key={l.index} href={l.url.startsWith('http') ? l.url : `https://${l.url}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-4 rounded-2xl px-4 py-3.5 transition hover:opacity-80"
                style={{ background: cardEffect.surfaceBg, backdropFilter: cardEffect.backdropFilter, WebkitBackdropFilter: cardEffect.backdropFilter, boxShadow: cardEffect.surfaceShadow, border: cardEffect.borderStyle }}>
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
            {galleryImages.map((item, i) => {
              // The per-image link field is "open a page when tapped". If it
              // holds an image URL (a common thing to paste there), tapping
              // opens THAT image in the fitted lightbox instead of dumping the
              // raw file in a new tab where it overflows the screen. A real
              // webpage link still navigates. No link -> enlarge the shown image.
              const linkIsImage = !!item.link && /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(item.link)
              const thumb = <img src={item.url} alt={`Gallery ${i + 1}`} className="w-full aspect-video object-cover rounded-xl hover:opacity-80 transition cursor-pointer" />
              if (item.link && !linkIsImage) {
                return <a key={i} href={item.link} target="_blank" rel="noopener noreferrer">{thumb}</a>
              }
              const full = linkIsImage ? item.link! : item.url
              return (
                <button key={i} type="button" onClick={() => setLightbox(full)} className="block w-full" aria-label={`Open gallery image ${i + 1}`}>
                  {thumb}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* The way out of an in-app browser. Portalled for the same reason as the
          lightbox: an ancestor of the card is transformed, which would trap a
          position:fixed overlay partway down the page. */}
      {browserHint && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setBrowserHint(false)}
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        >
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl p-6 animate-fade-in"
            style={{ background: '#111', border: '1px solid rgba(255,255,255,0.12)' }}>
            {/* Android never reaches this: there, Save Contact hands the file
                straight to Chrome in one tap. This is the iOS path, where a web
                page has no way to launch Safari itself. */}
            <p className="font-bold text-white text-lg">Contact didn&apos;t save?</p>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {detectInAppBrowser() || 'This app'}&apos;s built-in browser can&apos;t always save contact
              files. Open this card in Safari and tap Save Contact again.
            </p>
            <p className="mt-4 text-xs rounded-xl px-3 py-2.5 leading-relaxed" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.75)' }}>
              Tap the <strong>&#8943;</strong> or share icon at the bottom of this screen, then{' '}
              <strong>Open in Safari</strong>.
            </p>
            <button onClick={() => setBrowserHint(false)}
              className="mt-3 w-full py-2.5 rounded-2xl text-sm"
              style={{ color: 'rgba(255,255,255,0.5)' }}>
              It saved fine, dismiss
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Fitted image viewer, rendered into <body> via a portal. Without the
          portal it lives inside the card, which has CSS transforms/filters on
          ancestors - and `position: fixed` is trapped by a transformed ancestor,
          so on a phone the overlay landed mid-page (you had to scroll up to find
          it) instead of covering the screen. In the body it is truly viewport-
          fixed and centred. object-contain + max height keeps any aspect ratio,
          including tall 9:16, fully on screen. Tap anywhere or the X to close. */}
      {lightbox && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(4px)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Gallery image"
            onClick={(e) => e.stopPropagation()}
            className="object-contain rounded-xl"
            style={{ maxHeight: 'calc(100dvh - 2rem)', maxWidth: 'calc(100vw - 2rem)' }}
          />
          <button
            onClick={() => setLightbox(null)}
            aria-label="Close image"
            className="absolute top-4 right-4 w-11 h-11 rounded-full flex items-center justify-center text-white transition hover:bg-white/25"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>,
        document.body
      )}

      {isPro && !omitBooking && (
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
                workPhone: (card as any).work_phone,
                whatsapp: card.whatsapp,
                website: card.website,
                address: card.address,
                bio: (card as any).bio,
                // So the saved contact keeps a live link to the card, and a
                // picture, exactly like the downloaded .vcf does.
                cardUrl: `https://cardtly.com/card/${card.slug}`,
                photoUrl: (card as any).profile_image_url,
              })
              toast.success('Saved to contacts')
              trackContactSave()
              // Native save confirmed -> offer reciprocal exchange.
              if (contactExchangeOn) setExchangeOpen(true)
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Could not save contact'
              toast.error(msg)
            }
            return
          }
          // Web: trigger the vCard download, then offer the exchange.
          // We can't confirm the OS saved it, so we prompt right after
          // the download starts.
          trackContactSave()

          // A card opened from WhatsApp runs in WhatsApp's own WebView, which
          // has no download manager - the navigation below does nothing at all
          // and the visitor is left thinking they saved the contact. Since
          // sharing on WhatsApp is how most cards travel, that silent failure
          // is a lost contact every time.
          //
          // On Android, hand the .vcf straight to Chrome. That keeps it a single
          // tap: Chrome opens and the contact downloads, with no second trip
          // through the card and nothing for the visitor to work out. Telling
          // them to go and do it again in another browser is friction on the one
          // button that matters most.
          if (isInAppBrowser()) {
            if (isAndroid()) {
              if (contactExchangeOn) setExchangeOpen(true)
              window.location.href = chromeIntentUrl(`https://cardtly.com/api/vcf/${card.slug}`)
              return
            }
            // iOS: a page cannot launch Safari, so the best available is to try
            // the download and explain the menu route if it does nothing.
            setBrowserHint(true)
          }

          if (contactExchangeOn) {
            const a = document.createElement('a')
            a.href = `/api/vcf/${card.slug}`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            setExchangeOpen(true)
          } else {
            window.location.href = `/api/vcf/${card.slug}`
          }
        }}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold hover:opacity-90 transition"
          style={{
            backgroundColor: buttonBg,
            color: buttonText,
            border: buttonBorder ? `2px solid ${buttonBorder}` : 'none',
            fontSize: buttonFontSize,
          }}>
          <Download className="w-4 h-4" />Save Contact
        </button>
        <button onClick={handleShare}
          className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-semibold hover:opacity-80 transition"
          style={{ border: `1px solid ${bg.border}`, color: bg.text, fontSize: buttonFontSize }}>
          <Share2 className="w-4 h-4" />Share
        </button>
      </div>

      {/* Keep the link.
          An NFC tap opens this page in a browser tab. Close the tab and the
          card is gone: no app, no history they will dig through, nothing.
          Save Contact solves it only for people who save contacts.
          This sends the link to their own WhatsApp in one tap, which in South
          Africa is the one app they will still have open tomorrow. */}
      {card.slug && (
        <button
          onClick={() => {
            // Built on click, not at render: window does not exist during SSR,
            // and the card's URL is simply the page we are already on.
            const url = window.location.origin + `/card/${card.slug}`
            const text = `${card.name}${card.company ? ` (${card.company})` : ''}\n${url}`
            track({
              cardId: isTeamCard ? undefined : card.id,
              teamCardId: isTeamCard ? (card as any)._team_card_id : undefined,
              eventType: 'share',
            })
            window.open(waShareLink(text), '_blank', 'noopener')
          }}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold transition hover:opacity-90"
          style={{ background: '#25D366', color: '#fff', fontSize: buttonFontSize }}
        >
          <MessageCircle className="w-4 h-4" />
          Send this card to my WhatsApp
        </button>
      )}

      {contactExchangeOn && (
        <ContactExchangeModal
          open={exchangeOpen}
          onClose={() => setExchangeOpen(false)}
          ownerName={card.name || ''}
          cardId={isTeamCard ? null : card.id}
          teamCardId={isTeamCard ? ((card as any)._team_card_id || null) : null}
          accentHex={accentHex}
        />
      )}

      {/* Custom questionnaire add-on — sits alongside Save Contact */}
      {questionnaireCfg && (
        <QuestionnaireForm
          config={questionnaireCfg}
          cardId={isTeamCard ? null : card.id}
          teamCardId={isTeamCard ? ((card as any)._team_card_id || null) : null}
          ownerName={card.name || ''}
          accentHex={accentHex}
          bg={bg}
          cardButtonBg={buttonBg}
          cardButtonText={buttonText}
          cardButtonBorder={buttonBorder}
        />
      )}

      {isPro && (
        <div className="mt-8">
          {!showContactForm && !submitted ? (
            <button onClick={() => setShowContactForm(true)}
              className="group w-full py-3 px-3.5 rounded-2xl text-sm font-semibold flex items-center justify-between gap-3 transition hover:-translate-y-0.5"
              style={{
                background: `linear-gradient(135deg, ${accentHex}22, ${accentHex}0d)`,
                border: `1px solid ${accentHex}55`,
                color: bg.text,
                boxShadow: `0 4px 16px -6px ${accentHex}55`,
              }}>
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: accentHex + '2e' }}>
                  <UserPlus className="w-4 h-4" style={{ color: accentHex }} />
                </span>
                <span className="truncate">Share your info with {card.name.split(' ')[0]}</span>
              </span>
              <ChevronRight className="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: accentHex }} />
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

      {/* Save to Google Wallet — anyone viewing this card can save
          it as a wallet pass for quick access from their lock screen. */}
      {card.slug && (
        <div className="mt-8 flex justify-center">
          <AddToGoogleWalletButton slug={card.slug} />
        </div>
      )}

      {/* Early-member badge for the first 100 people on Cardtly. Deliberately
          just the number: quietly exclusive without announcing a title. Sits
          here, under the wallet button, so it reads as a footnote rather than
          competing with the person's name at the top. */}
      {founderNumber ? (
        <div className="mt-6 flex justify-center">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide text-black"
            style={{
              background: 'linear-gradient(135deg, #fcd34d 0%, #fbbf24 50%, #f59e0b 100%)',
              boxShadow: '0 3px 12px rgba(245,158,11,0.30), inset 0 1px 0 rgba(255,255,255,0.55)',
            }}
            title="One of the first 100 people on Cardtly"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2l2.6 6.6L21 9.6l-4.8 4.3 1.4 6.5L12 17l-5.6 3.4 1.4-6.5L3 9.6l6.4-1z" />
            </svg>
            <span>{founderNumber}/100</span>
          </div>
        </div>
      ) : null}

      {/* The one thing on the card that is for Cardtly rather than for its
          owner. Every template renders BottomSection, so it lands on all twelve
          from here rather than being pasted into each.

          On by default, off with one toggle - addons.cardtlyBadge !== false, so
          a card saved before this existed still shows it.

          When it is switched off, a card that is not Pro falls back to the
          quiet "Powered by" line it has always carried. That rule does not
          change: the badge is a nicer way of saying the same thing, not a way
          for a free card to shed it. */}
      {(card as any).addons?.cardtlyBadge !== false ? (
        <div className="mt-10 flex flex-col items-center gap-2">
          <div className="w-16 h-px" style={{ background: bg.subtext, opacity: 0.25 }} />
          {/* Straight to signup, not the homepage. Somebody who has just tapped
              a card and liked it has already been sold to; a landing page is
              one more thing between them and having one. */}
          <a
            href="/signup?ref=card"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-bold text-white transition hover:opacity-90 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)',
              boxShadow: '0 6px 20px rgba(124,58,237,0.35)',
            }}
          >
            <Sparkles className="w-4 h-4" />
            Get your own Cardtly card
          </a>
          <p className="text-[11px]" style={{ color: bg.subtext }}>
            One tap and they have your details. No app to install.
          </p>
        </div>
      ) : !isPro ? (
        <div className="mt-10 text-center">
          <a href="/" className="text-xs hover:opacity-70 transition" style={{ color: bg.subtext }}>
            Powered by <span className="font-semibold">Cardtly</span>
          </a>
        </div>
      ) : null}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component — only computes values and renders layout
// ─────────────────────────────────────────────────────────────────────────────

// Wrapper exists purely so the suspension notice is rendered ONCE.
//
// The card body has twelve template branches, each with its own return. The
// old founder ribbon was threaded through all twelve by hand, which is how it
// ended up impossible to remove cleanly. Not repeating that: anything that
// applies to every template goes here, above the body, in one place.
export default function PublicCardView(props: Props) {
  return (
    <>
      {props.suspendedMessage != null && <SuspendedBanner message={props.suspendedMessage} />}
      <CardBody {...props} />
    </>
  )
}

function CardBody({ card, isPro, isTeamCard, lastActiveAt, founderNumber }: Props) {
  // Counts taps on the cardholder's own links, across every template, from a
  // single delegated listener. Attaching to the document rather than wrapping
  // the card means no template's markup or layout changes to get this.
  useTrackLinkClicks(
    isTeamCard ? undefined : card.id,
    isTeamCard ? (card as any)._team_card_id : undefined
  )

  const design = parseDesign(card.color_theme)
  const font = FONTS[design.fontId]
  const bg = getBgColors(design.bgMode, design.templateId, design.customBgColor)
  const accentHex = getAccentHex(design)
  const buttonBg = getButtonBg(design)
  const buttonText = getButtonText(design)
  const buttonBorder = getButtonBorder(design)
  const cardEffect = getCardStyleEffect(design.cardStyle, accentHex, bg.page)
  const textNudge = TEXT_POSITION_TEMPLATES.includes(design.templateId)
    ? { transform: `translate(${design.textX ?? 0}px, ${design.textY ?? 0}px)` }
    : {}
  // A custom background colour decides which way round the card is, whatever
  // the dark/light toggle says. Without this, picking a pale custom colour left
  // every glass surface and tile styled for a dark page: white on near-white.
  const isLight = design.customBgColor ? isLightBg(design.customBgColor) : design.bgMode === 'light'

  const links = isPro ? extractLinks(card) : []
  const certifications = isPro && card.certifications
    ? card.certifications.split(',').map(c => c.trim()).filter(Boolean)
    : []
  const galleryImages = isPro ? [
    // Counted off IMAGE_SLOTS, so raising the limit does not need this list
    // rewritten - which is how slots 7 to 10 could exist in the editor and
    // never appear on the card.
    ...IMAGE_SLOTS.map(i => ({
      url: (card as any)[`image_${i}_url`],
      link: (card as any)[`image_${i}_link`],
    })),
  ].filter(item => item.url) as { url: string; link?: string }[] : []
  const socialLinks = isPro ? [
    card.linkedin_url && { platform: 'LinkedIn', url: card.linkedin_url, icon: <Linkedin className="w-4 h-4" />, color: SOCIAL_BRAND_COLORS.linkedin },
    card.twitter_url && { platform: 'Twitter / X', url: card.twitter_url, icon: <Twitter className="w-4 h-4" />, color: SOCIAL_BRAND_COLORS.twitter },
    card.instagram_url && { platform: 'Instagram', url: card.instagram_url, icon: <Instagram className="w-4 h-4" />, color: SOCIAL_BRAND_COLORS.instagram },
    (card as any).facebook_url && { platform: 'Facebook', url: (card as any).facebook_url, icon: <Facebook className="w-4 h-4" />, color: SOCIAL_BRAND_COLORS.facebook },
    (card as any).youtube && { platform: 'YouTube', url: (card as any).youtube, icon: <Youtube className="w-4 h-4" />, color: SOCIAL_BRAND_COLORS.youtube },
    (card as any).tiktok && { platform: 'TikTok', url: (card as any).tiktok, icon: <TikTokGlyph className="w-4 h-4" />, color: SOCIAL_BRAND_COLORS.tiktok },
    card.whatsapp && { platform: 'WhatsApp', url: `https://wa.me/${card.whatsapp.replace(/\D/g, '')}`, icon: <MessageCircle className="w-4 h-4" />, color: SOCIAL_BRAND_COLORS.whatsapp },
  ].filter(Boolean) as { platform: string; url: string; icon: React.ReactNode; color: string }[] : []

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
  const bottomProps: BottomProps = { card, isPro, isTeamCard, links, certifications, galleryImages, accentHex, buttonBg, buttonText, buttonBorder, buttonFontSize: getButtonFontSize(design), bg, cardEffect, handleShare, founderNumber }

  const pageStyle: React.CSSProperties = { minHeight: '100vh', backgroundColor: bg.page, color: bg.text, fontFamily: font.body }

  if (design.templateId === 'classic') {
    // Classic is the default and the only template that is not Pro, so it is
    // both the most-seen card in the product and the one that has to hold up
    // on the least content. A free card has no title, no socials, no work
    // number and no address: name, company, photograph, phone, email and
    // website is the whole of it. Everything below is built to look
    // deliberate with exactly that and no more, which is why the weight sits
    // in the hero and the contact card rather than in a busy layout that
    // needs a full card to make sense of.
    //
    // Hero band background: accent-tinted gradient (default) or a solid block
    // of the accent colour when the user picks the Solid option in the design
    // panel. Solid uses accentHex so the top band stays a distinct colour
    // instead of disappearing into the page bg.
    const heroBackground = design.solidBackground ? accentHex : cardEffect.heroBg
    const onHero = design.solidBackground ? getReadableTextOn(accentHex) : bg.text

    const rows: { key: string; label: string; value: string; href: string; icon: React.ReactNode }[] = [
      card.phone && { key: 'tel', label: 'Phone', value: card.phone, href: `tel:${card.phone}`, icon: <Phone className="w-4 h-4" /> },
      isPro && card.work_phone && { key: 'dir', label: 'Direct', value: card.work_phone, href: `tel:${card.work_phone}`, icon: <Phone className="w-4 h-4" /> },
      card.email && { key: 'eml', label: 'Email', value: card.email, href: `mailto:${card.email}`, icon: <Mail className="w-4 h-4" /> },
      isPro && card.address && { key: 'off', label: 'Address', value: card.address, href: `https://maps.google.com/?q=${encodeURIComponent(card.address)}`, icon: <MapPin className="w-4 h-4" /> },
      card.website && { key: 'web', label: 'Website', value: card.website.replace(/^https?:\/\//, '').replace(/\/$/, ''), href: card.website.startsWith('http') ? card.website : `https://${card.website}`, icon: <Globe className="w-4 h-4" /> },
    ].filter(Boolean) as { key: string; label: string; value: string; href: string; icon: React.ReactNode }[]

    return (
      <div style={pageStyle} className="animate-fade-up">
        <InAppBackButton bgMode={design.bgMode} />
        <button onClick={handleShare} className="fixed safe-top-3 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }}>
          <Share2 className="w-4 h-4" style={{ color: bg.text }} />
        </button>

        {/* 512, not the 448 this used to be. On a phone it makes no odds -
            both are wider than the screen - but on a desktop the card was a
            narrow strip down the middle with the contact rows squeezed into
            it. */}
        <div style={{ maxWidth: 512, margin: '0 auto' }}>
          <div style={{ height: 176, background: heroBackground, position: 'relative', overflow: 'hidden' }}>
            {/* Two offset glows rather than one centred circle: a single glow
                behind the middle of the band is symmetrical enough to read as
                a flat panel, where two off-centre ones give it a direction
                and some depth. Skipped on Solid, which is meant to be flat. */}
            {!design.solidBackground && (
              <>
                <div style={{ position: 'absolute', top: '-40%', left: '-10%', width: 320, height: 320, background: `radial-gradient(circle, ${accentHex}38 0%, transparent 70%)`, pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: '10%', right: '-15%', width: 260, height: 260, background: `radial-gradient(circle, ${accentHex}28 0%, transparent 70%)`, pointerEvents: 'none' }} />
              </>
            )}
            {/* Scoops the page colour up into the band so the photograph sits
                in a curve rather than straddling a hard horizontal line.
                Inset past both edges so the arc stays shallow at any width. */}
            <div aria-hidden style={{
              position: 'absolute', left: '-8%', right: '-8%', bottom: -1, height: 52,
              backgroundColor: bg.page, borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
            }} />
          </div>

          <div className="px-6 pb-10" style={{ marginTop: -78 }}>
            <div className="text-center mb-7">
              {/* The ring is a gradient rather than a flat border, so it reads
                  as a lit edge instead of an outline drawn round the crop. */}
              <div style={{
                display: 'inline-block', position: 'relative', zIndex: 2,
                padding: design.profileBorder === false ? 0 : 4, borderRadius: '50%',
                background: design.profileBorder === false ? 'none'
                  : `linear-gradient(140deg, ${accentHex} 0%, ${accentHex}44 60%, ${accentHex}22 100%)`,
                boxShadow: `0 10px 34px ${accentHex}33`,
              }}>
                <Avatar {...shared} size={124} extraStyle={{ border: `3px solid ${bg.page}`, display: 'block' }} />
              </div>

              <h1 className="font-bold mt-5 leading-tight" style={{ fontFamily: font.heading, letterSpacing: '-0.02em', fontSize: calcNameSize(28, design), color: getNameColor(design, bg.text) }}>{card.name}</h1>
              {isPro && card.title && (
                <p className="mt-2" style={{ color: getTitleColor(design, accentHex), fontSize: calcTitleSize(12, design), fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{card.title}</p>
              )}
              {/* Set in small caps whether or not there is a title above it.
                  On a free card there is no title, and a plain grey company
                  line under the name was the whole of the type hierarchy. */}
              {card.company && (
                <p className="mt-1.5" style={{ color: getCompanyColor(design, bg.subtext), fontSize: calcCompanySize(12, design), fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{card.company}</p>
              )}

              {/* A rule that fades out at both ends instead of a solid bar
                  with a glow under it. */}
              <div style={{ width: 132, height: 1, margin: '18px auto 0', background: `linear-gradient(90deg, transparent, ${accentHex}, transparent)` }} />

              <div className="mt-4"><LogoZone {...shared} /></div>
              {card.bio && <p className="mt-3 leading-relaxed" style={{ color: getBioColor(design, bg.subtext), fontSize: calcBioSize(14, design) }}>{card.bio}</p>}
            </div>

            {/* One panel with hairlines between the rows, not five separate
                outlined buttons. Three loose buttons is what a free card used
                to come to, and it read as a list of leftovers; a single card
                with three rows in it reads as a card. */}
            {/* The divider is derived from the mode rather than taken from
                bg.border. On a light card border is #e2e8f0, which is lighter
                than the tinted panel it would be drawn on, so the rows ran
                together into one grey block with no lines between them. */}
            {rows.length > 0 && (
              <div style={{
                // borderStyle, not bg.border: the rim is the strongest signal
                // that Glass is glass, and taking the border from the palette
                // instead of the style meant Glass never got to draw it.
                border: cardEffect.borderStyle, borderRadius: 16, overflow: 'hidden',
                background: cardEffect.surfaceBg, backdropFilter: cardEffect.backdropFilter, WebkitBackdropFilter: cardEffect.backdropFilter, boxShadow: cardEffect.surfaceShadow,
              }}>
                {rows.map((r, i) => (
                  <a key={r.key} href={r.href}
                    target={r.href.startsWith('http') ? '_blank' : undefined}
                    rel={r.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="hover:opacity-90 transition"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '13px 15px', minHeight: 60, textDecoration: 'none',
                      borderTop: i === 0 ? 'none' : `1px solid ${isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.09)'}`,
                    }}>
                    <span style={{
                      width: 40, height: 40, flexShrink: 0, borderRadius: 12,
                      display: 'grid', placeItems: 'center',
                      backgroundColor: accentHex + '1f', color: accentHex,
                    }}>{r.icon}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: bg.subtext, marginBottom: 2 }}>{r.label}</span>
                      <span className="truncate" style={{ display: 'block', fontSize: getBodyFontSize(design), fontWeight: 500, color: bg.text }}>{r.value}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: bg.subtext }} />
                  </a>
                ))}
              </div>
            )}

            {socialLinks.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3" style={{ marginTop: 18 }}>
                {socialLinks.map(s => (
                  <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer"
                    aria-label={s.platform} title={s.platform}
                    style={{
                      width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center',
                      backgroundColor: s.color || accentHex, color: '#fff', textDecoration: 'none',
                      boxShadow: `0 4px 14px ${(s.color || accentHex)}55`,
                    }}>{s.icon}</a>
                ))}
              </div>
            )}

            <BottomSection {...bottomProps} />
          </div>
        </div>
      </div>
    )
  }

  if (design.templateId === 'modern') {
    // Direction E: gradient orbs in the background, content on a
    // glassmorphic central panel. Orbs positioned ABSOLUTELY inside
    // a relative-positioned outer wrapper so they live in the card
    // container, not the viewport (previously fixed positioning made
    // them invisible inside the editor's live-preview frame).
    const nameFontSize = calcNameSize(26, design)
    const titleColor = getTitleColor(design, accentHex)
    const bioColor = getBioColor(design, bg.subtext)
    return (
      <div style={{ ...pageStyle, position: 'relative', overflow: 'hidden', minHeight: '100vh' }} className="animate-fade-up">
        {/* Floating gradient orbs - absolute positioned so they render
            relative to the card container. Three orbs at different
            spots / colours / sizes plus a subtle slow drift animation.

            Two of the three are a fixed pink and purple at 0.55, which is
            Modern's signature on its own dark page but swamps a background
            the user chose - pick cream and you got a pink card. When a custom
            background is set the orbs step back so that colour still reads. */}
        <div style={{ position: 'absolute', top: -120, left: -120, width: 460, height: 460, borderRadius: '50%', background: `radial-gradient(circle, ${accentHex}88 0%, transparent 65%)`, filter: 'blur(40px)', animation: 'modernOrb1 28s ease-in-out infinite', opacity: design.customBgColor ? 0.28 : 1, pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'absolute', top: '20%', right: -160, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.55) 0%, transparent 65%)', filter: 'blur(40px)', animation: 'modernOrb2 36s ease-in-out infinite', opacity: design.customBgColor ? 0.28 : 1, pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'absolute', bottom: -100, left: 40, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.55) 0%, transparent 65%)', filter: 'blur(40px)', animation: 'modernOrb3 32s ease-in-out infinite', opacity: design.customBgColor ? 0.28 : 1, pointerEvents: 'none', zIndex: 0 }} />
        <style>{`
          @keyframes modernOrb1 { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(60px,40px) scale(1.1) } }
          @keyframes modernOrb2 { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(-40px,80px) scale(1.05) } }
          @keyframes modernOrb3 { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(30px,-50px) scale(1.15) } }
        `}</style>
        <InAppBackButton bgMode={design.bgMode} />
        <button onClick={handleShare} className="fixed safe-top-3 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md" style={{ backgroundColor: isLight ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)' }}>
          <Share2 className="w-4 h-4" style={{ color: bg.text }} />
        </button>
        <div className="max-w-md mx-auto px-4 py-10 relative" style={{ zIndex: 1 }}>
          {/* Glassmorphic central panel - bumped opacity so it's visible
              against dark bg, and a stronger border for definition */}
          <div style={{
            backgroundColor: isLight ? 'rgba(255,255,255,0.6)' : 'rgba(20,20,30,0.45)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            border: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.14)'}`,
            borderRadius: 28,
            padding: '32px 24px',
            boxShadow: isLight ? '0 24px 60px rgba(0,0,0,0.08)' : '0 24px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}>
            <div className="flex items-start gap-5 mb-6">
              <div style={{ flexShrink: 0 }}>
                {/* Round, like every other template. This was a rounded square,
                    so a photo with a dark background - which most cut-out and
                    illustrated avatars have - showed as a black block with the
                    face floating in the middle of it. A circle crops the corners
                    off instead of framing them. */}
                <Avatar {...shared} size={92} rounded="full" extraStyle={{ border: `2px solid ${accentHex}66` }} />
              </div>
              <div className="flex-1 min-w-0 pt-1" style={textNudge}>
                <h1 style={{ margin: 0, fontSize: nameFontSize, fontWeight: 800, lineHeight: 1.1, fontFamily: font.heading, letterSpacing: '-0.02em', color: getNameColor(design, bg.text) }}>{card.name}</h1>
                {isPro && card.title && <p style={{ margin: '6px 0 0', fontSize: calcTitleSize(12, design), fontWeight: 700, color: titleColor, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{card.title}</p>}
                {card.company && <p style={{ margin: '4px 0 0', fontSize: calcCompanySize(13, design), color: getCompanyColor(design, bg.subtext) }}>{card.company}</p>}
              </div>
            </div>
            <div className="rounded-full mb-4" style={{ width: 40, height: 3, backgroundColor: accentHex, boxShadow: `0 0 16px ${accentHex}88` }} />
            <LogoZone {...shared} />
            {card.bio && <p style={{ fontSize: calcBioSize(15, design), lineHeight: 1.7, marginBottom: 20, color: bioColor }}>{card.bio}</p>}
            {/* Socials row - centered, UNDER the bio, in brand colours.
                White icon on the platform's own brand colour, instant
                recognition vs an accent-tinted row of identical pills. */}
            {socialLinks.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
                {socialLinks.map(s => (
                  <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer"
                    aria-label={s.platform}
                    className="w-11 h-11 rounded-full flex items-center justify-center transition hover:scale-110 active:scale-95"
                    style={{ backgroundColor: s.color, color: '#ffffff', boxShadow: `0 4px 14px ${s.color}66` }}>
                    {s.icon}
                  </a>
                ))}
              </div>
            )}
            {/* Pass empty socialLinks so AllContacts doesn't render
                them again - we showed them above as brand-coloured icons */}
            <AllContacts {...shared} socialLinks={[]} />
            <BottomSection {...bottomProps} />
          </div>
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
        <button onClick={handleShare} className="fixed safe-top-3 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
          <Share2 className="w-4 h-4 text-white" />
        </button>
        <div className="max-w-md mx-auto">
          <div style={{ background: heroBg, padding: '32px 24px', display: 'flex', alignItems: 'center', gap: 20, minHeight: 160, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <div style={{ position: 'absolute', right: 30, bottom: -30, width: 80, height: 80, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <div style={{ flexShrink: 0, position: 'relative', zIndex: 2 }}>
              <div style={{ borderRadius: '50%', overflow: 'hidden', width: heroPhotoSize, height: heroPhotoSize, border: design.profileBorder === false ? 'none' : '3px solid rgba(255,255,255,0.4)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
                {card.profile_image_url
                  ? <img src={card.profile_image_url} style={{ width: heroPhotoSize, height: heroPhotoSize, objectFit: 'cover' }} />
                  : <div style={{ width: heroPhotoSize, height: heroPhotoSize, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: heroPhotoSize * 0.36, fontWeight: 700, color: '#fff', fontFamily: font.heading }}>{card.name?.[0]?.toUpperCase()}</div>}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 2, ...textNudge }}>
              <h1 style={{ margin: '0 0 5px', fontSize: calcNameSize(22, design), fontWeight: 800, fontFamily: font.heading, color: getNameColor(design, '#fff'), lineHeight: 1.1 }}>{card.name}</h1>
              {isPro && card.title && <p style={{ margin: '0 0 4px', fontSize: calcTitleSize(13, design), fontWeight: 600, color: getTitleColor(design, 'rgba(255,255,255,0.85)'), lineHeight: 1.2 }}>{card.title}</p>}
              {card.company && <p style={{ margin: 0, fontSize: calcCompanySize(12, design), color: getCompanyColor(design, 'rgba(255,255,255,0.65)'), lineHeight: 1.2 }}>{card.company}</p>}
            </div>
          </div>
          <div className="px-6 py-6">
            <LogoZone {...shared} />
            {card.bio && <p className="text-sm mb-6 leading-relaxed" style={{ fontSize: calcBioSize(14, design), color: getBioColor(design, bg.subtext) }}>{card.bio}</p>}
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
    const pageBg = design.customBgColor || (isLight ? '#ffffff' : '#000000')
    const ink = design.customBgColor ? getReadableTextOn(design.customBgColor) : (isLight ? '#0f172a' : '#ffffff')
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
        <button onClick={handleShare} className="fixed safe-top-3 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>
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
              photos) show the page background through, not the gradient.
              Ring is dropped when profileBorder is OFF. */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            {design.profileBorder === false ? (
              <Avatar {...shared} size={140} rounded="full" extraStyle={{ backgroundColor: pageBg }} />
            ) : (
              <div style={{ padding: 4, borderRadius: '50%', background: RING_GRADIENT, boxShadow: '0 0 12px rgba(0, 212, 255, 0.22), 0 0 18px rgba(236, 72, 153, 0.16)' }}>
                <Avatar {...shared} size={140} rounded="full" extraStyle={{ border: `3px solid ${pageBg}`, backgroundColor: pageBg }} />
              </div>
            )}
          </div>
          <h1 style={{ margin: '0 0 6px', fontSize: calcNameSize(30, design), fontWeight: 800, color: getNameColor(design, ink), textAlign: 'center', fontFamily: font.heading, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{card.name}</h1>
          {isPro && card.title && <p style={{ margin: 0, fontSize: calcTitleSize(15, design), fontWeight: 500, color: getTitleColor(design, titleColor), textAlign: 'center' }}>{card.title}</p>}
          {card.company && <p style={{ margin: '4px 0 0', fontSize: calcCompanySize(14, design), color: getCompanyColor(design, muted), textAlign: 'center' }}>{card.company}</p>}
          {card.bio && <p style={{ fontSize: calcBioSize(13, design), color: getBioColor(design, muted), textAlign: 'center', lineHeight: 1.6, margin: '12px 0 0' }}>{card.bio}</p>}
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
            {isPro && card.work_phone && <ContactBtn icon={<Phone className="w-4 h-4" />} label={card.work_phone} sublabel="Work" href={`tel:${card.work_phone}`} accentHex={accentHex} bg={bg} cardEffect={cardEffect} bodyFontSize={getBodyFontSize(design)} />}
            {isPro && card.whatsapp && <ContactBtn icon={<MessageCircle className="w-4 h-4" />} label={card.whatsapp} sublabel="WhatsApp" href={`https://wa.me/${card.whatsapp.replace(/\D/g, '')}`} accentHex={accentHex} bg={bg} cardEffect={cardEffect} bodyFontSize={getBodyFontSize(design)} />}
            {isPro && card.address && <ContactBtn icon={<MapPin className="w-4 h-4" />} label={card.address} href={`https://maps.google.com/?q=${encodeURIComponent(card.address)}`} accentHex={accentHex} bg={bg} cardEffect={cardEffect} bodyFontSize={getBodyFontSize(design)} />}
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
    const pageBg  = design.customBgColor || (isLight ? '#fafafa' : '#000000')
    const ink     = design.customBgColor ? getReadableTextOn(design.customBgColor) : (isLight ? '#0f172a' : '#ffffff')
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
        <button onClick={handleShare} className="fixed safe-top-3 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
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
              <h1 style={{ margin: '0 0 12px', fontSize: calcNameSize(36, design), fontWeight: 800, color: getNameColor(design, '#ffffff'), letterSpacing: '-0.025em', lineHeight: 0.96, fontFamily: font.heading, textShadow: '0 4px 24px rgba(0,0,0,0.6)' }}>{card.name}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ width: 36, height: 3, background: accentHex, boxShadow: `0 0 16px ${accentHex}aa` }} />
                {isPro && card.title && <p style={{ margin: 0, fontSize: calcTitleSize(11, design), fontWeight: 700, color: getTitleColor(design, '#ffffff'), textTransform: 'uppercase', letterSpacing: '0.28em' }}>{card.title}</p>}
              </div>
              {card.company && <p style={{ margin: 0, fontSize: calcCompanySize(13, design), color: getCompanyColor(design, 'rgba(255,255,255,0.7)'), fontStyle: 'italic', letterSpacing: '0.02em' }}>{card.company}</p>}
            </div>
          </div>
          {/* Glass card - reduced overlap from -36 to -20 so there's clear
              breathing room between the company text and the card edge */}
          <div style={{ position: 'relative', marginTop: -20, marginLeft: 16, marginRight: 16, padding: '28px 22px', backgroundColor: glassBg, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: `1px solid ${glassBorder}`, borderRadius: 28, boxShadow: '0 24px 70px rgba(0,0,0,0.5)', zIndex: 2 }}>
            <LogoZone {...shared} />
            {card.bio && (
              <div style={{ position: 'relative', padding: '8px 12px', textAlign: 'center' }}>
                <span style={{ position: 'absolute', top: -10, left: 0, fontSize: 56, color: accentHex, fontFamily: 'Georgia, serif', lineHeight: 1, opacity: 0.5 }}>&ldquo;</span>
                <p style={{ margin: 0, fontSize: calcBioSize(14, design), color: getBioColor(design, muted), lineHeight: 1.75, fontStyle: 'italic' }}>{card.bio}</p>
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
    // A bento grid, which is the one shape nothing else in the set uses.
    // Every other template here is a vertical stack: hero, then name, then a
    // list of contacts, then the bottom. Two rebuilds of Creative kept that
    // stack and redecorated the top of it, and both times what was left below
    // the photograph was the same card as everything else. Changing the shape
    // is the only thing that actually makes it a different template.
    //
    // The grid is two columns at every width. Tiles that hold a long value
    // take both, tiles that hold a short one take one, and a tile whose field
    // is empty is simply not rendered - so a sparse card closes up into a
    // smaller arrangement instead of leaving holes.
    const deep = darkenHex(accentHex, 0.3)
    const onAccent = getReadableTextOn(accentHex)

    const tile: React.CSSProperties = {
      borderRadius: 20, padding: '16px 17px',
      background: cardEffect.surfaceBg,
      backdropFilter: cardEffect.backdropFilter,
      WebkitBackdropFilter: cardEffect.backdropFilter,
      boxShadow: cardEffect.surfaceShadow,
      border: `1px solid ${accentHex}26`,
      textDecoration: 'none', display: 'block',
    }
    const tileLabel: React.CSSProperties = {
      display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
      textTransform: 'uppercase', color: bg.subtext, marginBottom: 6,
    }
    const tileValue: React.CSSProperties = {
      display: 'block', fontSize: getBodyFontSize(design), fontWeight: 600, color: bg.text,
    }

    const contactTiles: { key: string; label: string; value: string; href: string; icon: React.ReactNode; wide?: boolean }[] = [
      card.phone && { key: 'tel', label: 'Call', value: card.phone, href: `tel:${card.phone}`, icon: <Phone className="w-4 h-4" /> },
      isPro && card.work_phone && { key: 'dir', label: 'Direct', value: card.work_phone, href: `tel:${card.work_phone}`, icon: <Phone className="w-4 h-4" /> },
      card.email && { key: 'eml', label: 'Email', value: card.email, href: `mailto:${card.email}`, icon: <Mail className="w-4 h-4" />, wide: true },
      card.website && { key: 'web', label: 'Website', value: card.website.replace(/^https?:\/\//, '').replace(/\/$/, ''), href: card.website.startsWith('http') ? card.website : `https://${card.website}`, icon: <Globe className="w-4 h-4" />, wide: true },
      isPro && card.address && { key: 'off', label: 'Find me', value: card.address, href: `https://maps.google.com/?q=${encodeURIComponent(card.address)}`, icon: <MapPin className="w-4 h-4" />, wide: true },
    ].filter(Boolean) as { key: string; label: string; value: string; href: string; icon: React.ReactNode; wide?: boolean }[]

    return (
      <div style={{ ...pageStyle, overflow: 'hidden', position: 'relative' }} className="animate-fade-up">
        {/* Colour-field backdrop: three overlapping washes rather than two flat
            radials, so the background has depth and movement instead of looking
            like a gradient someone forgot to finish. Kept from the old design:
            it is the part that was working, and it gives the tiles something to
            sit on rather than floating on a flat page. */}
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-18%', right: '-22%', width: '75vw', height: '75vw', maxWidth: 460, maxHeight: 460, borderRadius: '50%', background: `radial-gradient(circle, ${accentHex}55 0%, transparent 68%)`, filter: 'blur(28px)' }} />
          <div style={{ position: 'absolute', bottom: '-14%', left: '-24%', width: '68vw', height: '68vw', maxWidth: 420, maxHeight: 420, borderRadius: '50%', background: `radial-gradient(circle, ${deep}44 0%, transparent 70%)`, filter: 'blur(32px)' }} />
          <div style={{ position: 'absolute', top: '34%', left: '38%', width: '52vw', height: '52vw', maxWidth: 320, maxHeight: 320, borderRadius: '50%', background: `radial-gradient(circle, ${accentHex}22 0%, transparent 72%)`, filter: 'blur(36px)' }} />
        </div>

        <InAppBackButton bgMode={design.bgMode} />
        <button onClick={handleShare} className="fixed safe-top-3 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }}>
          <Share2 className="w-4 h-4" style={{ color: bg.text }} />
        </button>

        <div className="max-w-md mx-auto px-5 relative" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)', paddingBottom: 32 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>

            {/* Photograph, square, filling its cell edge to edge. */}
            <div style={{ ...tile, padding: 0, overflow: 'hidden', aspectRatio: '1 / 1' }}>
              {card.profile_image_url
                ? <img src={card.profile_image_url} alt={card.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: `linear-gradient(150deg, ${accentHex}55, ${deep}22)`, color: accentHex, fontFamily: font.heading, fontSize: 52, fontWeight: 800 }}>{initialsOf(card.name)}</div>}
            </div>

            {/* The one solid accent tile. A bento grid with every cell the same
                weight is a spreadsheet; one block of flat colour is what stops
                it being one. It carries the title when there is one, and the
                asterisk alone when there is not, so the cell is never empty. */}
            <div style={{ ...tile, aspectRatio: '1 / 1', background: accentHex, border: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <svg aria-hidden width="26" height="26" viewBox="0 0 30 30">
                <g stroke={onAccent} strokeWidth="2.6" strokeLinecap="round" opacity="0.9">
                  <line x1="15" y1="4" x2="15" y2="26" /><line x1="5" y1="9" x2="25" y2="21" /><line x1="25" y1="9" x2="5" y2="21" />
                </g>
              </svg>
              {isPro && card.title && (
                <span style={{
                  fontFamily: font.heading, fontSize: calcTitleSize(19, design), fontWeight: 800,
                  lineHeight: 1.08, letterSpacing: '-0.02em', color: onAccent,
                }}>{card.title}</span>
              )}
            </div>

            {/* Name across the full width, as large as it will go. */}
            <div style={{ ...tile, gridColumn: '1 / -1', paddingTop: 18, paddingBottom: 18 }}>
              <h1 className="font-bold" style={{
                margin: 0, fontFamily: font.heading, fontSize: calcNameSize(36, design),
                letterSpacing: '-0.035em', lineHeight: 1.02,
                ...(design.nameColor
                  ? { color: design.nameColor }
                  : {
                      background: `linear-gradient(120deg, ${bg.text} 12%, ${accentHex} 92%)`,
                      WebkitBackgroundClip: 'text', backgroundClip: 'text',
                      WebkitTextFillColor: 'transparent', color: 'transparent',
                    }),
              }}>{card.name}</h1>
              {card.company && (
                <p style={{ margin: '10px 0 0', fontSize: calcCompanySize(13, design), fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: getCompanyColor(design, bg.subtext) }}>{card.company}</p>
              )}
              <LogoZone {...shared} />
            </div>

            {card.bio && (
              <div style={{ ...tile, gridColumn: '1 / -1' }}>
                <span style={tileLabel}>About</span>
                <p className="leading-relaxed" style={{ margin: 0, fontSize: calcBioSize(14, design), color: getBioColor(design, bg.subtext) }}>{card.bio}</p>
              </div>
            )}

            {contactTiles.map(t => (
              <a key={t.key} href={t.href}
                target={t.href.startsWith('http') ? '_blank' : undefined}
                rel={t.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="hover:opacity-90 transition"
                style={{ ...tile, minHeight: 92, gridColumn: t.wide ? '1 / -1' : undefined }}>
                <span style={{ display: 'block', color: accentHex, marginBottom: 10 }}>{t.icon}</span>
                <span style={tileLabel}>{t.label}</span>
                <span className="truncate" style={tileValue}>{t.value}</span>
              </a>
            ))}

            {socialLinks.length > 0 && (
              <div style={{ ...tile, gridColumn: '1 / -1' }}>
                <span style={tileLabel}>Elsewhere</span>
                <div className="flex flex-wrap gap-2.5">
                  {socialLinks.map(s => (
                    <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer"
                      aria-label={s.platform} title={s.platform}
                      style={{
                        width: 46, height: 46, borderRadius: 14, display: 'grid', placeItems: 'center',
                        backgroundColor: s.color || accentHex, color: '#fff', textDecoration: 'none',
                        boxShadow: `0 6px 18px ${(s.color || accentHex)}55`,
                      }}>{s.icon}</a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <BottomSection {...bottomProps} />
        </div>
      </div>
    )
  }

  if (design.templateId === 'wave') {
    // Hero band - either accent gradient (default) or solid block of
    // accent colour when user picks the Solid option in the design
    // panel. Same toggle as Classic.
    const waveGradient = design.cardStyle === 'gradient'
      ? `linear-gradient(135deg, ${accentHex}55 0%, ${accentHex}22 100%)`
      : design.cardStyle === 'glass'
        ? `linear-gradient(135deg, ${accentHex}44 0%, ${accentHex}11 100%)`
        : `linear-gradient(135deg, ${accentHex}44 0%, ${bg.page} 100%)`
    const waveHeroBg = design.solidBackground ? accentHex : waveGradient
    const nameFontSize = calcNameSize(22, design)
    const titleColor = getTitleColor(design, accentHex)
    const bioColor = getBioColor(design, bg.subtext)
    return (
      <div style={pageStyle} className="animate-fade-up">
        <InAppBackButton bgMode={design.bgMode} />
        <button onClick={handleShare} className="fixed safe-top-3 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }}>
          <Share2 className="w-4 h-4" style={{ color: bg.text }} />
        </button>
        <div className="max-w-md mx-auto">
          <div style={{ background: waveHeroBg, position: 'relative' }}>
            <div style={{ display: 'flex', gap: 0, padding: '28px 24px 52px' }}>
              <div style={{ flexShrink: 0, position: 'relative', zIndex: 2 }}>
                {/* Round, for the same reason as Modern above. */}
                <Avatar {...shared} size={100} rounded="full" extraStyle={{ border: `3px solid ${accentHex}44` }} />
              </div>
              <div style={{ flex: 1, paddingLeft: 18, ...textNudge }}>
                <h1 style={{ margin: '4px 0 6px', fontSize: nameFontSize, fontWeight: 800, fontFamily: font.heading, color: getNameColor(design, bg.text), lineHeight: 1.2 }}>{card.name}</h1>
                {isPro && card.title && <p style={{ margin: '0 0 4px', fontSize: calcTitleSize(13, design), fontWeight: 600, color: titleColor }}>{card.title}</p>}
                {card.company && <p style={{ margin: 0, fontSize: calcCompanySize(12, design), color: getCompanyColor(design, bg.subtext) }}>{card.company}</p>}
              </div>
            </div>
            <svg viewBox="0 0 400 56" style={{ display: 'block', width: '100%', height: 56, position: 'absolute', bottom: 0 }} preserveAspectRatio="none">
              <path d="M0,28 C80,56 160,0 240,28 C320,56 360,14 400,28 L400,56 L0,56 Z" fill={bg.page} />
            </svg>
          </div>
          <div className="px-6 py-4 pb-10">
            <LogoZone {...shared} />
            {card.bio && <p style={{ fontSize: calcBioSize(14, design), lineHeight: 1.7, marginBottom: 20, color: bioColor }}>{card.bio}</p>}
            {/* Brand-coloured socials row - centred UNDER the bio.
                Same pattern as Modern. */}
            {socialLinks.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
                {socialLinks.map(s => (
                  <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer"
                    aria-label={s.platform}
                    className="w-11 h-11 rounded-full flex items-center justify-center transition hover:scale-110 active:scale-95"
                    style={{ backgroundColor: s.color, color: '#ffffff', boxShadow: `0 4px 14px ${s.color}66` }}>
                    {s.icon}
                  </a>
                ))}
              </div>
            )}
            {/* Empty socialLinks so AllContacts doesn't duplicate them */}
            <AllContacts {...shared} socialLinks={[]} />
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
    // The rail is fixed, so it is out of the page flow. The content beside it
    // was ALSO flex: 1 inside a flex row, which made it a full-width child that
    // a margin-left then pushed 80px further right - so every Split card
    // overflowed by exactly the width of its own sidebar. A plain block sizes
    // itself to what is left, which is what the margin was always for.
    // The rail carries the person; the logo lives once, in the content, drawn
    // by LogoZone like every other template.
    //
    // It used to be in both, so a Split card showed the company mark twice -
    // white and knocked out in the rail, then again in colour beside the name.
    // Only the second one obeys the logo position and size controls, so the
    // rail's copy was a fixture nobody could move, resize or turn off.
    // 96 rather than 80: at 80 the content box was 64px wide, and a profile
    // photo scaled past about 107% was wider than that. The browser clamped the
    // width and left the height alone, so the face came out as an oval - the
    // photo controls were quietly deforming the picture rather than resizing it.
    const rail = 96
    // Belt as well as braces: capped to what the rail can hold, so no photo
    // setting can squeeze it again, and aspectRatio below keeps it round even
    // if some future layout tries.
    const avatarSize = Math.min(rail - 20, calcPhotoSize(60, design))

    // Everything the rail can be tapped for: the three ways to reach them, then
    // their profiles. These were bare 16px glyphs and, worse, not links at all -
    // three things that looked pressable on a phone and did nothing.
    const RAIL_ICON = 20
    const railLinks = [
      card.phone && { key: 'phone', href: `tel:${card.phone}`, label: 'Call', icon: <Phone style={{ width: RAIL_ICON, height: RAIL_ICON }} /> },
      card.email && { key: 'email', href: `mailto:${card.email}`, label: 'Email', icon: <Mail style={{ width: RAIL_ICON, height: RAIL_ICON }} /> },
      card.website && { key: 'web', href: card.website.startsWith('http') ? card.website : `https://${card.website}`, label: 'Website', icon: <Globe style={{ width: RAIL_ICON, height: RAIL_ICON }} /> },
    ].filter(Boolean) as { key: string; href: string; label: string; icon: React.ReactNode }[]

    // 44, not 34. That is the size a finger is measured against - both Apple and
    // Material put the floor there - and the rail is 96px wide, so there was
    // room for it all along.
    const railPill: React.CSSProperties = {
      width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center',
      background: 'rgba(255,255,255,0.18)', color: '#fff', textDecoration: 'none', flexShrink: 0,
    }

    // The card is one centred column, and the rail is a band inside the top of
    // it rather than a full-height stripe.
    //
    // The rail used to run the whole page, so everything below the person's bio
    // - the contact buttons, the links, the gallery - was squeezed into the
    // 263px left over beside it, on a phone, for the entire length of the card.
    // The sidebar has nothing in it past the icons; it was costing a quarter of
    // every screen to show more yellow.
    //
    // So it stops where its own content does, and the rest of the card gets the
    // full width back.
    const GROUP = rail + 460
    const column: React.CSSProperties = { maxWidth: GROUP, margin: '0 auto' }
    return (
      <div style={{ ...pageStyle, minHeight: '100vh' }} className="animate-fade-up">
        <InAppBackButton bgMode={design.bgMode} />
        {/* The header band: rail on the left, who they are on the right.
            alignItems stretch is what makes the yellow end exactly level with
            the bio rather than at some guessed height. */}
        <div style={{ ...column, display: 'flex', alignItems: 'stretch' }}>
        {/* paddingTop clears the back button, which the app fixes at 12px from
            the top and 40px tall and which was sitting across the photo. */}
        <div style={{
          width: rail, flexShrink: 0, background: sidebarBg, display: 'flex',
          flexDirection: 'column', alignItems: 'center', gap: 12,
          padding: 'calc(env(safe-area-inset-top, 0px) + 64px) 10px 24px',
        }}>
          <Avatar {...shared} size={60} rounded="full" extraStyle={{
            width: avatarSize, height: avatarSize, aspectRatio: '1 / 1',
            border: design.profileBorder === false ? 'none' : '3px solid rgba(255,255,255,0.35)',
          }} />
          <div style={{ width: '55%', height: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            {railLinks.map(l => (
              <a key={l.key} href={l.href} aria-label={l.label} title={l.label} style={railPill}>
                {l.icon}
              </a>
            ))}
            {railLinks.length > 0 && socialLinks.length > 0 && (
              <div style={{ width: 20, height: 1, backgroundColor: 'rgba(255,255,255,0.3)', margin: '2px 0' }} />
            )}
            {socialLinks.map(s => (
              <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer"
                aria-label={s.platform} title={s.platform} style={railPill}>
                {/* socialLinks carries its glyphs at a fixed w-4 h-4 for the
                    contact rows, and they are shared with every other template,
                    so they are scaled here rather than resized at the source. */}
                <span style={{ display: 'grid', placeItems: 'center', transform: `scale(${RAIL_ICON / 16})` }}>
                  {s.icon}
                </span>
              </a>
            ))}
            {/* Under the socials, not marginTop:auto. The rail is fixed inside
                an animated ancestor, so it spans the whole PAGE rather than the
                viewport - "push it to the bottom" put Share 2800px down, at the
                foot of a column nobody scrolls. */}
            <div style={{ width: 20, height: 1, backgroundColor: 'rgba(255,255,255,0.3)', margin: '2px 0' }} />
            <button onClick={handleShare} aria-label="Share this card" title="Share"
              style={{ ...railPill, background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer' }}>
              <Share2 style={{ width: RAIL_ICON, height: RAIL_ICON }} />
            </button>
          </div>
        </div>
        {/* minWidth 0 so a long unbroken word - an email address, a URL - makes
            this column wrap rather than push the band wider than the screen. */}
        <div style={{ flex: 1, minWidth: 0, padding: '28px 24px' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: calcNameSize(26, design), fontWeight: 800, fontFamily: font.heading, color: getNameColor(design, bg.text) }}>{card.name}</h1>
          {isPro && card.title && <p style={{ margin: '0 0 3px', fontSize: calcTitleSize(12, design), fontWeight: 600, color: getTitleColor(design, accentHex), textTransform: 'uppercase', letterSpacing: '0.07em' }}>{card.title}</p>}
          {card.company && <p style={{ margin: '0 0 16px', fontSize: calcCompanySize(13, design), color: getCompanyColor(design, bg.subtext) }}>{card.company}</p>}
          <div style={{ width: 32, height: 3, backgroundColor: accentHex, marginBottom: 12, borderRadius: 2 }} />
          <LogoZone {...shared} />
          {card.bio && <p className="leading-relaxed" style={{ margin: 0, fontSize: calcBioSize(14, design), color: getBioColor(design, bg.subtext) }}>{card.bio}</p>}
        </div>
        </div>

        {/* Closes the band off across the whole card. Edge to edge rather than
            inside the body padding, so it finishes the yellow's bottom edge
            instead of starting a new inset block under it.
            The accent at full strength: it was at 0.35, which read as a faded
            line rather than a deliberate one. It is the same colour the rail is
            drawn from, so at full opacity it continues that edge exactly. */}
        <div style={{ ...column, height: 2, backgroundColor: accentHex }} />

        {/* Everything from here down gets the whole width. */}
        <div style={{ ...column, padding: '24px 24px 28px' }}>
          <AllContacts {...shared} socialLinks={socialLinks} />
          <BottomSection {...bottomProps} />
        </div>
      </div>
    )
  }

  // ── Split Pro ──────────────────────────────────────────────────────────
  //
  // Split, with the sidebar doing more of the work. Two differences:
  //
  //   1. The rail runs the whole way down to just above the gallery, instead of
  //      stopping level with the bio.
  //   2. Everything above the gallery hangs off it. Each contact, social and
  //      link is one row: the icon sits INSIDE the rail, and its value is a box
  //      to the right, outlined in the rail's own colour and joined to it - no
  //      left border, so the two read as one shape rather than a rail and a
  //      separate button beside it.
  //
  // The rail is absolutely positioned inside the zone wrapper, so "down to just
  // above the gallery" needs no measuring: the wrapper ends where the gallery
  // begins and the rail is stretched to it.
  if (design.templateId === 'splitpro') {
    // Wide enough to hold the photo, which sits in it like Split.
    const railW = 84
    const avatarSize = Math.min(railW - 20, calcPhotoSize(56, design))
    const railBg = design.cardStyle === 'gradient'
      ? `linear-gradient(180deg, ${accentHex} 0%, ${accentHex}cc 100%)`
      : design.cardStyle === 'glass'
        ? `linear-gradient(180deg, ${accentHex}cc 0%, ${accentHex}88 100%)`
        : accentHex
    const onRail = getReadableTextOn(accentHex)
    const GROUP = 560
    const column: React.CSSProperties = { maxWidth: GROUP, margin: '0 auto' }
    const bodySize = getBodyFontSize(design)

    // The rail is the whole contact sheet: photo, then everything a tap does.
    // Phone, email, location and website say the same thing as their glyph and
    // the tap does the rest, so none of them needs a row of the card to hold a
    // number nobody is going to copy out by hand. Save Contact is still there
    // for anyone who wants the details themselves.
    //
    // Titled as well as labelled: on a desktop, hovering says which number is
    // which, and a screen reader gets the same from aria-label.
    const railIcons: { key: string; icon: React.ReactNode; label: string; href: string }[] = [
      card.phone && { key: 'phone', icon: <Phone className="w-4 h-4" />, label: `Call ${card.phone}`, href: `tel:${card.phone}` },
      isPro && card.work_phone && { key: 'work', icon: <Phone className="w-4 h-4" />, label: `Call ${card.work_phone} (work)`, href: `tel:${card.work_phone}` },
      card.email && { key: 'email', icon: <Mail className="w-4 h-4" />, label: `Email ${card.email}`, href: `mailto:${card.email}` },
      isPro && card.address && { key: 'addr', icon: <MapPin className="w-4 h-4" />, label: card.address, href: `https://maps.google.com/?q=${encodeURIComponent(card.address)}` },
      card.website && { key: 'web', icon: <Globe className="w-4 h-4" />, label: card.website.replace(/^https?:\/\//, ''), href: card.website.startsWith('http') ? card.website : `https://${card.website}` },
    ].filter(Boolean) as { key: string; icon: React.ReactNode; label: string; href: string }[]

    // What is left as a row is what the glyph cannot say: a link somebody named
    // themselves. "Book a demo" is the whole reason that row exists.
    const rows: { key: string; icon: React.ReactNode; label: string; sub?: string; href: string }[] =
      isPro ? links.map(l => ({ key: `link${l.index}`, icon: <ExternalLink className="w-4 h-4" />, label: l.title, href: l.url })) : []

    // 46px, and a soft chip in whatever reads on the rail, so they look like
    // the buttons they are rather than decoration printed on the sidebar.
    const socialChip: React.CSSProperties = {
      width: 46, height: 46, borderRadius: '50%', display: 'grid', placeItems: 'center',
      color: onRail, textDecoration: 'none', flexShrink: 0,
      background: onRail === '#ffffff' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
    }
    // socialLinks is shared by every template and hands its glyphs down at
    // w-4, so the size is set here on the chip rather than at the source.
    const CHIP_GLYPH = '[&_svg]:w-5 [&_svg]:h-5'

    return (
      <div style={{ ...pageStyle, minHeight: '100vh' }} className="animate-fade-up">
        <InAppBackButton bgMode={design.bgMode} />

        <div style={{ ...column, position: 'relative' }}>
          {/* The rail. Absolute and stretched, so it ends exactly where this
              wrapper does - which is the line just above the gallery. */}
          <div aria-hidden style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: railW,
            background: railBg,
          }} />

          {/* Photo in the rail, name beside it - the same arrangement Split
              has. paddingTop clears the app's back button, which is fixed 12px
              from the top and 40px tall. */}
          <div style={{
            position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 0,
            padding: 'calc(env(safe-area-inset-top, 0px) + 64px) 20px 14px 0',
          }}>
            {/* Photo, then the socials directly under it. */}
            <div style={{ width: railW, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              {/* marginBottom, not a bigger gap: the breathing room belongs
                  between the photo and the run of chips, not between every
                  chip in it. */}
              <Avatar {...shared} size={56} rounded="full" extraStyle={{
                width: avatarSize, height: avatarSize, aspectRatio: '1 / 1',
                border: design.profileBorder === false ? 'none' : `3px solid ${onRail === '#ffffff' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)'}`,
                backgroundColor: bg.page, marginBottom: 12,
              }} />
              {railIcons.map(r => (
                <a key={r.key} href={r.href}
                  target={r.href.startsWith('http') ? '_blank' : undefined}
                  rel={r.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  aria-label={r.label} title={r.label} style={socialChip} className={CHIP_GLYPH}>
                  {r.icon}
                </a>
              ))}
              {/* How to reach them, then where to find them. One hairline so
                  the two groups do not read as one long undifferentiated run. */}
              {railIcons.length > 0 && socialLinks.length > 0 && (
                <div style={{
                  width: 22, height: 1, margin: '2px 0',
                  background: onRail === '#ffffff' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.25)',
                }} />
              )}
              {socialLinks.map(s => (
                <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer"
                  aria-label={s.platform} title={s.platform} style={socialChip} className={CHIP_GLYPH}>
                  {s.icon}
                </a>
              ))}
            </div>
            {/* Centred: the name block and the bio read as the front of the
                card, not as a caption running off the photo. paddingLeft so
                the bio and the link buttons clear the rail instead of butting
                straight up against its edge. */}
            <div style={{ flex: 1, minWidth: 0, textAlign: 'center', paddingLeft: 20 }}>
              <h1 style={{ margin: '0 0 4px', fontSize: calcNameSize(26, design), fontWeight: 800, fontFamily: font.heading, color: getNameColor(design, bg.text) }}>{card.name}</h1>
              {isPro && card.title && <p style={{ margin: '0 0 3px', fontSize: calcTitleSize(12, design), fontWeight: 600, color: getTitleColor(design, accentHex), textTransform: 'uppercase', letterSpacing: '0.07em' }}>{card.title}</p>}
              {card.company && <p style={{ margin: '0 0 14px', fontSize: calcCompanySize(13, design), color: getCompanyColor(design, bg.subtext) }}>{card.company}</p>}
              <LogoZone {...shared} />
              {card.bio && <p className="leading-relaxed" style={{ margin: 0, fontSize: calcBioSize(14, design), color: getBioColor(design, bg.subtext) }}>{card.bio}</p>}

              {/* Inside the content column, not in a block underneath it.
                  The rail now holds nine chips and the header holds four lines,
                  so a block below the pair started level with the BOTTOM of the
                  rail - a screen of empty space between the bio and the first
                  link. Here they flow straight on under the bio while the chips
                  run down beside them. */}
              {rows.length > 0 && (
                <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rows.map(r => (
                    <a key={r.key} href={r.href}
                      target={r.href.startsWith('http') ? '_blank' : undefined}
                      rel={r.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '12px 14px', minHeight: 44, textDecoration: 'none',
                        fontSize: bodySize, fontWeight: 600, color: bg.text,
                        border: `1px solid ${accentHex}`, borderRadius: 12,
                        background: cardEffect.surfaceBg, backdropFilter: cardEffect.backdropFilter, WebkitBackdropFilter: cardEffect.backdropFilter, boxShadow: cardEffect.surfaceShadow,
                      }}>
                      {r.icon}
                      <span className="truncate">{r.label}</span>
                    </a>
                  ))}
                </div>
              )}

              {certifications.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center" style={{ marginTop: 16 }}>
                  {certifications.map(c => (
                    <span key={c} className="text-xs px-3 py-1.5 rounded-full"
                      style={{ backgroundColor: accentHex + '22', color: accentHex, border: `1px solid ${accentHex}44` }}>#{c}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ height: 18 }} />
        </div>

        {/* Closes the rail off across the whole card, the same way Split
            finishes its band: the accent at full strength, edge to edge, so
            the sidebar ends on a line rather than just stopping. */}
        <div style={{ ...column, height: 2, backgroundColor: accentHex }} />

        {/* From the gallery down, the rail is finished and the card is one
            column again. */}
        <div style={{ ...column, padding: '0 20px 28px' }}>
          <BottomSection {...bottomProps} omitAboveGallery />
        </div>
      </div>
    )
  }

  // ── Circuit ────────────────────────────────────────────────────────────
  // Two tones, a star field and a ribbon top and bottom. The signature is the
  // contact row: a ringed icon, the value, then a trace running out to a node
  // on the right edge, alternating between the two tones down the list.
  //
  // No QR block, unlike the reference this was drawn from. That was a printed
  // card, where a QR is the only way in; here the visitor is already on the
  // card and scanning it would only bring them back to where they are. The
  // share sheet at the bottom is the equivalent, and /qr is where a printable
  // one lives.
  if (design.templateId === 'circuit') {
    const companion = companionHex(accentHex)
    const GROUP = 560
    const column: React.CSSProperties = { maxWidth: GROUP, margin: '0 auto' }
    const bodySize = getBodyFontSize(design)
    const avatarSize = calcPhotoSize(124, design)
    // Room around the photo for the arcs to curl through.
    const arcBox = avatarSize + 44

    const traceRows: { key: string; icon: React.ReactNode; label: string; href: string }[] = [
      card.phone && { key: 'phone', icon: <Phone className="w-4 h-4" />, label: card.phone, href: `tel:${card.phone}` },
      isPro && card.work_phone && { key: 'work', icon: <Phone className="w-4 h-4" />, label: card.work_phone, href: `tel:${card.work_phone}` },
      card.email && { key: 'email', icon: <Mail className="w-4 h-4" />, label: card.email, href: `mailto:${card.email}` },
      isPro && card.address && { key: 'addr', icon: <MapPin className="w-4 h-4" />, label: card.address, href: `https://maps.google.com/?q=${encodeURIComponent(card.address)}` },
      card.website && { key: 'web', icon: <Globe className="w-4 h-4" />, label: card.website.replace(/^https?:\/\//, ''), href: card.website.startsWith('http') ? card.website : `https://${card.website}` },
      ...socialLinks.map(s => ({ key: s.platform, icon: s.icon, label: s.platform, href: s.url })),
    ].filter(Boolean) as { key: string; icon: React.ReactNode; label: string; href: string }[]

    return (
      <div style={{ ...pageStyle, minHeight: '100vh' }} className="animate-fade-up">
        <InAppBackButton bgMode={design.bgMode} />

        {/* The hero owns its own overflow, so the sweeps can run off the edge
            without clipping the modals and the image viewer further down. */}
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <div aria-hidden style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: circuitMeshUrl(accentHex, companion), backgroundRepeat: 'repeat',
          }}>
            <CircuitStars companion={companion} />
            <CircuitSweep accentHex={accentHex} companion={companion} />
            <CircuitSweep accentHex={accentHex} companion={companion} flip />
          </div>

          {/* 124px at the foot: the closing sweep is 220px tall and sits at the
              base of this zone, so a short pad left the QR and the last contact
              row lying across it. */}
          <div style={{ ...column, position: 'relative', padding: 'calc(env(safe-area-inset-top, 0px) + 74px) 22px 124px' }}>
            {/* Logo one side, photo the other. The photo is the anchor of the
                whole header on the reference, so it is large and the ribbon
                arcs curl around it rather than a flat ring being drawn on. */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 26 }}>
              <div style={{ flex: 1, minWidth: 0, paddingTop: 14 }}>
                {card.company_logo_url && design.logoPosition !== 'hidden' && (
                  <img src={card.company_logo_url} alt="" style={{ height: calcLogoHeight(52, design), width: 'auto', maxWidth: '100%', objectFit: 'contain' }} />
                )}
              </div>
              {/* The arc box is bigger than the photo, and the photo is centred
                  inside it, so the arcs read as curling around it. */}
              <div style={{ position: 'relative', flexShrink: 0, width: arcBox, height: arcBox }}>
                <CircuitPhotoArc box={arcBox} accentHex={accentHex} companion={companion} />
                {/* inset 0 and grid-centred, not left/top 50% with a translate:
                    an absolutely positioned box anchored at left 50% can only
                    shrink-to-fit the half of the container to its right, which
                    squeezed a 124px photo into 78 and turned the circle into
                    an egg. */}
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                  <div style={{
                    borderRadius: '50%', padding: 3, lineHeight: 0,
                    background: `linear-gradient(135deg, ${companion} 0%, ${accentHex} 100%)`,
                    boxShadow: `0 0 26px ${companion}66`,
                  }}>
                    <Avatar {...shared} size={avatarSize} rounded="full" extraStyle={{
                      width: avatarSize, height: avatarSize, aspectRatio: '1 / 1',
                      border: `3px solid ${bg.page}`, backgroundColor: bg.page, display: 'block',
                    }} />
                  </div>
                </div>
              </div>
            </div>

            <h1 style={{
              margin: '0 0 4px', fontSize: calcNameSize(30, design), fontWeight: 800, fontFamily: font.heading,
              textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.1,
              color: getNameColor(design, accentHex),
            }}>{card.name}</h1>
            {/* The title sits in the accent alongside the name, not in the
                companion. On the reference both lines are the same warm tone;
                splitting them meant a blue accent put a salmon subtitle under
                a blue name, and the pair fought. The companion earns its keep
                in the ribbon, the arcs, the traces and the QR frame. */}
            {isPro && card.title && (
              <p style={{
                margin: '0 0 6px', fontSize: calcTitleSize(15, design), fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: getTitleColor(design, accentHex), opacity: 0.85,
              }}>{card.title}</p>
            )}
            {card.company && (
              <p style={{ margin: '0 0 4px', fontSize: calcCompanySize(14, design), color: getCompanyColor(design, bg.subtext) }}>{card.company}</p>
            )}
            {card.bio && (
              <p className="leading-relaxed" style={{ margin: '12px 0 0', fontSize: calcBioSize(14, design), color: getBioColor(design, bg.subtext) }}>{card.bio}</p>
            )}

            {/* The traces. Every row is drawn the same way - accent at the
                icon running to companion at the node - rather than alternating
                the whole row between the two tones, which made every second
                line look like a warning rather than a design. What alternates
                is the direction of the step, which is what gives a circuit
                board its character.
                The line is aria-hidden decoration; the row is the link, and
                the label is what a screen reader reads. */}
            <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {traceRows.map((r, i) => (
                <a key={r.key} href={r.href}
                  target={r.href.startsWith('http') ? '_blank' : undefined}
                  rel={r.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, textDecoration: 'none' }}>
                  <span style={{
                    width: 44, height: 44, flexShrink: 0, borderRadius: '50%',
                    display: 'grid', placeItems: 'center',
                    border: `1.5px solid ${accentHex}`, color: accentHex,
                    backgroundColor: accentHex + '1f', boxShadow: `0 0 14px ${accentHex}44`,
                  }}>{r.icon}</span>
                  <span className="truncate" style={{ fontSize: bodySize + 2, fontWeight: 500, color: bg.text, maxWidth: '56%' }}>{r.label}</span>
                  <CircuitTrace up={i % 2 === 0} from={accentHex} to={companion} />
                  <span aria-hidden style={{
                    width: 8, height: 8, flexShrink: 0, borderRadius: '50%',
                    backgroundColor: companion, boxShadow: `0 0 10px ${companion}`,
                  }} />
                </a>
              ))}
            </div>

            {/* Book on the left, scan on the right, as on the reference. The
                booking button is lifted out of BottomSection rather than added
                beside it - two Book buttons on one card is worse than none. */}
            {(isPro || card.slug) && (
              <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
                {isPro && (
                  <div style={{ flex: '1 1 180px', minWidth: 160 }}>
                    <p style={{
                      margin: '0 0 10px', fontSize: 15, fontWeight: 800, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: accentHex,
                    }}>Schedule a chat</p>
                    <CircuitBookButton card={card} accentHex={accentHex} companion={companion} />
                  </div>
                )}
                {card.slug && (
                  <CircuitQR slug={card.slug} accentHex={accentHex} companion={companion}
                    label="Scan to connect" logoUrl={card.company_logo_url} />
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ ...column, padding: '4px 22px 28px' }}>
          <BottomSection {...bottomProps} omitBooking />
        </div>
      </div>
    )
  }

  // ── Meridian ───────────────────────────────────────────────────────────
  // The corporate one, and the only template in the set that treats the
  // photograph as the design rather than as an avatar. Everything else here
  // crops a person into a circle and sets them beside their name; this runs
  // the portrait full bleed, fades it into the page, and lays the name over
  // the bottom of it. That is how a firm photographs its partners for an
  // annual report, and it is the whole reason to pick this one.
  //
  // No ornament anywhere: no glow, no pattern, no frame. The weight comes
  // from the photograph, the size of the name and the space around it.
  if (design.templateId === 'meridian') {
    const GROUP = 560
    const column: React.CSSProperties = { maxWidth: GROUP, margin: '0 auto' }
    const bodySize = getBodyFontSize(design)

    // Labelled tiles, not icon buttons. A label above the value is how a
    // dossier or a company profile sets out particulars, and it lets the
    // values keep the whole width of their tile.
    const tiles: { key: string; label: string; value: string; href: string; icon: React.ReactNode }[] = [
      card.phone && { key: 'tel', label: 'Telephone', value: card.phone, href: `tel:${card.phone}`, icon: <Phone className="w-3.5 h-3.5" /> },
      isPro && card.work_phone && { key: 'dir', label: 'Direct', value: card.work_phone, href: `tel:${card.work_phone}`, icon: <Phone className="w-3.5 h-3.5" /> },
      card.email && { key: 'eml', label: 'Email', value: card.email, href: `mailto:${card.email}`, icon: <Mail className="w-3.5 h-3.5" /> },
      isPro && card.address && { key: 'off', label: 'Office', value: card.address, href: `https://maps.google.com/?q=${encodeURIComponent(card.address)}`, icon: <MapPin className="w-3.5 h-3.5" /> },
      card.website && { key: 'web', label: 'Website', value: card.website.replace(/^https?:\/\//, '').replace(/\/$/, ''), href: card.website.startsWith('http') ? card.website : `https://${card.website}`, icon: <Globe className="w-3.5 h-3.5" /> },
    ].filter(Boolean) as { key: string; label: string; value: string; href: string; icon: React.ReactNode }[]

    // Short values pair up, long ones take a whole row. Laid out short-first
    // so the grid packs with no holes: in source order a full-width Office
    // between Email and Website left a gap beside each of them. grid-auto-flow
    // dense would also fill it, but by moving tiles past each other visually
    // while the tab order stayed put, which is a worse trade than reordering.
    const isWide = (v: string) => v.length > 20
    const ordered = [...tiles.filter(t => !isWide(t.value)), ...tiles.filter(t => isWide(t.value))]

    const label: React.CSSProperties = {
      display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
      textTransform: 'uppercase', color: bg.subtext, marginBottom: 5,
    }

    return (
      <div style={{ ...pageStyle, minHeight: '100vh' }} className="animate-fade-up">
        <InAppBackButton bgMode={design.bgMode} />

        <div style={{ ...column, position: 'relative' }}>
          {/* The hero runs to the top edge, so nothing can be padded down from
              it to clear the app's back button. The logo goes to the right
              instead, which is the corner the button never occupies.

              Profile photo size drives the height of the hero here, since
              there is no avatar to make bigger. calcPhotoSize(80) is the
              height as a percentage of the width, so the default is a wide
              head-and-shoulders crop, 60% is a slim band and 160% is a tall
              portrait. The vh clamp scales with it and then stops at 72, so
              the far end of the slider still leaves something on screen below
              the fold rather than a full page of photograph.

              80, down from 4:5 and then from square. A 4:5 hero is 469px on a
              375 phone and square is 375, and both spend more of the first
              screen on the photograph than on anything the card is for. At 80
              it is 300px, a bit over a third, and the name, the bio and the
              first contacts are all in view without scrolling. The top of the
              slider still reaches a full portrait for anyone who wants one. */}
          <div style={{
            position: 'relative', width: '100%',
            aspectRatio: 100 / calcPhotoSize(80, design),
            maxHeight: `${Math.min(72, Math.round(calcPhotoSize(44, design)))}vh`,
            overflow: 'hidden', backgroundColor: bg.card,
          }}>
            {card.profile_image_url ? (
              // 50% 18%, not centred: a portrait centred on its own box puts
              // the crop through the chin on anything taller than it is wide.
              //
              // Photo zoom scales the subject inside the frame. Profile photo
              // size only changes how tall the frame is, and because the image
              // always fills the width, that moves the crop without ever
              // making the person any bigger - which reads as the name sliding
              // up and down and nothing else. This is the control that makes
              // them larger. Floored at 1: below that a cover-cropped image
              // pulls away from the frame and leaves gaps down the sides.
              // The origin matches objectPosition so the face stays put as it
              // scales rather than drifting out of frame.
              <img src={card.profile_image_url} alt={card.name || ''}
                style={{
                  width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 18%',
                  transform: `scale(${Math.max(1, (design.boldImageZoom ?? 100) / 100)})`,
                  transformOrigin: '50% 18%',
                }} />
            ) : (
              <div style={{
                width: '100%', height: '100%', display: 'grid', placeItems: 'center',
                background: `linear-gradient(150deg, ${accentHex}44 0%, ${bg.card} 55%, ${bg.page} 100%)`,
              }}>
                <span style={{
                  fontFamily: font.heading, fontSize: calcPhotoSize(96, design), fontWeight: 300,
                  letterSpacing: '0.06em', color: accentHex, opacity: 0.9,
                }}>{initialsOf(card.name)}</span>
              </div>
            )}

            {/* Fades the photograph into the page so the name sits on solid
                ground. Two layers, and the order matters.

                The first is measured in pixels from the bottom, because the
                name block is a fixed height and the hero is not: with only a
                percentage fade, shrinking the hero with the photo size slider
                moved the name up into the part of the picture the scrim had
                barely touched, and at 60% it was grey on grey. 150px always
                covers the kicker, the name and the company line whatever the
                hero is doing.

                The second is the soft blend over the whole picture.

                Both end on bg.page exactly, not on black: on a light card a
                black scrim would band across the bottom of the photograph. */}
            <div aria-hidden style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(to top, ${bg.page} 0px, ${bg.page}e8 58px, ${bg.page}00 150px), `
                + `linear-gradient(to bottom, ${bg.page}00 30%, ${bg.page}70 68%, ${bg.page}c0 100%)`,
            }} />

            {card.company_logo_url && design.logoPosition !== 'hidden' && (
              <img src={card.company_logo_url} alt="" style={{
                position: 'absolute', right: 22, top: 'calc(env(safe-area-inset-top, 0px) + 20px)',
                height: calcLogoHeight(38, design), width: 'auto', maxWidth: '45%', objectFit: 'contain',
              }} />
            )}

            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 24px 20px' }}>
              {isPro && card.title && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span aria-hidden style={{ width: 26, height: 2, backgroundColor: accentHex, flexShrink: 0 }} />
                  <span style={{
                    fontSize: calcTitleSize(11, design), fontWeight: 700, letterSpacing: '0.16em',
                    textTransform: 'uppercase', color: getTitleColor(design, accentHex),
                  }}>{card.title}</span>
                </div>
              )}
              <h1 style={{
                margin: 0, fontFamily: font.heading,
                fontSize: calcNameSize(38, design), fontWeight: 700,
                letterSpacing: '-0.025em', lineHeight: 1.02,
                color: getNameColor(design, bg.text),
              }}>{card.name}</h1>
              {card.company && (
                <p style={{
                  margin: '10px 0 0', fontSize: calcCompanySize(15, design),
                  color: getCompanyColor(design, bg.subtext),
                }}>{card.company}</p>
              )}
            </div>
          </div>

          <div style={{ padding: '4px 24px 26px' }}>
            {/* The bio in a block of its own, labelled and ruled down the
                accent edge, so it reads as a statement rather than a caption
                left floating between the photograph and the grid. Same
                border, radius and surface as the contact tiles, so the page
                below the hero is one system: the accent edge is what marks
                it as the one block that is prose and not a field. */}
            {card.bio && (
              <div style={{
                marginBottom: 26, padding: '14px 16px',
                border: `1px solid ${bg.border}`, borderLeft: `3px solid ${accentHex}`,
                borderRadius: 10, background: cardEffect.surfaceBg, backdropFilter: cardEffect.backdropFilter, WebkitBackdropFilter: cardEffect.backdropFilter, boxShadow: cardEffect.surfaceShadow,
              }}>
                <span style={label}>About</span>
                <p className="leading-relaxed" style={{
                  margin: 0, fontSize: calcBioSize(15, design),
                  color: getBioColor(design, bg.subtext),
                }}>{card.bio}</p>
              </div>
            )}

            {/* Two columns, with the long values taking a whole row. A street
                address crushed into half a phone's width truncates to nothing,
                and a grid where every tile is full width is just a list with
                boxes round it. 1 / -1 spans whatever the column count happens
                to be, so this holds at any width without a media query. */}
            {tiles.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                {ordered.map(t => (
                  <a key={t.key} href={t.href}
                    target={t.href.startsWith('http') ? '_blank' : undefined}
                    rel={t.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    style={{
                      display: 'block', padding: '13px 15px', minHeight: 64,
                      border: `1px solid ${bg.border}`, borderRadius: 10,
                      background: cardEffect.surfaceBg, backdropFilter: cardEffect.backdropFilter, WebkitBackdropFilter: cardEffect.backdropFilter, boxShadow: cardEffect.surfaceShadow, textDecoration: 'none',
                      ...(isWide(t.value) ? { gridColumn: '1 / -1' } : {}),
                    }}>
                    <span style={label}>
                      <span style={{ display: 'inline-flex', verticalAlign: '-2px', marginRight: 7, color: accentHex }}>{t.icon}</span>
                      {t.label}
                    </span>
                    <span className="truncate" style={{ display: 'block', fontSize: bodySize, fontWeight: 500, color: bg.text }}>{t.value}</span>
                  </a>
                ))}
              </div>
            )}

            {socialLinks.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
                {socialLinks.map(s => (
                  <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer"
                    aria-label={s.platform} title={s.platform}
                    style={{
                      width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center',
                      border: `1px solid ${bg.border}`, background: cardEffect.surfaceBg, backdropFilter: cardEffect.backdropFilter, WebkitBackdropFilter: cardEffect.backdropFilter, boxShadow: cardEffect.surfaceShadow,
                      color: bg.text, textDecoration: 'none',
                    }}>{s.icon}</a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ ...column, padding: '0 24px 28px' }}>
          <BottomSection {...bottomProps} />
        </div>
      </div>
    )
  }

  if (design.templateId === 'neon') {
    const glow = `0 0 12px ${accentHex}66`
    return (
      <div style={{ ...pageStyle, backgroundColor: design.customBgColor || '#050510', position: 'relative', overflow: 'hidden' }} className="animate-fade-up">
        {/* The room the neon sits in: a horizon glow, a perspective grid, and a
            fine scanline wash. Previously this template was a dark page with a
            couple of coloured borders - the name said neon, the card did not. */}
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '140%', height: 260, background: `radial-gradient(ellipse at top, ${accentHex}33 0%, transparent 70%)` }} />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '38%',
            backgroundImage: `linear-gradient(${accentHex}22 1px, transparent 1px), linear-gradient(90deg, ${accentHex}22 1px, transparent 1px)`,
            backgroundSize: '44px 44px',
            transform: 'perspective(340px) rotateX(62deg)', transformOrigin: 'bottom',
            maskImage: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
            WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
          }} />
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.5,
            backgroundImage: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 3px)',
          }} />
        </div>

        <InAppBackButton bgMode={design.bgMode} />
        <button onClick={handleShare} className="fixed safe-top-3 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center" style={{ border: `1px solid ${accentHex}66`, backgroundColor: 'rgba(0,0,0,0.5)', boxShadow: `0 0 14px ${accentHex}55` }}>
          <Share2 className="w-4 h-4" style={{ color: accentHex }} />
        </button>
        <div className="max-w-md mx-auto px-6 py-8" style={{ position: 'relative' }}>
          <div className="flex items-center gap-4 mb-4" style={{ position: 'relative', zIndex: 2 }}>
            {(() => {
              const photoSize = calcPhotoSize(80, design)
              const inner = (
                <div style={{ borderRadius: '50%', overflow: 'hidden', width: photoSize, height: photoSize, backgroundColor: '#0a0a1a' }}>
                  {card.profile_image_url
                    ? <img src={card.profile_image_url} style={{ width: photoSize, height: photoSize, objectFit: 'cover' }} />
                    : <div style={{ width: photoSize, height: photoSize, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: photoSize * 0.35, fontWeight: 700, color: accentHex }}>{card.name?.[0]?.toUpperCase()}</div>}
                </div>
              )
              return design.profileBorder === false ? inner : (
                <div style={{ borderRadius: '50%', padding: 3, background: `linear-gradient(135deg, ${accentHex}, ${accentHex}44)`, boxShadow: `${glow}, 0 0 34px ${accentHex}55`, flexShrink: 0 }}>{inner}</div>
              )
            })()}
            <div className="flex-1 min-w-0" style={textNudge}>
              {/* The name is the sign. Give it the tube glow. */}
              <h1 style={{
                margin: '0 0 4px', fontSize: calcNameSize(22, design), fontWeight: 700,
                fontFamily: font.heading, color: getNameColor(design, '#e8e8ff'),
                textShadow: design.nameColor ? undefined : `0 0 6px ${accentHex}88, 0 0 22px ${accentHex}55`,
              }}>{card.name}</h1>
              {isPro && card.title && <p style={{ margin: '0 0 3px', fontSize: calcTitleSize(12, design), color: getTitleColor(design, accentHex), fontWeight: 600, textShadow: `0 0 8px ${accentHex}`, textTransform: 'uppercase', letterSpacing: '0.14em' }}>{card.title}</p>}
              {card.company && <p style={{ margin: 0, fontSize: calcCompanySize(12, design), color: getCompanyColor(design, '#6a6aa8') }}>{card.company}</p>}
            </div>
          </div>
          <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${accentHex}, transparent)`, marginBottom: 16, boxShadow: `0 0 12px ${accentHex}, 0 0 30px ${accentHex}66` }} />
          <LogoZone {...shared} />
          {card.bio && <p className="mb-6 leading-relaxed" style={{ fontSize: calcBioSize(14, design), color: getBioColor(design, '#6060a0') }}>{card.bio}</p>}
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
    const lightArea = design.customBgColor || '#f0f0ef'
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
        <button onClick={handleShare} className="fixed safe-top-3 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.9)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
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
                  <img src={card.company_logo_url} style={{ height: calcLogoHeight(60, design), maxWidth: 140, objectFit: 'contain', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 76, height: 76, border: '2px dashed rgba(255,255,255,0.3)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>
                    Your<br />Logo
                  </div>
                )}
                {card.company && <p style={{ margin: 0, fontSize: calcCompanySize(22, design), fontWeight: 800, color: getCompanyColor(design, '#ffffff'), textTransform: 'uppercase', letterSpacing: '0.04em', wordBreak: 'break-word', flex: 1, lineHeight: 1.1 }}>{card.company}</p>}
              </div>
            </div>
          </div>
          {/* Photo - absolute, sits inside the dip of the smile-curve.
              Top adjusted so the photo's centre lands where the curve
              dips lowest, giving the "wrapped by black" look from the
              user's annotated reference. */}
          <div style={{ position: 'absolute', top: 140, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
            <div style={{ width: 220, height: 220, borderRadius: '50%', overflow: 'hidden', border: design.profileBorder === false ? 'none' : `5px solid #ffffff`, boxShadow: '0 12px 36px rgba(0,0,0,0.55)' }}>
              {card.profile_image_url
                ? <img src={card.profile_image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', backgroundColor: accentHex + '44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80, fontWeight: 800, color: accentHex }}>{card.name?.[0]?.toUpperCase()}</div>}
            </div>
          </div>
          {/* Name + designation - top padding leaves room for the
              overlapping photo above. Bio renders AFTER the action arc
              below, not here. */}
          <div style={{ backgroundColor: lightArea, paddingTop: 30, paddingBottom: 0, paddingLeft: 20, paddingRight: 20, textAlign: 'center' }}>
            <h1 style={{ margin: '0 0 8px', fontSize: calcNameSize(40, design), fontWeight: 900, color: getNameColor(design, darkInk), textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.0, fontFamily: font.heading }}>{card.name}</h1>
            {isPro && card.title && <p style={{ margin: 0, fontSize: calcTitleSize(14, design), fontWeight: 700, color: getTitleColor(design, darkInk), textTransform: 'uppercase', letterSpacing: '0.22em' }}>{card.title}</p>}
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
              <p style={{ margin: 0, fontSize: calcBioSize(14, design), color: getBioColor(design, '#525252'), lineHeight: 1.7, fontStyle: 'italic' }}>{card.bio}</p>
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
      <div style={{ ...pageStyle, position: 'relative', overflow: 'hidden', background: design.customBgColor || 'linear-gradient(135deg, #fef3c7 0%, #fce7f3 25%, #e0e7ff 60%, #ccfbf1 100%)' }} className="animate-fade-up">
        {/* Decorative gradient blobs for the mesh-y feel */}
        <div style={{ position: 'absolute', top: -120, right: -80, width: 320, height: 320, borderRadius: '50%', background: `radial-gradient(circle, ${accentHex}55 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -80, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.4) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <InAppBackButton bgMode={design.bgMode} />
        <button onClick={handleShare} className="fixed safe-top-3 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md" style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}>
          <Share2 className="w-4 h-4" style={{ color: '#0f172a' }} />
        </button>
        <div className="max-w-md mx-auto px-5 py-12 relative" style={{ zIndex: 1 }}>
          {/* Single big glass card */}
          <div style={{ backgroundColor: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', border: '1px solid rgba(255,255,255,0.6)', borderRadius: 32, padding: '36px 28px', boxShadow: '0 32px 80px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <Avatar {...shared} size={120} rounded="full" extraStyle={{ border: design.profileBorder === false ? 'none' : '4px solid rgba(255,255,255,0.9)', boxShadow: '0 12px 28px rgba(0,0,0,0.15)' }} />
            </div>
            <h1 style={{ margin: '0 0 4px', fontSize: calcNameSize(28, design), fontWeight: 800, color: getNameColor(design, '#0f172a'), textAlign: 'center', fontFamily: font.heading, letterSpacing: '-0.01em' }}>{card.name}</h1>
            {isPro && card.title && <p style={{ margin: 0, fontSize: calcTitleSize(14, design), fontWeight: 600, color: getTitleColor(design, accentHex), textAlign: 'center' }}>{card.title}</p>}
            {card.company && <p style={{ margin: '4px 0 16px', fontSize: calcCompanySize(13, design), color: getCompanyColor(design, '#64748b'), textAlign: 'center' }}>{card.company}</p>}
            <LogoZone {...shared} />
            {card.bio && <p style={{ fontSize: calcBioSize(13, design), color: getBioColor(design, '#475569'), textAlign: 'center', lineHeight: 1.65, margin: '0 0 20px' }}>{card.bio}</p>}
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
    // Editorial prints straight onto the page - no panel, no glass, nothing
    // between the type and the background. Ink, rules and muted text were all
    // fixed dark, so choosing a dark background left the masthead and the name
    // near-invisible. The ink follows the paper.
    const paper = design.customBgColor || '#fafaf9'
    const darkPaper = !isLightBg(paper)
    const ink = darkPaper ? '#f5f5f4' : '#1c1917'
    const rule = darkPaper ? '#57534e' : '#a8a29e'
    const muted = darkPaper ? '#a8a29e' : '#78716c'
    return (
      <div style={{ ...pageStyle, backgroundColor: paper }} className="animate-fade-up">
        <InAppBackButton bgMode={design.bgMode} />
        <button onClick={handleShare} className="fixed safe-top-3 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: darkPaper ? 'rgba(255,255,255,0.10)' : 'rgba(28,25,23,0.08)' }}>
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
          <h1 style={{ margin: '0 0 8px', fontSize: calcNameSize(52, design), fontWeight: 900, color: getNameColor(design, ink), fontFamily: 'Georgia, "Times New Roman", serif', lineHeight: 0.95, letterSpacing: '-0.02em', textAlign: 'center' }}>{card.name}</h1>
          {isPro && card.title && <p style={{ margin: 0, fontSize: calcTitleSize(16, design), color: getTitleColor(design, muted), textAlign: 'center', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>{card.title}</p>}
          {card.company && <p style={{ margin: '4px 0 0', fontSize: calcCompanySize(13, design), color: getCompanyColor(design, muted), textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 600 }}>{card.company}</p>}
          <div style={{ width: 60, borderTop: `2px solid ${accentHex}`, margin: '24px auto' }} />
          {/* Centered portrait with serif rule */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <Avatar {...shared} size={140} rounded="full" extraStyle={{ border: design.profileBorder === false ? 'none' : `1px solid ${rule}`, boxShadow: '0 1px 0 #fff, 0 8px 24px rgba(0,0,0,0.1)' }} />
          </div>
          <LogoZone {...shared} />
          {/* Bio as a leading paragraph with drop-cap first letter */}
          {card.bio && (
            <p style={{ fontSize: calcBioSize(15, design), color: getBioColor(design, darkPaper ? '#e7e5e4' : '#3c2c20'), lineHeight: 1.75, margin: '0 0 28px', fontFamily: 'Georgia, serif', textAlign: 'justify' }}>
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
