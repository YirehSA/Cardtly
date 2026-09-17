// The team card preview answers the same question the public card answers.
//
// WHAT THIS EXISTS BECAUSE OF. The editor's live preview picked the design
// like this:
//
//   design={usesBrand && orgBrand.color_theme ? parseDesign(orgBrand.color_theme) : design}
//
// The public card does not. It runs mergeBrand, which hands the brand a field
// only when that field is LOCKED or the card has none of its own. So the two
// disagreed on exactly one case, and it is the common one: a team card that
// uses the brand, on an organisation that has NOT locked design. Publicly the
// card's own design wins. In the editor the brand won unconditionally, so an
// admin changed the template, saved it, saw it live on the real card - and
// watched the preview sit there unchanged.
//
// Reported as "the live preview of the card is not updating when I change it",
// which is what a preview showing someone else's answer looks like.
//
// THE RULE. The preview must derive BOTH the form and the design from one
// value that has been through mergeBrand. Two code paths asking the same
// question two ways is the whole defect; one path is the fix.
//
// Run: node scripts/check-team-preview.mjs

import { readFileSync } from 'fs'

const EDITOR = 'components/team/TeamCardEditor.tsx'
const BRAND = 'lib/team-brand.ts'
const LF = String.fromCharCode(10)

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }

const read = (p) => {
  try { return readFileSync(p, 'utf8').replace(new RegExp(String.fromCharCode(13), 'g'), '') }
  catch { bad(`${p} is missing`); return '' }
}

/** Comments stripped, so the explanation of the old bug above the fix cannot
 *  satisfy a check looking for the bug itself. */
const code = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split(LF).map(l => l.replace(/\/\/.*$/, '')).join(LF)

const editor = code(read(EDITOR))
const brand = read(BRAND)

// 1. color_theme has to still be a brand field, or none of this applies.
if (!/color_theme/.test(brand) || !/BRAND_FIELDS/.test(brand)) {
  bad(`${BRAND}: BRAND_FIELDS no longer mentions color_theme, so the design is not brand-managed and this guard is checking a rule that has gone`)
}

// 2. THE OLD EXPRESSION MUST NOT COME BACK. This is the precise shape of the
//    bug: the brand's design chosen because the brand HAS one, rather than
//    because the card's own is locked or missing.
if (/orgBrand\.color_theme\s*\?/.test(editor)) {
  bad(
    `${EDITOR} picks the design with "orgBrand.color_theme ? ...", which gives the brand the design whenever the ` +
    `organisation has one. The public card gives it the design only when design is LOCKED or the card has none, ` +
    `so on an unlocked organisation the preview would stop following the admin's edits.`,
  )
}

// 3. The preview must go through mergeBrand and use ONE derived value for both
//    props. Passing `form` through mergeBrand while picking the design some
//    other way is how the two drifted apart in the first place.
if (!/mergeBrand\(/.test(editor)) {
  bad(`${EDITOR} no longer calls mergeBrand, so the preview is not applying the brand the way the public card does`)
}
if (!/form=\{previewForm\}/.test(editor)) {
  bad(`${EDITOR}: the preview's form is not the merged value, so it can disagree with the design beside it`)
}
if (!/design=\{parseDesign\(previewForm\.color_theme\)\}/.test(editor)) {
  bad(`${EDITOR}: the preview's design is not read from the same merged value as its form, which is the split that caused this`)
}

// 4. And the live edit has to reach that value, or the preview would be
//    faithful to the stored card and still ignore what the admin is doing.
if (!/designTouched \? serializeDesign\(design\) : card\.color_theme/.test(editor)) {
  bad(
    `${EDITOR}: the merged value no longer carries the live design once the admin has touched it, so the preview ` +
    `would show the saved card rather than the edit in progress.`,
  )
}

if (fail) {
  console.error(`${LF}check-team-preview: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  'check-team-preview: the team card preview derives its form and its design from one mergeBrand result, so it ' +
  'answers the brand question exactly as the public card does - the brand wins only when design is locked or the ' +
  'card has none of its own.',
)
