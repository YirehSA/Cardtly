import { createClient as createAdminClient } from '@supabase/supabase-js'
import PublicCardView from '@/components/card/PublicCardView'
import ReportCardLink from '@/components/card/ReportCardLink'
import CardTracker from '@/components/card/CardTracker'
import { mergeBrand } from '@/lib/team-brand'
import { lockedColumnsFor } from '@/lib/team-locks'
import { hydrateBrandSources } from '@/lib/brand-source'
import { liveMirror } from '@/lib/questionnaire'
import { indexById, ancestorChain, resolveBrandChain, type DeptNode } from '@/lib/department-tree'

// Rendering a team card, shared by both public routes.
//
// This was the second half of app/card/[slug]/page.tsx. It moved here when
// /card/<company>/<person> was added, because the alternative was a second
// copy of the add-on merging, the brand cascade and the suspension notice -
// and the two would have drifted, so a card would look different depending on
// which of its two URLs somebody opened.
//
// The caller resolves the card. This only renders it.

export default async function TeamCardPublic({ teamCard }: { teamCard: any }) {
  // Add-ons (contact exchange, questionnaire) for a team are configured once
  // on the organization and apply to every team card. Fetch the org's add-ons
  // and merge them over the card's own (org wins). Service role: organizations
  // is RLS-protected.
  let orgAddons: Record<string, any> = {}
  let orgBrand: Record<string, any> = {}
  let orgLocked: unknown = null
  // The chain of departments above this card, root first. For a flat
  // organisation that is one department, or none.
  let deptChain: DeptNode[] = []
  // A suspension shows a notice on every card in the team. It never takes them
  // offline: the card opens, saves and scans exactly as before, it just no
  // longer looks finished, so the person carrying it asks their finance team
  // why. That is the lever.
  let suspendedMessage: string | null = null

  if (teamCard.organization_id) {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as any

    // select('*') so locked_fields comes along without naming it: it is what
    // decides which brand fields override the card, and naming a column a
    // pending migration has not added returns an EMPTY row - which here would
    // mean no brand and no locks at all on a live public card.
    const { data: org } = await admin
      .from('organizations')
      .select('*')
      .eq('id', teamCard.organization_id)
      .maybeSingle()
    orgAddons = org?.addons || {}
    // A look that follows a card is read from that card now, rather than from
    // the copy taken when it was chosen. See lib/brand-source.
    orgBrand = org ? (await hydrateBrandSources(admin, [org]))[0].brand || {} : {}
    orgLocked = org?.locked_fields ?? null
    if (org?.suspended_at) suspendedMessage = org.suspension_message || ''

    if (teamCard.department_id) {
      // Every department in the org, so the chain above this card can be
      // walked. Group brand, then company, then department, each overriding
      // the one above only for the fields it actually sets.
      //
      // select('*') rather than naming parent_id: migration 053 is applied by
      // hand, and naming a column that does not exist yet returns an EMPTY
      // result, which would silently strip the department brand from every
      // card in the team rather than failing loudly.
      const { data: depts } = await admin
        .from('departments')
        .select('*')
        .eq('organization_id', teamCard.organization_id)

      // Departments may follow a card too, so they are hydrated as one batch
      // rather than one query per level of the chain.
      const nodes: DeptNode[] = (await hydrateBrandSources(admin, depts || [])).map((d: any) => ({
        id: d.id,
        organization_id: d.organization_id,
        name: d.name,
        parent_id: d.parent_id ?? null,
        kind: d.kind === 'company' ? 'company' : 'department',
        slug_segment: d.slug_segment ?? null,
        brand: d.brand || {},
        locked_fields: d.locked_fields ?? null,
      }))
      deptChain = ancestorChain(teamCard.department_id, indexById(nodes))
    }
  }

  // The team brand is merged over this card ONLY if the admin opted it in
  // (use_team_brand). Cards that keep their own branding (a family member, a
  // contractor with their own company) are left untouched. Personal fields
  // always win for anything not in the brand.
  const brandToApply = teamCard.use_team_brand
    ? resolveBrandChain(orgBrand, deptChain)
    : {}

  // What the company has actually taken control of. The brand wins on these;
  // everything else it defines is a default the member may replace, which is
  // what leaving a group unlocked was always supposed to mean.
  const lockedForCard = lockedColumnsFor(orgLocked, deptChain.map(d => d.locked_fields))

  // Org add-ons fan out to every team card. The lead-capture form is
  // allocated per card:
  //   - use_team_questionnaire === false  -> this card shows no form
  //   - addons.assignedFormId set          -> this card shows that specific
  //                                           form from the org's library
  //   - neither                            -> the org's default (active) form
  // Cards that predate per-card allocation have no assignedFormId, so they
  // resolve to the org default exactly as before.
  const cardAddons = teamCard.addons || {}
  const mergedAddons: Record<string, any> = { ...cardAddons, ...orgAddons }
  if (teamCard.use_team_questionnaire === false) {
    mergedAddons.questionnaireEnabled = false
    delete mergedAddons.questionnaire
    delete mergedAddons.questionnaires
    delete mergedAddons.activeQuestionnaireId
  } else if (orgAddons.questionnaireEnabled) {
    const library = Array.isArray(orgAddons.questionnaires) ? orgAddons.questionnaires : []
    const chosen =
      (cardAddons.assignedFormId && library.find((f: any) => f.id === cardAddons.assignedFormId)) ||
      library.find((f: any) => f.id === orgAddons.activeQuestionnaireId) ||
      library[0] ||
      null
    if (chosen) {
      mergedAddons.questionnaire = liveMirror(chosen)
      mergedAddons.activeQuestionnaireId = chosen.id
    }
  }

  const cardShaped = mergeBrand({
    ...teamCard,
    user_id: null,
    is_primary: true,
    view_count: teamCard.view_count || 0,
    work_phone: teamCard.work_phone || null,
    whatsapp: teamCard.whatsapp || null,
    addons: mergedAddons,
    // Pass team_card_id so contact form saves correctly
    _team_card_id: teamCard.id,
  }, brandToApply, lockedForCard)

  return (
    <CardTracker teamCardId={teamCard.id}>
      <PublicCardView card={cardShaped as any} isPro={true} isTeamCard={true} suspendedMessage={suspendedMessage} />
      <ReportCardLink teamCardId={teamCard.id} cardName={teamCard.name} />
    </CardTracker>
  )
}
