'use client'

import { useEffect, useMemo, useState } from 'react'
import { Eye, ChevronDown, ChevronUp } from 'lucide-react'
import PublicCardView from '@/components/card/PublicCardView'
import PreviewFrame from '@/components/card/PreviewFrame'
import { parseDesign } from '@/types/design'
import type { CardPreviewContext, ContextAudience } from '@/lib/card-context'
import type { DraftAudience } from './ContextEditor'

// WHAT WILL THIS VISITOR ACTUALLY SEE.
//
// Fed by the DRAFT, never by the saved configuration. The owner is deciding
// whether to keep a change, and a preview that only moves after saving answers
// the wrong question. Every edit in the panel beside this one is visible here
// before anything is written.
//
// IT IS THE REAL CARD. PublicCardView, the real templates, the real transform,
// the real CTA resolver. A second hand-written miniature is how the old
// template picker drifted from the cards it claimed to show, and a preview
// that is merely similar to the card is worse than none: it invites the owner
// to trust it.
//
// STANDARD IS A MODE SOMEBODY CHOSE, not the absence of a choice. See
// CardPreviewContext for why that distinction has to be explicit rather than
// implied by a missing value.
//
// ALL SIX AUDIENCES ARE PREVIEWABLE, INCLUDING SWITCHED-OFF ONES. An owner has
// to be able to look at Procurement before turning it on, and this is an admin
// simulation: it changes nothing about what a visitor can reach. The visitor's
// own selector inside the card is still offered only the enabled ones, which
// is what a real visitor would get.

interface Props {
  /** The card this Context will actually run on. For an organisation that is a
   *  real team member's card, because link 3 is a different link on each one. */
  sourceCard: Record<string, any>
  sourceLabel: string
  /** Other team cards the admin can preview against, if any. */
  sourceOptions: { id: string; label: string }[]
  onSourceChange?: (id: string) => void
  sourceId?: string
  isPro: boolean
  rows: DraftAudience[]
}

function toAudience(d: DraftAudience): ContextAudience {
  return { id: d.id, enabled: d.enabled, label: d.label, order: d.sections, hide: d.hide, cta: d.cta }
}

export default function ContextPreview({
  sourceCard, sourceLabel, sourceOptions, onSourceChange, sourceId, isPro, rows,
}: Props) {
  const [mode, setMode] = useState<string>('standard')

  // COLLAPSED ON A PHONE, OPEN ON A WIDE SCREEN. Six audience editors plus a
  // full card is already a long page; permanently appending one below the
  // other would make the Save button a scroll away from everything.
  //
  // Decided after mount rather than during render, because reading matchMedia
  // while rendering gives the server one answer and the browser another, and
  // React rightly complains. One frame closed on desktop is the cost.
  const [open, setOpen] = useState(false)
  const [collapsible, setCollapsible] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)')
    const apply = () => { setCollapsible(!mq.matches); if (mq.matches) setOpen(true) }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const card = useMemo(() => ({
    ...sourceCard,
    color_theme: sourceCard.color_theme,
    view_count: 0,
  }), [sourceCard])

  const design = useMemo(() => parseDesign(sourceCard.color_theme), [sourceCard.color_theme])

  // Rebuilt from the draft on every change, which is what makes the preview
  // live. Memoised on the draft's CONTENT so PublicCardView's effect does not
  // re-run on every unrelated render.
  const signature = JSON.stringify(rows) + '|' + mode
  const previewContext: CardPreviewContext = useMemo(() => {
    const audiences = rows.filter(r => r.enabled).map(toAudience)
    if (mode === 'standard') return { mode: 'standard', audiences }
    const picked = rows.find(r => r.id === mode)
    // A mode naming an audience that is somehow gone falls back to Standard
    // rather than to nothing, so the pane always shows a truthful card.
    if (!picked) return { mode: 'standard', audiences }
    return { mode: 'audience', audience: toAudience(picked), audiences }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const chips = [{ id: 'standard', label: 'Standard', off: false },
    ...rows.map(r => ({ id: r.id, label: r.label || r.id, off: !r.enabled }))]

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <Eye className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--accent))' }} aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold text-sm">Preview your Cardtly</p>
            <p className="text-xs text-muted-foreground truncate">Previewing: {sourceLabel}</p>
          </div>
        </div>
        {collapsible && (
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold min-h-11"
            style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--background))' }}>
            {open ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
            {open ? 'Hide preview' : 'Show preview'}
          </button>
        )}
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t pt-4" style={{ borderColor: 'hsl(var(--border))' }}>
          {/* An organisation's Context runs on many different cards, so the
              admin picks which one they are looking at rather than being shown
              a generic card that belongs to nobody. */}
          {sourceOptions.length > 1 && (
            <div>
              <label htmlFor="ctx-preview-source" className="block text-xs font-semibold mb-1">Preview card</label>
              <select id="ctx-preview-source" value={sourceId}
                onChange={e => onSourceChange?.(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border text-sm min-h-11"
                style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}>
                {sourceOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Your team&apos;s Context settings run on every member&apos;s own card, so links and content
                differ from person to person.
              </p>
            </div>
          )}

          <fieldset>
            <legend className="text-xs font-semibold mb-1.5">Viewing as</legend>
            <div className="flex flex-wrap gap-2">
              {chips.map(c => {
                const active = mode === c.id
                return (
                  <button key={c.id} type="button" onClick={() => setMode(c.id)}
                    aria-pressed={active}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition min-h-11 max-w-full"
                    style={active
                      ? { borderColor: 'transparent', background: 'hsl(var(--accent))', color: '#fff' }
                      : { borderColor: 'hsl(var(--border))', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
                    <span className="truncate">{c.label}</span>
                    {c.off && (
                      <span className="text-[10px] font-bold opacity-70 flex-shrink-0"
                        title="Switched off. Visitors cannot reach this yet.">
                        &middot; Off
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {mode !== 'standard' && rows.find(r => r.id === mode && !r.enabled) && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Preview only. This audience is switched off, so visitors see your normal card.
              </p>
            )}
          </fieldset>

          {/* The card itself. PreviewFrame declares the surface (no analytics,
              no writes) and swallows link navigation, so nothing in here can
              take the owner out of their own settings. */}
          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'hsl(var(--border))' }}>
            <PreviewFrame className="cardtly-card-preview">
              <PublicCardView key={sourceId} card={card as any} isPro={isPro} previewContext={previewContext} />
            </PreviewFrame>
          </div>
        </div>
      )}
    </div>
  )
}
