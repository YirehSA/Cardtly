// The how-to videos (Bunny Stream), where each may play, and which page shows which.
//
// Andre, 2026-10-31: "add the videos to every point where it must be in the app
// or where it will help clients", plus a How-to page in the dashboard menu.
// The videos and their rules come from the video project (howto-videos/,
// VIDEO_LIST.md and RULES.md); the Bunny IDs, titles and lengths are generated
// into lib/howto-videos-data.ts by its upload script, never typed by hand.
//
// APPLE (RULES.md 1). Inside the iPhone app only "anywhere" videos may show:
//   - web-only videos (prices, buying, the reseller pages) play only on a page
//     the iPhone app can never open (isIosBlockedPath), and never on the
//     How-to page;
//   - not-ios videos (they name Android, or show what the iPhone app does not
//     have) are hidden when the dashboard is the iPhone app.
// Both checks live in canShow() below, which every button and the How-to page
// go through, so a wrong video cannot be placed by mistake.

import { isIosBlockedPath } from '@/lib/app-platform'
import { HOWTO_DATA, BUNNY_LIBRARY } from '@/lib/howto-videos-data'

export type HowToPlays = 'anywhere' | 'not-ios' | 'web-only'
export type HowToGroup = 'card' | 'sharing' | 'leads' | 'team' | 'managers' | 'members' | 'apps' | 'selling' | 'resellers'

interface Rule { group: HowToGroup; plays: HowToPlays; androidAppOnly?: boolean }

const RULES: Record<string, Rule> = {
  '01': { group: 'card', plays: 'anywhere' },
  '02': { group: 'card', plays: 'anywhere' },
  '03': { group: 'card', plays: 'anywhere' },
  '05': { group: 'card', plays: 'anywhere' },
  '06': { group: 'sharing', plays: 'anywhere' },
  '07': { group: 'sharing', plays: 'anywhere' },
  '08': { group: 'sharing', plays: 'not-ios' },
  // Tap to share works in the Android app only.
  '09': { group: 'sharing', plays: 'not-ios', androidAppOnly: true },
  '10': { group: 'sharing', plays: 'not-ios' },
  '11': { group: 'sharing', plays: 'anywhere' },
  '12': { group: 'sharing', plays: 'anywhere' },
  '13': { group: 'leads', plays: 'anywhere' },
  '14': { group: 'leads', plays: 'anywhere' },
  '15': { group: 'leads', plays: 'anywhere' },
  '16': { group: 'leads', plays: 'anywhere' },
  '17': { group: 'card', plays: 'anywhere' },
  '18': { group: 'card', plays: 'anywhere' },
  '20': { group: 'card', plays: 'anywhere' },
  '21': { group: 'selling', plays: 'web-only' },
  '22': { group: 'selling', plays: 'web-only' },
  '23': { group: 'selling', plays: 'web-only' },
  '24': { group: 'team', plays: 'anywhere' },
  '25': { group: 'team', plays: 'anywhere' },
  '26': { group: 'team', plays: 'anywhere' },
  '27': { group: 'team', plays: 'anywhere' },
  '28': { group: 'team', plays: 'anywhere' },
  '29': { group: 'team', plays: 'anywhere' },
  '30': { group: 'team', plays: 'anywhere' },
  '31': { group: 'team', plays: 'anywhere' },
  '32': { group: 'team', plays: 'not-ios' },
  '33': { group: 'team', plays: 'anywhere' },
  '34': { group: 'team', plays: 'anywhere' },
  '35': { group: 'team', plays: 'anywhere' },
  // "Anywhere" in the video list, but the iPhone app has no Microsoft sign-in,
  // so there it would show a button that is not on the screen.
  '36': { group: 'team', plays: 'not-ios' },
  '37': { group: 'managers', plays: 'anywhere' },
  '38': { group: 'members', plays: 'anywhere' },
  '39': { group: 'members', plays: 'anywhere' },
  '40': { group: 'members', plays: 'anywhere' },
  '41': { group: 'sharing', plays: 'anywhere' },
  '42': { group: 'card', plays: 'anywhere' },
  '43': { group: 'apps', plays: 'not-ios' },
  '44': { group: 'apps', plays: 'anywhere' },
  '45': { group: 'resellers', plays: 'web-only' },
  '46': { group: 'resellers', plays: 'web-only' },
}

