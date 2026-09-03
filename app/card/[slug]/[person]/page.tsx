import { createClient as createAdminClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import TeamCardPublic from '@/components/card/TeamCardPublic'
import { indexById, companyOf, type DeptNode } from '@/lib/department-tree'

// /card/<company>/<person>
//
// The second public card URL, for groups that hold several companies. The
// Building Company has seven businesses under it, and each wanted its own
// slice of the URL rather than a hyphen: /card/companya/thabo-nkosi instead of
// /card/companya-thabo-nkosi.
//
// It lives inside [slug] rather than in a [company] folder of its own because
// Next refuses two different dynamic names at one path level: [company] beside
// [slug] fails the build with "You cannot use different slug names for the
// same dynamic path". So the first segment is still called slug, and here it
// carries a company.
//
// /card/<slug> is untouched and permanent. Every NFC card already printed and
// every QR code already handed out encodes that form, so it has to keep
// resolving forever - this route is additional, never a replacement.
//
// Only team cards live here. A personal card has no company.

type Props = { params: Promise<{ slug: string; person: string }> }

/**
 * Resolve a company segment and a person slug to a card.
 *
 * Returns null rather than throwing so both the metadata pass and the page
 * body can call it and each decide what to do.
 */
async function resolve(companySegment: string, personSlug: string) {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // select('*') on departments, not named columns: migration 053 is applied by
  // hand, and naming slug_segment before it exists returns an empty result,
  // which would read as "no such company" rather than "not migrated yet".
  const { data: rows } = await admin.from('departments').select('*')
  const all: DeptNode[] = (rows || []).map((d: any) => ({
    id: d.id,
    organization_id: d.organization_id,
    name: d.name,
    parent_id: d.parent_id ?? null,
    kind: d.kind === 'company' ? 'company' : 'department',
    slug_segment: d.slug_segment ?? null,
  }))

  const wanted = companySegment.toLowerCase()
  const company = all.find(d => (d.slug_segment || '').toLowerCase() === wanted)
  if (!company) return null

  const { data: card } = await admin
    .from('team_cards')
    .select('*')
    .eq('organization_id', company.organization_id)
    .eq('is_active', true)
    .ilike('slug_person', personSlug)
    .maybeSingle()
  if (!card) return null

  // The card carries the right name inside the right organisation, but a group
  // has several companies in one organisation - so confirm this card actually
  // sits under THIS company. Without it, /card/companya/thabo-nkosi would
  // happily serve Company B's Thabo Nkosi.
  if (!card.department_id) return null
  const owning = companyOf(card.department_id, indexById(all))
  if (!owning || owning.id !== company.id) return null

  return { card, company }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // The first segment is the company here, the second the person.
  const { slug: company, person } = await params
  const found = await resolve(company, person)
  if (!found) return { title: 'Card not found' }

  const c = found.card
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com'
  const title = c.name ? `${c.name}${c.title ? ' - ' + c.title : ''}` : 'Cardtly'
  const description = c.bio || `${c.name || 'This card'}${c.company ? ' at ' + c.company : ''} on Cardtly.`
  const url = `${appUrl}/card/${company}/${person}`

  return {
    title,
    description,
    // The two-part URL is canonical for a card that has one, so search engines
    // consolidate on it rather than treating the two forms as duplicates.
    alternates: { canonical: `/card/${company}/${person}` },
    openGraph: {
      title,
      description,
      url,
      // Versioned like the single-card route, so an edited card gets a fresh
      // share image instead of whatever WhatsApp cached first.
      images: [`${appUrl}/api/og/card/${c.slug}${c.updated_at ? `?v=${Date.parse(c.updated_at)}` : ''}`],
      type: 'profile',
    },
  }
}

export default async function CompanyCardPage({ params }: Props) {
  const { slug: company, person } = await params
  const found = await resolve(company, person)
  if (!found) notFound()
  return <TeamCardPublic teamCard={found.card as any} />
}
