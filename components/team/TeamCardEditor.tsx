'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { CardDesign, parseDesign, serializeDesign, LINK_SLOTS, IMAGE_SLOTS, MAX_CUSTOM_LINKS, MAX_GALLERY_IMAGES, linkFieldsFrom, imageFieldsFrom, type LinkSlot, type ImageSlot } from '@/types/design'
import { mergeBrand } from '@/lib/team-brand'
import { lockedColumns, LOCK_GROUPS } from '@/lib/team-locks'
import { INDUSTRIES_BY_GROUP } from '@/lib/industries'
import { orgSlugPrefix, composeCardSlug, slugifyPart } from '@/lib/card-slug'
import { toast } from 'sonner'
import TemplatedCardPreview from '@/components/card/TemplatedCardPreview'
import DesignPanel from '@/components/card/DesignPanel'
import ImageUploader from '@/components/card/ImageUploader'
import AIBioModal from '@/components/card/AIBioModal'
import { Save, ExternalLink, ArrowLeft, User, Phone, Link2, Image, Palette, Copy, Check, Lock, Sparkles } from 'lucide-react'
import Link from 'next/link'

// The repeated slot columns, declared from the shared lists rather than typed
// out. They used to be twenty lines here and twenty more in the form below, and
// raising the limit meant remembering both.
type SlotColumns =
  & { [K in ImageSlot as `image_${K}_url` | `image_${K}_link`]?: string | null }
  & { [K in LinkSlot as `link_${K}_title` | `link_${K}_url`]?: string | null }

interface TeamCard extends SlotColumns {
  id: string
  organization_id: string
  name: string
  title: string | null
  company: string | null
  bio: string | null
  email: string | null
  phone: string | null
  work_phone: string | null
  whatsapp: string | null
  address: string | null
  website: string | null
  linkedin_url: string | null
  twitter_url: string | null
  instagram_url: string | null
  profile_image_url: string | null
  company_logo_url: string | null
  certifications: string | null
  color_theme: string | null
  slug: string | null
  allow_homepage_feature?: boolean | null
  industry?: string | null
  hide_from_network?: boolean | null
  org_hide_from_network?: boolean | null
}

interface Org { id: string; name: string }

interface Props {
  card: TeamCard
  org: Org
  userId: string
  /**
   * 'admin'  - org admin or the head of this card's department. Full edit
   *            access; they are the ones who set the locks.
   * 'member' - the user who claimed this card. Edits everything except the
   *            lock groups in lockedGroups, and the card's URL.
   */
  role?: 'admin' | 'member'
  /** The org's team brand (logo, company, colours, etc). Merged into
   *  the live preview so it matches the public card. */
  orgBrand?: Record<string, any>
  /** Lock-group ids this editor's user is working under, already resolved
   *  from the org's and the department's settings. Empty for admins and
   *  department heads, who set the locks rather than live under them. */
  lockedGroups?: string[]
  /** The company half of this card's URL, from the organisation. Null before
   *  migration 044, in which case it is derived from the company name. */
  slugPrefix?: string | null
}

// One comparable string for "everything the user can change", so unsaved work
// is detected without tracking each field by hand.
function snapshotOf(form: Record<string, unknown>, design: CardDesign): string {
  return JSON.stringify({ form, design })
}

type TabId = 'basic' | 'contact' | 'links' | 'media' | 'design'

// Colours match the personal card editor so the two feel like one product.
const ALL_TABS: { id: TabId; label: string; hint: string; icon: React.ReactNode; colour: string }[] = [
  { id: 'basic',   label: 'Profile', hint: 'Photo, name, what you do', icon: <User className="w-4 h-4" />,    colour: '#3b82f6' },
  { id: 'contact', label: 'Contact', hint: 'How people reach you',     icon: <Phone className="w-4 h-4" />,   colour: '#22c55e' },
  { id: 'links',   label: 'Links',   hint: 'Send people anywhere',     icon: <Link2 className="w-4 h-4" />,   colour: '#8b5cf6' },
  { id: 'media',   label: 'Media',   hint: 'Logo and pictures',        icon: <Image className="w-4 h-4" />,   colour: '#f59e0b' },
  { id: 'design',  label: 'Design',  hint: 'Colours and layout',       icon: <Palette className="w-4 h-4" />, colour: '#ec4899' },
]

