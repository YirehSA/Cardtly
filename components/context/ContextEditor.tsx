'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Loader2, Sparkles, ChevronDown, ChevronUp, Eye, EyeOff, AlertTriangle, Save,
} from 'lucide-react'
import {
  CONTEXT_AUDIENCE_IDS, STANDARD_SECTION_ORDER, MAX_CONTEXT_LABEL,
  type ContextAudience, type ContextSection, type ContextCta,
} from '@/lib/card-context'
import { setUnsavedContext } from './unsaved'
import ContextPreview from './ContextPreview'

// THE OWNER'S CONTEXT EDITOR.
//
// ONE DRAFT AND ONE SAVE, INCLUDING THE MASTER SWITCH. The switch used to save
// on its own, which was fine while this page was read-only and is a race now:
// an immediate save posts the audiences the SERVER last sent, so flipping it
// with unsaved edits open would store the old audiences, and the next Save
// would then post a stale `enabled` and undo the flip. One draft has no such
// seam, and "what the screen shows is what the server has" stays true.
//
// THE SCREEN SPEAKS IN ARRANGEMENTS, THE STORE SPEAKS IN PARTIAL ORDERS. The
// owner answers one question - in what order will my visitor see these - so
// the editor always holds all three sections in an explicit sequence. The
// stored `order` happening to be a partial list whose unnamed members keep
// their relative position is an implementation detail nobody should have to
// learn to arrange three things.

interface LinkOption { index: number; title: string }

export interface DraftAudience {
  id: string
  enabled: boolean
  label: string
  /** ALL THREE, always, in visitor order. Hidden ones included. */
  sections: ContextSection[]
  hide: ContextSection[]
  cta: ContextCta | null
}

interface Props {
  target: { table: string; id: string }
  targetLabel: string
  enabled: boolean
  audiences: ContextAudience[]
  defaultAudience: string | null
  links: LinkOption[]
  bookingAvailable: boolean
  /** Which sections this card actually has content for, so the editor can say
   *  so without pretending an empty one will appear. */
  populated: Record<ContextSection, boolean>
  isOrg: boolean
  teamWide: boolean
  beta: boolean
  /** The card the preview renders. For an organisation this is a real team
   *  member's card, because the same Context runs on many different ones. */
  previewCards: { id: string; label: string; card: Record<string, any> }[]
}

const SECTION_LABEL: Record<ContextSection, string> = {
  certifications: 'Certifications',
  links: 'Links',
  gallery: 'Gallery',
}

const AUDIENCE_NAME: Record<string, string> = {
  executive: 'Executive',
  it: 'IT',
  sales: 'Sales',
  marketing: 'Marketing',
  hr: 'HR',
  procurement: 'Procurement',
}

/**
 * The stored shape turned into the one the screen edits.
 *
 * The stored `order` names only the sections the owner placed. Anything it
 * does not name keeps its normal relative position AFTER the ones it does,
 * which is precisely the rule we do not want to make anybody learn, so it is
 * resolved here into one explicit list of all three.
 */
function toDraft(a: ContextAudience | null, id: string): DraftAudience {
  const order = a?.order ?? []
  const placed = order.filter(s => (STANDARD_SECTION_ORDER as readonly string[]).includes(s))
  const rest = STANDARD_SECTION_ORDER.filter(s => !placed.includes(s))
  return {
    id,
    enabled: a ? a.enabled : false,
    label: a?.label ?? AUDIENCE_NAME[id] ?? id,
    sections: [...placed, ...rest],
    hide: a?.hide ?? [],
    cta: a?.cta ?? null,
  }
}

/** The draft turned back into what the API stores. */
function fromDraft(d: DraftAudience) {
  return { id: d.id, enabled: d.enabled, label: d.label, order: d.sections, hide: d.hide, cta: d.cta }
}

