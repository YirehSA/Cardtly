'use client'

import { useState, useMemo } from 'react'
import { parseDesign, getAccentHex } from '@/types/design'
import { Copy, Download, Check, Mail, Phone, Globe, Linkedin, Twitter, Instagram, Code } from 'lucide-react'
import { toast } from 'sonner'

export interface SignatureCard {
  id: string
  name: string
  title: string | null
  company: string | null
  email: string | null
  phone: string | null
  website: string | null
  linkedin_url: string | null
  twitter_url: string | null
  instagram_url: string | null
  profile_image_url: string | null
  company_logo_url: string | null
  color_theme: string | null
  slug: string
  // Set by the page when it merges personal and team cards into one list. The
  // component already rendered _label; it just was not declared, so the type
  // disagreed with the code on both sides of the boundary.
  _type?: string
  _label?: string
}

type Style = 'minimal' | 'modern' | 'compact' | 'bold' | 'classic' | 'stacked'

interface Props {
  cards: SignatureCard[]
  defaultCardId: string
}

export default function EmailSignatureBuilder({ cards, defaultCardId }: Props) {
  const [selectedCardId, setSelectedCardId] = useState<string>(defaultCardId)
  const card = cards.find((c: SignatureCard) => c.id === selectedCardId) || cards[0]
  const design = parseDesign(card.color_theme)
  const accentHex = getAccentHex(design)

  const [style, setStyle] = useState<Style>('modern')
  const [includePhoto, setIncludePhoto] = useState(true)
  const [includeLogo, setIncludeLogo] = useState(!!card.company_logo_url)
  const [includeQR, setIncludeQR] = useState(true)
  const [includeSocials, setIncludeSocials] = useState(true)
  const [copied, setCopied] = useState(false)

  const cardUrl = `https://cardtly.com/card/${card.slug}`
  // Served by us, not api.qrserver.com. This image ends up inside every email
  // the customer sends, so it cannot depend on a free third party still being
  // there in a year - and it should not tell anyone else that the mail was
  // opened. It also carries the ?s=qr marker, so scans from a signature are
  // counted as scans.
  const qrUrl = `https://cardtly.com/api/qr/${card.slug}?size=160`

  // ── Generate HTML ─────────────────────────────────────────────────────────
  const html = useMemo(() => {
    const socials = [
      card.linkedin_url && { label: 'LinkedIn', url: card.linkedin_url, color: '#0A66C2' },
      card.twitter_url && { label: 'X', url: card.twitter_url, color: '#000000' },
      card.instagram_url && { label: 'Instagram', url: card.instagram_url, color: '#E1306C' },
    ].filter(Boolean) as { label: string; url: string; color: string }[]

    if (style === 'minimal') {
      return `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; font-size: 14px; color: #374151;">
  <tr>
    <td style="padding-right: 16px; border-right: 3px solid ${accentHex}; vertical-align: top;">
      ${includePhoto && card.profile_image_url ? `<img src="${card.profile_image_url}" width="64" height="64" style="border-radius: 50%; display: block; object-fit: cover;" />` : ''}
    </td>
    <td style="padding-left: 16px; vertical-align: top;">
      <p style="margin: 0 0 2px; font-size: 16px; font-weight: bold; color: #111827;">${card.name}</p>
      ${card.title ? `<p style="margin: 0 0 2px; font-size: 13px; color: ${accentHex}; font-weight: 600;">${card.title}</p>` : ''}
      ${card.company ? `<p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">${card.company}</p>` : ''}
      <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.8;">
        ${card.phone ? `📞 <a href="tel:${card.phone}" style="color: #6b7280; text-decoration: none;">${card.phone}</a><br>` : ''}
        ${card.email ? `✉️ <a href="mailto:${card.email}" style="color: #6b7280; text-decoration: none;">${card.email}</a><br>` : ''}
        ${card.website ? `🌐 <a href="${card.website}" style="color: ${accentHex}; text-decoration: none;">${card.website.replace(/^https?:\/\//, '')}</a>` : ''}
      </p>
      ${includeSocials && socials.length > 0 ? `
      <p style="margin: 8px 0 0;">
        ${socials.map(s => `<a href="${s.url}" style="color: ${s.color}; text-decoration: none; font-size: 12px; font-weight: 600; margin-right: 10px;">${s.label}</a>`).join('')}
      </p>` : ''}
      ${includeQR ? `
      <p style="margin: 8px 0 0;">
        <a href="${cardUrl}" style="text-decoration: none;">
          <img src="${qrUrl}" width="60" height="60" alt="Scan to connect" style="display: block;" />
          <span style="font-size: 10px; color: #9ca3af;">Scan to connect</span>
        </a>
      </p>` : ''}
    </td>
  </tr>
</table>`
    }

    if (style === 'compact') {
      return `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; font-size: 13px;">
  <tr>
    ${includePhoto && card.profile_image_url ? `<td style="padding-right: 12px; vertical-align: middle;"><img src="${card.profile_image_url}" width="48" height="48" style="border-radius: 50%; display: block; object-fit: cover; border: 2px solid ${accentHex}44;" /></td>` : ''}
    <td style="vertical-align: middle; padding-right: 16px; border-right: 2px solid ${accentHex};">
      <p style="margin: 0; font-size: 15px; font-weight: bold; color: #111827; white-space: nowrap;">${card.name}${card.title ? ` <span style="font-weight: 400; color: ${accentHex}; font-size: 13px;">· ${card.title}</span>` : ''}</p>
      ${card.company ? `<p style="margin: 2px 0 0; font-size: 12px; color: #6b7280;">${card.company}</p>` : ''}
    </td>
    <td style="padding-left: 16px; vertical-align: middle;">
      <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.9;">
        ${card.phone ? `📞 <a href="tel:${card.phone}" style="color: #374151; text-decoration: none;">${card.phone}</a><br>` : ''}
        ${card.email ? `✉️ <a href="mailto:${card.email}" style="color: #374151; text-decoration: none;">${card.email}</a><br>` : ''}
        ${card.website ? `🌐 <a href="${card.website}" style="color: ${accentHex}; text-decoration: none; font-weight: 600;">${card.website.replace(/^https?:\/\//, '')}</a>` : ''}
      </p>
    </td>
    ${includeQR ? `<td style="padding-left: 16px; vertical-align: middle; text-align: center;"><a href="${cardUrl}" style="text-decoration: none;"><img src="${qrUrl}" width="56" height="56" style="display: block; border-radius: 6px;" /><span style="font-size: 10px; color: #9ca3af; display: block; margin-top: 2px;">Scan</span></a></td>` : ''}
  </tr>
</table>`
    }

    if (style === 'bold') {
      return `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; max-width: 480px;">
  <tr>
    <td style="background: ${accentHex}; padding: 3px 0 0; border-radius: 4px 4px 0 0;"></td>
  </tr>
  <tr>
    <td style="background: #0f172a; padding: 20px 20px 16px; border-radius: 0 0 4px 4px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          ${includePhoto && card.profile_image_url ? `<td style="vertical-align: top; padding-right: 14px; width: 64px;"><img src="${card.profile_image_url}" width="64" height="64" style="border-radius: 12px; display: block; object-fit: cover; border: 2px solid ${accentHex}66;" /></td>` : ''}
          <td style="vertical-align: top;">
            <p style="margin: 0 0 2px; font-size: 20px; font-weight: 900; color: #f8fafc; letter-spacing: -0.03em;">${card.name}</p>
            ${card.title ? `<p style="margin: 0 0 8px; font-size: 12px; font-weight: 700; color: ${accentHex}; text-transform: uppercase; letter-spacing: 0.08em;">${card.title}</p>` : ''}
            ${card.company ? `<p style="margin: 0 0 10px; font-size: 12px; color: #64748b;">${card.company}</p>` : ''}
            <table cellpadding="0" cellspacing="0" border="0">
              ${card.phone ? `<tr><td style="padding-bottom: 2px; font-size: 12px; color: #94a3b8;">📞 <a href="tel:${card.phone}" style="color: #cbd5e1; text-decoration: none;">${card.phone}</a></td></tr>` : ''}
              ${card.email ? `<tr><td style="padding-bottom: 2px; font-size: 12px; color: #94a3b8;">✉️ <a href="mailto:${card.email}" style="color: #cbd5e1; text-decoration: none;">${card.email}</a></td></tr>` : ''}
              ${card.website ? `<tr><td style="font-size: 12px;">🌐 <a href="${card.website}" style="color: ${accentHex}; text-decoration: none; font-weight: 600;">${card.website.replace(/^https?:\/\//, '')}</a></td></tr>` : ''}
            </table>
          </td>
          ${includeQR ? `<td style="vertical-align: top; padding-left: 14px; width: 72px; text-align: center;"><a href="${cardUrl}" style="text-decoration: none;"><img src="${qrUrl}" width="66" height="66" style="display: block; border-radius: 8px; filter: invert(1);" /><span style="font-size: 10px; color: #64748b; display: block; margin-top: 3px;">Scan</span></a></td>` : ''}
        </tr>
      </table>
      ${includeLogo && card.company_logo_url ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 12px; border-top: 1px solid #1e293b; padding-top: 10px;"><tr><td><img src="${card.company_logo_url}" height="28" style="display: block; object-fit: contain; filter: brightness(0) invert(1); opacity: 0.7;" /></td></tr></table>` : ''}
    </td>
  </tr>
</table>`
    }

    // Understated: a single accent rule down the left, everything stacked.
    // The one that suits accountants, attorneys and anyone whose signature
    // should not look like an advert.
    if (style === 'classic') {
      return `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Georgia, 'Times New Roman', serif; font-size: 13px; color: #1f2937;">
  <tr>
    <td style="border-left: 3px solid ${accentHex}; padding: 2px 0 2px 14px;">
      <p style="margin: 0 0 1px; font-size: 17px; font-weight: bold; color: #111827; letter-spacing: 0.01em;">${card.name}</p>
      ${card.title ? `<p style="margin: 0 0 1px; font-size: 12px; color: #4b5563; font-style: italic;">${card.title}</p>` : ''}
      ${card.company ? `<p style="margin: 0 0 9px; font-size: 12px; font-weight: bold; color: ${accentHex}; text-transform: uppercase; letter-spacing: 0.08em;">${card.company}</p>` : ''}
      <table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif;">
        ${card.phone ? `<tr><td style="font-size: 11px; color: #6b7280; padding-right: 8px;">T</td><td style="font-size: 12px; padding-bottom: 2px;"><a href="tel:${card.phone}" style="color: #374151; text-decoration: none;">${card.phone}</a></td></tr>` : ''}
        ${card.email ? `<tr><td style="font-size: 11px; color: #6b7280; padding-right: 8px;">E</td><td style="font-size: 12px; padding-bottom: 2px;"><a href="mailto:${card.email}" style="color: #374151; text-decoration: none;">${card.email}</a></td></tr>` : ''}
        ${card.website ? `<tr><td style="font-size: 11px; color: #6b7280; padding-right: 8px;">W</td><td style="font-size: 12px;"><a href="${card.website}" style="color: ${accentHex}; text-decoration: none;">${card.website.replace(/^https?:\/\//, '')}</a></td></tr>` : ''}
      </table>
      ${includeSocials && socials.length > 0 ? `
      <p style="margin: 9px 0 0; font-family: Arial, sans-serif;">
        ${socials.map(s => `<a href="${s.url}" style="color: ${s.color}; text-decoration: none; font-size: 11px; font-weight: bold; margin-right: 12px;">${s.label}</a>`).join('')}
      </p>` : ''}
      ${(includeLogo && card.company_logo_url) || includeQR ? `
      <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 10px;">
        <tr>
          ${includeLogo && card.company_logo_url ? `<td style="padding-right: 12px; vertical-align: middle;"><img src="${card.company_logo_url}" height="26" style="display: block; object-fit: contain;" alt="${card.company || ''}" /></td>` : ''}
          ${includeQR ? `<td style="vertical-align: middle;"><a href="${cardUrl}"><img src="${qrUrl}" width="48" height="48" alt="Scan to connect" style="display: block;" /></a></td>` : ''}
        </tr>
      </table>` : ''}
    </td>
  </tr>
</table>`
    }

    // Everything centred in one narrow column. Built for phones, where the
    // side-by-side layouts get squeezed into an unreadable mess.
    if (style === 'stacked') {
      return `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; max-width: 300px; text-align: center;">
  ${includeLogo && card.company_logo_url ? `
  <tr>
    <td style="text-align: center; padding-bottom: 10px;">
      <img src="${card.company_logo_url}" height="30" style="display: inline-block; object-fit: contain;" alt="${card.company || ''}" />
    </td>
  </tr>` : ''}
  ${includePhoto && card.profile_image_url ? `
  <tr>
    <td style="text-align: center; padding-bottom: 8px;">
      <img src="${card.profile_image_url}" width="72" height="72" style="border-radius: 50%; display: inline-block; object-fit: cover; border: 3px solid ${accentHex}33;" />
    </td>
  </tr>` : ''}
  <tr>
    <td style="text-align: center;">
      <p style="margin: 0 0 2px; font-size: 17px; font-weight: bold; color: #111827;">${card.name}</p>
      ${card.title ? `<p style="margin: 0 0 2px; font-size: 12px; font-weight: 600; color: ${accentHex};">${card.title}</p>` : ''}
      ${card.company ? `<p style="margin: 0 0 10px; font-size: 12px; color: #6b7280;">${card.company}</p>` : ''}
      <div style="height: 2px; width: 40px; background: ${accentHex}; margin: 0 auto 10px;"></div>
      <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.9;">
        ${card.phone ? `<a href="tel:${card.phone}" style="color: #374151; text-decoration: none;">${card.phone}</a><br>` : ''}
        ${card.email ? `<a href="mailto:${card.email}" style="color: #374151; text-decoration: none;">${card.email}</a><br>` : ''}
        ${card.website ? `<a href="${card.website}" style="color: ${accentHex}; text-decoration: none; font-weight: 600;">${card.website.replace(/^https?:\/\//, '')}</a>` : ''}
      </p>
      ${includeSocials && socials.length > 0 ? `
      <p style="margin: 9px 0 0;">
        ${socials.map(s => `<a href="${s.url}" style="display: inline-block; background: ${s.color}; color: #fff; font-size: 11px; font-weight: bold; padding: 3px 10px; border-radius: 20px; text-decoration: none; margin: 0 3px;">${s.label}</a>`).join('')}
      </p>` : ''}
      ${includeQR ? `
      <p style="margin: 12px 0 0;">
        <a href="${cardUrl}" style="text-decoration: none;">
          <img src="${qrUrl}" width="64" height="64" alt="Scan to connect" style="display: inline-block;" />
          <span style="font-size: 10px; color: #9ca3af; display: block; margin-top: 3px;">Scan to connect</span>
        </a>
      </p>` : ''}
    </td>
  </tr>
</table>`
    }


    // Modern style
    return `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; max-width: 500px;">
  <tr>
    <td style="background: linear-gradient(135deg, ${accentHex}22, ${accentHex}08); border-radius: 12px; padding: 16px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          ${includePhoto && card.profile_image_url ? `
          <td style="vertical-align: top; padding-right: 14px; width: 72px;">
            <img src="${card.profile_image_url}" width="72" height="72" style="border-radius: 50%; display: block; object-fit: cover; border: 3px solid ${accentHex}44;" />
          </td>` : ''}
          <td style="vertical-align: top;">
            <p style="margin: 0 0 2px; font-size: 17px; font-weight: bold; color: #111827;">${card.name}</p>
            ${card.title ? `<p style="margin: 0 0 2px; font-size: 13px; color: ${accentHex}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">${card.title}</p>` : ''}
            ${card.company ? `<p style="margin: 0 0 10px; font-size: 13px; color: #6b7280;">${card.company}</p>` : ''}
            <table cellpadding="0" cellspacing="0" border="0">
              ${card.phone ? `<tr><td style="padding-bottom: 3px; font-size: 12px; color: #6b7280;">📞&nbsp;<a href="tel:${card.phone}" style="color: #374151; text-decoration: none;">${card.phone}</a></td></tr>` : ''}
              ${card.email ? `<tr><td style="padding-bottom: 3px; font-size: 12px; color: #6b7280;">✉️&nbsp;<a href="mailto:${card.email}" style="color: #374151; text-decoration: none;">${card.email}</a></td></tr>` : ''}
              ${card.website ? `<tr><td style="padding-bottom: 3px; font-size: 12px;">🌐&nbsp;<a href="${card.website}" style="color: ${accentHex}; text-decoration: none; font-weight: 600;">${card.website.replace(/^https?:\/\//, '')}</a></td></tr>` : ''}
            </table>
            ${includeSocials && socials.length > 0 ? `
            <p style="margin: 8px 0 0;">
              ${socials.map(s => `<a href="${s.url}" style="display: inline-block; background: ${s.color}; color: #fff; font-size: 11px; font-weight: bold; padding: 3px 10px; border-radius: 20px; text-decoration: none; margin-right: 5px;">${s.label}</a>`).join('')}
            </p>` : ''}
          </td>
          ${includeQR ? `
          <td style="vertical-align: top; padding-left: 14px; text-align: center; width: 80px;">
            <a href="${cardUrl}" style="text-decoration: none;">
              <img src="${qrUrl}" width="72" height="72" alt="Scan to connect" style="display: block; border-radius: 8px;" />
              <span style="font-size: 10px; color: #9ca3af; display: block; margin-top: 3px;">Scan to connect</span>
            </a>
          </td>` : ''}
        </tr>
      </table>
      ${includeLogo && card.company_logo_url ? `
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 12px; border-top: 1px solid ${accentHex}22; padding-top: 10px;">
        <tr>
          <td>
            <img src="${card.company_logo_url}" height="32" style="display: block; object-fit: contain;" alt="${card.company || ''}" />
          </td>
        </tr>
      </table>` : ''}
    </td>
  </tr>
</table>`
  }, [style, includePhoto, includeLogo, includeQR, includeSocials, accentHex, card, cardUrl, qrUrl])

  // What lands anywhere that cannot accept rich content, so the fallback is a
  // readable signature rather than a page of markup.
  const plainText = useMemo(() => [
    card.name,
    [card.title, card.company].filter(Boolean).join(', '),
    card.phone,
    card.email,
    card.website,
    cardUrl,
  ].filter(Boolean).join('\n'), [card, cardUrl])

  // Copy the signature ITSELF, not its source code.
  //
  // This used to writeText the raw HTML, so pasting into Gmail gave you a wall
  // of <table> markup rather than a signature - which is why the instructions
  // told people to download a file, open it in a browser, select it and copy
  // from there. Putting a text/html flavour on the clipboard makes one click
  // paste a formatted signature straight into Gmail, Outlook or Apple Mail.
  async function copySignature() {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        // Plain-text fallback for anywhere that cannot take rich content.
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      })
      await navigator.clipboard.write([item])
      setCopied(true)
      toast.success('Signature copied. Paste it into your email settings.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Older browsers, or a page without clipboard permission: fall back to
      // the old behaviour rather than failing, and say what was copied.
      try {
        await navigator.clipboard.writeText(html)
        setCopied(true)
        toast.success('Copied the HTML code. Use the paste-as-code option in your email settings.')
        setTimeout(() => setCopied(false), 2000)
      } catch {
        toast.error('Could not copy. Try the download button instead.')
      }
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(html)
      toast.success('HTML code copied')
    } catch {
      toast.error('Could not copy the code')
    }
  }

  function downloadHTML() {
    const blob = new Blob([html], { type: 'text/html' })
    const link = document.createElement('a')
    link.download = `${card.name.replace(/\s+/g, '-')}-email-signature.html`
    link.href = URL.createObjectURL(blob)
    link.click()
    toast.success('Signature downloaded')
  }

  // ── Live preview styles (approximate — email clients render differently) ──
  const socials = [
    card.linkedin_url && { label: 'LinkedIn', url: card.linkedin_url, color: '#0A66C2', icon: <Linkedin className="w-3 h-3" /> },
    card.twitter_url && { label: 'X', url: card.twitter_url, color: '#000000', icon: <Twitter className="w-3 h-3" /> },
    card.instagram_url && { label: 'Instagram', url: card.instagram_url, color: '#E1306C', icon: <Instagram className="w-3 h-3" /> },
  ].filter(Boolean) as { label: string; url: string; color: string; icon: React.ReactNode }[]

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl grid place-items-center text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold leading-tight">Your email signature</h1>
              <p className="text-muted-foreground text-sm">
                Every email you send becomes a way to save your card.
              </p>
            </div>
          </div>
        </div>
        {cards.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Card:</label>
            <select
              value={selectedCardId}
              onChange={e => setSelectedCardId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition min-w-[200px]">
              {cards.map(c => (
                <option key={c.id} value={c.id}>{c._label || c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Left — options */}
        <div className="space-y-6">

          {/* Style picker */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <label className="block text-sm font-semibold mb-3">Style</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { id: 'modern'  as Style, label: 'Modern',  desc: 'Card with gradient background' },
                { id: 'minimal' as Style, label: 'Minimal', desc: 'Clean with accent divider' },
                { id: 'compact' as Style, label: 'Compact', desc: 'Single line, space efficient' },
                { id: 'bold'    as Style, label: 'Bold',    desc: 'Large name, strong accent' },
                { id: 'classic' as Style, label: 'Classic', desc: 'Serif, understated, formal' },
                { id: 'stacked' as Style, label: 'Stacked', desc: 'Centred column, best on phones' },
              ]).map(({ id, label, desc }) => (
                <button key={id} onClick={() => setStyle(id)}
                  className={`p-3 rounded-xl border-2 text-left transition ${style === id ? 'border-blue-500 bg-blue-500/10' : 'border-border hover:border-foreground/20'}`}>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Include toggles */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <label className="block text-sm font-semibold mb-3">Include</label>
            <div className="space-y-3">
              {[
                { id: 'photo', label: 'Profile photo', enabled: includePhoto, set: setIncludePhoto, disabled: !card.profile_image_url },
                { id: 'logo', label: 'Company logo', enabled: includeLogo, set: setIncludeLogo, disabled: !card.company_logo_url },
                { id: 'socials', label: 'Social links', enabled: includeSocials, set: setIncludeSocials, disabled: socials.length === 0 },
                { id: 'qr', label: 'QR code', enabled: includeQR, set: setIncludeQR, disabled: false },
              ].map(({ id, label, enabled, set, disabled }) => (
                <div key={id} className={`flex items-center justify-between ${disabled ? 'opacity-40' : ''}`}>
                  <span className="text-sm">{label}</span>
                  <button
                    onClick={() => !disabled && set(!enabled)}
                    disabled={disabled}
                    className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors flex-shrink-0 ${enabled && !disabled ? 'bg-blue-500' : 'bg-muted'}`}>
                    <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled && !disabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions. Copying the signature itself is the main path now, so it
              is the big button and the code is tucked behind a small one. */}
          <div className="space-y-2">
            <button onClick={copySignature}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied - now paste it' : 'Copy my signature'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={copyCode}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm border border-border hover:bg-muted transition">
                <Code className="w-4 h-4" />
                Copy the code
              </button>
              <button onClick={downloadHTML}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm border border-border hover:bg-muted transition">
                <Download className="w-4 h-4" />
                Download file
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              &ldquo;Copy my signature&rdquo; copies the finished signature, so you can paste it straight in.
              The code is only needed if your email asks for HTML.
            </p>
          </div>

          {/* Install instructions */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-sm font-semibold mb-3">How to install</p>
            <div className="space-y-4 text-xs text-muted-foreground">
              <div>
                <p className="font-semibold text-foreground mb-1">Gmail</p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>Press <strong>Copy my signature</strong> above</li>
                  <li>In Gmail, open Settings → See all settings</li>
                  <li>Under General, scroll to Signature → Create new</li>
                  <li>Click in the box and paste (Ctrl+V, or Cmd+V on a Mac)</li>
                  <li>Scroll down and Save changes</li>
                </ol>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">Outlook</p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>Press <strong>Copy my signature</strong> above</li>
                  <li>In Outlook, go to File → Options → Mail → Signatures</li>
                  <li>Click New, give it a name</li>
                  <li>Click in the big box and paste (Ctrl+V)</li>
                  <li>Set it as your default and save</li>
                </ol>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">Apple Mail</p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>Download the HTML file</li>
                  <li>Open Mail → Preferences → Signatures</li>
                  <li>Create new signature, then locate the file at<br />
                    <code className="text-xs bg-muted px-1 rounded">~/Library/Mail/V10/MailData/Signatures/</code>
                  </li>
                  <li>Replace the signature file content with the downloaded HTML</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Right — live preview */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Preview</p>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200" style={{ overflow: "hidden" }}>

            {style === 'modern' && (
              <div style={{ background: `linear-gradient(135deg, ${accentHex}22, ${accentHex}08)`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  {includePhoto && card.profile_image_url && (
                    <img src={card.profile_image_url} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `3px solid ${accentHex}44` }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 17, fontWeight: 700, color: '#111827' }}>{card.name}</p>
                    {card.title && <p style={{ margin: '0 0 2px', fontSize: 12, color: accentHex, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.title}</p>}
                    {card.company && <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6b7280' }}>{card.company}</p>}
                    <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.8 }}>
                      {card.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone style={{ width: 11, height: 11 }} /><span style={{ color: '#374151' }}>{card.phone}</span></div>}
                      {card.email && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail style={{ width: 11, height: 11 }} /><span style={{ color: '#374151' }}>{card.email}</span></div>}
                      {card.website && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Globe style={{ width: 11, height: 11 }} /><span style={{ color: accentHex, fontWeight: 600 }}>{card.website.replace(/^https?:\/\//, '')}</span></div>}
                    </div>
                    {includeSocials && socials.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                        {socials.map(s => (
                          <span key={s.label} style={{ backgroundColor: s.color, color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                            {s.icon}{s.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {includeQR && (
                    <div style={{ flexShrink: 0, textAlign: 'center' }}>
                      <img src={qrUrl} style={{ width: 72, height: 72, borderRadius: 8, display: 'block' }} alt="QR" />
                      <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>Scan to connect</p>
                    </div>
                  )}
                </div>
                {includeLogo && card.company_logo_url && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${accentHex}22` }}>
                    <img src={card.company_logo_url} style={{ height: 28, width: 'auto', objectFit: 'contain' }} alt={card.company || ''} />
                  </div>
                )}
              </div>
            )}

            {style === 'minimal' && (
              <div style={{ display: 'flex', gap: 0 }}>
                <div style={{ borderRight: `3px solid ${accentHex}`, paddingRight: 16, marginRight: 16, flexShrink: 0, display: 'flex', alignItems: 'flex-start' }}>
                  {includePhoto && card.profile_image_url
                    ? <img src={card.profile_image_url} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
                    : <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: accentHex + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentHex, fontWeight: 700, fontSize: 16 }}>{card.name?.[0]}</div>}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 700, color: '#111827' }}>{card.name}</p>
                  {card.title && <p style={{ margin: '0 0 2px', fontSize: 12, color: accentHex, fontWeight: 600 }}>{card.title}</p>}
                  {card.company && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b7280' }}>{card.company}</p>}
                  <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.8 }}>
                    {card.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone style={{ width: 11, height: 11 }} /><span style={{ color: '#374151' }}>{card.phone}</span></div>}
                    {card.email && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail style={{ width: 11, height: 11 }} /><span style={{ color: '#374151' }}>{card.email}</span></div>}
                    {card.website && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Globe style={{ width: 11, height: 11 }} /><span style={{ color: accentHex }}>{card.website.replace(/^https?:\/\//, '')}</span></div>}
                  </div>
                  {includeSocials && socials.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      {socials.map(s => <span key={s.label} style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.label}</span>)}
                    </div>
                  )}
                  {includeQR && (
                    <div style={{ marginTop: 8 }}>
                      <img src={qrUrl} style={{ width: 56, height: 56, borderRadius: 6, display: 'block' }} alt="QR" />
                      <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>Scan to connect</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {style === 'compact' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px', flexWrap: 'wrap', overflow: 'hidden' }}>
                {includePhoto && card.profile_image_url && (
                  <img src={card.profile_image_url} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${accentHex}44` }} />
                )}
                <div style={{ paddingRight: 16, borderRight: `2px solid ${accentHex}`, marginRight: 16 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>
                    {card.name}{card.title && <span style={{ fontWeight: 400, color: accentHex, fontSize: 13 }}> · {card.title}</span>}
                  </p>
                  {card.company && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>{card.company}</p>}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.9 }}>
                  {card.phone && <div>📞 <span style={{ color: '#374151' }}>{card.phone}</span></div>}
                  {card.email && <div>✉️ <span style={{ color: '#374151' }}>{card.email}</span></div>}
                  {card.website && <div>🌐 <span style={{ color: accentHex, fontWeight: 600 }}>{card.website.replace(/^https?:\/\//, '')}</span></div>}
                </div>
                {includeQR && (
                  <div style={{ marginLeft: 12, textAlign: 'center' }}>
                    <img src={qrUrl} style={{ width: 56, height: 56, borderRadius: 6 }} alt="QR" />
                    <p style={{ fontSize: 10, color: '#9ca3af', margin: '2px 0 0' }}>Scan</p>
                  </div>
                )}
              </div>
            )}

            {style === 'bold' && (
              <div style={{ background: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ height: 4, background: accentHex }} />
                <div style={{ padding: '20px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  {includePhoto && card.profile_image_url && (
                    <img src={card.profile_image_url} style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', flexShrink: 0, border: `2px solid ${accentHex}66` }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.03em' }}>{card.name}</p>
                    {card.title && <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: accentHex, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{card.title}</p>}
                    {card.company && <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b' }}>{card.company}</p>}
                    <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.8 }}>
                      {card.phone && <div>📞 <span style={{ color: '#cbd5e1' }}>{card.phone}</span></div>}
                      {card.email && <div>✉️ <span style={{ color: '#cbd5e1' }}>{card.email}</span></div>}
                      {card.website && <div>🌐 <span style={{ color: accentHex, fontWeight: 600 }}>{card.website.replace(/^https?:\/\//, '')}</span></div>}
                    </div>
                  </div>
                  {includeQR && (
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <img src={qrUrl} style={{ width: 66, height: 66, borderRadius: 8, filter: 'invert(1)' }} alt="QR" />
                      <p style={{ fontSize: 10, color: '#64748b', margin: '3px 0 0' }}>Scan</p>
                    </div>
                  )}
                </div>
                {includeLogo && card.company_logo_url && (
                  <div style={{ margin: '0 20px 16px', paddingTop: 12, borderTop: '1px solid #1e293b' }}>
                    <img src={card.company_logo_url} style={{ height: 24, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.7 }} alt="" />
                  </div>
                )}
              </div>
            )}

            {style === 'classic' && (
              <div style={{ borderLeft: `3px solid ${accentHex}`, paddingLeft: 14, fontFamily: 'Georgia, serif' }}>
                <p style={{ margin: '0 0 1px', fontSize: 17, fontWeight: 700, color: '#111827' }}>{card.name}</p>
                {card.title && <p style={{ margin: '0 0 1px', fontSize: 12, color: '#4b5563', fontStyle: 'italic' }}>{card.title}</p>}
                {card.company && <p style={{ margin: '0 0 9px', fontSize: 12, fontWeight: 700, color: accentHex, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{card.company}</p>}
                <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 12, lineHeight: 1.7 }}>
                  {card.phone && <div><span style={{ color: '#6b7280', marginRight: 8 }}>T</span><span style={{ color: '#374151' }}>{card.phone}</span></div>}
                  {card.email && <div><span style={{ color: '#6b7280', marginRight: 8 }}>E</span><span style={{ color: '#374151' }}>{card.email}</span></div>}
                  {card.website && <div><span style={{ color: '#6b7280', marginRight: 8 }}>W</span><span style={{ color: accentHex }}>{card.website.replace(/^https?:\/\//, '')}</span></div>}
                </div>
                {includeSocials && (card.linkedin_url || card.twitter_url || card.instagram_url) && (
                  <p style={{ margin: '9px 0 0', fontFamily: 'Arial, sans-serif' }}>
                    {card.linkedin_url && <span style={{ color: '#0A66C2', fontSize: 11, fontWeight: 700, marginRight: 12 }}>LinkedIn</span>}
                    {card.twitter_url && <span style={{ color: '#000', fontSize: 11, fontWeight: 700, marginRight: 12 }}>X</span>}
                    {card.instagram_url && <span style={{ color: '#E1306C', fontSize: 11, fontWeight: 700 }}>Instagram</span>}
                  </p>
                )}
                {((includeLogo && card.company_logo_url) || includeQR) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                    {includeLogo && card.company_logo_url && <img src={card.company_logo_url} style={{ height: 26, objectFit: 'contain' }} alt="" />}
                    {includeQR && <img src={qrUrl} style={{ width: 48, height: 48 }} alt="QR" />}
                  </div>
                )}
              </div>
            )}

            {style === 'stacked' && (
              <div style={{ maxWidth: 300, margin: '0 auto', textAlign: 'center' }}>
                {includeLogo && card.company_logo_url && (
                  <img src={card.company_logo_url} style={{ height: 30, objectFit: 'contain', marginBottom: 10 }} alt="" />
                )}
                {includePhoto && card.profile_image_url && (
                  <img src={card.profile_image_url} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${accentHex}33`, marginBottom: 8 }} />
                )}
                <p style={{ margin: '0 0 2px', fontSize: 17, fontWeight: 700, color: '#111827' }}>{card.name}</p>
                {card.title && <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 600, color: accentHex }}>{card.title}</p>}
                {card.company && <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6b7280' }}>{card.company}</p>}
                <div style={{ height: 2, width: 40, background: accentHex, margin: '0 auto 10px' }} />
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.9 }}>
                  {card.phone && <div style={{ color: '#374151' }}>{card.phone}</div>}
                  {card.email && <div style={{ color: '#374151' }}>{card.email}</div>}
                  {card.website && <div style={{ color: accentHex, fontWeight: 600 }}>{card.website.replace(/^https?:\/\//, '')}</div>}
                </div>
                {includeSocials && (card.linkedin_url || card.twitter_url || card.instagram_url) && (
                  <p style={{ margin: '9px 0 0' }}>
                    {card.linkedin_url && <span style={{ display: 'inline-block', background: '#0A66C2', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, margin: '0 3px' }}>LinkedIn</span>}
                    {card.twitter_url && <span style={{ display: 'inline-block', background: '#000', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, margin: '0 3px' }}>X</span>}
                  </p>
                )}
                {includeQR && (
                  <div style={{ marginTop: 12 }}>
                    <img src={qrUrl} style={{ width: 64, height: 64 }} alt="QR" />
                    <p style={{ fontSize: 10, color: '#9ca3af', margin: '3px 0 0' }}>Scan to connect</p>
                  </div>
                )}
              </div>
            )}

          </div>

                    <p className="text-xs text-muted-foreground mt-3 text-center">
            Preview is approximate — email clients may render slightly differently
          </p>
        </div>
      </div>
    </div>
  )
}
