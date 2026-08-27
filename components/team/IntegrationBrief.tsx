'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, Check, Mail, ChevronDown } from 'lucide-react'

// The technical details, written to be handed to somebody else.
//
// The person who runs a company's Cardtly account is not usually the person
// who will wire it into their CRM. Explaining HMAC signatures to them is the
// wrong job; giving them something they can forward to whoever does that work,
// without having to understand it, is the right one.
//
// Collapsed by default. An admin who is never going to read it should not have
// to scroll past it, and the one who needs it is looking for it.

export default function IntegrationBrief({
  title, summary, body, mailSubject,
}: {
  title: string
  summary: string
  /** Plain text. It gets copied and emailed, so no markup. */
  body: string
  mailSubject: string
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3.5 py-3 text-left hover:bg-muted/50 transition">
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`} />
        <span className="min-w-0">
          <span className="text-sm font-medium block">{title}</span>
          <span className="text-xs text-muted-foreground">{summary}</span>
        </span>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-2">
          <pre className="p-3 rounded-lg bg-muted text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap">{body}</pre>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(body)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
                toast.success('Copied. Paste it into an email.')
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition">
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy all of it'}
            </button>
            <a
              href={`mailto:?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(body)}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition">
              <Mail className="w-3.5 h-3.5" />Email it to someone
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
