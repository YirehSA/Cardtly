// One list of social accounts, and no template gets to keep its own.
//
// WHAT THIS EXISTS BECAUSE OF. Three places in PublicCardView listed the
// social accounts by hand: the shared row, Minimal and Studio. Two of them
// stopped short. YouTube and TikTok rendered on neither Minimal nor Studio,
// and Instagram on neither Minimal. A customer on those designs filled the
// field in, watched it save, and it never appeared anywhere. Nothing failed,
// nothing warned, and the editor went on offering the field.
//
// The cause is the part worth guarding. Each template declared a COLOUR MAP
// with six or seven entries and then wrote its list to match, so the palette
// silently decided which accounts existed. Adding a social to the product
// needed three edits in three different styles, and the two that were missed
// were missed exactly that way.
//
// So the accounts are counted off SOCIAL_SLOTS in types/design.ts, and this
// checks the one thing that would bring the bug back: a template reaching for
// a social COLUMN directly instead of rendering the shared list.
//
// WHATSAPP IS DELIBERATELY NOT IN THE STRICT LIST. It is both a social account
// and a contact method, and several templates legitimately show it as a row
// with the number visible rather than as an icon. Guarding `card.whatsapp`
// would fail on correct code.
//
// Run: node scripts/check-socials.mjs

import { readFileSync } from 'fs'

const VIEW = 'components/card/PublicCardView.tsx'
const DESIGN = 'types/design.ts'
const LF = String.fromCharCode(10)

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }

const read = (p) => {
  try { return readFileSync(p, 'utf8').replace(new RegExp(String.fromCharCode(13), 'g'), '') }
  catch { bad(`${p} is missing`); return '' }
}

/** Comments stripped, so the explanation above a fix cannot trip a check
 *  looking for the code that caused it. This file and PublicCardView both
 *  describe the old mistake on purpose. */
const code = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split(LF).map(l => l.replace(/\/\/.*$/, '')).join(LF)

const designSrc = read(DESIGN)
const view = code(read(VIEW))

// 1. The single declaration has to exist, or this guard protects nothing.
const block = designSrc.match(/export const SOCIAL_SLOTS = \[([\s\S]*?)\] as const/)
if (!block) {
  bad(`${DESIGN}: SOCIAL_SLOTS is gone, so nothing declares the social accounts once`)
}

const columns = block ? [...block[1].matchAll(/column:\s*'([a-z0-9_]+)'/g)].map(m => m[1]) : []
const keys = block ? [...block[1].matchAll(/key:\s*'([a-z0-9_]+)'/g)].map(m => m[1]) : []
if (block && (columns.length === 0 || columns.length !== keys.length)) {
  bad(`${DESIGN}: SOCIAL_SLOTS parsed as ${keys.length} keys and ${columns.length} columns, which cannot both be right`)
}

// 2. No template may read a social column directly. This is the whole guard:
//    reading the column is how a template starts keeping its own list.
const strict = columns.filter(c => c !== 'whatsapp')
for (const col of strict) {
  // card.col / (card as any).col / card?.col - an ACCESS, not the bare word,
  // so `youtube: '#FF0000'` inside a colour map is not a match.
  const re = new RegExp(`card(?:\\s+as\\s+any)?\\s*\\)?\\??\\.${col}\\b`)
  if (re.test(view)) {
    bad(
      `${VIEW} reads card.${col} directly. Socials are counted off SOCIAL_SLOTS into socialAccounts, and every ` +
      `template renders that list in its own style. Reading the column here is how Minimal and Studio ended up ` +
      `missing YouTube, TikTok and Instagram without anything failing.`,
    )
  }
}

// 3. And the shared derivation has to still be there, or the rule above could
//    be satisfied by deleting the feature rather than by sharing it.
if (!/SOCIAL_SLOTS\.map\(/.test(view)) {
  bad(`${VIEW} no longer builds its social list from SOCIAL_SLOTS, so the accounts are being decided somewhere else again`)
}
if (!/socialAccounts/.test(view)) {
  bad(`${VIEW} has no socialAccounts list, so there is no single list for the templates to render`)
}

if (fail) {
  console.error(`${LF}check-socials: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  `check-socials: ${keys.length} social accounts declared once in types/design.ts, built once into socialAccounts, ` +
  `and no template reads a social column directly - so a palette cannot decide the list again.`,
)
