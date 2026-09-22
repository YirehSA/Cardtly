// Every piece of card text that takes a colour also takes an alignment.
//
// WHAT THIS EXISTS BECAUSE OF. The text alignment control is one setting read
// by 64 separate style objects - the name, job title, company and bio, on all
// sixteen templates. There is no shared component to put it in, because each
// template sets its own type. A sweep like that rots: the next person to
// restyle Frost's bio writes a fresh style object, forgets one property out of
// eight, and the control silently stops working on one element of one
// template. Nobody notices until a customer does.
//
// THE INVARIANT, and it is a simple one: if a style object asks for a text
// COLOUR through one of the getXColor helpers, it must also ask for the
// alignment. The two travel together because they describe the same run of
// text, so the colour call is a reliable marker for "this is card text".
//
// Run: node scripts/check-text-align.mjs

import { readFileSync } from 'fs'

const CARD = 'components/card/PublicCardView.tsx'
const DESIGN = 'types/design.ts'
const PANEL = 'components/card/DesignPanel.tsx'
const LF = String.fromCharCode(10)

const HELPERS = ['getNameColor(design', 'getTitleColor(design', 'getCompanyColor(design', 'getBioColor(design']

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return null } }

const src = read(CARD)
const design = read(DESIGN)
const panel = read(PANEL)
if (!src || !design || !panel) { bad('a source file is missing'); process.exit(1) }

/** The { ... } literal a position sits inside, or null when it is not in one
 *  (which is how `const bioColor = getBioColor(...)` is recognised rather than
 *  reported - those are wired at their usage site instead). */
function enclosingObject(s, at) {
  let depth = 0, i = at
  for (; i >= 0; i--) {
    const c = s[i]
    if (c === '}') depth++
    else if (c === '{') { if (depth === 0) break; depth-- }
  }
  if (i < 0) return null
  let d = 0
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') d++
    else if (s[j] === '}') { d--; if (d === 0) return s.slice(i, j + 1) }
  }
  return null
}

// ── 1. Every text colour is accompanied by an alignment ─────────────────────
let checked = 0
const missing = []
for (const helper of HELPERS) {
  let from = 0
  for (;;) {
    const at = src.indexOf(helper, from)
    if (at < 0) break
    from = at + helper.length
    const obj = enclosingObject(src, at)
    // Not inside an object literal: a `const x = getBioColor(...)` binding.
    // Its alignment belongs to whichever style object uses `x`, and section 2
    // below is what keeps the totals honest for those.
    if (!obj) continue
    // Nor is a ternary or a call argument a style object.
    if (!/[:=]\s*$|^\{/.test(obj.slice(0, 1)) && !obj.includes(':')) continue
    checked++
    if (!obj.includes('alignFor(design')) {
      missing.push({ helper, line: src.slice(0, at).split(LF).length, obj: obj.slice(0, 120).replace(/\n/g, ' ') })
    }
  }
}
for (const m of missing) {
  bad(`${CARD}:${m.line} styles card text with ${m.helper}...) but never calls alignFor, so the text alignment control does nothing for it. Add \`textAlign: alignFor(design)\` to that style object (or \`alignFor(design, 'center')\` if it hardcoded one). Object: ${m.obj}`)
}

// ── 2. And the totals have not quietly dropped ──────────────────────────────
//
// Section 1 can only check objects it can see. If a restyle moves a whole
// template's text into variables or a helper component, those calls vanish
// from its view and it goes green having checked less. The count is the
// backstop: sixteen templates, four text elements, and one template with no
// separate job title line.
const EXPECTED_ALIGN_SITES = 64
const actual = (src.match(/alignFor\(design/g) || []).length
if (actual < EXPECTED_ALIGN_SITES) {
  bad(`${CARD} calls alignFor ${actual} times, down from ${EXPECTED_ALIGN_SITES}. Text has stopped honouring the alignment control somewhere section 1 above cannot see - most likely it moved into a variable or a shared component. Wire it there and update EXPECTED_ALIGN_SITES.`)
}

// ── 2b. Creative's title pill moves with the row, not with text-align ───────
//
// It is a gradient badge in a flex row. text-align does nothing to it, so the
// alignment has to reach justifyContent or choosing "left" moves every other
// line on that card and leaves the badge centred - the control half working,
// which is harder to report than it not working at all.
if (!/justifyContent: justifyFor\(design\)/.test(src)) {
  bad(`${CARD}: Creative's job-title pill no longer takes its position from justifyFor, so the alignment control cannot move it. Choosing "left" would move every other line on that card and leave the badge centred.`)
}

// ── 3. The setting still means "unset is the template's own" ────────────────
//
// If alignFor ever gained a default, every card in the database would jump to
// that alignment at once, overriding sixteen designs that centre or left-set
// their text on purpose.
const fn = design.match(/export function alignFor\([\s\S]*?\n\}/)
if (!fn) bad(`${DESIGN}: alignFor is gone, so 63 call sites in ${CARD} are calling nothing.`)
else if (!/return v === 'left' \|\| v === 'center' \|\| v === 'right' \? v : fallback/.test(fn[0])) {
  bad(`${DESIGN}: alignFor no longer falls back to the caller's value for an unset alignment. An unset card MUST render the template's own alignment - anything else silently restyles every card that has never touched this control.`)
}
if (/\btextAlign: '(left|center|right)'/.test(design.match(/export const DEFAULT_DESIGN[\s\S]*?\n\}/)?.[0] || '')) {
  bad(`${DESIGN}: DEFAULT_DESIGN now sets textAlign. That makes it the alignment of every card that has never chosen one, overriding each template's own design.`)
}

// ── 4. The control can still give the template's alignment back ─────────────
if (!/textAlign: undefined/.test(panel) && !/\{ v: undefined/.test(panel)) {
  bad(`${PANEL}: the alignment control has no option that clears the setting, so once somebody picks an alignment they can never get the template's own back.`)
}

if (fail) {
  console.error(`${LF}check-text-align: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  `check-text-align: all ${checked} card-text style objects honour the alignment control (${actual} call sites), unset still means ` +
  "the template's own alignment, and the panel can hand that back.",
)
