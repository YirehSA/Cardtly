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
// The topics follow the sections of the series (howto-videos/VIDEO_LIST.md), so the How-to page reads in the
// series' own order, 01 to 44, top to bottom.
export type HowToGroup = 'card' | 'sharing' | 'leads' | 'more' | 'team' | 'managers' | 'members' | 'visitors' | 'apps' | 'selling' | 'resellers'

interface Rule { group: HowToGroup; plays: HowToPlays; androidAppOnly?: boolean }

// Words people search the How-to page with, beyond the title.
const KEYWORDS: Record<string, string> = {
  '01': 'create make new start set up first card',
  '02': 'design links photos colours template look button',
  '03': 'photo logo picture frame crop zoom',
  '05': 'ai bio about write',
  '06': 'share link whatsapp sms send number',
  '07': 'qr code download print colours logo',
  '08': 'google wallet',
  '09': 'tap share nfc phone android',
  '10': 'nfc write sticker tag card',
  '11': 'email signature outlook gmail',
  '12': 'background zoom teams video call virtual',
  '13': 'leads form questions capture share back',
  '14': 'contacts export follow up save csv',
  '15': 'scan paper business card camera',
  '16': 'analytics views stats opens numbers',
  '17': 'booking meeting calendar book appointment',
  '18': 'context audiences personalise first impression',
  '20': 'settings password link address data delete account',
  '21': 'pro upgrade trial code pay subscribe',
  '22': 'order printed nfc cards',
  '23': 'team set up start company',
  '24': 'add people excel spreadsheet import staff employees',
  '25': 'invite claim email send',
  '26': 'brand look logo colours team design',
  '27': 'lock rules company fields',
  '28': 'departments companies org chart structure',
  '29': 'manager head department boss',
  '30': 'team analytics report monthly',
  '31': 'leads team all',
  '32': 'nfc write team cards',
  '33': 'leaves revoke hand on remove staff',
  '34': 'crm webhook api integration it',
  '35': 'own card join team owner',
  '36': 'microsoft sign in office 365 outlook login',
  '37': 'my team manager page',
  '38': 'claim invite join password',
  '39': 'team card change edit locked',
  '40': 'teammate share colleague',
  '41': 'visitor opens save contact share back',
  '42': 'designs templates sixteen look',
  '43': 'android app widget home screen',
  '44': 'iphone app ios apple',
  '45': 'reseller client seats',
  '46': 'reseller nfc invoice pay',
}

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
  '17': { group: 'more', plays: 'anywhere' },
  '18': { group: 'more', plays: 'anywhere' },
  '20': { group: 'more', plays: 'anywhere' },
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
  '41': { group: 'visitors', plays: 'anywhere' },
  '42': { group: 'visitors', plays: 'anywhere' },
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
  keywords: string
}

export const HOWTO_VIDEOS: HowToVideo[] = HOWTO_DATA
  .filter(d => RULES[d.n])
  .map(d => ({ ...d, ...RULES[d.n], androidAppOnly: !!RULES[d.n].androidAppOnly, keywords: KEYWORDS[d.n] || '' }))

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
  more: 'More for your card',
  team: 'Running your team',
  managers: 'Managing a department',
  members: 'Your team card',
  visitors: 'When someone opens your card',
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

/** The How-to page's topics, always in this order, so a video is always where it was. Web-only topics never
 *  appear there. */
export const HOWTO_GROUPS: HowToGroup[] = ['card', 'sharing', 'leads', 'more', 'team', 'managers', 'members', 'visitors', 'apps']

/** "Start here" on the How-to page: the first videos for this person's role. */
export function startHere(who: Who): string[] {
  const picks = who.ownsTeam ? ['24', '25', '26', '28']
    : who.managesDepartment ? ['28', '37', '39', '40']
    : who.teamMember ? ['06', '38', '39', '40']
    : ['01', '02', '06', '07']
  return inOrder(picks)
}

/** Videos in the series' order, by number. */
const inOrder = (ns: string[]) => [...ns].sort()

/** Does a video match what was typed on the How-to page? Every word must be found. */
export function matches(v: HowToVideo, query: string): boolean {
  const hay = `${v.title} ${v.keywords} ${GROUP_TITLES[v.group]}`.toLowerCase()
  return query.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w))
}

/** Which videos a dashboard page offers, in the series' order. */
export function howToForPage(pathname: string, who: Who): string[] {
  return inOrder(pageVideos(pathname, who))
}

function pageVideos(pathname: string, who: Who): string[] {
  const p = pathname.replace(/\/+$/, '') || '/'
  if (p === '/dashboard') {
    if (who.teamMember && !who.ownsTeam) return ['39', '40', '08', '09']
    return who.hasCard ? ['06', '08', '09'] : ['01']
  }
  if (p === '/dashboard/card') return who.teamMember && !who.ownsTeam ? ['39'] : ['01', '02', '03', '05', '17', '42']
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
