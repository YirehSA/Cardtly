'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CardDesign, DEFAULT_DESIGN, parseDesign, serializeDesign } from '@/types/design'
import { toast } from 'sonner'
import TemplatedCardPreview from '@/components/card/TemplatedCardPreview'
import DesignPanel from '@/components/card/DesignPanel'
import ImageUploader from '@/components/card/ImageUploader'
import { Save, ExternalLink, ArrowLeft, User, Phone, Link2, Image, Palette, Copy, Check } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface TeamCard {
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
  image_1_url: string | null
  image_2_url: string | null
  image_3_url: string | null
  image_4_url: string | null
  image_5_url: string | null
  certifications: string | null
  color_theme: string | null
  slug: string | null
  link_1_title: string | null; link_1_url: string | null
  link_2_title: string | null; link_2_url: string | null
  link_3_title: string | null; link_3_url: string | null
  link_4_title: string | null; link_4_url: string | null
  link_5_title: string | null; link_5_url: string | null
}

interface Org { id: string; name: string }

interface Props {
  card: TeamCard
  org: Org
  userId: string
}

type TabId = 'basic' | 'contact' | 'links' | 'media' | 'design'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'basic',   label: 'Profile', icon: <User className="w-4 h-4" /> },
  { id: 'contact', label: 'Contact', icon: <Phone className="w-4 h-4" /> },
  { id: 'links',   label: 'Links',   icon: <Link2 className="w-4 h-4" /> },
  { id: 'media',   label: 'Media',   icon: <Image className="w-4 h-4" /> },
  { id: 'design',  label: 'Design',  icon: <Palette className="w-4 h-4" /> },
]