// Which fields each tab owns, so each tab can show how much of itself is
// filled in. Someone who does not know what to do next looks for the tab
// that is not full yet.
const TAB_FIELDS: Record<TabId, string[]> = {
  basic:   ['profile_image_url', 'name', 'title', 'company', 'bio', 'certifications'],
  contact: ['email', 'phone', 'work_phone', 'whatsapp', 'address', 'website',
            'linkedin_url', 'twitter_url', 'instagram_url', 'facebook_url', 'youtube', 'tiktok'],
  links:   LINK_SLOTS.map(i => `link_${i}_url`),
  media:   ['company_logo_url', ...IMAGE_SLOTS.map(i => `image_${i}_url`)],
  design:  [],
}

export default function TeamCardEditor({ card, org, userId, role = 'admin', orgBrand = {}, lockedGroups = [], slugPrefix = null }: Props) {
  // Brand only applies to this card if the admin opted it in AND a
  // team brand is set. Cards keeping their own branding stay fully
  // editable, with no brand merged into the preview.
  const usesBrand = !!(card as any).use_team_brand && Object.keys(orgBrand).length > 0
  const isAdmin = role === 'admin'
  const isMember = role === 'member'

  // What this member may not touch. The Design tab used to be hidden from
  // every member unconditionally, and every other field was shown as freely
  // editable no matter what the company had locked - so a member could type
  // into a locked field, save, and be told afterwards that it was ignored.
  // Both now follow the same resolved locks the save endpoint enforces.
  const locked = useMemo(() => new Set(lockedColumns(lockedGroups)), [lockedGroups])
  const isLocked = useCallback((field: string) => locked.has(field), [locked])
  const designLocked = lockedGroups.includes('design')
  const TABS = ALL_TABS.filter(t => t.id !== 'design' || isAdmin || !designLocked)
  const [saving, setSaving] = useState(false)
  const [aiBioOpen, setAiBioOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  function copyLink() {
    if (!card.slug) return
    navigator.clipboard.writeText(`https://cardtly.com/card/${card.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const [activeTab, setActiveTab] = useState<TabId>('basic')
  // The URL is company-firstname-surname. The company half is fixed and set on
  // the organisation; only the person's half is typed here.
  const companyPart = slugPrefix || orgSlugPrefix(org.name || '')

  // What to show in the box. If the current URL already follows the
  // convention, strip the company half off and show the rest.
  //
  // If it does not - and most existing cards do not, since slugs were written
  // three different ways over time (person-company, person-random, and
  // company-person) - fall back to the card's NAME rather than to the old
  // slug. Prefilling from a slug like "hannetjie-atterbury-sicongroup" would
  // turn one save into "sicon-group-hannetjie-atterbury-sicongroup".
  const personFromSlug = card.slug && card.slug.startsWith(companyPart + '-')
    ? card.slug.slice(companyPart.length + 1)
    : null
  const [slug, setSlug] = useState(personFromSlug || slugifyPart(card.name || ''))
  const [slugSaving, setSlugSaving] = useState(false)
  const [slugError, setSlugError] = useState('')
  const [slugSuccess, setSlugSuccess] = useState(false)
  const [savedSlug, setSavedSlug] = useState(card.slug || '')

  // What the URL will actually be, composed exactly as the server composes it.
  const nextSlug = composeCardSlug(companyPart, slug)
  const slugChanges = !!slug && nextSlug !== savedSlug
  const [design, setDesign] = useState<CardDesign>(() => parseDesign(card.color_theme))

  // Homepage-feature opt-in. Saves instantly (like the personal
  // settings toggle) rather than waiting for "Save changes".
  const [allowFeature, setAllowFeature] = useState(!!card.allow_homepage_feature)
  const [featureSaving, setFeatureSaving] = useState(false)
  async function toggleFeature(next: boolean) {
    setFeatureSaving(true)
    setAllowFeature(next)
    try {
      const res = await fetch('/api/cards/visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: card.id, allow_homepage_feature: next }),
      })
      if (!res.ok) throw new Error()
      toast.success(next ? 'This card may now be featured on the homepage' : 'This card will no longer be featured')
    } catch {
      setAllowFeature(!next) // revert
      toast.error('Could not update. Try again.')
    }
    setFeatureSaving(false)
  }

  // Network listing. Two separate switches on purpose: this one is the card
  // holder's own choice, and org_hide_from_network is the team admin's. Both
  // must allow it for the card to appear, so this toggle shows as off - and
  // says why - when the admin has excluded the card.
  const orgExcluded = !!card.org_hide_from_network
  const [inNetwork, setInNetwork] = useState(!card.hide_from_network)
  const [networkSaving, setNetworkSaving] = useState(false)
  const [industry, setIndustry] = useState(card.industry || '')
  const [industrySaving, setIndustrySaving] = useState(false)

  async function toggleNetwork(next: boolean) {
    setNetworkSaving(true)
    setInNetwork(next)
    try {
      const res = await fetch('/api/cards/visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: card.id, hide_from_network: !next }),
      })
      if (!res.ok) throw new Error()
      toast.success(next ? 'This card is listed in the Network' : 'This card is no longer listed')
    } catch {
      setInNetwork(!next) // revert
      toast.error('Could not update. Try again.')
    }
    setNetworkSaving(false)
  }

  async function saveIndustry(next: string) {
    const prev = industry
    setIndustry(next)
    setIndustrySaving(true)
    try {
      const res = await fetch('/api/team/card/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: card.id, fields: { industry: next || null } }),
      })
      if (!res.ok) throw new Error()
      toast.success('Industry saved')
    } catch {
      setIndustry(prev)
      toast.error('Could not save industry. Try again.')
    }
    setIndustrySaving(false)
  }

  const [form, setForm] = useState({
    name:              card.name || '',
    title:             card.title || '',
    company:           card.company || '',
    bio:               card.bio || '',
    email:             card.email || '',
    phone:             card.phone || '',
    work_phone:        card.work_phone || '',
    whatsapp:          card.whatsapp || '',
    address:           card.address || '',
    website:           card.website || '',
    linkedin_url:      card.linkedin_url || '',
    twitter_url:       card.twitter_url || '',
    instagram_url:     card.instagram_url || '',
    facebook_url:      (card as any).facebook_url || '',
    youtube:           (card as any).youtube || '',
    tiktok:            (card as any).tiktok || '',
    profile_image_url: card.profile_image_url || '',
    company_logo_url:  card.company_logo_url || '',
    ...imageFieldsFrom(card),
    certifications:    card.certifications || '',
    ...linkFieldsFrom(card),
  })

  const update = useCallback((field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  // Unsaved-work tracking, same as the personal editor. Without it a member
  // could write a long bio, click the team breadcrumb, and lose the lot with
  // no warning at all.
  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshotOf(form, design))
  const dirty = snapshotOf(form, design) !== savedSnapshot

  // Covers closing the tab and reloading.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // Covers clicking away inside the app, which beforeunload never sees and is
  // how this actually happens - someone edits, taps the org name, and it is gone.
  useEffect(() => {
    if (!dirty) return
    function onClick(e: MouseEvent) {
      const a = (e.target as HTMLElement)?.closest?.('a') as HTMLAnchorElement | null
      if (!a) return
      const href = a.getAttribute('href') || ''
      if (!href.startsWith('/') || a.target === '_blank') return
      if (!window.confirm('You have unsaved changes to this card. Leave without saving?')) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [dirty])

  // How much of each tab is filled in, so the tabs can carry a count.
  function filledCount(tab: TabId): { done: number; total: number } {
    const fields = TAB_FIELDS[tab].filter(f => !isLocked(f))
    const done = fields.filter(f => {
      const v = (form as any)[f]
      return typeof v === 'string' && v.trim().length > 0
    }).length
    return { done, total: fields.length }
  }

  async function saveSlug() {
    if (!slug || slug.length < 2) { setSlugError('Min 2 characters'); return }
    setSlugSaving(true); setSlugError('')
    // Sends the person's half only. The server composes the company half from
    // the organisation, so the prefix cannot be edited away from here.
    const res = await fetch('/api/team/slug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person: slug, team_card_id: card.id }),
    })
    const data = await res.json()
    if (!res.ok) { setSlugError(data.error || 'Failed') }
    else {
      setSavedSlug(data.slug)
      setSlugSuccess(true); setTimeout(() => setSlugSuccess(false), 3000)
      // Say whether the old link still works. A rename used to break every
      // printed card silently; now it writes a redirect, and the person
      // renaming is the one who needs to know which happened.
      if (data.previous && data.previous !== data.slug) {
        toast.success(data.redirected
          ? `Now at /card/${data.slug}. The old link still works.`
          : `Now at /card/${data.slug}. The old link could NOT be redirected - anything printed with it will stop working.`,
          { duration: data.redirected ? 6000 : 12000 })
      }
    }
    setSlugSaving(false)
  }

  async function save() {
    setSaving(true)

    // The save goes through the API, which decides what may actually be
    // written. This used to update team_cards straight from the browser after
    // stripping locked fields here - which meant the locks only held for people
    // who did not look. Sending everything and letting the server strip it is
    // both simpler and the only version that is true.
    const payload: Record<string, any> = { ...form }
    if (isAdmin) payload.color_theme = serializeDesign(design)

    const res = await fetch('/api/team/card/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: card.id, fields: payload }),
    })
    const result = await res.json().catch(() => ({}))

    if (!res.ok || !result.success) {
      toast.error(result.error || 'Failed to save')
    } else {
      // Say so when the company kept something, rather than pretending it saved.
      if (result.removed?.length) {
        toast.success('Saved. Some details are set by your company and were left as they are.')
      } else {
        toast.success('Card saved')
      }
      // Only now is the work actually on the server, so this is where the
      // baseline moves. Doing it optimistically would drop the unsaved-changes
      // warning for a save that failed.
      setSavedSnapshot(snapshotOf(form, design))
      // Keep any saved Google Wallet passes for this team card in sync.
      // Best-effort and non-blocking; no-ops if nobody saved it.
      const slug = (card as any).slug
      if (slug) {
        fetch('/api/wallet/google/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug }),
        }).catch(() => {})
      }
    }
    setSaving(false)
  }

  const cardUrl = card.slug ? `/card/${card.slug}` : null

  return (
    <div className="flex flex-col xl:flex-row gap-6 max-w-7xl mx-auto">
      <div className="flex-1 min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/team"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
              <ArrowLeft className="w-4 h-4" />
              {org.name}
            </Link>
            <span className="text-muted-foreground">/</span>
            <div>
              <h1 className="font-display text-xl font-bold">{form.name || 'New team card'}</h1>
              {cardUrl && (
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <a href={cardUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    cardtly.com{cardUrl} <ExternalLink className="w-3 h-3" />
                  </a>
                  <button onClick={copyLink}
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition">
                    {copied ? <><Check className="w-3 h-3 text-green-500" />Copied!</> : <><Copy className="w-3 h-3" />Copy</>}
                  </button>
                </div>
              )}
              {isAdmin && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* The company half is shown, not typed. It is set once on
                        the organisation so every card in the company shares it,
                        which is the whole point: sicon-group-john-smith reads as
                        Sicon's, and a rep cannot accidentally publish under a
                        different name to their colleagues. */}
                    <div className="flex items-center px-2 py-1.5 rounded-l-lg border border-r-0 border-border bg-muted text-xs text-muted-foreground whitespace-nowrap">
                      cardtly.com/card/<span className="font-semibold text-foreground">{companyPart}-</span>
                    </div>
                    <input value={slug}
                      onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSlugError(''); setSlugSuccess(false) }}
                      placeholder="john-smith"
                      aria-label="This person's part of the card link"
                      className="px-3 py-1.5 rounded-r-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring transition w-44" />
                    <button onClick={saveSlug} disabled={slugSaving || !slug || !slugChanges}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                      style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
                      {slugSaving ? '...' : slugSuccess ? '✓ Saved' : 'Update URL'}
                    </button>
                    {slugError && <span className="text-xs text-destructive">{slugError}</span>}
                  </div>
                  {/* Renaming a live card is not free. Say so before they do it,
                      not after: the old URL is on printed cards and NFC tags. */}
                  {slugChanges && savedSlug && (
                    <p className="text-[11px] text-amber-500 mt-1.5">
                      This card is live at <span className="font-mono">/card/{savedSlug}</span>. Changing it to{' '}
                      <span className="font-mono">/card/{nextSlug}</span> keeps the old link working through a redirect,
                      but anything already printed will point at the redirect rather than the card.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium ${dirty ? 'text-amber-500' : 'text-muted-foreground'}`}>
              {dirty ? 'Unsaved changes' : 'All changes saved'}
            </span>
            <button onClick={save} disabled={saving || !dirty}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
            </button>
          </div>
        </div>

        {/* Member banner. This used to state a fixed list of what was locked,
            which stopped being true the moment locks became choosable - it
            claimed the design and company name were managed centrally even
            when the company had left them open. It now lists what is actually
            locked, or says plainly that nothing is. */}
        {isMember && (
          <div className="mb-5 rounded-xl p-4 border flex items-start gap-3" style={{ borderColor: 'rgba(124,58,237,0.3)', background: 'linear-gradient(135deg, rgba(0,212,255,0.06), rgba(124,58,237,0.08), rgba(236,72,153,0.06))' }}>
            <div className="text-lg mt-0.5">💼</div>
            <div className="flex-1 text-sm">
              <p className="font-semibold mb-0.5">You&rsquo;re editing your team card</p>
              {lockedGroups.length === 0 ? (
                <p className="text-muted-foreground">
                  Everything on this card is yours to edit. Only the card&rsquo;s web address is set by {org.name}.
                </p>
              ) : (
                <>
                  <p className="text-muted-foreground mb-2">
                    Everything is yours to edit except the items below, which {org.name} keeps the same across the team.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {LOCK_GROUPS.filter(g => lockedGroups.includes(g.id)).map(g => (
                      <span key={g.id} title={g.hint}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border border-border bg-background/60 text-muted-foreground">
                        <Lock className="w-3 h-3" />{g.label}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tabs. Each owns a colour, carries its own hint, and shows how much
            of itself is filled in, so the next thing to do is visible without
            opening every tab to check. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-6">
          {TABS.map(tab => {
            const on = activeTab === tab.id
            const { done, total } = filledCount(tab.id)
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`text-left p-3 rounded-xl border-2 transition ${on ? '' : 'border-border hover:border-foreground/20'}`}
                style={on ? { borderColor: tab.colour, background: tab.colour + '14' } : undefined}>
                <div className="flex items-center justify-between mb-1">
                  <span style={{ color: on ? tab.colour : undefined }}
                    className={on ? '' : 'text-muted-foreground'}>{tab.icon}</span>
                  {total > 0 && (
                    <span className="text-[10px] font-semibold tabular-nums"
                      style={{ color: done === total ? '#22c55e' : undefined }}>
                      {done}/{total}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold leading-tight"
                  style={{ color: on ? tab.colour : undefined }}>{tab.label}</p>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{tab.hint}</p>
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">

          {activeTab === 'basic' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Profile Photo</label>
                <ImageUploader value={form.profile_image_url} onChange={url => update('profile_image_url', url)} bucket="card-images" userId={userId} shape="circle" allowBackgroundRemoval />
              </div>
              <Field label="Full name" required>
                <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Jane Smith" />
              </Field>
              <Field label="Job title">
                <Input value={form.title} onChange={e => update('title', e.target.value)} placeholder="Sales Manager" />
              </Field>
              <Field label="Company" locked={isLocked('company')} lockedBy={org.name}>
                <Input value={form.company} onChange={e => update('company', e.target.value)} placeholder={org.name} disabled={isLocked('company')} />
              </Field>
              {/* The AI writer, same as a personal card gets. A team card is
                  always Pro, since the organisation pays for it, so there is no
                  plan gate.
                  No lock check either: bio belongs to no lock group in
                  lib/team-locks, deliberately - the company fixes its logo,
                  name, website and design, and the words a person writes about
                  themselves stay theirs. Guarding on isLocked('bio') would be
                  a condition that can never be true, implying a control the
                  company does not actually have. */}
              <Field label="Bio" hint="Stuck? Let the AI write it.">
                <div className="relative">
                  <textarea value={form.bio} onChange={e => update('bio', e.target.value)}
                    placeholder="Tell people about this team member..." rows={4}
                    className="w-full px-4 py-2.5 pr-32 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition resize-none" />
                  <button type="button" onClick={() => setAiBioOpen(true)}
                    className="absolute top-2 right-2 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white transition hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
                    <Sparkles className="w-3 h-3" />Write it for me
                  </button>
                </div>
              </Field>
              <Field label="Certifications / Tags" hint="Comma separated e.g. Sales, Certified, CPA">
                <Input value={form.certifications} onChange={e => update('certifications', e.target.value)} placeholder="Sales, Certified, CPA" />
              </Field>
            </>
          )}

          {activeTab === 'contact' && (
            <>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="jane@company.com" />
              </Field>
              <Field label="Phone">
                <Input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+27 82 000 0000" />
              </Field>
              <Field label="Work phone" locked={isLocked('work_phone')} lockedBy={org.name}>
                <Input type="tel" value={form.work_phone} onChange={e => update('work_phone', e.target.value)} placeholder="+27 11 000 0000" disabled={isLocked('work_phone')} />
              </Field>
              <Field label="WhatsApp">
                <Input type="tel" value={form.whatsapp} onChange={e => update('whatsapp', e.target.value)} placeholder="+27 82 000 0000" />
              </Field>
              <Field label="Address" locked={isLocked('address')} lockedBy={org.name}>
                <Input value={form.address} onChange={e => update('address', e.target.value)} placeholder="Johannesburg, South Africa" disabled={isLocked('address')} />
              </Field>
              <Field label="Website" locked={isLocked('website')} lockedBy={org.name}>
                <Input type="url" value={form.website} onChange={e => update('website', e.target.value)} placeholder="https://yoursite.com" disabled={isLocked('website')} />
              </Field>
              <Field label="LinkedIn URL" locked={isLocked('linkedin_url')} lockedBy={org.name}>
                <Input type="url" value={form.linkedin_url} onChange={e => update('linkedin_url', e.target.value)} placeholder="https://linkedin.com/in/jane" disabled={isLocked('linkedin_url')} />
              </Field>
              <Field label="Twitter / X URL" locked={isLocked('twitter_url')} lockedBy={org.name}>
                <Input type="url" value={form.twitter_url} onChange={e => update('twitter_url', e.target.value)} placeholder="https://twitter.com/jane" disabled={isLocked('twitter_url')} />
              </Field>
              <Field label="Instagram URL" locked={isLocked('instagram_url')} lockedBy={org.name}>
                <Input type="url" value={form.instagram_url} onChange={e => update('instagram_url', e.target.value)} placeholder="https://instagram.com/jane" disabled={isLocked('instagram_url')} />
              </Field>
              <Field label="Facebook URL" locked={isLocked('facebook_url')} lockedBy={org.name}>
                <Input type="url" value={(form as any).facebook_url || ''} onChange={e => update('facebook_url', e.target.value)} placeholder="https://facebook.com/yourpage" disabled={isLocked('facebook_url')} />
              </Field>
              <Field label="YouTube URL" locked={isLocked('youtube')} lockedBy={org.name}>
                <Input type="url" value={(form as any).youtube || ''} onChange={e => update('youtube', e.target.value)} placeholder="https://youtube.com/@you" disabled={isLocked('youtube')} />
              </Field>
              <Field label="TikTok URL" locked={isLocked('tiktok')} lockedBy={org.name}>
                <Input type="url" value={(form as any).tiktok || ''} onChange={e => update('tiktok', e.target.value)} placeholder="https://tiktok.com/@you" disabled={isLocked('tiktok')} />
              </Field>
            </>
          )}

          {activeTab === 'links' && (
            <div className="space-y-5">
              {isLocked('link_1_url') ? (
                <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm">
                  <Lock className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    The link buttons on this card are set by {org.name} and are the same across the team.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Add up to {MAX_CUSTOM_LINKS} custom links to this card.</p>
              )}
              {LINK_SLOTS.map(i => (
                <div key={i} className="rounded-xl border border-border p-4 space-y-2.5 bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Link {i}</p>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Label</label>
                    <Input value={form[`link_${i}_title` as keyof typeof form]} onChange={e => update(`link_${i}_title`, e.target.value)} placeholder="e.g. Our Website" disabled={isLocked('link_1_url')} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-muted-foreground">URL</label>
                    <Input type="url" value={form[`link_${i}_url` as keyof typeof form]} onChange={e => update(`link_${i}_url`, e.target.value)} placeholder="https://..." disabled={isLocked('link_1_url')} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'media' && (
            <div className="space-y-6">
              {!isLocked('company_logo_url') ? (
                <div>
                  <label className="block text-sm font-medium mb-1">Company Logo</label>
                  <p className="text-xs text-muted-foreground mb-3">Shown on the card with position controlled in Design tab</p>
                  <ImageUploader value={form.company_logo_url} onChange={url => update('company_logo_url', url)} bucket="company-logos" userId={userId} shape="square" />
                </div>
              ) : form.company_logo_url ? (
                <div>
                  <label className="block text-sm font-medium mb-1">Company Logo</label>
                  <p className="text-xs text-muted-foreground mb-3">Set by {org.name} and shared across all team cards.</p>
                  <div className="inline-block rounded-xl border border-border p-3 bg-muted/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.company_logo_url} alt="Company logo" className="h-16 w-auto object-contain opacity-70" />
                  </div>
                </div>
              ) : null}
              <div>
                <label className="block text-sm font-medium mb-1">Gallery Images</label>
                <p className="text-xs text-muted-foreground mb-3">
                  {isLocked('image_1_url')
                    ? `The gallery on this card is set by ${org.name}.`
                    : `Up to ${MAX_GALLERY_IMAGES} images shown on the card`}
                </p>
                {isLocked('image_1_url') ? (
                  // Read-only when the company owns the gallery. Showing upload
                  // controls that silently discard the upload would be worse
                  // than showing none.
                  <div className="flex flex-wrap gap-3">
                    {IMAGE_SLOTS
                      .map(i => (form as any)[`image_${i}_url`] as string)
                      .filter(Boolean)
                      .map((url, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={url} alt={`Gallery image ${i + 1}`}
                          className="h-20 w-20 rounded-lg border border-border object-cover opacity-70" />
                      ))}
                    {!IMAGE_SLOTS.some(i => (form as any)[`image_${i}_url`]) && (
                      <p className="text-xs text-muted-foreground">No gallery images set.</p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {IMAGE_SLOTS.map(i => (
                      <div key={i} className="rounded-xl border border-border p-3 space-y-2 bg-muted/20">
                        <p className="text-xs font-semibold text-muted-foreground">Image {i}</p>
                        <ImageUploader value={form[`image_${i}_url` as keyof typeof form]} onChange={url => update(`image_${i}_url`, url)} bucket="card-images" userId={userId} shape="square" />
                        <div>
                          <label className="block text-xs font-medium mb-1 text-muted-foreground">Link (optional)</label>
                          <Input type="url" value={(form as any)[`image_${i}_link`] || ''} onChange={e => update(`image_${i}_link`, e.target.value)} placeholder="https://... (tap image to open)" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'design' && (
            <DesignPanel design={design} onChange={setDesign} isPro={true} />
          )}
        </div>

        {/* Homepage feature opt-in. Saves instantly on toggle. */}
        <div className="mt-4 rounded-xl border border-border p-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold mb-1">Feature this card on cardtly.com</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When on, this team card may appear in the rotating &ldquo;Real cards, real people&rdquo; showcase on the public Cardtly homepage. Eight cards show at a time and refresh daily. Turn it off any time.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={allowFeature}
            disabled={featureSaving}
            onClick={() => !featureSaving && toggleFeature(!allowFeature)}
            className="relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition disabled:opacity-50"
            style={{ background: allowFeature ? 'linear-gradient(135deg, #00d4ff, #7c3aed)' : 'rgba(255,255,255,0.15)' }}>
            <span className="inline-block h-5 w-5 transform rounded-full bg-white transition"
              style={{ transform: allowFeature ? 'translateX(22px)' : 'translateX(2px)' }} />
          </button>
        </div>

        {/* Network listing + industry. Saves instantly, like the toggle above. */}
        <div className="mt-4 rounded-xl border border-border p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold mb-1">List this card in the Cardtly Network</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The Network is a directory other signed-in Cardtly members can search to find people by company, name or position. It shows name, position, company and photo, never a phone number or email address.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={inNetwork && !orgExcluded}
              disabled={networkSaving || orgExcluded}
              onClick={() => !networkSaving && !orgExcluded && toggleNetwork(!inNetwork)}
              className="relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition disabled:opacity-50"
              style={{ background: inNetwork && !orgExcluded ? 'linear-gradient(135deg, #00d4ff, #7c3aed)' : 'rgba(255,255,255,0.15)' }}>
              <span className="inline-block h-5 w-5 transform rounded-full bg-white transition"
                style={{ transform: inNetwork && !orgExcluded ? 'translateX(22px)' : 'translateX(2px)' }} />
            </button>
          </div>

          {orgExcluded && (
            <p className="mt-3 text-xs text-muted-foreground flex items-start gap-1.5">
              <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              {org.name} has chosen to keep this card out of the Network. Only a team admin can change that.
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-border">
            <label htmlFor="team-industry" className="block text-sm font-semibold mb-1">Industry</label>
            <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
              Lets people filter the Network down to this line of work.
            </p>
            <select
              id="team-industry"
              value={industry}
              onChange={e => saveIndustry(e.target.value)}
              disabled={industrySaving}
              className="w-full sm:w-72 min-h-[44px] px-3 rounded-lg border border-border bg-background text-sm disabled:opacity-50"
            >
              <option value="">Not set</option>
              {INDUSTRIES_BY_GROUP.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map(i => (
                    <option key={i.id} value={i.id}>{i.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={save} disabled={saving || !dirty}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </div>

      {/* Live preview */}
      <div className="xl:w-80 xl:flex-shrink-0">
        <div className="sticky top-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Live Preview</p>
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-800" style={{ maxHeight: '82vh', overflowY: 'auto' }}>
            <TemplatedCardPreview
              form={usesBrand ? mergeBrand(form, orgBrand, locked) : form}
              isPro={true}
              design={usesBrand && orgBrand.color_theme ? parseDesign(orgBrand.color_theme) : design}
            />
          </div>
          {/* Mounted beside the preview, as on a personal card. The endpoint
              only needs an authenticated user - it takes the role, company and
              tone and returns text - so nothing about it is specific to which
              table the card lives in. */}
          <AIBioModal
            open={aiBioOpen}
            onClose={() => setAiBioOpen(false)}
            onAccept={(bio) => update('bio', bio)}
            initial={{ role: form.title, company: form.company || org.name, bio: form.bio }}
          />
          {cardUrl && (
            <a href={cardUrl} target="_blank" rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-2 w-full border border-border rounded-xl py-2.5 text-sm font-medium hover:bg-muted transition">
              <ExternalLink className="w-4 h-4" />View live card
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, required, hint, locked, lockedBy }: {
  label: string; children: React.ReactNode; required?: boolean; hint?: string
  locked?: boolean; lockedBy?: string
}) {
  return (
    <div className={locked ? 'opacity-70' : undefined}>
      <label className="flex items-center gap-1.5 text-sm font-medium mb-1.5">
        {label}{required && <span className="text-destructive ml-1">*</span>}
        {locked && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-border text-muted-foreground">
            <Lock className="w-2.5 h-2.5" />Set by {lockedBy || 'your company'}
          </span>
        )}
      </label>
      {hint && <p className="text-xs text-muted-foreground mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return (
    <input className={`w-full px-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition ${className}`} {...props} />
  )
}
