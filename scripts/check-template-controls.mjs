// Which design controls does each template actually honour?
//
// A customer drags "Profile photo size" on a template that never calls
// calcPhotoSize and nothing moves. That reads as a broken slider, and the
// panel now greys those controls out - but only if it knows which ones apply,
// and a hand-written list of that would rot the moment a template changed.
//
// So the list is derived from the source here and checked against the copy in
// types/design.ts. Each template branch in PublicCardView is read, and a
// control counts as supported when the branch calls the helper that reads it.
//
// Run: node scripts/check-template-controls.mjs
//   --print   emit the map instead of asserting, for pasting into design.ts

import { readFileSync } from 'node:fs'

const SRC = 'components/card/PublicCardView.tsx'
const src = readFileSync(SRC, 'utf8')

// The template chain lives in CardBody. Each branch runs from its own
// `if (design.templateId === 'x') {` to the next one.
const RE = /if \(design\.templateId === '([a-z]+)'\) \{/g
const marks = []
let m
while ((m = RE.exec(src)) !== null) marks.push({ id: m[1], at: m.index })
if (marks.length === 0) {
  console.error('check-template-controls: found no template branches in ' + SRC)
  process.exit(1)
}

const branches = marks.map((mark, i) => ({
  id: mark.id,
  body: src.slice(mark.at, i + 1 < marks.length ? marks[i + 1].at : src.length),
}))

// A control is supported when the branch calls something that reads it.
// Several controls are read through more than one helper, so any hit counts.
const PROBES = {
  photoSize:      ['calcPhotoSize('],
  photoZoom:      ['boldImageZoom'],
  profileBorder:  ['design.profileBorder'],
  logo:           ['<LogoZone', 'calcLogoHeight('],
  cardStyle:      ['cardEffect.'],
  solidBackground:['design.solidBackground'],
  nameType:       ['calcNameSize(', 'getNameColor('],
  titleType:      ['calcTitleSize(', 'getTitleColor('],
  companyType:    ['calcCompanySize(', 'getCompanyColor('],
  bioType:        ['calcBioSize(', 'getBioColor('],
  bodySize:       ['getBodyFontSize('],
  textPosition:   ['textNudge', 'design.textX'],
}

const map = {}
for (const b of branches) {
  map[b.id] = Object.fromEntries(
    Object.entries(PROBES).map(([k, probes]) => [k, probes.some(p => b.body.includes(p))])
  )
}

if (process.argv.includes('--print')) {
  const keys = Object.keys(PROBES)
  const lines = branches.map(b => {
    const on = keys.filter(k => map[b.id][k])
    return `  ${b.id}: [${on.map(k => `'${k}'`).join(', ')}],`
  })
  console.log('{\n' + lines.join('\n') + '\n}')
  process.exit(0)
}

// Compare against the copy the panel reads.
const declaredSrc = readFileSync('types/design.ts', 'utf8')
const block = declaredSrc.match(/export const TEMPLATE_CONTROLS[^=]*= \{([\s\S]*?)\n\}/)
if (!block) {
  console.error('check-template-controls: TEMPLATE_CONTROLS not found in types/design.ts')
  process.exit(1)
}

const declared = {}
for (const line of block[1].split('\n')) {
  const mm = line.match(/^\s*([a-z]+):\s*\[([^\]]*)\]/)
  if (!mm) continue
  declared[mm[1]] = mm[2].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean)
}

let bad = 0
for (const b of branches) {
  const actual = Object.keys(PROBES).filter(k => map[b.id][k]).sort()
  const said = (declared[b.id] || []).slice().sort()
  const missing = actual.filter(k => !said.includes(k))
  const extra = said.filter(k => !actual.includes(k))
  if (missing.length || extra.length) {
    bad++
    console.error(`  ${b.id}:`)
    if (missing.length) console.error(`    the template honours these but the map does not list them: ${missing.join(', ')}`)
    if (extra.length) console.error(`    the map claims these but the template ignores them: ${extra.join(', ')}`)
  }
}
for (const id of Object.keys(declared)) {
  if (!map[id]) { bad++; console.error(`  ${id}: in the map, but no such template branch`) }
}

if (bad) {
  console.error(`\ncheck-template-controls: ${bad} template(s) out of step.`)
  console.error('Regenerate with:  node scripts/check-template-controls.mjs --print')
  process.exit(1)
}

const total = branches.length
const counts = Object.keys(PROBES).map(k => `${k} ${branches.filter(b => map[b.id][k]).length}/${total}`)
console.log(`check-template-controls: ${total} templates, map agrees with the source (${counts.join(', ')}).`)
