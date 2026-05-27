'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, UserPlan } from '@/types/database'
import { isPro } from '@/lib/plan'
import { CardDesign, DEFAULT_DESIGN, parseDesign, serializeDesign } from '@/types/design'
import { toast } from 'sonner'
import TemplatedCardPreview from './TemplatedCardPreview'
import FlippableCardPreview from './FlippableCardPreview'
import DesignPanel from './DesignPanel'
import ProGate from './ProGate'
import ImageUploader from './ImageUploader'
import { Save, ExternalLink, Lock, User, Phone, Link2, Image, Palette, Copy, Check, Sparkles } from 'lucide-react'
import AIBioModal from './AIBioModal'
import { isNativeApp } from '@/lib/capacitor'
import { celebrateFirstSave, hasCelebratedFirstSave, markFirstSaveCelebrated } from '@/lib/celebrate'

interface Props {
  card: Card | null
  plan: UserPlan
  userId: string
}

type TabId = 'basic' | 'contact' | 'links' | 'media' | 'design'

const TABS: { id: TabId; label: string; icon: React.ReactNode; proOnly?: boolean }[] = [
  { id: 'basic',   label: 'Profile', icon: <User className="w-4 h-4" /> },
  { id: 'contact', label: 'Contact', icon: <Phone className="w-4 h-4" /> },
  { id: 'links',   label: 'Links',   icon: <Link2 className="w-4 h-4" />,   proOnly: true },
  { id: 'media',   label: 'Media',   icon: <Image className="w-4 h-4" />,   proOnly: true },
  { id: 'design',  label: 'Design',  icon: <Palette className="w-4 h-4" />, proOnly: true },
]

