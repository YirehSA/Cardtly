// The "Company name: Show / Hide" design switch must hold on every template.
//
// Added 2026-10-07 for cardholders whose logo already says the company name.
// Sixteen templates each print the company in their own markup, so the failure
// to guard against is the seventeenth template - or an edit to one of the
// sixteen - printing card.company directly and ignoring the switch.
//
// Rule: inside the public card, the company is DISPLAYED only through
// shownCompany. card.company itself may appear only in the uses that are not
// display and must keep the company whatever the switch says: the saved
// contact, the share text, the contact-exchange and booking forms.
//
// Run: node scripts/check-company-toggle.mjs

import { readFileSync } from 'node:fs'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => readFileSync(p, 'utf8').replace(/\r/g, '')

const card = read('components/card/PublicCardView.tsx')
if (!/const shownCompany = design\.showCompany === false \? null : card\.company\n/.test(card)) {
  bad('PublicCardView no longer works out shownCompany from the design switch.')
}

// Every remaining card.company (not card.company_logo_url) must be one of the
// non-display uses.
const ALLOWED = [
  /company: card\.company,/,                       // the saved contact (vCard)
  /\$\{card\.company \? ` \(\$\{card\.company\}\)` : ''\}/, // the share text
  /ownerCompany=\{card\.company\}/,                // contact exchange
  /company=\{card\.company\}/,                     // booking
  /: card\.company\n$/,                            // the shownCompany definition itself
]
const lines = card.split('\n')
lines.forEach((line, i) => {
  if (!/card\.company(?!_)/.test(line)) return
  if (/^\s*\/\//.test(line)) return
  if (ALLOWED.some(re => re.test(line + '\n'))) return
  bad(`components/card/PublicCardView.tsx:${i + 1} uses card.company directly, so it ignores the Company name switch. Display it through shownCompany: ${line.trim().slice(0, 100)}`)
})

// And the display uses really are there: all sixteen templates print it.
const displays = (card.match(/\{shownCompany && /g) || []).length
if (displays < 16) bad(`only ${displays} places display shownCompany; every one of the 16 templates prints the company.`)

const design = read('types/design.ts')
if (!/showCompany\?: boolean/.test(design) || !/\n  showCompany: true,\n/.test(design)) {
  bad('types/design.ts no longer declares showCompany defaulting to true, so existing cards would lose their company name.')
}
const panel = read('components/card/DesignPanel.tsx')
if (!/update\(\{ showCompany: false \}\)/.test(panel) || !/update\(\{ showCompany: true \}\)/.test(panel)) {
  bad('the Design panel no longer offers the Company name switch.')
}

if (fail) {
  console.error(`\ncheck-company-toggle: ${fail} failure(s).`)
  process.exit(1)
}
console.log(`check-company-toggle: ${displays} places display the company through the switch, card.company is used directly only where the company must stay (contact, share, booking), and the switch defaults to on.`)
