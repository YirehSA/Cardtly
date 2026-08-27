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

// ── 1. llms.txt has to state the price at all ───────────────────────────────
// Whether a given figure is CORRECT is checked across every marketing file
// further down. This one is specific to llms.txt, which exists to answer the
// question and is useless if it stays silent on it.
if (!/R(\d+)(?=\s*(?:per card|a card|\/month|a month|per month|\/seat|per seat))/i.test(llms)) {
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

// ── 4. Feature counts quoted in marketing copy ──────────────────────────────
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

// app/promotions/terms is competition T&Cs, where "Free Account" is a defined
// term meaning an account created without payment. That is accurate, and it is
// legal text that gets reviewed on its own rather than swept with marketing
// copy, so the free-tier rule below would only ever produce noise here.
const SKIP = ['app/dashboard', 'app/admin', 'app/api', 'app/promotions/terms']

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

// Every file a customer can read. Built once, because the rules below kept
// being written against llms.txt alone while this list was right there.
const MARKETING = [
  ...marketingFiles('app'),
  ...marketingFiles('components/marketing'),
  'public/llms.txt',
]

const COUNT_CLAIMS = [
  { what: 'custom links', actual: maxLinks,
    re: /(\d+)\s+(?:custom\s+)?link(?:\s+button)?s/gi },
  { what: 'gallery images', actual: maxImages,
    re: /(?:gallery of up to|up to)\s+(\d+)\s+(?:gallery\s+)?(?:images|photos)/gi },
]

for (const file of MARKETING) {
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

// A free trial is no longer something every signup gets. Since migration 046 it
// comes from a code, and the marketing pages were swept of every "60 days free"
// claim. This guard exists because that copy was true for months, and it is the
// kind of line that gets pasted back from an older page without anyone noticing
// it has become a promise the product does not keep.
const TRIAL_CLAIMS = [
  /60\s*days?\s*free/i,
  /free\s+for\s+60/i,
  /60[-\s]day\s+(?:free\s+)?trial/i,
  /start\s+(?:your\s+)?free\s+trial/i,
]

for (const file of MARKETING) {
  let text
  try { text = read(file) } catch { continue }
  for (const re of TRIAL_CLAIMS) {
    const m = text.match(re)
    if (m) note(`${file} promises a free trial ("${m[0].trim()}"). A signup gets 7 days (migration 049); 30 and 60 only come from a code, so a 60-day promise is not true for everyone.`)
  }
}

// ── 6. Recurring prices, everywhere a customer can read one ─────────────────
// This rule used to look at llms.txt only. app/blog/posts.ts was already in
// the sweep above for link counts and trial promises, and still carried
// sixteen "R65/month" and "free forever" claims across five posts, because no
// rule that checked a PRICE was ever pointed at it. The blog outranks the
// pricing page for several of these searches, so it was the first number a lot
// of people saw.
//
// A legitimate page quotes more than the unit price: "R970 a month" for ten
// cards, and "about R81/month" for the annual plan, which org-billing computes
// as SEAT_PRICE_RAND * 10 / 12. Both are derived from the seat price rather
// than being separate constants, so this derives them the same way instead of
// hard-coding an exception. Any multiple of the seat price is a plausible team
// total; a stale unit price (R65) is not a multiple of the current one, which
// is what makes this worth checking at all.
const annualMonthly = Math.round((seatPrice * 10) / 12)
const priceIsPlausible = n => n % seatPrice === 0 || n === annualMonthly

const PRICE_RE = /R(\d+)(?=\s*(?:per card|a card|\/month|a month|per month|\/seat|per seat|\/card))/gi

// ── 7. The free tier that no longer exists ──────────────────────────────────
// An expired personal card 404s. Every phrasing below promises something the
// product will not do, and each one was found in live copy rather than
// imagined: the social share image said "free forever", the account page said
// cancelling left you "live on the free tier", and the blog said you could
// "keep it forever at no cost".
const FREE_TIER_CLAIMS = [
  /free[-\s]forever/i,
  /forever\s+(?:free|at no cost)/i,
  /R0\s+forever/i,
  /free\s+(?:plan|tier)\b/i,
  /free\s+account\b/i,
  /keep\s+it\s+forever/i,
]

// Copy that says the free tier is GONE contains the same words as copy that
// promises one. Without this, the rule fires on "There is no permanent free
// tier" in llms.txt, which is the sentence doing the right thing.
//
// The window is the 30 characters immediately before the phrase, not the whole
// line. Scanning the line lets "a free plan, with no credit card required"
// excuse itself on the "no" belonging to a different clause, and that is very
// close to the sentence this rule exists to catch.
const NEGATED = /\b(no|not|never|without|dropped|removed|longer|stopped)\b[\w\s]*$/i

// Whole-line // comments and /* */ blocks. Four of the first hits were
// comments explaining that the free tier had been removed.
const stripComments = t => t
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')

for (const file of MARKETING) {
  let text
  try { text = stripComments(read(file)) } catch { continue }

  PRICE_RE.lastIndex = 0
  let m
  while ((m = PRICE_RE.exec(text))) {
    const n = Number(m[1])
    if (!priceIsPlausible(n)) {
      note(`${file} quotes R${n} as a recurring price; SEAT_PRICE_RAND is ${seatPrice} (R${seatPrice * 10} a year, about R${annualMonthly} a month on the annual plan).`)
    }
  }

  for (const re of FREE_TIER_CLAIMS) {
    const g = new RegExp(re.source, 'gi')
    let hit
    while ((hit = g.exec(text))) {
      const before = text.slice(Math.max(0, hit.index - 30), hit.index)
      if (NEGATED.test(before)) continue
      // "Is there a free plan?" is a question a FAQ is allowed to ask. The
      // answer next to it is what the rule should be reading.
      if (/^["'\s]*\?/.test(text.slice(hit.index + hit[0].length))) continue
      note(`${file} promises a free tier ("${hit[0].trim()}"). There is no free plan: a signup gets 7 days, then the card stops being served unless it is paid for.`)
    }
  }
}

if (fail.length) {
  console.error('\ncheck-facts: copy contradicts the code.\n')
  for (const f of fail) console.error('  - ' + f)
  console.error('\nFix the copy (or the constant, if the code is what changed).\n')
  process.exit(1)
}

console.log(`check-facts: copy agrees with the code (R${seatPrice}/card, up to ${maxSeats} seats, NFC R${nfcPrice} + R${nfcShipping}, ${maxLinks} links, ${maxImages} gallery images, no free-trial promises).`)
