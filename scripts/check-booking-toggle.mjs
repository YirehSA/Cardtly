// The Book a meeting switch.
//
// WHAT THIS PROTECTS (2026-10-15): Book a meeting was on every Pro card with
// no way to remove it, and not every client takes meetings through the card.
// It is now a design setting, on by default, and off has to mean off
// everywhere a visitor could reach the booking form.
//
//   1. types/design declares showBooking and defaults it to true, so every
//      existing card keeps its button.
//   2. Off removes the shared button (and with it a Context recommendation to
//      book), and Circuit's own "Book a slot".
//   3. Design, Button tab, offers both On and Off.
//   4. The Context editor does not offer a booking recommendation for a card
//      that has it off.
//
// Run: node scripts/check-booking-toggle.mjs

import { readFileSync } from 'node:fs'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }

const design = read('types/design.ts')
if (!/showBooking\?: boolean/.test(design) || !/\n  showBooking: true,\n/.test(design)) bad('types/design must declare showBooking and default it to true, or existing cards lose their booking button')

const card = read('components/card/PublicCardView.tsx')
if (!/const bottomProps: BottomProps = \{[\s\S]{0,400}omitBooking: design\.showBooking === false,/.test(card)) bad('PublicCardView must pass omitBooking from design.showBooking into every template\'s BottomSection')
if (!/\{isPro && !omitBooking && \(\s*<BookingTrigger/.test(card)) bad('the shared Book a meeting button must respect omitBooking')
if (!/resolveContextCta\(context, links, isPro && !omitBooking\)/.test(card)) bad('a Context recommendation to book must respect omitBooking')
if (!/\{isPro && design\.showBooking !== false && \(\s*<div[^>]*>\s*<p[\s\S]{0,300}Schedule a chat[\s\S]{0,200}<CircuitBookButton/.test(card)) bad('Circuit\'s own Book a slot must respect design.showBooking')
// Every other BottomSection spreads bottomProps and may only ever ADD omitBooking.
for (const m of card.matchAll(/<BottomSection \{\.\.\.bottomProps\}([^/]*)\/>/g)) {
  if (/omitBooking=\{false\}/.test(m[1])) bad('a template switches booking back on over the cardholder\'s choice')
}

const panel = read('components/card/DesignPanel.tsx')
if (!/update\(\{ showBooking: true \}\)/.test(panel) || !/update\(\{ showBooking: false \}\)/.test(panel)) bad('Design, Button tab must offer Book a meeting On and Off')

const ctx = read('app/dashboard/context/page.tsx')
if (!/sourceDesign\.showBooking === false/.test(ctx) || !/&& !bookingSwitchedOff/.test(ctx)) bad('the Context editor must not offer a booking recommendation for a card with booking switched off')

if (fail) {
  console.error(`check-booking-toggle: ${fail} problem(s)`)
  process.exit(1)
}
console.log('check-booking-toggle: ok (on by default; off removes the shared button, Circuit\'s Book a slot and a Context booking recommendation; Design offers On and Off)')
