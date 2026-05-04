'use client'

import { useState, useMemo } from 'react'
import { parseDesign, getAccentHex } from '@/types/design'
import { Copy, Download, Check, Mail, Phone, Globe, Linkedin, Twitter, Instagram } from 'lucide-react'
import { toast } from 'sonner'

interface Card {
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
}

type Style = 'minimal' | 'modern' | 'compact' | 'bold'

interface Props {
  cards: Card[]
  defaultCardId: string
}

export default function EmailSignatureBuilder({ cards, defaultCardId }: Props) {
  const [selectedCardId, setSelectedCardId] = useState<string>(defaultCardId)
  const card = cards.find(c => c.id === selectedCardId) || cards[0]
  const design = parseDesign(card.color_theme)
  const accentHex = getAccentHex(design)

  const [style, setStyle] = useState<Style>('modern')
  const [includePhoto, setIncludePhoto] = useState(true)
  const [includeLogo, setIncludeLogo] = useState(!!card.company_logo_url)
  const [includeQR, setIncludeQR] = useState(true)
  const [includeSocials, setIncludeSocials] = useState(true)
  const [copied, setCopied] = useState(false)

  const cardUrl = `https://cardtly.com/card/${card.slug}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(cardUrl)}`

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

  async function copyHTML() {
    await navigator.clipboard.writeText(html)
    setCopied(true)
    toast.success('HTML copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
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
          <h1 className="font-display text-2xl font-bold">Email Signature</h1>
          <p className="text-muted-foreground text-sm mt-1">Generate a professional email signature from your card.</p>
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

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={copyHTML}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-foreground text-background hover:bg-foreground/90 transition">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy HTML'}
            </button>
            <button onClick={downloadHTML}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm border border-border hover:bg-muted transition">
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>

          {/* Install instructions */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-sm font-semibold mb-3">How to install</p>
            <div className="space-y-4 text-xs text-muted-foreground">
              <div>
                <p className="font-semibold text-foreground mb-1">Gmail</p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>Click Copy HTML above</li>
                  <li>Open Gmail Settings → See all settings</li>
                  <li>Go to General → Signature → Create new</li>
                  <li>Click the source code button (&lt;&gt;) and paste the HTML</li>
                  <li>Save changes</li>
                </ol>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">Outlook</p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>Download the HTML file</li>
                  <li>Open Outlook → File → Options → Mail → Signatures</li>
                  <li>Create new → paste or import the HTML</li>
                  <li>Set as default and save</li>
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

          </div>

                    <p className="text-xs text-muted-foreground mt-3 text-center">
            Preview is approximate — email clients may render slightly differently
          </p>
        </div>
      </div>
    </div>
  )
}
