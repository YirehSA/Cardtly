// The admin's navigation: every screen is in the sidebar, and every screen in
// the sidebar renders something.
//
// WHAT THIS PROTECTS (Andre, 2026-10-21: "hard to find things"). The admin was
// rebuilt around a sidebar that lists every screen on its own. A screen added
// to TABS but not to SECTIONS would exist and be unreachable; one in SECTIONS
// that AdminDashboard never renders would open onto a header and nothing.
//
// Run: node scripts/check-admin-nav.mjs

import { readFileSync } from 'node:fs'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }

const shell = read('components/admin/AdminShell.tsx')
const dash = read('components/admin/AdminDashboard.tsx')
if (!shell || !dash) { console.error('check-admin-nav: admin files missing'); process.exit(1) }

const tabsBlock = /export const TABS = \[([\s\S]*?)\] as const/.exec(shell)?.[1] || ''
const tabs = [...tabsBlock.matchAll(/'([a-z_]+)'/g)].map(m => m[1])
if (tabs.length < 15) bad(`TABS could not be read from AdminShell (found ${tabs.length})`)

// Screens only: a screen has a desc, a section heading has items.
const sectionIds = [...shell.matchAll(/\{ id: '([a-z_]+)', label: '[^']+', icon: \w+, desc: /g)].map(m => m[1])
for (const t of tabs) {
  if (!sectionIds.includes(t)) bad(`"${t}" is a screen but is not in the sidebar (SECTIONS), so nobody can reach it`)
  if (!dash.includes(`tab === '${t}'`)) bad(`"${t}" is in the sidebar but AdminDashboard never renders it`)
}
for (const s of sectionIds) if (!tabs.includes(s)) bad(`the sidebar lists "${s}", which is not in TABS`)
if (new Set(sectionIds).size !== sectionIds.length) bad('a screen is listed twice in the sidebar')

// The address carries the screen, so Back, refresh and bookmarks work.
if (!/window\.history\.pushState\(null, '', url\)/.test(dash) || !/addEventListener\('popstate'/.test(dash)) bad('switching screens must update the address and follow Back')
if (!/isTab\(initialTab\)/.test(dash)) bad('the screen in ?tab= must be checked against TABS, not trusted')
// The dashboard sidebar's Calendar shortcut deep-links here.
if (!tabs.includes('meetings')) bad("/admin?tab=meetings is linked from the dashboard sidebar and must stay a screen")

if (fail) {
  console.error(`check-admin-nav: ${fail} problem(s)`)
  process.exit(1)
}
console.log(`check-admin-nav: ok (${tabs.length} screens, every one in the sidebar and rendered, in the address, Back works)`)
