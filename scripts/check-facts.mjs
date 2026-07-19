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

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

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


// ── 5. Feature counts quoted in marketing copy ──────────────────────────────
// "Up to 14 custom links" sat on the pricing page for a long time. It was true
// of the schema - cards has link_1..link_14 and extractLinks renders them all -
// and false of the product, which offers five slots in the editor. Someone
// paying on the strength of that line got five. The same wrong number had
// already been corrected on the upgrade page and was missed here, so the check
// covers every marketing file rather than the one that was noticed.
const design = read('types/design.ts')
const maxLinks = Number(design.match(/MAX_CUSTOM_LINKS\s*=\s*(\d+)/)?.[1])
const maxImages = Number(design.match(/MAX_GALLERY_IMAGES\s*=\s*(\d+)/)?.[1])

if (!Number.isFinite(maxLinks) || !Number.isFinite(maxImages)) {
  console.error('check-facts: could not read MAX_CUSTOM_LINKS / MAX_GALLERY_IMAGES from types/design.ts')
  process.exit(1)
}

const MARKETING_DIRS = ['app', 'components/marketing']
const SKIP = ['app/dashboard', 'app/admin', 'app/api']

function marketingFiles(dir, acc = []) {
  const abs = new URL(`../${dir}`, import.meta.url)
  for (const entry of readdirSync(abs)) {
    const rel = `${dir}/${entry}`
    if (SKIP.some(s => rel.startsWith(s))) continue
    const st = statSync(new URL(`../${rel}`, import.meta.url))
    if (st.isDirectory()) marketingFiles(rel, acc)
    else if (/\.(tsx?|txt|md)$/.test(entry)) acc.push(rel)
  }
  return acc
}

const COUNT_CLAIMS = [
  { what: 'custom links', actual: maxLinks,
    re: /(\d+)\s+(?:custom\s+)?link(?:\s+button)?s/gi },
  { what: 'gallery images', actual: maxImages,
    re: /(?:gallery of up to|up to)\s+(\d+)\s+(?:gallery\s+)?(?:images|photos)/gi },
]

for (const file of [...marketingFiles('app'), ...marketingFiles('components/marketing'), 'public/llms.txt']) {
  let text
  try { text = read(file) } catch { continue }
  for (const { what, actual, re } of COUNT_CLAIMS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text))) {
      const n = Number(m[1])
      // Ignore counts that are plainly about something else (a year, a price).
      if (n === actual || n > 100) continue
      note(`${file} claims "${m[0].trim()}" but a card supports ${actual} ${what}.`)
    }
  }
}

if (fail.length) {
  console.error('\ncheck-facts: public/llms.txt contradicts the code.\n')
  for (const f of fail) console.error('  - ' + f)
  console.error('\nFix public/llms.txt (or the constant, if the code is what changed).\n')
  process.exit(1)
}

console.log(`check-facts: copy agrees with the code (R${seatPrice}/card, up to ${maxSeats} seats, NFC R${nfcPrice} + R${nfcShipping}, ${maxLinks} links, ${maxImages} gallery images).`)
