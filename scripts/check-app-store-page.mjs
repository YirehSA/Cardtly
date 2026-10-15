// The App Store listing's page stays a dead end.
//
// WHAT THIS PROTECTS: the App Store listing's Marketing URL and Support URL
// point at /app-support. Apple opens them in an ordinary browser, where the
// app's user-agent check does not apply, and rejection 7 (2026-10-14) was the
// home page's Pricing link reached that way. Any link back into the site can
// lead to a price, so the page carries no link at all except email.
//
// Run: node scripts/check-app-store-page.mjs

import { readFileSync } from 'node:fs'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const path = 'app/app-support/page.tsx'
let src = ''
try { src = readFileSync(path, 'utf8').replace(/\r/g, '') } catch { bad(`${path} is missing: the App Store listing points at it`) }

// Comments explain the rule and name the things it forbids, so judge the code.
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\s*\}/g, '')

if (/import\s+\w+\s+from\s+'@\/components\/marketing\/(Navbar|Footer)'/.test(code)) bad('the page imports the site Navbar or Footer, which link to Pricing and Sign up')
if (/from\s+'next\/link'|<Link\b/.test(code)) bad('the page uses next/link: no link into the site is allowed')
if (/<a\b/.test(code) && [...code.matchAll(/<a\b[^>]*>/g)].some(m => !/href=\{`mailto:|href="mailto:/.test(m[0]))) bad('an <a> on the page is not a mailto link')
if (/\bhref=["'{`](?!`?mailto:)/.test(code.replace(/href=\{`mailto:[^`]*`\}/g, ''))) bad('the page has an href that is not mailto')
if (/(window\.)?location\s*=|router\.push|onClick=/.test(code)) bad('the page navigates somewhere by script')
if (/\bR\s?\d{2,}|\$\s?\d|per (card|seat|month)|\/month/i.test(code)) bad('the page mentions a price')
if (/pricing|sign ?up|free trial|subscribe|upgrade|checkout|buy now|start (a|your) trial/i.test(code)) bad('the page mentions pricing, sign-up, a trial or buying')
if (!/robots:\s*\{\s*index:\s*false/.test(code)) bad('the page should stay out of search results (robots index: false)')

if (fail) {
  console.error(`check-app-store-page: ${fail} problem(s)`)
  process.exit(1)
}
console.log('check-app-store-page: /app-support has no site link, no price and no sign-up; only an email link, so the App Store URLs lead nowhere Apple objects to')