export default function TeamCardEditor({ card, org, userId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  function copyLink() {
    if (!card.slug) return
    navigator.clipboard.writeText(`https://cardtly.com/card/${card.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const [activeTab, setActiveTab] = useState<TabId>('basic')
  const [slug, setSlug] = useState(card.slug || '')
  const [slugSaving, setSlugSaving] = useState(false)
  const [slugError, setSlugError] = useState('')
  const [slugSuccess, setSlugSuccess] = useState(false)
  const [design, setDesign] = useState<CardDesign>(() => parseDesign(card.color_theme))

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
    profile_image_url: card.profile_image_url || '',
    company_logo_url:  card.company_logo_url || '',
    image_1_url:       card.image_1_url || '',
    image_1_link:      (card as any).image_1_link || '',
    image_2_url:       card.image_2_url || '',
    image_2_link:      (card as any).image_2_link || '',
    image_3_url:       card.image_3_url || '',
    image_3_link:      (card as any).image_3_link || '',
    image_4_url:       card.image_4_url || '',
    image_4_link:      (card as any).image_4_link || '',
    image_5_url:       card.image_5_url || '',
    image_5_link:      (card as any).image_5_link || '',
    certifications:    card.certifications || '',
    link_1_title:      card.link_1_title || '', link_1_url: card.link_1_url || '',
    link_2_title:      card.link_2_title || '', link_2_url: card.link_2_url || '',
    link_3_title:      card.link_3_title || '', link_3_url: card.link_3_url || '',
    link_4_title:      card.link_4_title || '', link_4_url: card.link_4_url || '',
    link_5_title:      card.link_5_title || '', link_5_url: card.link_5_url || '',
  })

  const update = useCallback((field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  async function saveSlug() {
    if (!slug || slug.length < 3) { setSlugError('Min 3 characters'); return }
    setSlugSaving(true); setSlugError('')
    const res = await fetch('/api/team/slug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, team_card_id: card.id, org_id: org.id }),
    })
    const data = await res.json()
    if (!res.ok) { setSlugError(data.error || 'Failed') }
    else { setSlugSuccess(true); setTimeout(() => setSlugSuccess(false), 3000) }
    setSlugSaving(false)
  }

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('team_cards')
      .update({
        ...form,
        color_theme: serializeDesign(design),
        updated_at: new Date().toISOString(),
      })
      .eq('id', card.id)

    if (error) toast.error('Failed to save: ' + error.message)
    else toast.success('Card saved')
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
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <div className="flex items-center px-2 py-1.5 rounded-l-lg border border-r-0 border-border bg-muted text-xs text-muted-foreground whitespace-nowrap">
                  cardtly.com/card/
                </div>
                <input value={slug}
                  onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSlugError(''); setSlugSuccess(false) }}
                  placeholder="yireh-member-name"
                  className="px-3 py-1.5 rounded-r-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring transition w-44" />
                <button onClick={saveSlug} disabled={slugSaving || !slug || slug === card.slug}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                  style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
                  {slugSaving ? '...' : slugSuccess ? '✓ Saved' : 'Update URL'}
                </button>
                {slugError && <span className="text-xs text-destructive">{slugError}</span>}
              </div>
            </div>
          </div>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted p-1 rounded-xl mb-6 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap flex-1 justify-center ${activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">

          {activeTab === 'basic' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Profile Photo</label>
                <ImageUploader value={form.profile_image_url} onChange={url => update('profile_image_url', url)} bucket="card-images" userId={userId} shape="circle" />
              </div>
              <Field label="Full name" required>
                <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Jane Smith" />
              </Field>
              <Field label="Job title">
                <Input value={form.title} onChange={e => update('title', e.target.value)} placeholder="Sales Manager" />
              </Field>
              <Field label="Company">
                <Input value={form.company} onChange={e => update('company', e.target.value)} placeholder={org.name} />
              </Field>
              <Field label="Bio">
                <textarea value={form.bio} onChange={e => update('bio', e.target.value)}
                  placeholder="Tell people about this team member..." rows={4}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition resize-none" />
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
              <Field label="Work phone">
                <Input type="tel" value={form.work_phone} onChange={e => update('work_phone', e.target.value)} placeholder="+27 11 000 0000" />
              </Field>
              <Field label="WhatsApp">
                <Input type="tel" value={form.whatsapp} onChange={e => update('whatsapp', e.target.value)} placeholder="+27 82 000 0000" />
              </Field>
              <Field label="Address">
                <Input value={form.address} onChange={e => update('address', e.target.value)} placeholder="Johannesburg, South Africa" />
              </Field>
              <Field label="Website">
                <Input type="url" value={form.website} onChange={e => update('website', e.target.value)} placeholder="https://yoursite.com" />
              </Field>
              <Field label="LinkedIn URL">
                <Input type="url" value={form.linkedin_url} onChange={e => update('linkedin_url', e.target.value)} placeholder="https://linkedin.com/in/jane" />
              </Field>
              <Field label="Twitter / X URL">
                <Input type="url" value={form.twitter_url} onChange={e => update('twitter_url', e.target.value)} placeholder="https://twitter.com/jane" />
              </Field>
              <Field label="Instagram URL">
                <Input type="url" value={form.instagram_url} onChange={e => update('instagram_url', e.target.value)} placeholder="https://instagram.com/jane" />
              </Field>
              <Field label="Facebook URL">
                <Input type="url" value={(form as any).facebook_url || ''} onChange={e => update('facebook_url', e.target.value)} placeholder="https://facebook.com/yourpage" />
              </Field>
            </>
          )}

          {activeTab === 'links' && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">Add up to 5 custom links to this card.</p>
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
          )}

          {activeTab === 'media' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-1">Company Logo</label>
                <p className="text-xs text-muted-foreground mb-3">Shown on the card with position controlled in Design tab</p>
                <ImageUploader value={form.company_logo_url} onChange={url => update('company_logo_url', url)} bucket="company-logos" userId={userId} shape="square" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Gallery Images</label>
                <p className="text-xs text-muted-foreground mb-3">Up to 5 images shown on the card</p>
                <div className="grid grid-cols-1 gap-4">
                  {[1,2,3,4,5].map(i => (
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
          )}

          {activeTab === 'design' && (
            <DesignPanel design={design} onChange={setDesign} isPro={true} />
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Live preview */}
      <div className="xl:w-80 xl:flex-shrink-0">
        <div className="sticky top-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Live Preview</p>
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-800" style={{ maxHeight: '82vh', overflowY: 'auto' }}>
            <TemplatedCardPreview form={form} isPro={true} design={design} />
          </div>
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

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return (
    <input className={`w-full px-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition ${className}`} {...props} />
  )
}
