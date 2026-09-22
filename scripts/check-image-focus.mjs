// The reframing tool frames the crop the card actually uses.
//
// WHAT THIS EXISTS BECAUSE OF. A focal point is stored as one CSS
// object-position per image and applied in three places: the shared Avatar,
// the Showroom hero band and the gallery thumbnail. Two things can silently
// break it, and neither shows up in a type check.
//
//   1. A SURFACE STOPS APPLYING IT. Somebody rewrites the gallery thumb or the
//      hero img and drops objectPosition. The editor's tool still drags, still
//      saves, and the card ignores it - which reads as "the reframe tool does
//      not work" and is nearly impossible to find, because the stored value is
//      correct and the preview in the editor is correct too.
//
//   2. THE TOOL'S SHAPE DRIFTS FROM THE CARD'S. The picker draws its frame at
//      HERO_ASPECT / GALLERY_ASPECT. Change the hero's height or swap the
//      thumbnail off aspect-video and the tool is now framing a shape the card
//      does not use, so a photo centred perfectly in the tool comes out cut
//      off on the card. Worse than no tool, because it looks like it worked.
//
// Run: node scripts/check-image-focus.mjs

import { readFileSync } from 'fs'

const CARD = 'components/card/PublicCardView.tsx'
const DESIGN = 'types/design.ts'
const PICKER = 'components/card/ImageFocusPicker.tsx'
const EDITORS = ['components/card/CardEditor.tsx', 'components/team/TeamCardEditor.tsx']
const LF = String.fromCharCode(10)

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return null } }

const card = read(CARD)
const design = read(DESIGN)
const picker = read(PICKER)
if (!card || !design || !picker) {
  bad('one of the source files is missing, so nothing here can be checked')
  process.exit(1)
}

// ── 1. Every cropped surface applies a focal point ──────────────────────────
//
// Matched on the SURFACE plus its objectPosition together, not on the presence
// of the string somewhere in a 4,000 line file - which would pass on any file
// that happened to mention it once.

/** One top-level function's source, so a check is scoped to the thing it is
 *  about rather than to a character window a comment can push a match out of.
 *
 *  Sliced to the NEXT TOP-LEVEL DECLARATION, which is the only boundary here
 *  that is not confused by the props.
 *
 *  Two wrong ways were tried first, and both reported "Avatar no longer
 *  applies its focal point" while Avatar was applying it perfectly well.
 *  Counting braces from the signature finishes at the end of the DESTRUCTURED
 *  PARAMETER LIST, because the first `{` after the name opens the props
 *  pattern, not the body. Slicing to the next `}` in column zero stops at the
 *  `})` that closes that same pattern. A guard that cries wolf is worth less
 *  than no guard, so the boundary has to be something a props block cannot
 *  contain. */
function bodyOf(src, signature) {
  const at = src.indexOf(signature)
  if (at < 0) return ''
  const after = src.slice(at + signature.length)
  const next = after.search(new RegExp(LF + '(?:export )?(?:function|const|interface|type) '))
  return next < 0 ? src.slice(at) : src.slice(at, at + signature.length + next)
}

const avatar = bodyOf(card, 'function Avatar(')
if (!avatar) {
  bad(`${CARD}: cannot find the Avatar function, so the portrait's focal point cannot be checked.`)
} else if (!/objectFit: 'cover'/.test(avatar) || !/objectPosition: focusFor\(design, 'photo'\)/.test(avatar)) {
  bad(`${CARD}: Avatar no longer crops with a focal point, so reframing a portrait saves a value that nothing reads. Its baseStyle needs objectFit 'cover' AND objectPosition: focusFor(design, 'photo').`)
}

const SURFACES = [
  {
    what: 'the Showroom hero band',
    re: /src=\{heroPhoto\}[\s\S]{0,320}?objectPosition: focusFor\(design, 'hero'\)/,
    fix: "the hero <img> must set objectPosition: focusFor(design, 'hero').",
  },
  {
    what: 'the gallery thumbnail',
    re: /const thumb = <img[\s\S]{0,360}?objectPosition: item\.focus/,
    fix: 'the gallery thumb must set objectPosition from item.focus.',
  },
  {
    // Showroom draws its seller chip itself rather than through Avatar, so it
    // does not inherit the portrait's focal point and has to be listed
    // separately. It was missed on the first pass for exactly that reason:
    // reframing a portrait worked everywhere except the one template the
    // reframing tool was built for.
    what: "Showroom's seller chip",
    re: /width: sellerSize, height: sellerSize, objectFit: 'cover', objectPosition: focusFor\(design, 'photo'\)/,
    fix: "the seller chip <img> must set objectPosition: focusFor(design, 'photo').",
  },
]
for (const s of SURFACES) {
  if (!s.re.test(card)) {
    bad(`${CARD}: ${s.what} no longer applies its focal point, so the reframing tool saves a value that nothing reads - ${s.fix}`)
  }
}

