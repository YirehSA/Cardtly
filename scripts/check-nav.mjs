// Fails the build when the two dashboard navs disagree.
//
// The dashboard has two of them: Sidebar.tsx on desktop and MobileBottomNav.tsx
// on phones, which is also what the Android app shows since it loads the same
// site in a WebView. They are separate lists because the navs are shaped
// differently - four primary tabs plus a More sheet against one flat list - so
// there is nothing forcing them to match.
//
// The Network page was added to the sidebar alone and was therefore invisible
// to every phone and app user until somebody noticed. Departments had been
// missing from the bottom nav for longer. Both were silent: the page worked
// perfectly, it just could not be reached.
//
// This also compares the CONDITION each destination is shown under, not only
// that it appears in both. Once entries became conditional - Lead capture on
// Pro, Departments for managers, Team Cards hidden from people inside someone
// else's team - "present in both files" stopped being enough. A link gated on
// isPro in one nav and shown to everybody in the other is the same class of
// bug as a missing link, and just as quiet.
import { readFileSync } from 'fs'

// Destinations declared as a named const rather than inline, so the guard that
// references the const can be resolved back to a href.
function constHrefs(src) {
  const map = {}
  for (const m of src.matchAll(/const\s+(\w+)(?:\s*:\s*[\w<>\[\]]+)?\s*=\s*\{\s*href:\s*'(\/dashboard[^']*)'/g)) {
    map[m[1]] = m[2]
  }
  return map
}

// href -> the identifier it is gated behind, or 'always' when it is
// unconditional.
function guards(file) {
  const src = readFileSync(file, 'utf8')
  const consts = constHrefs(src)
  const out = {}

  // Everything declared anywhere in the file starts as unconditional.
  for (const m of src.matchAll(/href:\s*'(\/dashboard[^']*)'/g)) out[m[1]] = 'always'

  // Then anything inside a `...(FLAG ? [ ... ] : ...)` spread is gated on FLAG.
  for (const m of src.matchAll(/\.\.\.\(\s*(\w+)\s*\?\s*\[([^\]]*)\]/g)) {
    const [, flag, body] = m
    for (const h of body.matchAll(/href:\s*'(\/dashboard[^']*)'/g)) out[h[1]] = flag
    for (const name of Object.keys(consts)) {
      if (new RegExp(`\\b${name}\\b`).test(body)) out[consts[name]] = flag
    }
  }
  return out
}

const sidebar = guards('components/dashboard/Sidebar.tsx')
const mobile = guards('components/dashboard/MobileBottomNav.tsx')

const missingFromMobile = Object.keys(sidebar).filter(h => !(h in mobile))
const missingFromSidebar = Object.keys(mobile).filter(h => !(h in sidebar))
const mismatched = Object.keys(sidebar)
  .filter(h => h in mobile && sidebar[h] !== mobile[h])
  .map(h => `${h} - sidebar: ${sidebar[h]}, mobile: ${mobile[h]}`)

if (missingFromMobile.length || missingFromSidebar.length || mismatched.length) {
  console.error('\ncheck-nav: the desktop and mobile dashboard navs disagree.\n')
  if (missingFromMobile.length)
    console.error('  In Sidebar.tsx but not MobileBottomNav.tsx (unreachable on phones and in the app):\n' +
      missingFromMobile.map(h => '    ' + h).join('\n') + '\n')
  if (missingFromSidebar.length)
    console.error('  In MobileBottomNav.tsx but not Sidebar.tsx (unreachable on desktop):\n' +
      missingFromSidebar.map(h => '    ' + h).join('\n') + '\n')
  if (mismatched.length)
    console.error('  Shown under different conditions, so one nav offers it to people the other hides it from:\n' +
      mismatched.map(h => '    ' + h).join('\n') + '\n')
  console.error('Add the destination to both, or remove it from both, under the same condition.\n')
  process.exit(1)
}

const conditional = Object.entries(sidebar).filter(([, g]) => g !== 'always')
console.log(`check-nav: both dashboard navs cover the same ${Object.keys(sidebar).length} destinations` +
  (conditional.length ? `, ${conditional.length} conditional (${conditional.map(([h, g]) => `${h.split('/').pop()}:${g}`).join(', ')}).` : '.'))