export default function ContextEditor({
  target, targetLabel, enabled, audiences, defaultAudience,
  links, bookingAvailable, populated, isOrg, teamWide, beta, previewCards = [],
}: Props) {
  const router = useRouter()
  // WHICH CARD THE PREVIEW RENDERS. Preview state, not configuration, so it is
  // deliberately outside the draft: choosing a different team member to look
  // at is not an edit and must not turn Save changes on.
  const [previewId, setPreviewId] = useState(previewCards[0]?.id ?? '')
  const previewCard = previewCards.find(c => c.id === previewId) || previewCards[0] || null

  const initial = useMemo(() => {
    const byId = new Map(audiences.map(a => [a.id, a]))
    return {
      on: enabled,
      rows: CONTEXT_AUDIENCE_IDS.map(id => toDraft(byId.get(id) || null, id)),
      def: defaultAudience,
    }
  }, [audiences, enabled, defaultAudience])

  const [on, setOn] = useState(initial.on)
  const [rows, setRows] = useState<DraftAudience[]>(initial.rows)
  const [def, setDef] = useState<string | null>(initial.def)
  const [open, setOpen] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial))

  const current = JSON.stringify({ on, rows, def })
  const dirty = current !== baseline

  // Two different ways out of this page, so two guards.
  //
  // The target switcher is a client navigation and never unloads the document,
  // so beforeunload cannot see it: TargetLink reads the shared flag on click
  // instead. beforeunload covers the rest - a reload, the back button, closing
  // the tab - which the flag cannot.
  useEffect(() => {
    setUnsavedContext(dirty)
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('beforeunload', warn)
      // Unmounting means this editor is gone, so its draft cannot be leaving
      // anything behind for the next page to warn about.
      setUnsavedContext(false)
    }
  }, [dirty])

  const patch = (id: string, fn: (d: DraftAudience) => DraftAudience) =>
    setRows(rs => rs.map(r => (r.id === id ? fn(r) : r)))

  function setEnabled(id: string, next: boolean) {
    patch(id, d => ({ ...d, enabled: next }))
    // THE DEFAULT CANNOT OUTLIVE THE AUDIENCE IT NAMES. The server clears it
    // too, but finding out after saving is not the same as watching it happen.
    if (!next && def === id) {
      setDef(null)
      toast.message(`${AUDIENCE_NAME[id] || id} was your default audience, so the default is now None.`)
    }
  }

  function move(id: string, from: number, dir: -1 | 1) {
    const to = from + dir
    if (to < 0 || to >= STANDARD_SECTION_ORDER.length) return
    patch(id, d => {
      const s = [...d.sections]
      ;[s[from], s[to]] = [s[to], s[from]]
      return { ...d, sections: s }
    })
  }

  function toggleHide(id: string, section: ContextSection) {
    patch(id, d => ({
      ...d,
      hide: d.hide.includes(section) ? d.hide.filter(x => x !== section) : [...d.hide, section],
    }))
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/card/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTable: target.table,
          targetId: target.id,
          context: { enabled: on, defaultAudience: def, audiences: rows.map(fromDraft) },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not save that')

      // THE SERVER'S ANSWER REPLACES THE DRAFT, never the other way round. It
      // canonicalises: a malformed value, a CTA pointing past the last link
      // slot, a default naming a switched-off audience. Keeping what we posted
      // would leave the screen showing something the database does not have,
      // which is the exact failure this whole design is built to avoid.
      const saved = data?.context
      if (saved && Array.isArray(saved.audiences)) {
        const byId = new Map<string, ContextAudience>(saved.audiences.map((a: ContextAudience) => [a.id, a]))
        const nextRows = CONTEXT_AUDIENCE_IDS.map(id => toDraft(byId.get(id) || null, id))
        const nextOn = saved.enabled === true
        const nextDef = typeof saved.defaultAudience === 'string' ? saved.defaultAudience : null
        setRows(nextRows)
        setOn(nextOn)
        setDef(nextDef)
        setBaseline(JSON.stringify({ on: nextOn, rows: nextRows, def: nextDef }))
      } else {
        setBaseline(current)
      }
      toast.success('Saved.')
      router.refresh()
    } catch (e: any) {
      // The draft is NOT reset. A failed save must not also cost the work.
      toast.error(e?.message || 'Could not save that', { duration: 8000 })
    } finally {
      setSaving(false)
    }
  }

  const enabledRows = rows.filter(r => r.enabled)

  return (
    <div className="space-y-4">
      {/* ── The add-on switch ─────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)' }}>
              <Sparkles className="w-5 h-5" style={{ color: 'hsl(var(--accent))' }} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm">Cardtly Context</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {teamWide
                  ? 'Arranges every card in your team around whoever is looking at it.'
                  : 'Arranges your card around whoever is looking at it.'}
              </p>
            </div>
          </div>
          <Switch checked={on} onChange={setOn} label="Cardtly Context" />
        </div>

        {/* OFF IS NOT AN EDITING LOCK. Preparing a campaign before switching it
            on is a completely reasonable thing to want to do. */}
        {!on && (
          <p className="text-xs text-muted-foreground mt-3">
            Context is currently off. You can still prepare your audience settings and save them.
          </p>
        )}
        {on && (
          <p className="text-xs text-muted-foreground mt-3">
            {enabledRows.length
              ? `${enabledRows.length} audience${enabledRows.length === 1 ? '' : 's'} switched on.`
              : 'No audiences are switched on yet, so this card behaves normally.'}
          </p>
        )}
      </div>

      {/* ── Default audience ──────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card p-4">
        <label htmlFor="ctx-default" className="block text-sm font-semibold mb-1">Default audience</label>
        <p className="text-xs text-muted-foreground mb-2.5">
          Used when no specific audience has been selected. If Cardtly receives an audience you have
          not set up, your normal card is shown.
        </p>
        <select
          id="ctx-default"
          value={def ?? ''}
          onChange={e => setDef(e.target.value || null)}
          className="w-full sm:max-w-xs px-3 py-2.5 rounded-xl border text-sm min-h-11"
          style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
        >
          <option value="">None (show my normal card)</option>
          {enabledRows.map(r => <option key={r.id} value={r.id}>{r.label || r.id}</option>)}
        </select>
      </div>

      {/* ── The six, with the preview beside them on a wide screen ────── */}
      {/* TWO COLUMNS FROM xl, ONE BELOW. The preview is a phone-width card, so
          anything narrower than xl would squeeze both halves rather than help.
          Below that it stacks and collapses, because six audience editors plus
          a full card is already a long page on a phone. */}
      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-5 xl:items-start space-y-3 xl:space-y-0">
      <div className="space-y-3">
        {rows.map(row => (
          <AudienceRow
            key={row.id}
            row={row}
            expanded={open === row.id}
            onToggleExpand={() => setOpen(open === row.id ? null : row.id)}
            onEnabled={next => setEnabled(row.id, next)}
            onLabel={v => patch(row.id, d => ({ ...d, label: v }))}
            onMove={(i, dir) => move(row.id, i, dir)}
            onHide={s => toggleHide(row.id, s)}
            onCta={c => patch(row.id, d => ({ ...d, cta: c }))}
            links={links}
            bookingAvailable={bookingAvailable}
            populated={populated}
            isOrg={isOrg}
          />
        ))}
      </div>

        {previewCard && (
          // Sticky within the grid column only. The height budget subtracts
          // BOTH the top offset and the sticky save bar below: at 100vh-3rem
          // the card ran underneath the Save button, which is the same class
          // of overlap the save bar itself had on mobile. Measured, not
          // guessed: 852px of preview against a bar starting at 809.
          <div className="xl:sticky xl:top-6 xl:max-h-[calc(100vh-9rem)] xl:overflow-y-auto mt-3 xl:mt-0">
            <ContextPreview
              sourceCard={previewCard.card}
              sourceLabel={previewCard.label}
              sourceOptions={previewCards.map(c => ({ id: c.id, label: c.label }))}
              sourceId={previewId}
              onSourceChange={setPreviewId}
              isPro={true}
              rows={rows}
            />
          </div>
        )}
      </div>

      {/* ── Save ──────────────────────────────────────────────────────── */}
      {/* SOLID, NOT A FADE. This started as a gradient to transparent, which
          looked better empty and was unreadable in use: on a phone the
          audience cards scroll underneath and showed straight through the
          save bar's own text. A bar you cannot read is worse than a hard
          edge, so it is opaque with a rule above it and a stacking context of
          its own. */}
      {/* HELD ABOVE THE PHONE'S BOTTOM NAV. That nav is `fixed bottom-0
          z-[60] lg:hidden` and 59px tall, so a bar pinned to bottom-0 put the
          Save button half underneath it: reachable by scrolling, easy to
          mis-tap, and exactly the "sticky save covering controls" failure to
          watch for. Cleared on small screens and flush again from lg, where
          the nav is not rendered at all. */}
      <div className="sticky bottom-16 lg:bottom-0 -mx-4 px-4 pt-3 pb-3 border-t z-20"
        style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {dirty ? 'You have unsaved changes.' : 'Everything is saved.'}
            {beta && ' Context is not live on public cards yet.'}
          </p>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed min-h-11"
            style={{ background: 'hsl(var(--accent))' }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
        <p className="sr-only" role="status">{dirty ? 'Unsaved changes' : 'Saved'}</p>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          These settings apply to {targetLabel}.
        </p>
      </div>
    </div>
  )
}

