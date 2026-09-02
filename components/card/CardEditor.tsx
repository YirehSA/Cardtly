'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, UserPlan } from '@/types/database'
import { isPro } from '@/lib/plan'
import { CardDesign, DEFAULT_DESIGN, parseDesign, serializeDesign, MAX_CUSTOM_LINKS, MAX_GALLERY_IMAGES, LINK_SLOTS, IMAGE_SLOTS, linkFieldsFrom, imageFieldsFrom } from '@/types/design'
import { composeCardSlug, slugifyPart } from '@/lib/card-slug'
import { toast } from 'sonner'
import FlippableCardPreview from './FlippableCardPreview'
import DesignPanel from './DesignPanel'
import ProGate from './ProGate'
import ImageUploader from './ImageUploader'
import {
  Save, ExternalLink, Lock, User, Phone, Link2, Image, Palette, Copy, Check, Sparkles,
  Camera, MapPin, Plus, Building2, Linkedin, Twitter, Instagram, Facebook, Youtube,
} from 'lucide-react'
import { TikTokGlyph } from '@/components/card/SocialIcons'
import AIBioModal from './AIBioModal'
import { isNativeApp } from '@/lib/capacitor'
import { celebrateFirstSave, hasCelebratedFirstSave, markFirstSaveCelebrated } from '@/lib/celebrate'

interface Props {
  card: Card | null
  plan: UserPlan
  userId: string
  /** The company half of this person's card link, when they belong to one.
   *  Null for an individual, whose card is just their name. */
  slugPrefix?: string | null
}

type TabId = 'basic' | 'contact' | 'links' | 'media' | 'design'

// One comparable string for "everything the user can change", so unsaved work
// is detected without tracking each field by hand.
function snapshotOf(form: Record<string, unknown>, design: CardDesign): string {
  return JSON.stringify({ form, design })
}

// Each tab owns a colour, and that colour is used consistently: the tab, its
// heading, its icons. It turns five identical grey words into five places you
// can recognise at a glance and point at.
const TABS: {
  id: TabId; label: string; hint: string; icon: React.ReactNode; colour: string; proOnly?: boolean
}[] = [
  { id: 'basic',   label: 'You',     hint: 'Photo, name, what you do', icon: <User className="w-4 h-4" />,   colour: '#3b82f6' },
  { id: 'contact', label: 'Contact', hint: 'How people reach you',     icon: <Phone className="w-4 h-4" />,  colour: '#22c55e' },
  { id: 'links',   label: 'Links',   hint: 'Send people anywhere',     icon: <Link2 className="w-4 h-4" />,  colour: '#8b5cf6', proOnly: true },
  { id: 'media',   label: 'Photos',  hint: 'Your logo and pictures',   icon: <Image className="w-4 h-4" />,  colour: '#f59e0b', proOnly: true },
  { id: 'design',  label: 'Design',  hint: 'Colours and layout',       icon: <Palette className="w-4 h-4" />, colour: '#ec4899', proOnly: true },
]

// Which fields each tab is responsible for, so every tab can show how much of
// itself is filled in. Someone who does not know what to do next can simply
// look for the tab that is not full yet.
const TAB_FIELDS: Record<TabId, string[]> = {
  basic:   ['profile_image_url', 'name', 'title', 'company', 'bio', 'certifications'],
  contact: ['email', 'phone', 'work_phone', 'whatsapp', 'address', 'website',
            'linkedin_url', 'twitter_url', 'instagram_url', 'facebook_url', 'youtube', 'tiktok'],
  links:   LINK_SLOTS.map(i => `link_${i}_url`),
  media:   ['company_logo_url', ...IMAGE_SLOTS.map(i => `image_${i}_url`)],
  design:  [],
}

const TAB_COLOUR: Record<TabId, string> = Object.fromEntries(
  TABS.map(t => [t.id, t.colour])
) as Record<TabId, string>

