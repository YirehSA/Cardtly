import { teamHealth, cardStatus, QUIET_DAYS, type TeamHealth, type CardStatus } from './rep-teams'

// Reads a rep's teams for the My Teams page (app/dashboard/my-teams).
//
// SCOPED BY rep_id, AND NOTHING ELSE. organizations.rep_id is the one link
// between a rep and a client team (set by Admin, Reps); every other read here
// hangs off the teams that query returns, so a rep can only ever see the teams
// assigned to them. Service-role client, so this must only be called after
// the caller has been resolved to a rep (lib/rep-access) or an admin.
//
// What a rep sees is what after sales needs: who to call and how to reach
// them, whether people took up their cards, and whether the cards are opened.
// No prices and no invoices, which stay in the books.

export interface RepTeamCard {
  id: string
  name: string
  title: string | null
  slug: string | null
  isActive: boolean
  status: CardStatus
  inviteSentAt: string | null
  claimedAt: string | null
  hasPhoto: boolean
  opens: number
  saves: number
  leads: number
  lastOpenAt: string | null
  viewsAllTime: number
}

export interface RepTeamContact { label: string; name: string | null; email: string | null; phone: string | null }

export interface RepTeam {
  id: string
  name: string
  repName: string | null
  billingPeriod: string | null
  live: boolean
  suspended: boolean
  paidUntil: string | null
  trialEndsAt: string | null
  maxSeats: number
  createdAt: string | null
  ownerSignedInAt: string | null
  contacts: RepTeamContact[]
  cards: RepTeamCard[]
  health: TeamHealth
}

const CHUNK = 150

/** Every row, a thousand at a time, over id lists split small enough for a URL. */
async function rowsFor(db: any, table: string, select: string, column: string, ids: string[], since: string): Promise<any[]> {
  const out: any[] = []
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK)
    for (let from = 0; from < 100_000; from += 1000) {
      const { data, error } = await db.from(table).select(select)
        .in(column, part).gte('created_at', since).order('created_at', { ascending: true }).range(from, from + 999)
      if (error || !data) break
      out.push(...data)
      if (data.length < 1000) break
    }
  }
  return out
}

const RANK = { red: 0, amber: 1, green: 2 } as const

/**
 * The teams of one rep, or of every rep when repId is null (admins only),
 * worst first.
 */