/** A labelled switch. A real checkbox, so the keyboard and screen readers get
 *  one for free rather than having it simulated with divs. */
function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 flex-shrink-0 cursor-pointer min-h-11">
      <span className="text-xs font-semibold text-muted-foreground w-7 text-right" aria-hidden="true">{checked ? 'On' : 'Off'}</span>
      <span className="relative inline-flex">
        <input type="checkbox" role="switch" checked={checked} aria-label={label}
          onChange={e => onChange(e.target.checked)} className="sr-only peer" />
        <span aria-hidden="true" className="block w-11 h-6 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2"
          style={{ background: checked ? 'hsl(var(--accent))' : 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }} />
        <span aria-hidden="true" className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow" style={{ left: checked ? 26 : 5 }} />
      </span>
    </label>
  )
}

function AudienceRow({
  row, expanded, onToggleExpand, onEnabled, onLabel, onMove, onHide, onCta,
  links, bookingAvailable, populated, isOrg,
}: {
  row: DraftAudience
  expanded: boolean
  onToggleExpand: () => void
  onEnabled: (v: boolean) => void
  onLabel: (v: string) => void
  onMove: (index: number, dir: -1 | 1) => void
  onHide: (s: ContextSection) => void
  onCta: (c: ContextCta | null) => void
  links: LinkOption[]
  bookingAvailable: boolean
  populated: Record<ContextSection, boolean>
  isOrg: boolean
}) {
  const name = AUDIENCE_NAME[row.id] || row.id
  const visible = row.sections.filter(s => !row.hide.includes(s))
  const ctaSummary = describeCta(row.cta, links, isOrg)

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-4 flex items-start justify-between gap-3">
        <button type="button" onClick={onToggleExpand} aria-expanded={expanded}
          className="flex items-start gap-2.5 text-left min-w-0 flex-1 min-h-11">
          {expanded
            ? <ChevronUp className="w-4 h-4 mt-1 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
            : <ChevronDown className="w-4 h-4 mt-1 flex-shrink-0 text-muted-foreground" aria-hidden="true" />}
          <span className="min-w-0">
            <span className="block font-semibold text-sm">{row.label || name}</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              {visible.length ? visible.map(s => SECTION_LABEL[s]).join(' → ') : 'Everything hidden'}
            </span>
            <span className="block text-xs text-muted-foreground">{ctaSummary.short}</span>
          </span>
        </button>
        <Switch checked={row.enabled} onChange={onEnabled} label={`${name} audience`} />
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t pt-4" style={{ borderColor: 'hsl(var(--border))' }}>
          <div>
            <label htmlFor={`lbl-${row.id}`} className="block text-xs font-semibold mb-1">Display label</label>
            <input
              id={`lbl-${row.id}`}
              value={row.label}
              maxLength={MAX_CONTEXT_LABEL}
              onChange={e => onLabel(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border text-sm min-h-11"
              style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              This is what visitors see when choosing their personalised view.
            </p>
          </div>

          <fieldset>
            <legend className="text-xs font-semibold mb-1">Section order</legend>
            <p className="text-[11px] text-muted-foreground mb-2">
              In what order will a visitor in this audience see these? Hiding a section only affects this
              personalised view. Your normal Cardtly content is not deleted.
            </p>
            <ul className="space-y-2">
              {row.sections.map((s, i) => {
                const hidden = row.hide.includes(s)
                return (
                  <li key={s} className="flex items-center gap-2 rounded-xl border px-3 py-2"
                    style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--background))' }}>
                    <span className="text-xs text-muted-foreground w-4 flex-shrink-0" aria-hidden="true">{i + 1}</span>
                    <span className="text-sm min-w-0 flex-1">
                      <span className={hidden ? 'line-through text-muted-foreground' : ''}>{SECTION_LABEL[s]}</span>
                      {!populated[s] && (
                        <span className="block text-[11px] text-muted-foreground">
                          No {SECTION_LABEL[s].toLowerCase()} content currently added.
                        </span>
                      )}
                    </span>
                    <button type="button" onClick={() => onMove(i, -1)} disabled={i === 0}
                      aria-label={`Move ${SECTION_LABEL[s]} up`}
                      className="w-11 h-11 rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-white/5">
                      <ChevronUp className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => onMove(i, 1)} disabled={i === row.sections.length - 1}
                      aria-label={`Move ${SECTION_LABEL[s]} down`}
                      className="w-11 h-11 rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-white/5">
                      <ChevronDown className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => onHide(s)}
                      aria-pressed={hidden}
                      aria-label={hidden ? `Show ${SECTION_LABEL[s]} for this audience` : `Hide ${SECTION_LABEL[s]} for this audience`}
                      className="w-11 h-11 rounded-lg flex items-center justify-center hover:bg-white/5">
                      {hidden
                        ? <EyeOff className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                        : <Eye className="w-4 h-4" style={{ color: 'hsl(var(--accent))' }} aria-hidden="true" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </fieldset>

          <CtaPicker
            row={row} links={links} bookingAvailable={bookingAvailable} isOrg={isOrg} onCta={onCta}
          />
        </div>
      )}
    </div>
  )
}

