'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { getNativePlatform } from '@/lib/capacitor'
import { isIosBlockedPath } from '@/lib/app-platform'

type Item = { href: string; label: string }

/**
 * The footer's link columns, with the routes the iOS app may not open removed.
 *
 * A separate client component so the footer itself stays a server component:
 * it renders on every marketing page and the brand-colour hovers are pure CSS,
 * so only this list pays for the platform check.
 *
 * The footer shows on the pages iOS CAN still reach - /network, /contact,
 * /login, the legal pages - and from there it linked to "Digital business card
 * pricing". Those links redirect rather than sell, but a link by that name
 * inside the app is an argument with App Review that is not worth having.
 */
export default function FooterLinkList({ items }: { items: Item[] }) {
  const [iosApp, setIosApp] = useState(false)
  useEffect(() => { setIosApp(getNativePlatform() === 'ios') }, [])

  // '/#teams' is the home page with an anchor, and home is blocked.
  const visible = iosApp
    ? items.filter(i => !isIosBlockedPath(i.href.split('#')[0] || '/'))
    : items

  return (
    <div className="space-y-2.5">
      {visible.map(({ href, label }) => (
        <Link key={href} href={href}
          className="block text-sm transition hover:text-white"
          style={{ color: 'rgba(255,255,255,0.45)' }}>
          {label}
        </Link>
      ))}
    </div>
  )
}
