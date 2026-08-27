// Unit tests for the spreadsheet-import and directory-filter helpers.
//
// Run: node scripts/test-import-directory.mjs
//
// These are the pure pieces of three features a tender turns on: an .xlsx
// staff list becoming cards, and finding one person inside a company of
// several hundred.
//
// The functions under test are the REAL ones. lib/*.ts is compiled with the
// project's own tsc into a temp directory and imported from there, rather
// than retyping the logic here - a test that re-implements what it is testing
// passes happily while the source drifts underneath it, which is worse than
// no test because it reads like coverage.

import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const out = mkdtempSync(join(tmpdir(), 'cardtly-test-'))

try {
  // tsc's own entry point rather than the .bin shim: spawning a .cmd without
  // a shell is EINVAL on Windows, and going through a shell would mean
  // quoting a temp path that can contain spaces.
  execFileSync(
    process.execPath,
    [join(ROOT, 'node_modules/typescript/bin/tsc'),
     'lib/csv-import.ts', 'lib/network.ts', 'lib/industries.ts',
     '--outDir', out, '--module', 'commonjs', '--target', 'es2022',
     '--skipLibCheck'],
    { cwd: ROOT, stdio: 'pipe' }
  )
} catch (e) {
  console.error('Could not compile the libraries under test:\n' + (e.stdout || e.message))
  process.exit(1)
}

// CommonJS, because tsc emits extensionless relative imports that Node's ESM
// loader refuses; require resolves them without a build step to fix up.
const require = createRequire(import.meta.url)
const { rowsToCsv, parseDelimited } = require(join(out, 'csv-import.js'))
const { companyFacets, filterCompanyCards } = require(join(out, 'network.js'))

let pass = 0
const fail = []
const ok = (name, cond, detail) => {
  if (cond) { pass++; return }
  fail.push(`${name}${detail ? `\n      ${detail}` : ''}`)
}
const eq = (name, actual, expected) =>
  ok(name, JSON.stringify(actual) === JSON.stringify(expected),
     `expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`)

// ── rowsToCsv: what the .xlsx reader hands to the CSV parser ───────────────
eq('plain cells need no quoting',
  rowsToCsv([['Name', 'Email'], ['Thabo Nkosi', 't@x.co.za']]),
  'Name,Email\nThabo Nkosi,t@x.co.za')
eq('a comma in a job title is quoted',
  rowsToCsv([['Sarah', 'Director, Sales']]), 'Sarah,"Director, Sales"')
eq('a quote is doubled', rowsToCsv([['He said "hi"']]), '"He said ""hi"""')
eq('a newline inside a cell is quoted, not split',
  rowsToCsv([['line1\nline2', 'b']]), '"line1\nline2",b')
eq('null and undefined become empty, keeping column positions',
  rowsToCsv([['a', null, undefined, 'd']]), 'a,,,d')

// The round trip is the real contract: whatever the workbook held has to
// survive rowsToCsv and come back out of parseDelimited unchanged.
const tricky = [
  ['Name', 'Job title', 'Business unit'],
  ['Sarah Botha', 'Director, Sales', 'Sales'],
  ['Kobus "KB" Steyn', 'Estimator', 'Sales'],
  ['Thabo Nkosi', 'Site\nManager', 'Site Management'],
  ['Jan van Wyk', '', 'Admin'],
]
eq('xlsx cells survive the round trip through the CSV parser',
  parseDelimited(rowsToCsv(tricky)), tricky)

// ── cellText, lifted from the modal ────────────────────────────────────────
// This one lives in a .tsx that imports React, so it is read out of the file
// and its type annotations stripped, rather than compiled with its component.
const modalSrc = readFileSync(new URL('../components/team/BulkImportModal.tsx', import.meta.url), 'utf8')
const fnMatch = modalSrc.match(/function cellText\(v: any\): string \{[\s\S]*?\n\}/)
ok('cellText was found in BulkImportModal', !!fnMatch)
const cellText = fnMatch
  ? new Function(`${fnMatch[0].replace(/: any|: string/g, '')}; return cellText`)()
  : () => { throw new Error('not found') }

