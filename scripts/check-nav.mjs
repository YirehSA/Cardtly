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

// The two navs also have to MEET. The sidebar appears at one breakpoint and the
// bottom bar disappears at another, and if the bar goes before the sidebar
// arrives there is a band of screen widths with no navigation whatsoever.
//
// That is not hypothetical: the bar was md:hidden while the sidebar was
// hidden lg:flex, so every width from 768px to 1023px had neither. An iPad in
// portrait is 820px, which is how Apple's reviewer found it - and every tablet
// user and every half-width desktop window had been in the same hole silently.
const ORDER = ['sm', 'md', 'lg', 'xl', '2xl']

function navBreakpoints() {
  const sidebarSrc = readFileSync('components/dashboard/Sidebar.tsx', 'utf8')
  const mobileSrc = readFileSync('components/dashboard/MobileBottomNav.tsx', 'utf8')
  // Where the sidebar starts showing: `hidden lg:flex`.
  const shows = sidebarSrc.match(/hidden\s+(\w+):(?:flex|block|grid)/)
  // Where the bar stops showing. Taken from the bar itself, not the sheet.
  const hides = mobileSrc.match(/fixed bottom-0 left-0 right-0 z-\[60\] (\w+):hidden/)
  return { shows: shows?.[1] || null, hides: hides?.[1] || null }
}

const bp = navBreakpoints()
if (!bp.shows || !bp.hides) {
  console.error('\ncheck-nav: could not read the nav breakpoints. Sidebar needs a "hidden <bp>:flex" '
    + 'and the bottom bar a "<bp>:hidden" on its fixed bar, or this guard is checking nothing.\n')
  process.exit(1)
}
if (ORDER.indexOf(bp.hides) < ORDER.indexOf(bp.shows)) {
  console.error(`\ncheck-nav: there is a band of screen widths with no navigation at all.\n\n`
    + `  The bottom bar hides at ${bp.hides} and the sidebar does not appear until ${bp.shows},\n`
    + `  so anything between them shows neither. A tablet in portrait sits right there.\n\n`
    + `  Make the bar ${bp.shows}:hidden so it hands over exactly where the sidebar takes\n`
    + `  over. The content wrapper's pb-28 lg:pb-10 assumes the same handover point.\n`)
  process.exit(1)
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
  (conditional.length ? `, ${conditional.length} conditional (${conditional.map(([h, g]) => `${h.split('/').pop()}:${g}`).join(', ')})` : '') +
  `, and they hand over at ${bp.shows} with no gap.`)
