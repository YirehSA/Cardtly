// The bio alignment control reaches every bio, and nothing but the bios.
//
// WHAT THIS EXISTS BECAUSE OF. The control is one setting read by sixteen
// separate style objects - one bio per template. There is no shared component
// to put it in, because each template sets its own type. A sweep like that
// rots: the next person to restyle Frost's bio writes a fresh style object,
// forgets one property out of eight, and the control silently stops working on
// one template. Nobody notices until a customer does.
//
// AND IT GUARDS THE BOUNDARY IN BOTH DIRECTIONS. This shipped for a few hours
// as one control over the name, job title, company and bio together, on the
// reasoning that alignment belongs to the text block. It does not, on a
// business card: those three are each one short line placed by the template as
// part of its design, and moving them moves the design. So the check is not
// only "every bio honours it" but "nothing else does" - the easy mistake now
// is a well-meaning sweep putting it back on the name.
//
// It also holds the per-template type size floors, which are the other place
// the typography controls promise something a template has to deliver.
//
// Run: node scripts/check-text-align.mjs

import { readFileSync } from 'fs'

const CARD = 'components/card/PublicCardView.tsx'
const DESIGN = 'types/design.ts'
const PANEL = 'components/card/DesignPanel.tsx'
const LF = String.fromCharCode(10)

const BIO = 'getBioColor(design'
const NOT_BIO = ['getNameColor(design', 'getTitleColor(design', 'getCompanyColor(design']

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return null } }

const src = read(CARD)
const design = read(DESIGN)
const panel = read(PANEL)
if (!src || !design || !panel) { bad('a source file is missing'); process.exit(1) }

/** The { ... } literal a position sits inside, or null when it is not in one -
 *  which is how a `const bioColor = getBioColor(...)` binding is recognised
 *  rather than misread. Those are wired at their usage site, and the count in
 *  section 3 is what keeps them honest. */
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

function objectsHolding(marker) {
  const out = []
  let from = 0
  for (;;) {
    const at = src.indexOf(marker, from)
    if (at < 0) break
    from = at + marker.length
    const obj = enclosingObject(src, at)
    if (!obj || !obj.includes(':')) continue
    out.push({ at, line: src.slice(0, at).split(LF).length, obj })
  }
  return out
}

// ── 1. Every bio honours it ─────────────────────────────────────────────────
let bios = 0
for (const o of objectsHolding(BIO)) {
  bios++
  if (!o.obj.includes('bioAlignFor(design')) {
    bad(`${CARD}:${o.line} styles a bio but never calls bioAlignFor, so the alignment control does nothing on that template. Add \`textAlign: bioAlignFor(design)\` (or \`bioAlignFor(design, 'center')\` if it hardcoded one).`)
  }
}

// ── 2. And nothing else does ────────────────────────────────────────────────
for (const marker of NOT_BIO) {
  for (const o of objectsHolding(marker)) {
    // An object can legitimately hold both when a template styles a block; the
    // bio is what is being aligned there.
    if (o.obj.includes(BIO)) continue
    if (o.obj.includes('bioAlignFor(design')) {
      bad(`${CARD}:${o.line} aligns ${marker.replace('(design', '')} text with bioAlignFor. The control is the BIO's only - the name, job title and company sit where each template puts them, and moving them moves the design.`)
    }
  }
}

// ── 3. The totals have not quietly drifted ──────────────────────────────────
//
// Sections 1 and 2 can only see objects they can parse. Two templates hold
// their bio colour in a variable, so their style object carries no getBioColor
// for section 1 to find; the count is what covers them. One bio per template.
const EXPECTED = 16
const actual = (src.match(/bioAlignFor\(design/g) || []).length
if (actual !== EXPECTED) {
  bad(`${CARD} calls bioAlignFor ${actual} times, not ${EXPECTED} - one per template. Fewer means a bio has stopped honouring the control somewhere the sections above cannot see; more means it has spread to text that is not a bio.`)
}

// ── 4. Unset still means the template's own ─────────────────────────────────
//
// If bioAlignFor ever gained a default, every card in the database would jump
// to that alignment at once, overriding the templates that centre or justify
// their bio on purpose.
const fn = design.match(/export function bioAlignFor\([\s\S]*?\n\}/)
if (!fn) bad(`${DESIGN}: bioAlignFor is gone, so ${actual} call sites in ${CARD} are calling nothing.`)
else if (!/return v === 'left' \|\| v === 'center' \|\| v === 'right' \? v : fallback/.test(fn[0])) {
  bad(`${DESIGN}: bioAlignFor no longer falls back to the caller's value for an unset alignment. An unset card MUST render the template's own - anything else silently restyles every card that has never touched this control.`)
}
if (/\bbioAlign: '(left|center|right)'/.test(design.match(/export const DEFAULT_DESIGN[\s\S]*?\n\}/)?.[0] || '')) {
  bad(`${DESIGN}: DEFAULT_DESIGN now sets bioAlign, which makes it the alignment of every card that has never chosen one.`)
}

// ── 5. The panel can hand the template's alignment back ─────────────────────
if (!/\{ v: undefined, label: 'Template' \}/.test(panel)) {
  bad(`${PANEL}: the bio alignment control has no option that clears the setting, so once somebody picks an alignment they can never get the template's own back.`)
}
if (/name, job title, company and bio together/.test(panel)) {
  bad(`${PANEL}: the bio alignment control still tells people it moves the name, job title and company. It does not.`)
}

// ── 6. Showroom's company size can still go below 80 ────────────────────────
//
// Showroom sets the COMPANY as its 26px headline, so it is the one place where
// going under 80% makes a card better rather than illegible. The floor is
// enforced in TWO places and both have to hold: the panel's stepper, so the
// value can be reached, and calcCompanySize, so a card carrying 60 that
// switches to Classic does not print its company at 7px with no control able
// to show a number that low.
if (!/if \(templateId === 'showroom' && sizeKey === 'companySize'\) return 60/.test(design)) {
  bad(`${DESIGN}: typeSizeMin no longer lets Showroom's company text go below 80%. It is the only template where the company IS the headline, which is the whole reason for the exception.`)
}
if (!/const min = typeSizeMin\(design\.templateId, 'companySize'\)/.test(design)) {
  bad(`${DESIGN}: calcCompanySize no longer clamps to the per-template floor, so a card set to 60 on Showroom would print its company at 60% on templates where that is 7px.`)
}
if (!/Math\.max\(minPct, sizePct - 10\)/.test(panel) || !/disabled=\{sizePct <= minPct\}/.test(panel)) {
  bad(`${PANEL}: the typography stepper is back to a flat minimum, so Showroom's company size cannot be taken below 80% however much calcCompanySize allows.`)
}

if (fail) {
  console.error(`${LF}check-text-align: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  `check-text-align: all ${bios} bio style objects honour the alignment control and no name, title or company does ` +
  `(${actual} call sites, one per template), unset still means the template's own, the panel can hand that back, and ` +
  "Showroom's company size still reaches 60%.",
)