export async function loadRepTeams(db: any, repId: string | null, now = new Date()): Promise<RepTeam[]> {
  let q = db.from('organizations').select('*')
  q = repId ? q.eq('rep_id', repId) : q.not('rep_id', 'is', null)
  const { data: orgs, error } = await q
  if (error || !orgs?.length) return []

  const orgIds = orgs.map((o: any) => o.id)
  const ownerIds = [...new Set<string>(orgs.map((o: any) => o.admin_user_id).filter(Boolean))]
  const repIds = [...new Set<string>(orgs.map((o: any) => o.rep_id).filter(Boolean))]
  const since = new Date(now.getTime() - QUIET_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: cards }, { data: clients }, { data: personal }, { data: reps }] = await Promise.all([
    db.from('team_cards')
      .select('id, organization_id, name, title, slug, is_active, user_id, invite_email, invite_sent_at, claimed_at, created_at, profile_image_url, view_count, phone, whatsapp')
      .in('organization_id', orgIds),
    db.from('billing_clients').select('organization_id, contact_person, email, phone').in('organization_id', orgIds),
    ownerIds.length ? db.from('cards').select('user_id, name, phone, whatsapp').in('user_id', ownerIds) : Promise.resolve({ data: [] }),
    repIds.length ? db.from('reps').select('id, name').in('id', repIds) : Promise.resolve({ data: [] }),
  ])
  const allCards = (cards || []) as any[]
  const cardIds = allCards.map(c => c.id)

  const [events, leads, owners] = await Promise.all([
    cardIds.length ? rowsFor(db, 'team_card_events', 'team_card_id, event_type, created_at', 'team_card_id', cardIds, since) : Promise.resolve([]),
    cardIds.length ? rowsFor(db, 'contacts', 'team_card_id, created_at', 'team_card_id', cardIds, since) : Promise.resolve([]),
    // One lookup per team owner: bounded by the number of teams, not of people.
    Promise.all(ownerIds.map(async id => {
      try {
        const { data } = await db.auth.admin.getUserById(id)
        return [id, { email: data?.user?.email || null, signedInAt: data?.user?.last_sign_in_at || null }] as const
      } catch { return [id, { email: null, signedInAt: null }] as const }
    })),
  ])
  const ownerById = Object.fromEntries(owners)
  const repName = Object.fromEntries(((reps || []) as any[]).map(r => [r.id, r.name]))

  const stats: Record<string, { opens: number; saves: number; leads: number; lastOpenAt: string | null }> = {}
  for (const id of cardIds) stats[id] = { opens: 0, saves: 0, leads: 0, lastOpenAt: null }
  for (const e of events) {
    const s = stats[e.team_card_id]
    if (!s) continue
    if (e.event_type === 'view') {
      s.opens++
      if (!s.lastOpenAt || e.created_at > s.lastOpenAt) s.lastOpenAt = e.created_at
    } else if (e.event_type === 'contact_save') s.saves++
  }
  for (const l of leads) if (stats[l.team_card_id]) stats[l.team_card_id].leads++

  const teams: RepTeam[] = orgs.map((o: any) => {
    const mine = allCards.filter(c => c.organization_id === o.id)
    const owner = ownerById[o.admin_user_id] || { email: null, signedInAt: null }
    const ownerCard = mine.find(c => c.user_id && c.user_id === o.admin_user_id)
      || ((personal || []) as any[]).find(c => c.user_id === o.admin_user_id)
    const client = ((clients || []) as any[]).find(c => c.organization_id === o.id)

    // Who to call. The owner first: they run the cards. The billing contact
    // too when it is somebody else, often the person who signed.
    const contacts: RepTeamContact[] = [{
      label: 'Owner',
      name: ownerCard?.name || null,
      email: owner.email,
      phone: ownerCard?.whatsapp || ownerCard?.phone || null,
    }]
    if (client && (client.email || client.phone)
      && String(client.email || '').toLowerCase() !== String(owner.email || '').toLowerCase()) {
      contacts.push({ label: 'Signed by', name: client.contact_person || null, email: client.email || null, phone: client.phone || null })
    }

    const teamCards: RepTeamCard[] = mine
      .map(c => {
        const s = stats[c.id]
        return {
          id: c.id,
          name: c.name?.trim() || c.invite_email || 'Unnamed card',
          title: c.title || null,
          slug: c.slug || null,
          isActive: c.is_active !== false,
          status: cardStatus({ userId: c.user_id, claimedAt: c.claimed_at, inviteSentAt: c.invite_sent_at }),
          inviteSentAt: c.invite_sent_at || null,
          claimedAt: c.claimed_at || null,
          hasPhoto: !!c.profile_image_url,
          opens: s.opens, saves: s.saves, leads: s.leads, lastOpenAt: s.lastOpenAt,
          viewsAllTime: Number(c.view_count || 0),
        }
      })
      .sort((a, b) => (b.opens - a.opens) || a.name.localeCompare(b.name))

    const health = teamHealth({
      createdAt: o.created_at || null,
      live: !!o.business_plan_active,
      suspended: !!o.suspended_at,
      billingPeriod: o.billing_period || null,
      paidUntil: o.paid_until || null,
      trialEndsAt: o.trial_ends_at || null,
      maxSeats: Number(o.max_seats || 0),
      ownerSignedInAt: owner.signedInAt,
      cards: mine.map(c => ({
        id: c.id, name: c.name || null, isActive: c.is_active !== false, userId: c.user_id || null,
        inviteEmail: c.invite_email || null, inviteSentAt: c.invite_sent_at || null, claimedAt: c.claimed_at || null,
        createdAt: c.created_at || null, hasPhoto: !!c.profile_image_url,
        opens: stats[c.id].opens, saves: stats[c.id].saves, leads: stats[c.id].leads, lastOpenAt: stats[c.id].lastOpenAt,
      })),
    }, now)

    return {
      id: o.id, name: o.name, repName: repName[o.rep_id] || null,
      billingPeriod: o.billing_period || null, live: !!o.business_plan_active, suspended: !!o.suspended_at,
      paidUntil: o.paid_until || null, trialEndsAt: o.trial_ends_at || null,
      maxSeats: Number(o.max_seats || 0), createdAt: o.created_at || null,
      ownerSignedInAt: owner.signedInAt, contacts, cards: teamCards, health,
    }
  })

  return teams.sort((a, b) => (RANK[a.health.tone] - RANK[b.health.tone])
    || (b.health.flags.length - a.health.flags.length) || a.name.localeCompare(b.name))
}
