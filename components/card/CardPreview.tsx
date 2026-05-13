import { Phone, Mail, MapPin, Globe, MessageCircle, ExternalLink } from 'lucide-react'

const THEME_COLORS: Record<string, string> = {
  blue: '#3b82f6',
  purple: '#8b5cf6',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f97316',
  pink: '#ec4899',
  teal: '#14b8a6',
  gray: '#374151',
}

function getReadableTextOn(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length !== 3 && h.length !== 6) return '#ffffff'
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  const toLin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const L = 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b)
  return L > 0.55 ? '#0a0a0a' : '#ffffff'
}

interface PreviewForm {
  name: string
  title: string
  company: string
  bio: string
  email: string
  phone: string
  work_phone: string
  whatsapp: string
  address: string
  website: string
  linkedin_url: string
  twitter_url: string
  instagram_url: string
  profile_image_url: string
  company_logo_url: string
  certifications: string
  color_theme: string
  link_1_title: string
  link_1_url: string
  link_2_title: string
  link_2_url: string
  link_3_title: string
  link_3_url: string
  link_4_title: string
  link_4_url: string
  link_5_title: string
  link_5_url: string
}

interface Props {
  form: PreviewForm
  isPro: boolean
}

export default function CardPreview({ form, isPro }: Props) {
  const accentColor = THEME_COLORS[form.color_theme] || THEME_COLORS.blue

  const certifications = form.certifications
    ? form.certifications.split(',').map(c => c.trim()).filter(Boolean)
    : []

  const customLinks = [1, 2, 3, 4, 5]
    .map(i => ({
      title: form[`link_${i}_title` as keyof PreviewForm],
      url: form[`link_${i}_url` as keyof PreviewForm],
    }))
    .filter(l => l.title && l.url)

  const socials = isPro ? [
    form.linkedin_url && { label: 'LinkedIn', url: form.linkedin_url },
    form.twitter_url && { label: 'Twitter / X', url: form.twitter_url },
    form.instagram_url && { label: 'Instagram', url: form.instagram_url },
  ].filter(Boolean) : []

  return (
    <div className="text-white min-h-96" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Cover */}
      <div
        className="h-24 relative"
        style={{
          background: `linear-gradient(135deg, ${accentColor}33 0%, #0f172a 100%)`,
          borderBottom: `2px solid ${accentColor}22`,
        }}
      >
        {isPro && form.company_logo_url && (
          <img
            src={form.company_logo_url}
            alt="Logo"
            className="absolute top-3 right-3 w-10 h-10 object-contain opacity-80"
          />
        )}
      </div>

      <div className="px-5 pb-6 -mt-10">
        {/* Avatar */}
        {form.profile_image_url ? (
          <img
            src={form.profile_image_url}
            alt={form.name}
            className="w-20 h-20 rounded-full object-cover border-4 border-gray-950 mb-3"
          />
        ) : (
          <div
            className="w-20 h-20 rounded-full border-4 border-gray-950 mb-3 flex items-center justify-center text-2xl font-bold"
            style={{ backgroundColor: accentColor + '33', color: accentColor }}
          >
            {form.name?.[0]?.toUpperCase() || '?'}
          </div>
        )}

        {/* Identity */}
        <h2 className="text-lg font-bold leading-tight">{form.name || 'Your Name'}</h2>
        {isPro && form.title && (
          <p className="text-sm font-medium mt-0.5" style={{ color: accentColor }}>
            {form.title}
          </p>
        )}
        {form.company && (
          <p className="text-gray-400 text-xs mt-0.5">{form.company}</p>
        )}
        {isPro && form.bio && (
          <p className="text-gray-300 text-xs mt-3 leading-relaxed line-clamp-3">{form.bio}</p>
        )}

        {/* Contact rows */}
        <div className="mt-4 space-y-2">
          {form.phone && (
            <PreviewRow icon={<Phone className="w-3 h-3" />} label={form.phone} color={accentColor} />
          )}
          {isPro && form.work_phone && (
            <PreviewRow icon={<Phone className="w-3 h-3" />} label={form.work_phone} sublabel="Work" color={accentColor} />
          )}
          {isPro && form.whatsapp && (
            <PreviewRow icon={<MessageCircle className="w-3 h-3" />} label={form.whatsapp} sublabel="WhatsApp" color={accentColor} />
          )}
          {form.email && (
            <PreviewRow icon={<Mail className="w-3 h-3" />} label={form.email} color={accentColor} />
          )}
          {isPro && form.address && (
            <PreviewRow icon={<MapPin className="w-3 h-3" />} label={form.address} color={accentColor} />
          )}
          {isPro && form.website && (
            <PreviewRow icon={<Globe className="w-3 h-3" />} label={form.website.replace(/^https?:\/\//, '')} color={accentColor} />
          )}
          {socials.map((s: any) => (
            <PreviewRow key={s.label} icon={<ExternalLink className="w-3 h-3" />} label={s.label} color={accentColor} />
          ))}
        </div>

        {/* Certifications */}
        {isPro && certifications.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2">Certifications</p>
            <div className="flex flex-wrap gap-1.5">
              {certifications.map(cert => (
                <span key={cert} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">
                  #{cert}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Custom links */}
        {isPro && customLinks.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-gray-500 mb-2">Links</p>
            {customLinks.map(link => (
              <PreviewRow key={link.title} icon={<ExternalLink className="w-3 h-3" />} label={link.title} color={accentColor} />
            ))}
          </div>
        )}

        {/* Save contact button */}
        <button
          className="mt-5 w-full py-2.5 rounded-xl text-sm font-semibold transition"
          style={{ backgroundColor: accentColor, color: getReadableTextOn(accentColor) }}
        >
          Save Contact
        </button>

        {/* Powered by */}
        {!isPro && (
          <p className="text-center text-xs text-gray-700 mt-4">Powered by Cardtly</p>
        )}
      </div>
    </div>
  )
}

function PreviewRow({ icon, label, sublabel, color }: {
  icon: React.ReactNode
  label: string
  sublabel?: string
  color: string
}) {
  return (
    <div className="flex items-center gap-3 bg-gray-900 rounded-lg px-3 py-2">
      <span style={{ color }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{label}</p>
        {sublabel && <p className="text-xs text-gray-500">{sublabel}</p>}
      </div>
    </div>
  )
}
