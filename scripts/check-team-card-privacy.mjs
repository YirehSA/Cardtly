// A team card's invite never reaches a browser or the public key.
//
// WHY. invite_token is the whole of a claim on a staff card: /api/team/claim
// takes a token and a password and makes an account for the invited address,
// signed in, with the card on it. Until 2026-11-03 the public card page read
// team_cards with select('*') and handed the row to PublicCardView, a client
// component, so every unclaimed staff card carried its own token (and the
// invited person's email) in its page's HTML. The anon key could read both
// columns for every card too. See lib/team-card-public.
//
// What this holds in place:
//   1. lib/team-card-public names the three invite columns;
//   2. TeamCardPublic, the one renderer of public team cards, strips them;
//   3. the card page reads team_cards with the service role, never the
//      visitor's session (which migration 101 refuses select('*'));
//   4. nothing reading team_cards with a session (`supabase`) asks for '*' or an
//      invite column, and no client component touches them;
//   5. migration 101 takes the table from anon and authenticated and grants
//      back every column but the three.
//
// Run: node scripts/check-team-card-privacy.mjs

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return null } }
const PRIVATE = ['invite_token', 'invite_email', 'invite_sent_at']

// 1. The list
const lib = read('lib/team-card-public.ts') || ''
if (!lib) bad('lib/team-card-public.ts is missing')
const listed = (lib.match(/TEAM_CARD_PRIVATE_COLUMNS\s*=\s*\[([^\]]*)\]/) || [])[1] || ''
for (const c of PRIVATE) if (!listed.includes(`'${c}'`)) bad(`TEAM_CARD_PRIVATE_COLUMNS no longer names ${c}`)
if (!/delete out\[c\]/.test(lib)) bad('publicTeamCard no longer removes the private columns from the row')

// 2. The renderer
const tcp = read('components/card/TeamCardPublic.tsx') || ''
if (!/\.\.\.publicTeamCard\(teamCard\)/.test(tcp)) bad('TeamCardPublic no longer spreads publicTeamCard(teamCard) into the card it renders, so the invite token goes into the page HTML')
if (/\.\.\.teamCard\b/.test(tcp)) bad('TeamCardPublic spreads the raw teamCard row somewhere, invite and all')

// 3. The card page
const page = read('app/card/[slug]/page.tsx') || ''
for (const m of page.matchAll(/(\w+(?:\(\))?)\s*\n?\s*\.from\(\s*['"]team_cards['"]\s*\)/g)) {
  if (m[1] !== 'serviceClient()') bad(`app/card/[slug]/page.tsx reads team_cards with ${m[1]}, not serviceClient(): from migration 101 the visitor's key may not select('*') there, and every team card page would 404`)
}

// 4. Sessions and client components, everywhere
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}
for (const f of ['app', 'components', 'lib'].flatMap(d => walk(d))) {
  const src = read(f) || ''
  for (const m of src.matchAll(/\bsupabase\s*\.from\(\s*['"]team_cards['"]\s*\)\s*\.select\(\s*(['"`])([\s\S]*?)\1/g)) {
    const cols = m[2]
    if (cols.trim() === '*' || PRIVATE.some(c => cols.includes(c))) {
      bad(`${f} reads team_cards with a session client asking for "${cols.trim().slice(0, 40)}". From migration 101 that is refused; use the service role after checking who is asking.`)
    }
  }
  // A client component may DISPLAY an invite it was handed by a server page
  // that checked who is asking (the owner's team screen, the admin's). It may
  // not read team_cards for itself with the browser's key.
  if (/^['"]use client['"]/.test(src.trimStart())) {
    for (const m of src.matchAll(/\.from\(\s*['"]team_cards['"]\s*\)\s*\.select\(\s*(['"`])([\s\S]*?)\1/g)) {
      if (m[2].trim() === '*' || PRIVATE.some(c => m[2].includes(c))) bad(`${f} is a client component and reads team_cards "${m[2].trim().slice(0, 40)}" with the browser's key`)
    }
  }
}

// 5. The migration
const mig = read('supabase/migrations/101_team_card_invite_private.sql') || ''
if (!mig) bad('supabase/migrations/101_team_card_invite_private.sql is missing')
const code = mig.split('\n').map(l => l.replace(/--.*$/, '')).join('\n')
if (!/revoke\s+select\s+on\s+public\.team_cards\s+from\s+anon\s*,\s*authenticated\s*;/i.test(code)) bad('migration 101 no longer revokes select on team_cards from anon and authenticated')
const grant = (code.match(/grant\s+select\s*\(([^)]*)\)\s*on\s+public\.team_cards\s+to\s+anon\s*,\s*authenticated\s*;/i) || [])[1]
if (!grant) bad('migration 101 no longer grants the public columns back')
else {
  const cols = grant.split(',').map(s => s.trim())
  for (const c of PRIVATE) if (cols.includes(c)) bad(`migration 101 grants ${c} back to anon and authenticated`)
  for (const c of ['id', 'name', 'slug', 'is_active', 'organization_id', 'user_id', 'video_url', 'show_video']) {
    if (!cols.includes(c)) bad(`migration 101 does not grant ${c}, which the public card and the editor read`)
  }
}
if (!/pg_policies/.test(code) || !/raise exception/i.test(code)) bad('migration 101 lost its check for policies that read an invite column, which would fail for signed-in users once the grant narrows')

if (fail) {
  console.error(`\ncheck-team-card-privacy: ${fail} failure(s).`)
  process.exit(1)
}
console.log('check-team-card-privacy: the invite never reaches a card page or a session read, TeamCardPublic strips it, and migration 101 keeps it from the public key.')