export default function CardEditor({ card, plan, userId }: Props) {
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
    profile_image_url: card?.profile_image_url || '',
    company_logo_url:  card?.company_logo_url || '',
    image_1_url:       card?.image_1_url || '',
    image_1_link:      card?.image_1_link || '',
    image_2_url:       card?.image_2_url || '',
    image_2_link:      card?.image_2_link || '',
    image_3_url:       card?.image_3_url || '',
    image_3_link:      card?.image_3_link || '',
    image_4_url:       card?.image_4_url || '',
    image_4_link:      card?.image_4_link || '',
    image_5_url:       card?.image_5_url || '',
    image_5_link:      card?.image_5_link || '',
    image_6_url:       card?.image_6_url || '',
    image_6_link:      card?.image_6_link || '',
    certifications:    card?.certifications || '',
    link_1_title:      card?.link_1_title || '',
    link_1_url:        card?.link_1_url || '',
    link_2_title:      card?.link_2_title || '',
    link_2_url:        card?.link_2_url || '',
    link_3_title:      card?.link_3_title || '',
    link_3_url:        card?.link_3_url || '',
    link_4_title:      card?.link_4_title || '',
    link_4_url:        card?.link_4_url || '',
    link_5_title:      card?.link_5_title || '',
    link_5_url:        card?.link_5_url || '',
  })

  const update = useCallback((field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  async function saveSlug() {
    if (!slug || slug.length < 3) { setSlugError('Min 3 characters'); return }
    if (!card?.id) {
      setSlugError('Your card is still loading. Refresh and try again.')
      return
    }
    setSlugSaving(true)
    setSlugError('')
    const res = await fetch('/api/slug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, card_id: card.id }),
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
    // Never send design-only fields as DB columns
    const { error } = await supabase
      .from('cards')
      .update({
        ...form,
        color_theme: serializeDesign(design),
        updated_at: new Date().toISOString(),
      })
      .eq('id', card.id)

    if (error) toast.error('Failed to save: ' + error.message)
    else {
      toast.success(isFirst ? 'Your card is live! 🎉' : 'Card saved')
      if (isFirst) {
        markFirstSaveCelebrated()
        celebrateFirstSave()
      }
    }
    setSaving(false)
  }

  const [slug, setSlug] = useState(card?.slug || '')
  // Track the saved slug separately from the input value so the displayed
  // URL above the input updates immediately after a successful save,
  // instead of staying stale until the page is reloaded.
  const [savedSlug, setSavedSlug] = useState(card?.slug || '')
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

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-xl font-bold">My Card</h1>
            {cardUrl && (
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={cardUrl}
                  {...(isNativeApp() ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  cardtly.com{cardUrl} <ExternalLink className="w-3 h-3" />
                </a>
                <button onClick={copyLink} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition">
                  {copied ? <><Check className="w-3 h-3 text-green-500" />Copied!</> : <><Copy className="w-3 h-3" />Copy</>}
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <div className="flex items-center px-2 py-1.5 rounded-l-lg border border-r-0 border-border bg-muted text-xs text-muted-foreground whitespace-nowrap">
                cardtly.com/card/
              </div>
              <input
                value={slug}
                onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSlugError(''); setSlugSuccess(false) }}
                placeholder="yireh-your-name"
                className="px-3 py-1.5 rounded-r-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring transition w-44"
              />
              <button onClick={saveSlug} disabled={slugSaving || !slug || slug === savedSlug}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
                {slugSaving ? '...' : slugSuccess ? '✓ Saved' : 'Update URL'}
              </button>
              {slugError && <span className="text-xs text-destructive">{slugError}</span>}
            </div>
          </div>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div className="flex flex-wrap gap-1 bg-muted p-1 rounded-xl mb-6">
          {TABS.map(tab => {
            const locked = tab.proOnly && !pro
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap flex-1 min-w-[120px] justify-center ${activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'} ${locked ? 'opacity-60' : ''}`}>
                {tab.icon}{tab.label}
                {locked && <Lock className="w-3 h-3" />}
              </button>
            )
          })}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">

          {activeTab === 'basic' && (<>
            <div>
              <label className="block text-sm font-medium mb-2">Profile Photo</label>
              <ImageUploader value={form.profile_image_url} onChange={url => update('profile_image_url', url)} bucket="card-images" userId={userId} shape="circle" allowBackgroundRemoval={pro} />
            </div>
            <Field label="Full name" required>
              <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Andre Nel" />
            </Field>
            <ProField label="Job title" pro={pro}>
              <Input value={form.title} onChange={e => update('title', e.target.value)} placeholder="Founder & CEO" disabled={!pro} />
            </ProField>
            <Field label="Company">
              <Input value={form.company} onChange={e => update('company', e.target.value)} placeholder="Yireh Business Solutions" />
            </Field>
            <ProField label="Bio" pro={pro}>
              <div className="relative">
                <textarea value={form.bio} onChange={e => update('bio', e.target.value)} placeholder="Tell people about yourself..." disabled={!pro} rows={4}
                  className="w-full px-4 py-2.5 pr-32 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition resize-none disabled:opacity-50 disabled:cursor-not-allowed" />
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
            <ProField label="Certifications / Tags" pro={pro} hint="Comma separated e.g. Web Design, SEO, Marketing">
              <Input value={form.certifications} onChange={e => update('certifications', e.target.value)} placeholder="Web Design, SEO, Digital Marketing" disabled={!pro} />
            </ProField>
          </>)}

          {activeTab === 'contact' && (<>
            <Field label="Email" required>
              <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@company.com" />
            </Field>
            <Field label="Phone">
              <Input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+27 82 000 0000" />
            </Field>
            <ProField label="Work phone" pro={pro}>
              <Input type="tel" value={form.work_phone} onChange={e => update('work_phone', e.target.value)} placeholder="+27 11 000 0000" disabled={!pro} />
            </ProField>
            <ProField label="WhatsApp" pro={pro}>
              <Input type="tel" value={form.whatsapp} onChange={e => update('whatsapp', e.target.value)} placeholder="+27 82 000 0000" disabled={!pro} />
            </ProField>
            <ProField label="Address" pro={pro}>
              <Input value={form.address} onChange={e => update('address', e.target.value)} placeholder="Johannesburg, South Africa" disabled={!pro} />
            </ProField>
            <Field label="Website">
              <Input type="url" value={form.website} onChange={e => update('website', e.target.value)} placeholder="https://yoursite.com" />
            </Field>
            <ProField label="LinkedIn URL" pro={pro}>
              <Input type="url" value={form.linkedin_url} onChange={e => update('linkedin_url', e.target.value)} placeholder="https://linkedin.com/in/you" disabled={!pro} />
            </ProField>
            <ProField label="Twitter / X URL" pro={pro}>
              <Input type="url" value={form.twitter_url} onChange={e => update('twitter_url', e.target.value)} placeholder="https://twitter.com/you" disabled={!pro} />
            </ProField>
            <ProField label="Instagram URL" pro={pro}>
              <Input type="url" value={form.instagram_url} onChange={e => update('instagram_url', e.target.value)} placeholder="https://instagram.com/you" disabled={!pro} />
            </ProField>
            <ProField label="Facebook URL" pro={pro}>
              <Input type="url" value={form.facebook_url} onChange={e => update('facebook_url', e.target.value)} placeholder="https://facebook.com/yourpage" disabled={!pro} />
            </ProField>
          </>)}

          {activeTab === 'links' && (
            pro ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Add up to 5 custom links to your card.</p>
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="rounded-xl border border-border p-4 space-y-2.5 bg-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Link {i}</p>
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Label</label>
                      <Input value={form[`link_${i}_title` as keyof typeof form]} onChange={e => update(`link_${i}_title`, e.target.value)} placeholder="e.g. Our Website" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-muted-foreground">URL</label>
                      <Input type="url" value={form[`link_${i}_url` as keyof typeof form]} onChange={e => update(`link_${i}_url`, e.target.value)} placeholder="https://..." />
                    </div>
                  </div>
                ))}
              </div>
            ) : <ProGate feature="Custom links" />
          )}

          {activeTab === 'media' && (
            pro ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-1">Company Logo</label>
                  <p className="text-xs text-muted-foreground mb-3">Resize and position it in the Design tab</p>
                  <ImageUploader value={form.company_logo_url} onChange={url => update('company_logo_url', url)} bucket="company-logos" userId={userId} shape="square" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Gallery Images</label>
                  <p className="text-xs text-muted-foreground mb-3">Up to 6 images shown on your card</p>
                  <div className="grid grid-cols-1 gap-4">
                    {[1,2,3,4,5,6].map(i => (
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
                </div>
              </div>
            ) : <ProGate feature="Gallery and media" />
          )}

          {activeTab === 'design' && (
            pro
              ? <DesignPanel design={design} onChange={setDesign} isPro={pro} />
              : <ProGate feature="Card design customisation" />
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-foreground text-background px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-foreground/90 transition disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save changes'}
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

function ProField({ label, children, pro, hint }: { label: string; children: React.ReactNode; pro: boolean; hint?: string }) {
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
