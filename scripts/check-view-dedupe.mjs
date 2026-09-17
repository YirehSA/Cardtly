// A card view is counted once, by one piece of code.
//
// WHAT THIS EXISTS BECAUSE OF. Anthony's team card had 33 pairs of view events
// on the same device and browser within five seconds, gaps of 7ms, 10ms, 17ms.
// Each pair was two real document loads, one at ?s=email and one at
// ?s=email-qr - the link and the QR code from the same email signature, opened
// milliseconds apart by the same browser. About 8% of his views were not
// people. The per-mount ref in CardTracker could never have caught it: it
// stops one component instance firing twice and knows nothing about a second
// page load.
//
// THERE ARE TWO ENTRY POINTS, which is the thing worth guarding. CardTracker
// wraps personal cards; the useTrackView hook is used by team cards. They fire
// the same event for the same reason, so a fix applied to one and not the
// other leaves half the cards wrong, and nothing about the code makes that
// obvious - the two live in different files and neither mentions the other.
// Both must go through trackView().
//
// Run: node scripts/check-view-dedupe.mjs

import { readFileSync } from 'fs'

const TRACK = 'lib/track.ts'
const TRACKER = 'components/card/CardTracker.tsx'
const LF = String.fromCharCode(10)

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }

const read = (p) => {
  try { return readFileSync(p, 'utf8').replace(new RegExp(String.fromCharCode(13), 'g'), '') }
  catch { bad(`${p} is missing`); return '' }
}

/** Comments stripped, so the explanation of the bug cannot satisfy a check
 *  looking for the fix. Both files describe it at length on purpose. */
const code = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split(LF).map(l => l.replace(/\/\/.*$/, '')).join(LF)

const track = code(read(TRACK))
const tracker = code(read(TRACKER))

// 1. The one implementation exists, and still has BOTH guards. They catch
//    different things: visibility catches a load nobody looked at, dedupe
//    catches the same browser arriving twice.
const body = (() => {
  // Scoped to the function. Testing the whole file passed with the body
  // emptied, because the words appear in the helpers above it.
  const at = track.indexOf('export function trackView')
  if (at < 0) return ''
  const rest = track.slice(at)
  const open = rest.indexOf('{')
  const end = rest.indexOf(LF + '}')
  return open < 0 || end < 0 ? '' : rest.slice(open, end)
})()

if (!body) {
  bad(`${TRACK}: trackView is gone, so there is no single place a view is counted and the two entry points are deciding for themselves again`)
} else {
  if (!/whenVisible\(/.test(body)) {
    bad(`${TRACK}: trackView no longer waits for the page to be visible, so a prerendered or background load counts as somebody having seen the card`)
  }
  if (!/viewAlreadyCounted\(/.test(body)) {
    bad(`${TRACK}: trackView no longer dedupes, so one browser loading the card twice in a moment counts twice - which is the defect this was written for`)
  }
}

// 2. The guards themselves still do what their names claim.
if (!/prerendering/.test(track)) {
  bad(`${TRACK}: whenVisible no longer checks document.prerendering, so a speculatively loaded page counts a view for a visit that may never happen`)
}
if (!/localStorage/.test(track)) {
  bad(`${TRACK}: the dedupe no longer uses localStorage. sessionStorage is per tab, and two tabs is exactly the case being caught.`)
}
if (!/catch\s*\{[\s\S]{0,120}?return false/.test(track)) {
  bad(`${TRACK}: the dedupe no longer fails open. Blocked storage must not cost an owner a real view; a duplicate is the lesser fault.`)
}

// 3. BOTH ENTRY POINTS GO THROUGH IT. This is the check with teeth.
for (const [file, src] of [[TRACK, track], [TRACKER, tracker]]) {
  if (!/trackView\(/.test(src)) {
    bad(`${file} does not call trackView, so its view events skip the dedupe and that half of the cards double counts again`)
  }
  // A raw view send anywhere is the regression, whichever file it is in.
  if (/(?:^|[^a-zA-Z])track\(\s*\{[^}]*eventType:\s*'view'/.test(src)) {
    bad(`${file} sends a 'view' event straight through track(), bypassing the visibility and dedupe guards. Call trackView instead.`)
  }
}

// 4. And the arrival events are NOT deduped, or the attribution goes with it.
//    ?s=email and ?s=email-qr are different markers on the same visit and
//    collapsing them would make a QR scan indistinguishable from a click.
if (/viewAlreadyCounted\([\s\S]{0,200}?source\.eventType/.test(tracker)) {
  bad(`${TRACKER} dedupes the arrival event as well as the view, which throws away the marker that tells a link from a QR scan`)
}

if (fail) {
  console.error(`${LF}check-view-dedupe: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  'check-view-dedupe: both entry points count a view through one trackView, which waits for the page to be visible ' +
  'and ignores the same browser arriving twice within seconds - so a prefetch or an email scanner opening two ' +
  'marked URLs no longer reads as two people.',
)
