// Fails the build when public/llms.txt contradicts the code.
//
// llms.txt is what ChatGPT, Claude, Perplexity and Google's AI grounding read
// to describe Cardtly, and robots.ts invites all of them. It has no import
// graph tying it to anything, so it drifts silently: it sat at "R65/month" and
// "free-forever plan" long after the price moved to R97 and the free tier was
// dropped, telling every AI assistant the wrong thing.
//
// Run by `prebuild`, so `npm run build` refuses to ship a contradiction.
// Run it directly with: node scripts/check-facts.mjs

import { readFileSync } from 'node:fs'

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const fail = []
const note = m => fail.push(m)

// ── Source of truth, straight from the code ─────────────────────────────────
const billing = read('lib/org-billing.ts')
const seatPrice = Number(billing.match(/SEAT_PRICE_RAND\s*=\s*(\d+)/)?.[1])
const maxSeats = Number(billing.match(/MAX_SELF_SERVE_SEATS\s*=\s*(\d+)/)?.[1])

if (!Number.isFinite(seatPrice) || !Number.isFinite(maxSeats)) {
  console.error('check-facts: could not read SEAT_PRICE_RAND / MAX_SELF_SERVE_SEATS from lib/org-billing.ts')
  process.exit(1)
}

// The NFC prices are literals on the NFC page rather than constants, so the
// check is that llms.txt agrees with that page - not with a magic number here.
const nfcPage = read('app/nfc/page.tsx')
const nfcPrice = Number(nfcPage.match(/price:\s*'(\d+)'/)?.[1])
const nfcShipping = Number(nfcPage.match(/value:\s*'(\d+)',\s*currency:\s*'ZAR'/)?.[1])

const llms = read('public/llms.txt')

// ── 1. Any per-month or per-card rand figure must be the seat price ─────────
const priceClaims = [...llms.matchAll(/R(\d+)(?=\s*(?:per card|a card|\/month|a month|per month|\/seat|per seat))/gi)]
for (const m of priceClaims) {
  if (Number(m[1]) !== seatPrice) {
    note(`llms.txt quotes R${m[1]} as a recurring price; SEAT_PRICE_RAND is ${seatPrice}.`)
  }
}
if (priceClaims.length === 0) {
  note(`llms.txt never states the recurring price. It should say R${seatPrice}.`)
}

// ── 2. Seat range must match what the API will actually accept ──────────────
const seatRange = llms.match(/(\d+)\s*to\s*(\d+)\s*cards/i)
if (!seatRange) {
  note(`llms.txt does not state the seat range. It should say 2 to ${maxSeats} cards.`)
} else if (Number(seatRange[2]) !== maxSeats) {
  note(`llms.txt says teams go up to ${seatRange[2]} cards; MAX_SELF_SERVE_SEATS is ${maxSeats}.`)
}

// ── 3. NFC card price and shipping must match the NFC page ──────────────────
if (Number.isFinite(nfcPrice) && !new RegExp(`R${nfcPrice}\\b`).test(llms)) {
  note(`llms.txt does not mention the NFC card price of R${nfcPrice} used on /nfc.`)
}
if (Number.isFinite(nfcShipping) && !new RegExp(`R${nfcShipping}\\b`).test(llms)) {
  note(`llms.txt does not mention the R${nfcShipping} shipping charge used on /nfc.`)
}

// ── 4. Claims that were true once and are not any more ──────────────────────
// The free tier is gone. If it creeps back into the text, that is a promise
// the checkout will not honour.
if (/free[- ]forever|free forever/i.test(llms)) {
  note('llms.txt claims a free-forever plan. There is a 60-day trial, not a free tier.')
}

if (fail.length) {
  console.error('\ncheck-facts: public/llms.txt contradicts the code.\n')
  for (const f of fail) console.error('  - ' + f)
  console.error('\nFix public/llms.txt (or the constant, if the code is what changed).\n')
  process.exit(1)
}

console.log(`check-facts: llms.txt agrees with the code (R${seatPrice}/card, up to ${maxSeats} seats, NFC R${nfcPrice} + R${nfcShipping}).`)
