'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Loader2, Sparkles, ChevronDown, ChevronUp, Eye, EyeOff, AlertTriangle, Save,
  Crown, Cpu, TrendingUp, Megaphone, Users, ShoppingCart, Link2, Check, Copy,
} from 'lucide-react'
import {
  CONTEXT_AUDIENCE_IDS, STANDARD_SECTION_ORDER, MAX_CONTEXT_LABEL, MAX_LINK_INDEX, CONTEXT_COLLECTIONS,
  type ContextAudience, type ContextSection, type ContextCta, type ContextCollection,
} from '@/lib/card-context'
import { SOCIAL_SLOTS } from '@/types/design'
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
  /** Which link slots this audience shows. null means every link, which is
   *  what an audience nobody has configured that way must keep doing. Carried
   *  through the draft before the picker exists, so saving from this editor
   *  cannot strip a selection made anywhere else. */
  links: number[] | null
  gallery: number[] | null
  socials: string[] | null
  cta: ContextCta | null
}

interface Props {
  target: { table: string; id: string }
  targetLabel: string
  enabled: boolean
  audiences: ContextAudience[]
  defaultAudience: string | null
  links: LinkOption[]
  /** The photos and social accounts this card actually has, so the pickers
   *  can name them. Empty for an organisation, where they differ per member. */
  galleryItems: PickItem[]
  socialItems: PickItem[]
  bookingAvailable: boolean
  /** Which sections this card actually has content for, so the editor can say
   *  so without pretending an empty one will appear. */
  populated: Record<ContextSection, boolean>
  isOrg: boolean
  teamWide: boolean
  beta: boolean
  /** The card's public slug, for the personalised share link. Null for an
   *  organisation, where every member has their own. */
  cardSlug?: string | null
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
 * A FACE PER AUDIENCE, so six rows stop looking like one row repeated.
 *
 * The list was six identical cards distinguished only by the word at the top,
 * which meant finding IT was reading rather than glancing. An icon and a hue
 * each make the list scannable in a way no amount of spacing was going to.
 *
 * Colour is never the only signal: every row still carries its name, its
 * arrangement in words, and an On/Off switch with a visible label.
 */
const AUDIENCE_FACE: Record<string, { Icon: typeof Crown; hue: string }> = {
  executive:   { Icon: Crown,        hue: '#f59e0b' },
  it:          { Icon: Cpu,          hue: '#0ea5e9' },
  sales:       { Icon: TrendingUp,   hue: '#22c55e' },
  marketing:   { Icon: Megaphone,    hue: '#ec4899' },
  hr:          { Icon: Users,        hue: '#a855f7' },
  procurement: { Icon: ShoppingCart, hue: '#14b8a6' },
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
    links: a?.links ?? null,
    gallery: a?.gallery ?? null,
    socials: a?.socials ?? null,
    cta: a?.cta ?? null,
  }
}

/** The draft turned back into what the API stores. */
function fromDraft(d: DraftAudience) {
  return { id: d.id, enabled: d.enabled, label: d.label, order: d.sections, hide: d.hide, links: d.links, gallery: d.gallery, socials: d.socials, cta: d.cta }
}