export interface HowToVideo {
  n: string
  title: string
  seconds: number
  /** Bunny video IDs, 16:9 and 9:16. */
  landscape: string
  portrait: string
  group: HowToGroup
  plays: HowToPlays
  androidAppOnly: boolean
}

export const HOWTO_VIDEOS: HowToVideo[] = HOWTO_DATA
  .filter(d => RULES[d.n])
  .map(d => ({ ...d, ...RULES[d.n], androidAppOnly: !!RULES[d.n].androidAppOnly }))

export function howToVideo(n: string): HowToVideo | undefined {
  return HOWTO_VIDEOS.find(v => v.n === n)
}

export interface ShowContext {
  /** The page it would show on. Null for the How-to page itself. */
  pathname: string | null
  iosApp: boolean
  androidApp: boolean
}

/** The one gate for every video on every page (see APPLE above). */
export function canShow(v: HowToVideo, c: ShowContext): boolean {
  if (v.plays === 'web-only') return !c.iosApp && !!c.pathname && isIosBlockedPath(c.pathname)
  if (v.plays === 'not-ios' && c.iosApp) return false
  if (v.androidAppOnly && !c.androidApp) return false
  return true
}

export const GROUP_TITLES: Record<HowToGroup, string> = {
  card: 'Your card',
  sharing: 'Sharing your card',
  leads: 'Leads and contacts',
  team: 'Running your team',
  managers: 'Managing a department',
  members: 'Your team card',
  apps: 'The apps',
  selling: 'Plans and printed cards',
  resellers: 'Reselling Cardtly',
}

export interface Who {
  ownsTeam: boolean
  managesDepartment: boolean
  /** Holds a card in a team they do not own. */
  teamMember: boolean
  hasCard: boolean
  /** Their own card in a team, if they have one: its editor is /dashboard/team/card/<id>, the same page an owner
   *  edits anybody's card on. */
  ownTeamCardId?: string | null
}

/** The groups for the How-to page, the ones for this person's role first.
 *  Web-only groups never appear there. */
export function howToGroups(who: Who): HowToGroup[] {
  const first: HowToGroup[] = who.ownsTeam ? ['team', 'managers']
    : who.managesDepartment ? ['managers', 'members']
    : who.teamMember ? ['members']
    : ['card']
  const all: HowToGroup[] = ['card', 'sharing', 'leads', 'members', 'managers', 'team', 'apps']
  return [...first, ...all.filter(g => !first.includes(g))]
}

/** Which videos a dashboard page offers, in the order shown. */
export function howToForPage(pathname: string, who: Who): string[] {
  const p = pathname.replace(/\/+$/, '') || '/'
  if (p === '/dashboard') {
    if (who.teamMember && !who.ownsTeam) return ['39', '40', '08', '09']
    return who.hasCard ? ['06', '08', '09'] : ['01']
  }
  if (p === '/dashboard/card') return who.teamMember && !who.ownsTeam ? ['39'] : ['02', '03', '05', '17', '42']
  if (p.startsWith('/dashboard/team/card/')) {
    const own = !!who.ownTeamCardId && p.split('/')[4] === who.ownTeamCardId
    return own ? (who.ownsTeam ? ['35'] : ['39']) : ['33']
  }
  const simple: Record<string, string[]> = {
    '/dashboard/qr': ['07'],
    '/dashboard/analytics': ['16', '41'],
    '/dashboard/contacts': ['14'],
    '/dashboard/scan': ['15'],
    '/dashboard/questionnaire': ['13'],
    '/dashboard/context': ['18'],
    '/dashboard/email-signature': ['11'],
    '/dashboard/virtual-bg': ['12'],
    '/dashboard/nfc': who.ownsTeam || who.managesDepartment ? ['10', '32'] : ['10'],
    '/dashboard/settings': ['20', '36'],
    '/dashboard/team': who.ownsTeam ? ['24', '25', '33', '35', '34'] : who.managesDepartment ? ['37'] : [],
    '/dashboard/team/brand': ['26', '27'],
    '/dashboard/team/analytics': ['30'],
    '/dashboard/team/contacts': ['31'],
    '/dashboard/departments': ['28', '29'],
    '/dashboard/upgrade': ['21'],
    '/dashboard/reseller': ['45', '46'],
  }
  return simple[p] || []
}

/** Bunny's player for one video. */
export function playerUrl(id: string): string {
  return `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY}/${id}?autoplay=true&preload=true&responsive=true`
}

export function lengthLabel(seconds: number): string {
  const s = Math.round(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
