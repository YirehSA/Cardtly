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
import { readFileSync } from 'fs'

const hrefs = file =>
  new Set([...readFileSync(file, 'utf8').matchAll(/href: '(\/dashboard[^']*)'/g)].map(m => m[1]))

const sidebar = hrefs('components/dashboard/Sidebar.tsx')
const mobile = hrefs('components/dashboard/MobileBottomNav.tsx')

const missingFromMobile = [...sidebar].filter(h => !mobile.has(h))
const missingFromSidebar = [...mobile].filter(h => !sidebar.has(h))

if (missingFromMobile.length || missingFromSidebar.length) {
  console.error('\ncheck-nav: the desktop and mobile dashboard navs disagree.\n')
  if (missingFromMobile.length)
    console.error('  In Sidebar.tsx but not MobileBottomNav.tsx (unreachable on phones and in the app):\n' +
      missingFromMobile.map(h => '    ' + h).join('\n'))
  if (missingFromSidebar.length)
    console.error('  In MobileBottomNav.tsx but not Sidebar.tsx (unreachable on desktop):\n' +
      missingFromSidebar.map(h => '    ' + h).join('\n'))
  console.error('\nAdd the destination to both, or remove it from both.\n')
  process.exit(1)
}

console.log(`check-nav: both dashboard navs cover the same ${sidebar.size} destinations.`)
