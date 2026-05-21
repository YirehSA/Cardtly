'use client'

import Link from 'next/link'
import { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    href: string
  }
  // Optional accent color for the illustration glow; defaults to the
  // Cardtly cyan.
  accent?: string
}

// Friendly empty-state block used wherever a dashboard list has zero
// rows. The big animated gradient circle with the relevant icon gives
// the screen visual presence so it doesn't feel broken, and the CTA
// nudges the user toward the action that would populate the list.

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  accent = '#00d4ff',
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center max-w-md mx-auto">
      <div className="relative mb-8">
        {/* Pulsing halo */}
        <div className="absolute inset-0 rounded-full blur-3xl opacity-40 animate-pulse"
          style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }} />
        {/* Icon plate */}
        <div className="relative w-24 h-24 rounded-3xl flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${accent}22 0%, ${accent}11 100%)`,
            border: `1px solid ${accent}44`,
            boxShadow: `0 20px 60px -20px ${accent}66`,
          }}>
          <Icon className="w-10 h-10" style={{ color: accent }} />
        </div>
      </div>
      <h3 className="text-2xl font-bold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-8">{description}</p>
      {action && (
        <Link href={action.href}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
          style={{
            background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)',
            boxShadow: '0 8px 24px -8px rgba(124,58,237,0.5)',
          }}>
          {action.label}
        </Link>
      )}
    </div>
  )
}