export default function ContextEditor({
  target, targetLabel, enabled, audiences, defaultAudience,
  links, galleryItems, socialItems, bookingAvailable, populated, isOrg, teamWide, beta, previewCards = [], cardSlug = null,
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

  // Written as a switch rather than a computed key, so the three collections
  // keep their real types on the draft instead of becoming
  // (number | string)[] the moment one picker is generalised.
  const setPicks = (id: string, collection: ContextCollection, v: (number | string)[] | null) =>
    patch(id, d => {
      if (collection === 'socials') return { ...d, socials: v as string[] | null }
      if (collection === 'gallery') return { ...d, gallery: v as number[] | null }
      return { ...d, links: v as number[] | null }
    })

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
      {/* THE ONE DECISION THAT GOVERNS THE PAGE, so it gets the weight of one
          rather than sitting in a row that looks like every other row. The
          gradient edge is the only piece of brand colour on the screen; the
          audiences below carry their own hues and would fight it anywhere
          else. */}
      {/* SWITCHED OFF IS ASLEEP, NOT ABSENT. The off state used to flatten
          this edge to plain border grey, which made the one panel that turns
          the whole feature on read as the most inert thing on the page. It
          keeps its colours now and simply dims them, so off looks like
          something waiting to be switched on. */}
      <div className="panel ctx-master panel-hover overflow-hidden relative" data-on={on ? 'true' : 'false'}>
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 transition-opacity duration-500"
          style={{
            background: 'linear-gradient(180deg,#00d4ff,#7c3aed,#ec4899)',
            opacity: on ? 1 : 0.34,
          }} />
        <div className="p-4 sm:p-5 pl-5 sm:pl-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="ctx-face w-11 h-11 rounded-xl grid place-items-center flex-shrink-0"
                style={on
                  ? {
                      background: 'linear-gradient(145deg, rgba(168,85,247,0.30), rgba(0,212,255,0.12))',
                      border: '1px solid rgba(168,85,247,0.45)',
                      boxShadow: '0 8px 24px -10px rgba(168,85,247,0.9)',
                    }
                  : { background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }}>
                <Sparkles className="w-5 h-5" aria-hidden="true"
                  style={{ color: on ? 'hsl(var(--accent))' : 'hsl(var(--muted-foreground))' }} />
              </div>
              <div className="min-w-0">
                <p className="section-title text-base">Cardtly Context</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-md">
                  {teamWide
                    ? 'Arranges every card in your team around whoever is looking at it.'
                    : 'Arranges your card around whoever is looking at it.'}
                </p>
              </div>
            </div>
            <Switch checked={on} onChange={setOn} label="Cardtly Context" />
          </div>

          {/* OFF IS NOT AN EDITING LOCK. Preparing before switching on is a
              completely reasonable thing to want to do. */}
          <div className="mt-3.5 pt-3.5 border-t" style={{ borderColor: 'hsl(var(--border))' }}>
            {!on ? (
              <p className="text-xs text-muted-foreground">
                Switched off. You can still set your audiences up and save them, ready for when you turn it on.
              </p>
            ) : enabledRows.length ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Live for</span>
                {enabledRows.map(r => {
                  const face = AUDIENCE_FACE[r.id]
                  return (
                    <span key={r.id} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md border"
                      style={{ background: `${face.hue}1f`, borderColor: `${face.hue}59`, color: 'hsl(var(--foreground))' }}>
                      <face.Icon className="w-3 h-3" style={{ color: face.hue }} aria-hidden="true" />
                      {r.label || r.id}
                    </span>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No audiences are switched on yet, so this card behaves exactly as it does now.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Default audience ──────────────────────────────────────────── */}
      <div className="panel p-4 sm:p-5">
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
      <div className="space-y-3 stagger">
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
            onPicks={(c, v) => setPicks(row.id, c, v)}
            galleryItems={galleryItems}
            socialItems={socialItems}
            links={links}
            bookingAvailable={bookingAvailable}
            populated={populated}
            isOrg={isOrg}
            cardSlug={cardSlug}
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
              focus={open}
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
      <div className="sticky bottom-16 lg:bottom-0 -mx-4 sm:-mx-8 px-4 sm:px-8 pt-3 pb-3 border-t z-20"
        style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs flex items-center gap-2 min-w-0">
            {/* Shape as well as colour: a dot alone would put the whole state
                on a hue, and the sentence beside it carries it anyway. */}
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: dirty ? '#f59e0b' : '#22c55e' }} />
            <span className={dirty ? 'font-semibold' : 'text-muted-foreground'}>
              {dirty ? 'Unsaved changes' : 'Everything is saved'}
            </span>
            {beta && <span className="text-muted-foreground hidden sm:inline">Not live on public cards yet.</span>}
          </p>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="btn-sheen inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none min-h-11"
            style={{ background: dirty ? 'linear-gradient(135deg,#00d4ff,#7c3aed,#ec4899)' : 'hsl(var(--muted-foreground))' }}
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

/**
 * The personalised link for one audience, ready to send.
 *
 * THE MACHINE ID APPEARS HERE AND NOWHERE ELSE. It is deliberately kept out of
 * the rest of the interface - an owner is choosing "Technology / IT", not
 * typing `it` - but the moment they want to send the link it stops being
 * jargon and becomes the thing they need. So it shows up exactly once, in the
 * place where it is useful, as part of a URL rather than as a field.
 *
 * Copy rather than a mailto or a share sheet: this gets pasted into WhatsApp,
 * an email signature, a printed QR, and we cannot know which.
 */
function ShareLink({ slug, audienceId, hue }: { slug: string; audienceId: string; hue: string }) {
  const [copied, setCopied] = useState(false)
  // The canonical public host, written out rather than derived. This string
  // is going into a WhatsApp message, an email signature and printed QR codes,
  // so it has to be the address that answers directly: the apex 307s to www,
  // and a redirect in a printed link is a redirect forever.
  const url = `https://www.cardtly.com/card/${slug}?a=${audienceId}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Link copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be refused (insecure context, permissions). Saying so
      // beats a button that silently does nothing.
      toast.error('Could not copy. Select the link and copy it manually.')
    }
  }

  return (
    <div className="px-4 pb-4 -mt-1">
      <div className="flex items-center gap-2 rounded-xl border px-3 py-2"
        style={{ background: 'hsl(var(--muted) / 0.4)', borderColor: 'hsl(var(--border))' }}>
        <Link2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: hue }} aria-hidden="true" />
        {/* Selectable, wrapping, and monospaced so a glanced-at URL is legible.
            Not an input: it is not editable and should not look editable. */}
        <code className="text-[11px] leading-relaxed min-w-0 flex-1 break-all select-all text-muted-foreground">
          {url}
        </code>
        <button type="button" onClick={copy}
          aria-label={`Copy the personalised link for ${audienceId}`}
          className="w-11 h-11 -my-2 -mr-2 rounded-lg grid place-items-center flex-shrink-0 transition hover:bg-white/5">
          {copied
            ? <Check className="w-4 h-4" style={{ color: '#22c55e' }} aria-hidden="true" />
            : <Copy className="w-4 h-4 text-muted-foreground" aria-hidden="true" />}
        </button>
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
  row, expanded, onToggleExpand, onEnabled, onLabel, onMove, onHide, onCta, onPicks,
  galleryItems, socialItems,
  links, bookingAvailable, populated, isOrg, cardSlug,
}: {
  row: DraftAudience
  expanded: boolean
  onToggleExpand: () => void
  onEnabled: (v: boolean) => void
  onLabel: (v: string) => void
  onMove: (index: number, dir: -1 | 1) => void
  onHide: (s: ContextSection) => void
  onCta: (c: ContextCta | null) => void
  onPicks: (collection: ContextCollection, v: (number | string)[] | null) => void
  galleryItems: PickItem[]
  socialItems: PickItem[]
  links: LinkOption[]
  bookingAvailable: boolean
  populated: Record<ContextSection, boolean>
  isOrg: boolean
  cardSlug: string | null
}) {
  const name = AUDIENCE_NAME[row.id] || row.id
  const visible = row.sections.filter(s => !row.hide.includes(s))
  const ctaSummary = describeCta(row.cta, links, isOrg)
  const face = AUDIENCE_FACE[row.id] || { Icon: Sparkles, hue: '#7c3aed' }

  // A link selection is part of "what does this audience actually do", so it
  // belongs in the collapsed line rather than only behind the accordion. Shown
  // only when a choice was made: null is "all of them", which is exactly what
  // the plain section name already says.
  // ALL THREE COLLECTIONS, not just links. 10c put "Links (3 of 5)" on this
  // line so a non-default setting was visible without opening the accordion,
  // and 11d added two more collections without extending it - so an audience
  // showing one social account out of four looked, collapsed, exactly like one
  // showing all of them. Found by the 11e pass rather than by the compiler,
  // because a summary being incomplete is not a type error.
  const totals: Record<ContextCollection, number> = {
    links: isOrg ? MAX_LINK_INDEX : links.length,
    gallery: isOrg ? CONTEXT_COLLECTIONS.gallery.max : galleryItems.length,
    socials: isOrg ? CONTEXT_COLLECTIONS.socials.keys.length : socialItems.length,
  }
  const countOf = (c: ContextCollection) => {
    const sel = row[c] as (number | string)[] | null
    if (!sel) return null
    return sel.length === 0 ? 'none' : `${sel.length} of ${totals[c]}`
  }
  const sectionSummary = (s: ContextSection) => {
    const n = s === 'links' ? countOf('links') : s === 'gallery' ? countOf('gallery') : null
    return n ? `${SECTION_LABEL[s]} (${n})` : SECTION_LABEL[s]
  }

  return (
    // A LIVE AUDIENCE LOOKS LIVE. An off one is quiet but never disabled: its
    // settings are intact and still editable, which is the whole promise of the
    // persisted-disabled model, so greying it out would be a lie.
    <div className="panel ctx-aud overflow-hidden"
      data-live={row.enabled ? 'true' : 'false'}
      style={{
        ['--aud' as string]: face.hue,
        ...(row.enabled ? { borderColor: `${face.hue}4d` } : {}),
      } as React.CSSProperties}>
      <div className="flex items-start gap-3 p-4">
        <button type="button" onClick={onToggleExpand} aria-expanded={expanded}
          className="flex items-start gap-3 text-left min-w-0 flex-1 min-h-11 rounded-lg">
          <span aria-hidden="true"
            className="ctx-face w-10 h-10 rounded-xl grid place-items-center flex-shrink-0 mt-0.5"
            style={row.enabled
              ? {
                  background: `linear-gradient(145deg, ${face.hue}33, ${face.hue}0f)`,
                  border: `1px solid ${face.hue}66`,
                }
              : { background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }}>
            <face.Icon className="w-[18px] h-[18px]"
              style={{ color: row.enabled ? face.hue : 'hsl(var(--muted-foreground))' }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{row.label || name}</span>
              {!row.enabled && <span className="stat-chip">Off</span>}
            </span>
            {/* The arrangement in words, so the collapsed row answers "what
                does this audience actually do" without opening it. */}
            <span className="block text-xs text-muted-foreground mt-1 leading-relaxed">
              {visible.length ? visible.map(sectionSummary).join(' → ') : 'Everything hidden'}
            </span>
            <span className="block text-xs text-muted-foreground">{ctaSummary.short}</span>
            {countOf('socials') && (
              <span className="block text-xs text-muted-foreground">
                Socials ({countOf('socials')})
              </span>
            )}
          </span>
          <span aria-hidden="true" className="flex-shrink-0 mt-1.5 text-muted-foreground">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>
        <Switch checked={row.enabled} onChange={onEnabled} label={`${name} audience`} />
      </div>

      {/* THE LINK THAT MAKES THIS USEFUL. An audience you cannot send anybody
          to is a setting, not a feature: the id is permanent, it belongs in a
          WhatsApp message, and the owner should never have to construct it by
          hand from a machine name they were deliberately never shown. */}
      {row.enabled && cardSlug && (
        <ShareLink slug={cardSlug} audienceId={row.id} hue={face.hue} />
      )}

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

          <CollectionPicker row={row} collection="links" isOrg={isOrg} onPicks={onPicks}
            items={links.map(l => ({ id: l.index, label: l.title, sub: `Link ${l.index}` }))} />

          <CollectionPicker row={row} collection="gallery" isOrg={isOrg} onPicks={onPicks}
            items={galleryItems} />

          <CollectionPicker row={row} collection="socials" isOrg={isOrg} onPicks={onPicks}
            items={socialItems} />

          <CtaPicker
            row={row} links={links} bookingAvailable={bookingAvailable} isOrg={isOrg} onCta={onCta}
          />
        </div>
      )}
    </div>
  )
}

/** One offerable member of a collection. `id` is what the audience actually
 *  stores: a slot number for links and gallery, a platform key for socials. */
interface PickItem { id: number | string; label: string; sub?: string }

/** The words for each collection, in one place, so three pickers cannot
 *  describe the same idea three slightly different ways. */
const COLLECTION_COPY: Record<ContextCollection, {
  legend: string
  blurb: string
  all: string
  none: string
  empty: string
  /** The section this collection lives in, when it lives in one. Socials are
   *  not a section: they sit in the card's identity block and there is no
   *  ordering or hiding control for them. */
  section: ContextSection | null
  orphan: (id: number | string) => string
}> = {
  links: {
    legend: 'Which links to show',
    blurb: 'Tick the links this audience should see. Unticking one hides it from this personalised view only. It stays on your card.',
    all: 'Every link shows. Any link you add to this card later will show here too.',
    none: 'No links will show for this audience.',
    empty: 'This card has no links yet. Add some to your card and you can choose which of them each audience sees.',
    section: 'links',
    orphan: id => `Link ${id}`,
  },
  gallery: {
    legend: 'Which photos to show',
    blurb: 'Tick the photos this audience should see. Unticking one hides it from this personalised view only. It stays on your card.',
    all: 'Every photo shows. Any photo you add to this card later will show here too.',
    none: 'No photos will show for this audience.',
    empty: 'This card has no photos yet. Add some to your card and you can choose which of them each audience sees.',
    section: 'gallery',
    orphan: id => `Photo ${id}`,
  },
  socials: {
    legend: 'Which social accounts to show',
    blurb: 'Tick the accounts this audience should see. Unticking one hides it from this personalised view only. It stays on your card.',
    all: 'Every social account shows. Any account you add to this card later will show here too.',
    none: 'No social accounts will show for this audience.',
    empty: 'This card has no social accounts yet. Add some to your card and you can choose which of them each audience sees.',
    section: null,
    orphan: id => String(id),
  },
}

/** WHICH MEMBERS OF A COLLECTION THIS AUDIENCE SHOWS.
 *
 * ONE PICKER FOR THREE COLLECTIONS. This was LinkPicker, and socials and the
 * gallery were each about to become a copy of it. Task 11 exists because three
 * copies of one idea is how the social row ended up rendered three ways with
 * two of them missing platforms, and a picker is no safer than a renderer: the
 * copy nobody updates is the one that quietly stops matching.
 *
 * THE WHOLE ROW IS THE CONTROL. "Maybe you can click the ones you want to
 * display" was the ask, and a 16px checkbox is not a click target on a phone.
 *
 * EVERY BOX TICKED IS STORED AS "no choice made", not as a list naming every
 * member. The difference is invisible today and is the entire behaviour
 * tomorrow: null means a link, photo or account added next month appears here
 * by itself, while a full list quietly excludes it the day it exists. Ticking
 * every box says "all of them", not "these three forever".
 *
 * IDENTITY, NOT POSITION. A tick selects link_3_url, image_2_url or `tiktok` -
 * the column or the key - so it keeps meaning the same thing when a different
 * one is cleared or renamed. The gallery only became eligible for this in 11c,
 * when its slot number stopped being thrown away at the point the list was
 * built.
 */
function CollectionPicker({ row, collection, items, isOrg, onPicks }: {
  row: DraftAudience
  collection: ContextCollection
  items: PickItem[]
  isOrg: boolean
  onPicks: (collection: ContextCollection, v: (number | string)[] | null) => void
}) {
  const copy = COLLECTION_COPY[collection]
  const selected = row[collection] as (number | string)[] | null

  // AN ORGANISATION RUNS ONE CONFIGURATION ACROSS MANY CARDS, each with its
  // own link 3, own photo 2 and own TikTok, so there is nothing to name and
  // the members are offered by number or by platform. Taken from the registry
  // rather than written out here, so the day a social is added it appears in
  // this picker without anybody remembering to come back. Same compromise the
  // CTA picker makes, for the same reason.
  const spec = CONTEXT_COLLECTIONS[collection]
  const offered: PickItem[] = (isOrg && items.length === 0)
    ? (spec.kind === 'slot'
        ? Array.from({ length: spec.max }, (_, i) => ({ id: i + 1, label: copy.orphan(i + 1) }))
        : spec.keys.map(k => ({ id: k, label: SOCIAL_SLOTS.find(s => s.key === k)?.label ?? k })))
    : items
  const offerable = offered.map(i => i.id)

  // A member that was chosen and is now gone keeps its row. Dropping it on
  // sight would mean opening this panel silently edited the configuration,
  // which is the thing the CTA picker refuses to do with an empty slot.
  const orphans = (selected ?? []).filter(id => !offerable.includes(id))

  const showAll = selected === null
  const isOn = (id: number | string) => showAll || selected!.includes(id)
  const chosen = showAll ? offerable.length : selected!.length
  const sectionHidden = copy.section !== null && row.hide.includes(copy.section)

  function toggle(id: number | string) {
    const current = selected ?? offerable
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id]
    // Kept in the card's own order. visiblePicks can render a custom one and
    // 10a proves it does, but nothing on this screen asks for an order, and
    // inventing one would make the preview disagree with the card the owner
    // already knows by heart.
    const ordered = [...offerable, ...orphans].filter(x => next.includes(x))
    const isEverything =
      ordered.length === offerable.length && offerable.every(x => ordered.includes(x))
    onPicks(collection, isEverything ? null : ordered)
  }

  if (offered.length === 0) {
    return (
      <fieldset>
        <legend className="text-xs font-semibold mb-1">{copy.legend}</legend>
        <p className="text-[11px] text-muted-foreground">{copy.empty}</p>
      </fieldset>
    )
  }

  const rows: PickItem[] = [
    ...offered,
    ...orphans.map(id => ({ id, label: copy.orphan(id) })),
  ]

  return (
    <fieldset>
      <legend className="text-xs font-semibold mb-1">{copy.legend}</legend>
      <p className="text-[11px] text-muted-foreground mb-2">{copy.blurb}</p>

      <ul className="space-y-1.5">
        {rows.map(item => {
          const on = isOn(item.id)
          const empty = !offerable.includes(item.id)
          const domId = `pick-${collection}-${row.id}-${item.id}`
          return (
            <li key={String(item.id)}>
              <label htmlFor={domId}
                className="ctx-tick flex items-center gap-2.5 rounded-xl border px-3 py-2 min-h-11 cursor-pointer"
                style={{
                  borderColor: on ? 'hsl(var(--accent) / 0.5)' : 'hsl(var(--border))',
                  background: on ? 'hsl(var(--accent) / 0.07)' : 'hsl(var(--background))',
                }}>
                {/* NAMED OUT LOUD, rather than left to the wrapping label. Read
                    through the accessibility tree these came back named "on" -
                    the default value attribute of an HTML checkbox, and what a
                    control with no accessible name falls back to. The visible
                    label stays the first words of the spoken name, so a
                    speech-input user still says what they see. */}
                <input type="checkbox" id={domId}
                  checked={on} onChange={() => toggle(item.id)}
                  aria-label={empty
                    ? `${item.label}, currently empty`
                    : item.sub ? `${item.label}, ${item.sub}` : item.label}
                  className="w-4 h-4 flex-shrink-0" style={{ accentColor: 'hsl(var(--accent))' }} />
                <span className="text-sm min-w-0 flex-1">
                  <span className={on ? '' : 'text-muted-foreground'}>{item.label}</span>
                  {empty ? (
                    <span className="block text-[11px]" style={{ color: '#d97706' }}>
                      Currently empty, so nothing shows for it until you fill it in on your card.
                    </span>
                  ) : item.sub ? (
                    <span className="block text-[11px] text-muted-foreground">{item.sub}</span>
                  ) : null}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      <p className="text-[11px] text-muted-foreground mt-2">
        {showAll ? copy.all : chosen === 0 ? copy.none : `Showing ${chosen} of ${offerable.length}.`}
      </p>

      {sectionHidden && (
        <p className="text-[11px] flex items-start gap-1.5 mt-1" style={{ color: '#d97706' }}>
          <AlertTriangle className="w-3.5 h-3.5 mt-px flex-shrink-0" aria-hidden="true" />
          The {SECTION_LABEL[copy.section!]} section is hidden for this audience, so none of these
          will show. Your choice is kept for when you unhide it.
        </p>
      )}

      {isOrg && (
        <p className="text-[11px] text-muted-foreground mt-1">
          Applies to each team member&apos;s own card, so it is different content for each of them.
        </p>
      )}
    </fieldset>
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

        {/* WHY THIS IS WORDED THE WAY IT IS. The first version said "your card
            design does not show this button", which an owner on Circuit can
            see is false: Circuit shows a Book a slot button up in the hero
            beside the QR. What is actually true is narrower and less
            alarming - the design already has a booking button of its own, so
            Context has nowhere to add a second one without offering to book
            the same person twice. The rule has not changed, only the
            explanation, which was describing a card that does not exist. */}
        <Radio name={n} id={`${n}-booking`} checked={kind === 'booking'} disabled={!bookingAvailable}
          onChange={() => onCta({ kind: 'booking', index: null, label: row.cta?.label ?? null })}
          label={bookingAvailable
            ? 'Book a meeting'
            : 'Book a meeting (your design already has its own booking button)'} />

        {!bookingAvailable && (
          <p className="text-[11px] text-muted-foreground pl-7">
            Your card design puts its own booking button near the top, so Context cannot add a
            second one. Every other recommended action still works for this audience.
          </p>
        )}

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