function CtaPicker({ row, links, bookingAvailable, isOrg, onCta }: {
  row: DraftAudience
  links: LinkOption[]
  bookingAvailable: boolean
  isOrg: boolean
  onCta: (c: ContextCta | null) => void
}) {
  const kind = row.cta?.kind ?? 'none'
  const n = `cta-${row.id}`
  const desc = describeCta(row.cta, links, isOrg)

  return (
    <fieldset>
      <legend className="text-xs font-semibold mb-1">Recommended action</legend>
      <p className="text-[11px] text-muted-foreground mb-2">
        An extra button suggesting where this visitor should go next. It never replaces your card&apos;s
        own buttons.
      </p>

      <div className="space-y-2">
        <Radio name={n} id={`${n}-none`} checked={kind === 'none'} onChange={() => onCta(null)} label="No recommended action" />

        <Radio name={n} id={`${n}-link`} checked={kind === 'link'}
          disabled={links.length === 0 && !isOrg}
          onChange={() => onCta({ kind: 'link', index: row.cta?.kind === 'link' ? row.cta.index : (links[0]?.index ?? 1), label: row.cta?.label ?? null })}
          label={links.length === 0 && !isOrg ? 'One of my links (add a link to your card first)' : 'One of my links'} />

        {kind === 'link' && (
          <div className="pl-7 space-y-2">
            <label htmlFor={`${n}-slot`} className="sr-only">Which link</label>
            <select id={`${n}-slot`}
              value={row.cta?.kind === 'link' ? row.cta.index : ''}
              onChange={e => onCta({ kind: 'link', index: Number(e.target.value), label: row.cta?.label ?? null })}
              className="w-full px-3 py-2.5 rounded-xl border text-sm min-h-11"
              style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}>
              {isOrg
                ? Array.from({ length: 10 }, (_, i) => i + 1).map(i => (
                    <option key={i} value={i}>Link {i} on each team member&apos;s card</option>
                  ))
                : links.map(l => <option key={l.index} value={l.index}>{l.title} &middot; Link {l.index}</option>)}
              {/* A slot that is configured but no longer filled still has to be
                  selectable, or opening this select would silently repoint the
                  CTA at a different link the owner never chose. */}
              {!isOrg && row.cta?.kind === 'link' && !links.some(l => l.index === row.cta!.index) && (
                <option value={row.cta.index}>Link {row.cta.index} (currently empty)</option>
              )}
            </select>
            {desc.warning && (
              <p className="text-[11px] flex items-start gap-1.5" style={{ color: '#d97706' }}>
                <AlertTriangle className="w-3.5 h-3.5 mt-px flex-shrink-0" aria-hidden="true" />
                {desc.warning}
              </p>
            )}
            {isOrg && (
              <p className="text-[11px] text-muted-foreground">
                Uses that link from each team member&apos;s own Cardtly, so it goes somewhere different
                for each of them.
              </p>
            )}
          </div>
        )}

        <Radio name={n} id={`${n}-booking`} checked={kind === 'booking'} disabled={!bookingAvailable}
          onChange={() => onCta({ kind: 'booking', index: null, label: row.cta?.label ?? null })}
          label={bookingAvailable
            ? 'Book a meeting'
            : 'Book a meeting (your card design does not show this button)'} />

        {/* An organisation's members can be on different card designs, and a
            few of those draw their own booking control instead of the shared
            one. Saying so is better than implying it works everywhere. */}
        {kind === 'booking' && isOrg && (
          <p className="text-[11px] text-muted-foreground pl-7">
            Shows for team members whose card design uses the standard booking button.
          </p>
        )}
      </div>

      {kind !== 'none' && (
        <div className="mt-3">
          <label htmlFor={`${n}-label`} className="block text-xs font-semibold mb-1">Button wording (optional)</label>
          <input id={`${n}-label`}
            value={row.cta?.label ?? ''}
            maxLength={MAX_CONTEXT_LABEL}
            placeholder={desc.placeholder}
            onChange={e => {
              const v = e.target.value.trim() ? e.target.value : null
              onCta(row.cta?.kind === 'link'
                ? { kind: 'link', index: row.cta.index, label: v }
                : { kind: 'booking', index: null, label: v })
            }}
            className="w-full px-3 py-2.5 rounded-xl border text-sm min-h-11"
            style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }} />
          <p className="text-[11px] text-muted-foreground mt-1">
            Changes what the button says. It still goes to the same place.
          </p>
        </div>
      )}
    </fieldset>
  )
}