// And the gallery has to carry it per SLOT. Keyed off the filtered position, a
// cleared photo would hand its framing to the next one along, which is the
// exact defect the `index` field on the same object was added to prevent.
if (!/focus: focusFor\(design, String\(i\)\)/.test(card)) {
  bad(`${CARD}: gallery items no longer take their focus from the slot number. Keyed off anything else, clearing photo 2 re-frames every photo after it.`)
}

// ── 2. The tool's frame is the card's frame ─────────────────────────────────
const heroAspect = design.match(/export const HERO_ASPECT = (\d+) \/ (\d+)/)
const galleryAspect = design.match(/export const GALLERY_ASPECT = (\d+) \/ (\d+)/)

if (!heroAspect) bad(`${DESIGN}: HERO_ASPECT is gone or is no longer written as a width / height pair, so it cannot be checked against the card.`)
else {
  // The denominator is the hero band's height, and the card states it.
  const heroHeight = card.match(/minHeight: (\d+)[\s\S]{0,400}?src=\{heroPhoto\}/)
  if (!heroHeight) {
    bad(`${CARD}: cannot find the Showroom hero's minHeight, so HERO_ASPECT cannot be held to it.`)
  } else if (heroHeight[1] !== heroAspect[2]) {
    bad(`HERO_ASPECT is ${heroAspect[1]}/${heroAspect[2]} but the Showroom hero is ${heroHeight[1]}px tall. The reframing tool would draw a different shape from the card, so a photo centred in the tool comes out cropped on the card.`)
  }
  if (heroAspect[1] !== '390') {
    bad(`HERO_ASPECT's width is ${heroAspect[1]}, not 390. 390 is the width the card is laid out at and the width CardPreview renders it at; anything else frames a viewport nobody has.`)
  }
}

if (!galleryAspect) bad(`${DESIGN}: GALLERY_ASPECT is gone or is no longer a width / height pair.`)
else {
  // aspect-video IS 16/9. If the thumb moves off it, the constant is wrong.
  const usesAspectVideo = /const thumb = <img[\s\S]{0,200}?aspect-video/.test(card)
  if (!usesAspectVideo) {
    bad(`${CARD}: the gallery thumbnail is no longer aspect-video, so GALLERY_ASPECT (${galleryAspect[1]}/${galleryAspect[2]}) is now describing a crop that does not exist.`)
  } else if (galleryAspect[1] !== '16' || galleryAspect[2] !== '9') {
    bad(`GALLERY_ASPECT is ${galleryAspect[1]}/${galleryAspect[2]} but the thumbnail is aspect-video, which is 16/9.`)
  }
}

// ── 3. The drag direction, which is the one thing that makes it feel broken ─
//
// Pulling the picture DOWN must reveal what is above it. object-position counts
// from the top, so the percentage has to go DOWN as the pointer goes down:
// (start - current), never (current - start). Inverted, the tool works
// perfectly and fights the user on every drag.
if (!/\(s\.py - e\.clientY\)/.test(picker) || !/\(s\.px - e\.clientX\)/.test(picker)) {
  bad(`${PICKER}: the drag no longer computes its delta as (start - current). Reversed, dragging the photo down moves the crop down, so the image appears to run away from the finger.`)
}
if (!/touchAction: 'none'/.test(picker)) {
  bad(`${PICKER}: the frame has lost touchAction 'none', so on a phone the browser scrolls the page instead of reporting the drag - the gesture stops existing on the devices most cards are edited on.`)
}

// ── 4. Both editors actually offer it ───────────────────────────────────────
for (const e of EDITORS) {
  const src = read(e)
  if (!src) { bad(`${e} is missing`); continue }
  if (!/ImageFocusPicker/.test(src)) {
    bad(`${e} no longer renders ImageFocusPicker, so photos on this editor cannot be reframed at all.`)
    continue
  }
  for (const [key, label] of [["'photo'", 'the profile portrait'], ["'hero'", 'the Showroom hero'], ['String(i)', 'the gallery slots']]) {
    if (!src.includes(`setFocus(${key}`)) {
      bad(`${e}: ${label} has no reframing control (setFocus(${key}) is gone).`)
    }
  }
}

if (fail) {
  console.error(`${LF}check-image-focus: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  'check-image-focus: the portrait, the Showroom hero and the gallery all apply their stored focal point, the gallery keys it by slot, ' +
  'the tool frames the same shapes the card crops to, the drag runs the right way and both editors offer it.',
)