eq('plain string cell', cellText('  Thabo  '), 'Thabo')
eq('empty cell', cellText(null), '')
eq('number cell', cellText(42), '42')
eq('hyperlinked email yields the text, not [object Object]',
  cellText({ text: 'sarah@x.co.za', hyperlink: 'mailto:sarah@x.co.za' }), 'sarah@x.co.za')
eq('rich text is joined',
  cellText({ richText: [{ text: 'Site ' }, { text: 'Manager' }] }), 'Site Manager')
eq('a formula yields its result',
  cellText({ formula: 'CONCAT(A1,B1)', result: 'Thabo Nkosi' }), 'Thabo Nkosi')
eq('a formula error yields empty, not #DIV/0!',
  cellText({ formula: 'A1/0', error: '#DIV/0!' }), '')
eq('a date cell is a plain date', cellText(new Date('2026-08-27T10:00:00Z')), '2026-08-27')
ok('no cell shape produces [object Object]',
  ![{ text: 'a' }, { richText: [{ text: 'b' }] }, { result: 'c' }, { error: '#N/A' }]
    .some(v => cellText(v).includes('[object')))

// ── Directory facets and filtering ─────────────────────────────────────────
const CARDS = [
  { id: '1', name: 'Andre Nel', title: 'Sales Director', department: 'Sales' },
  { id: '2', name: 'Priya Naidoo', title: 'sales director', department: 'Sales' },
  { id: '3', name: 'Thabo Mokoena', title: 'Site Manager', department: 'Site Management' },
  { id: '4', name: 'Sarah Botha', title: 'Sales Director', department: 'Sales' },
  { id: '5', name: 'Jan van Wyk', title: null, department: null },
  { id: '6', name: 'Kobus Steyn', title: 'Estimator', department: '  Sales  ' },
]

const f = companyFacets(CARDS)
eq('business units fold on case and whitespace, biggest first',
  f.departments, [{ value: 'Sales', count: 4 }, { value: 'Site Management', count: 1 }])
eq('job titles fold on case, labelled with the commonest spelling',
  f.titles.map(t => t.value), ['Sales Director', 'Estimator', 'Site Manager'])
eq('the folded title keeps the full count', f.titles[0], { value: 'Sales Director', count: 3 })
ok('blank values never become a filter chip', !f.departments.some(d => !d.value.trim()))

eq('filter by business unit matches across casing and padding',
  filterCompanyCards(CARDS, '', 'sales', null).map(c => c.id), ['1', '2', '4', '6'])
eq('filter by job title catches the lowercase spelling too',
  filterCompanyCards(CARDS, '', null, 'Sales Director').map(c => c.id), ['1', '2', '4'])
eq('the two filters combine',
  filterCompanyCards(CARDS, '', 'Sales', 'Estimator').map(c => c.id), ['6'])
eq('words match in any order across fields',
  filterCompanyCards(CARDS, 'naidoo sales', null, null).map(c => c.id), ['2'])
eq('search combines with a filter',
  filterCompanyCards(CARDS, 'botha', 'Sales', null).map(c => c.id), ['4'])
eq('no filters returns everyone', filterCompanyCards(CARDS, '', null, null).length, 6)
eq('somebody with no unit is still findable by name',
  filterCompanyCards(CARDS, 'jan', null, null).map(c => c.id), ['5'])
eq('no match returns nothing', filterCompanyCards(CARDS, 'zzz', null, null), [])

rmSync(out, { recursive: true, force: true })

console.log(`\n${pass} passed, ${fail.length} failed`)
if (fail.length) {
  for (const f2 of fail) console.error('  FAIL  ' + f2)
  process.exitCode = 1
} else {
  console.log('import + directory helpers: all assertions hold.')
}
