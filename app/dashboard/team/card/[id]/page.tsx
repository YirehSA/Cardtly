import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect, notFound } from 'next/navigation'
import TeamCardEditor from '@/components/team/TeamCardEditor'
import { canManageDepartment } from '@/lib/department-perms'
import { resolveLocks } from '@/lib/team-locks'
import { resolveTeamBrand } from '@/lib/team-brand'

export const metadata = { title: 'Edit Team Card' }

export default async function TeamCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: card } = await admin
    .from('team_cards')
    .select('*')
    .eq('id', id)
    .single()

  if (!card) notFound()

  // Resolve the org first (every team card belongs to one) so we
  // know who the admin is. Service-role lookup so members - who
  // don't have read RLS on organizations - can still be matched.
  const { data: org } = await admin
    .from('organizations')
    .select('id, name, admin_user_id, brand')
    .eq('id', card.organization_id)
    .single()

  if (!org) notFound()

  // Three valid editor identities:
  //   admin   - the org's admin_user_id. Can edit everything.
  //   head    - the head of this card's department. Also edits everything,
  //             because they are the one who sets the locks for this team.
  //   member  - the team card's claimed user_id (their own card). Edits
  //             everything the org and department have not locked.
  // Anyone else gets bounced to the dashboard.
  //
  // The department head case used to be missing here while /api/team/card/save
  // already granted it, so a head could save changes they were never allowed to
  // open the editor to make.
  const isOrgAdmin = org.admin_user_id === user.id
  const isDeptHead = !isOrgAdmin && card.department_id
    ? await canManageDepartment(admin, user.id, card.department_id)
    : false
  const isCardOwner = (card as any).user_id === user.id
  if (!isOrgAdmin && !isDeptHead && !isCardOwner) redirect('/dashboard')

  const role: 'admin' | 'member' = (isOrgAdmin || isDeptHead) ? 'admin' : 'member'

  // The locks the member is actually working under. Only they are constrained,
  // so only they need them resolved. Reading these has to be tolerant: the
  // locked_fields columns arrive with a hand-applied migration, and a missing
  // column must read as "nothing locked" rather than locking someone out of
  // their own card.
  // The brand the preview must show is the same one the public card resolves:
  // department over org. Passing only the org brand meant anyone in a
  // department with its own look previewed the company's brand while their
  // real card wore the department's.
  const { data: dept } = card.department_id
    ? await admin.from('departments').select('brand').eq('id', card.department_id).maybeSingle()
    : { data: null }
  const resolvedBrand = resolveTeamBrand((org as any).brand || {}, (dept as any)?.brand || {})

  // The company half of this card's URL. Asked for on its own and tolerantly:
  // the column arrives with migration 044 while the code deploys on commit,
  // and a missing column must leave the editor working rather than break the
  // page. Null falls back to deriving it from the company name.
  //
  // Fetched separately rather than added to the select above, and certainly
  // not by widening that to select('*'): this org object is handed to a client
  // component, so every column it carries is published to the browser -
  // billing notes, seat counts and suspension reasons included.
  const slugPrefix = await (async (): Promise<string | null> => {
    try {
      const { data, error } = await admin
        .from('organizations').select('card_slug_prefix').eq('id', org.id).maybeSingle()
      if (error) return null
      return (data as any)?.card_slug_prefix || null
    } catch {
      return null
    }
  })()

  let lockedGroups: string[] = []
  if (role === 'member') {
    const readLocks = async (table: string, rowId: string | null) => {
      if (!rowId) return []
      const { data, error } = await admin.from(table).select('locked_fields').eq('id', rowId).maybeSingle()
      if (error) return []
      return (data as any)?.locked_fields ?? []
    }
    const [orgLocks, deptLocks] = await Promise.all([
      readLocks('organizations', card.organization_id),
      readLocks('departments', card.department_id),
    ])
    lockedGroups = resolveLocks(orgLocks, deptLocks)
  }

  return (
    <TeamCardEditor
      card={card}
      org={org}
      userId={user.id}
      role={role}
      orgBrand={resolvedBrand}
      lockedGroups={lockedGroups}
      slugPrefix={slugPrefix}
    />
  )
}