// Each social in its own brand colour, so the row is scannable by logo rather
// than by reading four near-identical labels.
const SOCIALS: { key: string; label: string; placeholder: string; colour: string; icon: React.ReactNode }[] = [
  { key: 'linkedin_url',  label: 'LinkedIn',    placeholder: 'https://linkedin.com/in/you',  colour: '#0A66C2', icon: <Linkedin className="w-3 h-3" /> },
  { key: 'facebook_url',  label: 'Facebook',    placeholder: 'https://facebook.com/yourpage', colour: '#1877F2', icon: <Facebook className="w-3 h-3" /> },
  { key: 'instagram_url', label: 'Instagram',   placeholder: 'https://instagram.com/you',     colour: '#E4405F', icon: <Instagram className="w-3 h-3" /> },
  { key: 'twitter_url',   label: 'Twitter / X', placeholder: 'https://x.com/you',             colour: '#0f172a', icon: <Twitter className="w-3 h-3" /> },
  { key: 'youtube',       label: 'YouTube',     placeholder: 'https://youtube.com/@you',      colour: '#FF0000', icon: <Youtube className="w-3 h-3" /> },
  { key: 'tiktok',        label: 'TikTok',      placeholder: 'https://tiktok.com/@you',       colour: '#0f172a', icon: <TikTokGlyph className="w-3 h-3" /> },
]

// A titled block of related fields, in the tab's colour.
function Section({ title, hint, colour, icon, children }: {
  title: string; hint?: string; colour: string; icon?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border p-4 sm:p-5" style={{ background: colour + '08' }}>
      <div className="flex items-center gap-2.5 mb-1">
        {icon && (
          <span className="w-7 h-7 rounded-xl grid place-items-center shrink-0"
            style={{ background: colour + '1f', color: colour }}>{icon}</span>
        )}
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {hint && <p className="text-xs text-muted-foreground mb-4 ml-9">{hint}</p>}
      <div className={`space-y-4 ${hint ? '' : 'mt-4'}`}>{children}</div>
    </section>
  )
}

