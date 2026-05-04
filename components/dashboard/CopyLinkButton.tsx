'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function CopyLinkButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(`https://cardtly.com/card/${slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition"
    >
      {copied
        ? <><Check className="w-3 h-3 text-green-500" />Copied!</>
        : <><Copy className="w-3 h-3" />Copy link</>}
    </button>
  )
}
