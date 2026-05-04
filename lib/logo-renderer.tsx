import { CardDesign, calcLogoHeight } from '@/types/design'
import React from 'react'

interface LogoProps {
  logoUrl: string | null | undefined
  design: CardDesign
  position: 'top-left' | 'top-right' | 'below-photo' | 'bottom-left' | 'bottom-right'
  baseHeight?: number
  className?: string
  filter?: string
}

// Renders the logo only if the design.logoPosition matches the requested position
export function LogoAt({ logoUrl, design, position, baseHeight = 28, className = '', filter }: LogoProps) {
  if (!logoUrl || design.logoPosition === 'hidden') return null
  if (design.logoPosition !== position) return null
  const h = calcLogoHeight(baseHeight, design)
  return (
    <img
      src={logoUrl}
      style={{
        height: h,
        width: 'auto',
        objectFit: 'contain',
        maxWidth: 120,
        display: 'block',
        filter,
      }}
      className={className}
    />
  )
}

// Returns true if the logo should appear at this position
export function logoAt(design: CardDesign, position: string): boolean {
  return design.logoPosition === position && design.logoPosition !== 'hidden'
}

// Bottom logo bar — renders bottom-left or bottom-right inside a flex row
// Use this inside the bottom section of every template
export function BottomLogo({
  logoUrl,
  design,
  baseHeight = 28,
  pageBg,
}: {
  logoUrl: string | null | undefined
  design: CardDesign
  baseHeight?: number
  pageBg?: string
}) {
  if (!logoUrl || design.logoPosition === 'hidden') return null
  if (design.logoPosition !== 'bottom-left' && design.logoPosition !== 'bottom-right') return null
  const h = calcLogoHeight(baseHeight, design)
  const isRight = design.logoPosition === 'bottom-right'
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isRight ? 'flex-end' : 'flex-start',
        padding: '12px 0 4px',
      }}
    >
      <img
        src={logoUrl}
        style={{ height: h, width: 'auto', objectFit: 'contain', maxWidth: 120, display: 'block' }}
      />
    </div>
  )
}