function Radio({ name, id, checked, onChange, label, disabled }: {
  name: string; id: string; checked: boolean; onChange: () => void; label: string; disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5 min-h-11">
      <input type="radio" name={name} id={id} checked={checked} disabled={disabled} onChange={onChange}
        className="w-4 h-4 flex-shrink-0" style={{ accentColor: 'hsl(var(--accent))' }} />
      <label htmlFor={id} className={`text-sm ${disabled ? 'text-muted-foreground' : ''}`}>{label}</label>
    </div>
  )
}

/** One place that turns a stored CTA into English, so the collapsed summary,
 *  the warning and the placeholder cannot describe it three different ways. */
function describeCta(cta: ContextCta | null, links: LinkOption[], isOrg: boolean): {
  short: string; warning: string | null; placeholder: string
} {
  if (!cta) return { short: 'No recommended action', warning: null, placeholder: '' }
  if (cta.kind === 'booking') {
    return { short: cta.label || 'Book a meeting', warning: null, placeholder: 'Book a meeting' }
  }
  if (isOrg) {
    return {
      short: `${cta.label || `Link ${cta.index}`} (each card's own link ${cta.index})`,
      warning: null,
      placeholder: `Link ${cta.index}`,
    }
  }
  const title = links.find(l => l.index === cta.index)?.title
  if (!title) {
    return {
      short: `Link ${cta.index} (currently empty)`,
      warning: `This link is currently unavailable, so no Context button will appear.`,
      placeholder: `Link ${cta.index}`,
    }
  }
  return { short: cta.label ? `${cta.label} (goes to ${title})` : title, warning: null, placeholder: title }
}
