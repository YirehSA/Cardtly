import { Card, extractLinks } from '@/types/database'
import { IMAGE_SLOTS } from '@/types/design'
import { Phone, Mail, MapPin, Globe, MessageCircle, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface Props {
  card: Card
  isPro: boolean
}

export default function PublicCard({ card, isPro }: Props) {
  const links = isPro ? extractLinks(card) : []

  // Parse social links (stored as legacy flat columns)
  const socialLinks = isPro ? [
    card.linkedin_url && { platform: 'LinkedIn', url: card.linkedin_url },
    card.twitter_url && { platform: 'Twitter / X', url: card.twitter_url },
    card.instagram_url && { platform: 'Instagram', url: card.instagram_url },
    (card as any).facebook_url && { platform: 'Facebook', url: (card as any).facebook_url },
    (card as any).youtube && { platform: 'YouTube', url: (card as any).youtube },
    (card as any).tiktok && { platform: 'TikTok', url: (card as any).tiktok },
  ].filter(Boolean) : []

  // Parse certifications
  const certifications = isPro && card.certifications
    ? card.certifications.split(',').map(c => c.trim()).filter(Boolean)
    : []

  // Gallery images
  const galleryImages = isPro
    ? IMAGE_SLOTS.map(i => (card as any)[`image_${i}_url`]).filter(Boolean) as string[]
    : []

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-md mx-auto">

        {/* Cover photo */}
        {isPro && card.company_logo_url ? (
          <div className="relative h-48 bg-gray-900 overflow-hidden">
            <img
              src={card.company_logo_url}
              alt="Cover"
              className="w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-950" />
          </div>
        ) : (
          <div className="h-32 bg-gradient-to-br from-blue-900 to-gray-950" />
        )}

        {/* Profile section */}
        <div className="px-6 pb-6 -mt-16 relative">
          {/* Profile image */}
          <div className="mb-4">
            {card.profile_image_url ? (
              <img
                src={card.profile_image_url}
                alt={card.name}
                className="w-28 h-28 rounded-full object-cover border-4 border-gray-950"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-gray-800 border-4 border-gray-950 flex items-center justify-center text-4xl font-bold text-gray-400">
                {card.name?.[0]?.toUpperCase()}
              </div>
            )}
          </div>

          {/* Name & identity */}
          <h1 className="text-2xl font-bold">{card.name}</h1>
          {isPro && card.title && (
            <p className="text-blue-400 font-medium mt-0.5">{card.title}</p>
          )}
          {card.company && (
            <p className="text-gray-400 text-sm mt-0.5">{card.company}</p>
          )}

          {/* Bio */}
          {isPro && card.bio && (
            <p className="text-gray-300 text-sm mt-4 leading-relaxed">{card.bio}</p>
          )}

          {/* Contact buttons */}
          <div className="mt-6 space-y-2.5">
            {card.phone && (
              <ContactRow
                icon={<Phone className="w-4 h-4" />}
                label={card.phone}
                href={`tel:${card.phone}`}
              />
            )}
            {isPro && card.work_phone && (
              <ContactRow
                icon={<Phone className="w-4 h-4" />}
                label={card.work_phone}
                href={`tel:${card.work_phone}`}
                sublabel="Work"
              />
            )}
            {isPro && card.whatsapp && (
              <ContactRow
                icon={<MessageCircle className="w-4 h-4" />}
                label={card.whatsapp}
                href={`https://wa.me/${card.whatsapp.replace(/\D/g, '')}`}
                sublabel="WhatsApp"
              />
            )}
            {card.email && (
              <ContactRow
                icon={<Mail className="w-4 h-4" />}
                label={card.email}
                href={`mailto:${card.email}`}
              />
            )}
            {isPro && card.address && (
              <ContactRow
                icon={<MapPin className="w-4 h-4" />}
                label={card.address}
                href={`https://maps.google.com/?q=${encodeURIComponent(card.address)}`}
              />
            )}
            {isPro && card.website && (
              <ContactRow
                icon={<Globe className="w-4 h-4" />}
                label={card.website.replace(/^https?:\/\//, '')}
                href={card.website}
              />
            )}
          </div>

          {/* Social links */}
          {isPro && socialLinks.length > 0 && (
            <div className="mt-6 space-y-2.5">
              {socialLinks.map((s: any) => (
                <ContactRow
                  key={s.platform}
                  icon={<ExternalLink className="w-4 h-4" />}
                  label={`${s.platform} Profile`}
                  href={s.url}
                />
              ))}
            </div>
          )}

          {/* Certifications */}
          {isPro && certifications.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Certifications
              </h3>
              <div className="flex flex-wrap gap-2">
                {certifications.map(cert => (
                  <span
                    key={cert}
                    className="text-xs bg-gray-800 text-gray-300 px-3 py-1 rounded-full"
                  >
                    #{cert}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Custom links */}
          {isPro && links.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Links
              </h3>
              <div className="space-y-2.5">
                {links.map(link => (
                  <ContactRow
                    key={link.index}
                    icon={<ExternalLink className="w-4 h-4" />}
                    label={link.title}
                    href={link.url}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Gallery */}
          {isPro && galleryImages.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Gallery
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {galleryImages.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={url}
                      alt={`Gallery ${i + 1}`}
                      className="w-full aspect-video object-cover rounded-lg hover:opacity-90 transition"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* vCard / Save contact */}
          <div className="mt-8">
            <a
              href={`/api/vcf/${card.slug}`}
              download={`${card.name}.vcf`}
              className="block w-full text-center bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-semibold transition"
            >
              Save Contact
            </a>
          </div>

          {/* Powered by Cardtly (free only) */}
          {!isPro && (
            <div className="mt-6 text-center">
              <Link
                href="/"
                className="text-xs text-gray-600 hover:text-gray-400 transition"
              >
                Powered by Cardtly
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ContactRow({
  icon,
  label,
  href,
  sublabel,
}: {
  icon: React.ReactNode
  label: string
  href: string
  sublabel?: string
}) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="flex items-center gap-4 bg-gray-900 hover:bg-gray-800 rounded-xl px-4 py-3.5 transition group"
    >
      <div className="text-blue-400 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        {sublabel && <p className="text-xs text-gray-500">{sublabel}</p>}
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition flex-shrink-0" />
    </a>
  )
}