export default function CardEditor({ card, plan, userId, slugPrefix = null }: Props) {
  const supabase = createClient()
  const pro = isPro(plan)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('basic')
  const [aiBioOpen, setAiBioOpen] = useState(false)
  const [design, setDesign] = useState<CardDesign>(() => parseDesign(card?.color_theme || null))

  const [form, setForm] = useState({
    name:              card?.name || '',
    title:             card?.title || '',
    company:           card?.company || '',
    bio:               card?.bio || '',
    email:             card?.email || '',
    phone:             card?.phone || '',
    work_phone:        card?.work_phone || '',
    whatsapp:          card?.whatsapp || '',
    address:           card?.address || '',
    website:           card?.website || '',
    linkedin_url:      card?.linkedin_url || '',
    twitter_url:       card?.twitter_url || '',
    instagram_url:     card?.instagram_url || '',
    facebook_url:      card?.facebook_url || '',
    youtube:           (card as any)?.youtube || '',
    tiktok:            (card as any)?.tiktok || '',
    profile_image_url: card?.profile_image_url || '',
    company_logo_url:  card?.company_logo_url || '',
    // Generated from IMAGE_SLOTS, so raising the limit is one number rather
    // than eight more lines somebody has to remember to add.
    ...imageFieldsFrom(card),
    certifications:    card?.certifications || '',
    ...linkFieldsFrom(card),
  })

  const update = useCallback((field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  // Everything on this page lives in local state until Save is pressed, so
  // leaving without saving threw the work away without a word. Compare what is
  // on screen against what was last stored, and refuse to let it go quietly.
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
  // how this actually happens - someone edits, taps Dashboard, and it is gone.
  useEffect(() => {
    if (!dirty) return
    function onClick(e: MouseEvent) {
      const a = (e.target as HTMLElement)?.closest?.('a') as HTMLAnchorElement | null
      if (!a) return
      const href = a.getAttribute('href') || ''
      // Leave new tabs and non-navigations alone: they do not lose anything.
      if (!href.startsWith('/') || a.target === '_blank') return
      if (!window.confirm('You have unsaved changes to your card. Leave without saving?')) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [dirty])

  async function saveSlug() {
    if (!slug || slug.length < 2) { setSlugError('Min 2 characters'); return }
    if (!card?.id) {
      setSlugError('Your card is still loading. Refresh and try again.')
      return
    }
    setSlugSaving(true)
    setSlugError('')
    // Sends the person's half only. The server composes the company half, so
    // it cannot be edited away from here.
    const res = await fetch('/api/slug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person: slug, card_id: card.id }),
    })
    const data = await res.json()
    if (!res.ok) {
      setSlugError(data.error || 'Failed to update')
    } else {
      setSlugSuccess(true)
      setSavedSlug(data.slug || slug)
      setTimeout(() => setSlugSuccess(false), 3000)
    }
    setSlugSaving(false)
  }

  async function save() {
    if (!card?.id) {
      toast.error('Your card is still loading. Refresh and try again.')
      return
    }
    setSaving(true)
    const isFirst = !hasCelebratedFirstSave()

    // All design settings (including bold controls) live in color_theme JSON
    // Never send design-only fields as DB columns.
    //
    // .select() is what makes this honest. An update that matches no rows -
    // which is exactly what happens when RLS cannot see a row created by
    // another path, the case this page's own loader works around - comes back
    // with no error at all. Without checking that a row came back we told the
    // user "Card saved" and even "Your card is live!" while saving nothing,
    // and they would only find out later that their edits were gone.
    const payload: Record<string, any> = {
      ...form,
      color_theme: serializeDesign(design),
      updated_at: new Date().toISOString(),
    }
    const write = () => supabase.from('cards').update(payload).eq('id', card.id).select('id')
    let { data: updated, error } = await write()

    // Photos 7 to 10 arrive with migration 060, applied by hand after the
    // deploy. Postgres fails the whole update over one unknown column, so in
    // that window somebody fixing a typo in their name would be told their card
    // could not be saved. Drop the columns the table has not got and save the
    // rest, rather than losing everything they just typed.
    let late = 0
    if (error && ((error as any).code === '42703' || /column .* does not exist/i.test(error.message || ''))) {
      for (const key of Object.keys(payload)) {
        const n = Number(key.match(/^image_(\d+)_/)?.[1] ?? 0)
        if (n > 6) { delete payload[key]; late++ }
      }
      if (late > 0) ({ data: updated, error } = await write())
    }

    if (error) toast.error('Failed to save: ' + error.message)
    else if (!updated || updated.length === 0) {
      toast.error('Your changes were not saved. Please refresh and try again, or email andre@cardtly.com.')
    }
    else {
      toast.success(isFirst ? 'Your card is live! 🎉' : 'Card saved')
      // Only now is what is on screen genuinely what is stored.
      setSavedSnapshot(snapshotOf(form, design))
      if (isFirst) {
        markFirstSaveCelebrated()
        celebrateFirstSave()
      }
      // Push the fresh details to any saved Google Wallet passes so they
      // stay up to date. Best-effort and non-blocking; the server no-ops
      // if nobody has saved this card to Wallet.
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

  // Five empty link boxes and six empty photo boxes is a wall. Show what is
  // filled plus one waiting slot, and let people ask for more.
  const [linkSlots, setLinkSlots] = useState(() =>
    Math.max(1, Array.from({ length: MAX_CUSTOM_LINKS }, (_, i) => i + 1).filter(i => (card as any)?.[`link_${i}_url`] || (card as any)?.[`link_${i}_title`]).length + 0))
  const [photoSlots, setPhotoSlots] = useState(() =>
    Math.max(1, Array.from({ length: MAX_GALLERY_IMAGES }, (_, i) => i + 1).filter(i => (card as any)?.[`image_${i}_url`]).length + 0))

  // When this person belongs to a company, their link carries its name and
  // they only fill in their own half. An individual has no company, so
  // slugPrefix is null and the box is the whole link, exactly as before.
  //
  // If the current slug already follows the convention, strip the company off
  // and show the rest. If it does not - and no existing card does, since these
  // were random until now - fall back to their NAME rather than the old slug,
  // otherwise "andre-gqapw" would become "cardtly-andre-gqapw".
  const personFromSlug = slugPrefix && card?.slug?.startsWith(slugPrefix + '-')
    ? card.slug.slice(slugPrefix.length + 1)
    : null
  const [slug, setSlug] = useState(
    personFromSlug ?? (slugPrefix ? slugifyPart(card?.name || '') : (card?.slug || ''))
  )
  // Track the saved slug separately from the input value so the displayed
  // URL above the input updates immediately after a successful save,
  // instead of staying stale until the page is reloaded.
  const [savedSlug, setSavedSlug] = useState(card?.slug || '')
  const nextSlug = composeCardSlug(slugPrefix, slug)
  // Drive the displayed URL from local savedSlug state so it refreshes
  // immediately when the slug changes, without needing a page reload.
  const cardUrl = savedSlug ? `/card/${savedSlug}` : null
  const [copied, setCopied] = useState(false)
  function copyLink() {
    if (!savedSlug) return
    navigator.clipboard.writeText(`https://cardtly.com/card/${savedSlug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const [slugSaving, setSlugSaving] = useState(false)
  const [slugError, setSlugError] = useState('')
  const [slugSuccess, setSlugSuccess] = useState(false)

  return (
    <div className="flex flex-col xl:flex-row gap-6 max-w-7xl mx-auto">
      <div className="flex-1 min-w-0">

        <div className="rounded-3xl border border-border overflow-hidden mb-5">
          <div className="p-5 sm:p-6" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.12), transparent 65%)' }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl grid place-items-center text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold leading-tight">Your card</h1>
                  <p className="text-muted-foreground text-sm">Change anything here, then press save to put it live.</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Says out loud whether what is on screen is actually stored. */}
                <span className={`text-xs font-medium flex items-center gap-1.5 ${dirty ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  {dirty
                    ? <><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Not saved yet</>
                    : <><Check className="w-3.5 h-3.5 text-green-500" />All saved</>}
                </span>
                <button onClick={save} disabled={saving || !dirty}
                  className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : dirty ? 'Save changes' : 'Saved'}
                </button>
              </div>
            </div>

            {/* The card's address, and how to change it. */}
            <div className="mt-5 rounded-2xl border border-border bg-card/60 backdrop-blur p-3.5">
              {cardUrl && (
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Your link</span>
                  <a
                    href={cardUrl}
                    {...(isNativeApp() ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                    className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1">
                    cardtly.com{cardUrl} <ExternalLink className="w-3 h-3" />
                  </a>
                  <button onClick={copyLink} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground transition">
                    {copied ? <><Check className="w-3 h-3 text-green-500" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center px-2.5 py-2 rounded-l-xl border border-r-0 border-border bg-muted text-xs text-muted-foreground whitespace-nowrap">
                  cardtly.com/card/{slugPrefix && <span className="font-semibold text-foreground">{slugPrefix}-</span>}
                </div>
                <input
                  value={slug}
                  onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSlugError(''); setSlugSuccess(false) }}
                  placeholder={slugPrefix ? 'john-smith' : 'your-name'}
                  aria-label="Your part of the card link"
                  className="px-3 py-2 rounded-r-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring transition w-44 -ml-2"
                />
                <button onClick={saveSlug} disabled={slugSaving || !slug || nextSlug === savedSlug}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border border-border hover:bg-muted transition disabled:opacity-50 whitespace-nowrap">
                  {slugSaving ? 'Saving...' : slugSuccess ? '✓ Updated' : 'Change link'}
                </button>
                {slugError && <span className="text-xs text-destructive">{slugError}</span>}
              </div>
              {/* Changing a slug writes a slug_redirects row and the card page
                  follows it, so anything already printed keeps working. Worth
                  saying, because otherwise this looks like the scary button. */}
              <p className="text-[11px] text-muted-foreground mt-2">
                Safe to change. Your old link keeps working and sends people to the new one, so cards
                you have already printed are fine.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-5">
          {TABS.map(tab => {
            const locked = tab.proOnly && !pro
            const on = activeTab === tab.id
            const fields = TAB_FIELDS[tab.id]
            const done = fields.filter(f => String((form as any)[f] || '').trim()).length
            const complete = fields.length > 0 && done === fields.length
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`relative rounded-2xl border-2 p-3 text-left transition-all ${on ? '' : 'border-border hover:-translate-y-0.5'} ${locked ? 'opacity-60' : ''}`}
                style={on
                  ? { borderColor: tab.colour, background: tab.colour + '14' }
                  : undefined}>
                <span className="w-8 h-8 rounded-xl grid place-items-center mb-2"
                  style={{ background: tab.colour + (on ? '2b' : '18'), color: tab.colour }}>
                  {tab.icon}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-sm font-bold block" style={on ? { color: tab.colour } : undefined}>{tab.label}</span>
                  {locked && <Lock className="w-3 h-3 text-muted-foreground" />}
                </span>
                <span className="text-[11px] text-muted-foreground block leading-tight mt-0.5">{tab.hint}</span>
                {/* How full this tab is, so the next thing to do is obvious. */}
                {!locked && fields.length > 0 && (
                  <span className="text-[10px] font-bold mt-1.5 flex items-center gap-1"
                    style={{ color: complete ? '#22c55e' : 'hsl(var(--muted-foreground))' }}>
                    {complete ? <><Check className="w-3 h-3" />All done</> : `${done} of ${fields.length} filled`}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">

          {activeTab === 'basic' && (<>
            <Section title="Your photo" colour={TAB_COLOUR.basic} icon={<Camera className="w-4 h-4" />}
              hint="A friendly face gets saved far more often than a logo.">
              <ImageUploader value={form.profile_image_url} onChange={url => update('profile_image_url', url)} bucket="card-images" userId={userId} shape="circle" allowBackgroundRemoval={pro} />
            </Section>

            <Section title="Who you are" colour={TAB_COLOUR.basic} icon={<User className="w-4 h-4" />}
              hint="This is the big writing at the top of your card.">
              <Field label="Your name" required>
                <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Andre Nel" />
              </Field>
              <ProField label="What you do" pro={pro} hint="Your job title, like Founder or Electrician.">
                <Input value={form.title} onChange={e => update('title', e.target.value)} placeholder="Founder & CEO" disabled={!pro} />
              </ProField>
              <Field label="Where you work">
                <Input value={form.company} onChange={e => update('company', e.target.value)} placeholder="Yireh Business Solutions" />
              </Field>
            </Section>

            <Section title="A bit about you" colour={TAB_COLOUR.basic} icon={<Sparkles className="w-4 h-4" />}
              hint="A line or two so people remember why they met you. Stuck? Let the AI write it.">
              <ProField label="Your intro" pro={pro}>
                <div className="relative">
                  <textarea value={form.bio} onChange={e => update('bio', e.target.value)} placeholder="Tell people about yourself..." disabled={!pro} rows={4}
                    className="w-full px-4 py-2.5 pr-32 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition resize-none disabled:opacity-50 disabled:cursor-not-allowed" />
                  {pro && (
                    <button type="button" onClick={() => setAiBioOpen(true)}
                      className="absolute top-2 right-2 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white transition hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
                      <Sparkles className="w-3 h-3" />
                      Write with AI
                    </button>
                  )}
                </div>
              </ProField>
              <ProField label="What you are good at" pro={pro} hint="Separate with commas. These show as little tags on your card.">
                <Input value={form.certifications} onChange={e => update('certifications', e.target.value)} placeholder="Web Design, SEO, Digital Marketing" disabled={!pro} />
              </ProField>
            </Section>
          </>)}

          {activeTab === 'contact' && (<>
            <Section title="How people reach you" colour={TAB_COLOUR.contact} icon={<Phone className="w-4 h-4" />}
              hint="These become the big tappable buttons on your card.">
              <Field label="Email" required>
                <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@company.com" />
              </Field>
              <Field label="Phone number">
                <Input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+27 82 000 0000" />
              </Field>
              <ProField label="WhatsApp number" pro={pro} hint="Usually the same as your phone. Gives people a one-tap chat.">
                <Input type="tel" value={form.whatsapp} onChange={e => update('whatsapp', e.target.value)} placeholder="+27 82 000 0000" disabled={!pro} />
              </ProField>
              <ProField label="Office phone" pro={pro}>
                <Input type="tel" value={form.work_phone} onChange={e => update('work_phone', e.target.value)} placeholder="+27 11 000 0000" disabled={!pro} />
              </ProField>
            </Section>

            <Section title="Where to find you" colour={TAB_COLOUR.contact} icon={<MapPin className="w-4 h-4" />}
              hint="Your address opens directly in Maps when someone taps it.">
              <Field label="Website">
                <Input type="url" value={form.website} onChange={e => update('website', e.target.value)} placeholder="https://yoursite.com" />
              </Field>
              <ProField label="Address" pro={pro}>
                <Input value={form.address} onChange={e => update('address', e.target.value)} placeholder="Johannesburg, South Africa" disabled={!pro} />
              </ProField>
            </Section>

            <Section title="Your social profiles" colour={TAB_COLOUR.contact} icon={<Link2 className="w-4 h-4" />}
              hint="Paste the full link to each one. Leave blank any you do not use.">
              {SOCIALS.map(({ key, label, placeholder, colour, icon }) => (
                <ProField key={key} pro={pro} label={
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md grid place-items-center shrink-0"
                      style={{ background: colour + '22', color: colour }}>{icon}</span>
                    {label}
                  </span>
                }>
                  <Input type="url" value={(form as any)[key]} onChange={e => update(key, e.target.value)}
                    placeholder={placeholder} disabled={!pro} />
                </ProField>
              ))}
            </Section>
          </>)}

          {activeTab === 'links' && (
            pro ? (
              <Section title="Buttons that send people somewhere" colour={TAB_COLOUR.links} icon={<Link2 className="w-4 h-4" />}
                hint={`A menu, a booking page, a price list, your Google reviews. Up to ${MAX_CUSTOM_LINKS}.`}>
                {Array.from({ length: MAX_CUSTOM_LINKS }, (_, i) => i + 1).slice(0, linkSlots).map(i => (
                  <div key={i} className="rounded-2xl border border-border p-4 space-y-3 bg-card">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg grid place-items-center text-[11px] font-bold shrink-0"
                        style={{ background: TAB_COLOUR.links + '1f', color: TAB_COLOUR.links }}>{i}</span>
                      <p className="text-xs font-semibold text-muted-foreground">Link {i}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-muted-foreground">What should the button say?</label>
                      <Input value={form[`link_${i}_title` as keyof typeof form]} onChange={e => update(`link_${i}_title`, e.target.value)} placeholder="See our prices" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Where should it go?</label>
                      <Input type="url" value={form[`link_${i}_url` as keyof typeof form]} onChange={e => update(`link_${i}_url`, e.target.value)} placeholder="https://..." />
                    </div>
                  </div>
                ))}
                {linkSlots < MAX_CUSTOM_LINKS && (
                  <button type="button" onClick={() => setLinkSlots(n => Math.min(MAX_CUSTOM_LINKS, n + 1))}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground hover:border-foreground/30 hover:text-foreground transition">
                    <Plus className="w-4 h-4" />Add another button
                  </button>
                )}
              </Section>
            ) : <ProGate feature="Custom links" />
          )}

          {activeTab === 'media' && (
            pro ? (<>
              <Section title="Your company logo" colour={TAB_COLOUR.media} icon={<Building2 className="w-4 h-4" />}
                hint="Shown on your card and in the middle of your QR code. Resize it in Design.">
                <ImageUploader value={form.company_logo_url} onChange={url => update('company_logo_url', url)} bucket="company-logos" userId={userId} shape="square" />
              </Section>

              <Section title="Photos of your work" colour={TAB_COLOUR.media} icon={<Image className="w-4 h-4" />}
                hint={`Up to ${MAX_GALLERY_IMAGES}. Finished jobs, your shop, your products - whatever proves you are good at it.`}>
                {Array.from({ length: MAX_GALLERY_IMAGES }, (_, i) => i + 1).slice(0, photoSlots).map(i => (
                  <div key={i} className="rounded-2xl border border-border p-4 space-y-3 bg-card">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg grid place-items-center text-[11px] font-bold shrink-0"
                        style={{ background: TAB_COLOUR.media + '1f', color: TAB_COLOUR.media }}>{i}</span>
                      <p className="text-xs font-semibold text-muted-foreground">Photo {i}</p>
                    </div>
                    <ImageUploader value={form[`image_${i}_url` as keyof typeof form]} onChange={url => update(`image_${i}_url`, url)} bucket="card-images" userId={userId} shape="square" />
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-muted-foreground">
                        Open a page when this photo is tapped (optional)
                      </label>
                      <Input type="url" value={(form as any)[`image_${i}_link`] || ''} onChange={e => update(`image_${i}_link`, e.target.value)} placeholder="https://..." />
                    </div>
                  </div>
                ))}
                {photoSlots < MAX_GALLERY_IMAGES && (
                  <button type="button" onClick={() => setPhotoSlots(n => Math.min(MAX_GALLERY_IMAGES, n + 1))}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground hover:border-foreground/30 hover:text-foreground transition">
                    <Plus className="w-4 h-4" />Add another photo
                  </button>
                )}
              </Section>
            </>) : <ProGate feature="Gallery and media" />
          )}

          {activeTab === 'design' && (
            pro
              ? <DesignPanel design={design} onChange={setDesign} isPro={pro} />
              : <ProGate feature="Card design customisation" />
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-3">
          {dirty && (
            <p className="text-xs text-muted-foreground">
              You have changes that are not on your live card yet.
            </p>
          )}
          <button onClick={save} disabled={saving || !dirty}
            className="flex items-center gap-2 bg-foreground text-background px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-foreground/90 transition disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </div>

      {/* Live preview */}
      <div className="xl:w-80 xl:flex-shrink-0">
        <div className="sticky top-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Preview</p>
            <p className="text-xs text-muted-foreground italic">Tap the arrow to flip</p>
          </div>
          <FlippableCardPreview form={form} isPro={pro} design={design} cardUrl={cardUrl} />
          <AIBioModal
            open={aiBioOpen}
            onClose={() => setAiBioOpen(false)}
            onAccept={(bio) => update('bio', bio)}
            initial={{ role: form.title, company: form.company, bio: form.bio }}
          />
          {cardUrl && (
            <a
              href={cardUrl}
              {...(isNativeApp() ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
              className="mt-3 flex items-center justify-center gap-2 w-full border border-border rounded-xl py-2.5 text-sm font-medium hover:bg-muted transition">
              <ExternalLink className="w-4 h-4" />View live card
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, required, hint }: { label: string; children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">
        {label}{required && <span className="text-destructive ml-1">*</span>}
      </label>
      {hint && <p className="text-xs text-muted-foreground mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}

function ProField({ label, children, pro, hint }: { label: React.ReactNode; children: React.ReactNode; pro: boolean; hint?: string }) {
  return (
    <div className={pro ? '' : 'opacity-60'}>
      <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5">
        {label}
        {!pro && <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-normal flex items-center gap-1"><Lock className="w-2.5 h-2.5" />Pro</span>}
      </label>
      {hint && <p className="text-xs text-muted-foreground mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return (
    <input className={`w-full px-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition disabled:opacity-50 disabled:cursor-not-allowed ${className}`} {...props} />
  )
}
