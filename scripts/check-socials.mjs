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

// 4. EVERY TEMPLATE EITHER RENDERS THE SHARED LIST OR SAYS IT DOES NOT.
//
//    The check above stops a template keeping its own list. It does not stop a
//    template having NO list, which is the other half of the same defect and
//    the half that was still true after the Minimal and Studio fix: Neon
//    renders no socials at all, and Editorial renders none either - the
//    WhatsApp it shows is a contact row with the number visible, not a social
//    icon. Neither has ever rendered them.
//
//    Whether that is a design choice is not this script's business. Whether it
//    is WRITTEN DOWN is. A template that renders nothing and is not declared
//    is an oversight; one that is declared is a decision, and a sixteenth
//    template cannot join the list by accident.
{
  const declared = (() => {
    const m = designSrc.match(/TEMPLATES_WITHOUT_SOCIALS[^=]*=\s*\[([^\]]*)\]/)
    if (!m) {
      bad(`${DESIGN}: TEMPLATES_WITHOUT_SOCIALS is gone, so a template rendering no socials is unrecorded again`)
      return null
    }
    return (m[1].match(/'([a-z]+)'/g) || []).map(x => x.replace(/'/g, '')).sort()
  })()

  // Each template branch, sliced to the next one.
  const marks = [...view.matchAll(/design\.templateId === '([a-z]+)'/g)].map(m => ({ id: m[1], at: m.index }))
  if (marks.length === 0) {
    bad(`${VIEW}: no template branches found, so this check cannot see what it is checking`)
  }

  const silent = []
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].at : view.length
    // `socialLinks={[]}` is stripped first. Several templates render the
    //  socials themselves and pass AllContacts an empty list so it does not
    //  repeat them, so the empty prop is a legitimate pattern - but it renders
    //  nothing on its own, and counting it let a mutation that silenced a
    //  whole template pass unnoticed. Mentioning AllContacts is not the same
    //  as giving it anything to show.
    const body = view.slice(marks[i].at, end).replace(/socialLinks=\{\[\]\}/g, '')
    const rendersSocials = /socialAccounts|socialLinks/.test(body)
    if (!rendersSocials) silent.push(marks[i].id)
  }
  silent.sort()

  if (declared) {
    const undeclared = silent.filter(t => !declared.includes(t))
    const stale = declared.filter(t => !silent.includes(t))
    if (undeclared.length) {
      bad(
        `${VIEW}: ${undeclared.join(', ')} ${undeclared.length === 1 ? 'renders' : 'render'} no social icons and ` +
        `${undeclared.length === 1 ? 'is' : 'are'} not in TEMPLATES_WITHOUT_SOCIALS. ` +
        `Either render socialAccounts like the other templates, or add them to that list with a reason - ` +
        `a customer filling in LinkedIn on one of these designs currently gets nothing, silently.`,
      )
    }
    if (stale.length) {
      bad(
        `${DESIGN}: ${stale.join(', ')} ${stale.length === 1 ? 'is' : 'are'} listed in TEMPLATES_WITHOUT_SOCIALS ` +
        `but ${stale.length === 1 ? 'does' : 'do'} render socials now. ` +
        `Remove them, or the list stops meaning anything.`,
      )
    }
  }
}

if (fail) {
  console.error(`${LF}check-socials: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  `check-socials: ${keys.length} social accounts declared once in types/design.ts, built once into socialAccounts, ` +
  `no template reads a social column directly, and every template either renders the shared list or is recorded ` +
  `in TEMPLATES_WITHOUT_SOCIALS - so neither a palette nor an omission can decide the list again.`,
)
