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
const {
  rowsToCsv, parseDelimited, detectColumns, looksLikeHeader, toRows, checkRows,
} = require(join(out, 'csv-import.js'))
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

// ── The worked example in the import modal ───────────────────────
// Pull the example straight out of the component so the test cannot pass
// against a copy that no longer matches what is rendered.
const src = readFileSync('components/team/BulkImportModal.tsx', 'utf8')
const headerLine = src.match(/header: routes \? '([^']+)' : '([^']+)', key: 'company'/)
const routingHeader = headerLine?.[1]
const plainHeader = headerLine?.[2]


ok('routing header found in source', !!routingHeader, String(headerLine))
ok('plain header found in source', !!plainHeader)

// The departments a group would really have.
const targets = [
  { id: 'd1', name: 'Site Management', kind: 'department' },
  { id: 'd2', name: 'Sales', kind: 'department' },
  { id: 'c1', name: 'TBCo Roofing', kind: 'company' },
]

const grid = [
  ['Name', 'Email', 'Job title', 'Phone', routingHeader],
  ['Thabo Nkosi', 'thabo@company.co.za', 'Site Manager', '082 123 4567', 'Site Management'],
  ['Sarah Botha', 'sarah@company.co.za', 'Sales Director', '083 987 6543', 'Sales'],
]

const parsed = parseDelimited(rowsToCsv(grid))
ok('the example round-trips through the parser', JSON.stringify(parsed) === JSON.stringify(grid))

const hasHeader = looksLikeHeader(parsed[0])
ok('the header row is recognised as a header', hasHeader === true)

const map = detectColumns(parsed[0])
for (const [field, idx] of Object.entries(map)) {
  if (field === 'firstName' || field === 'lastName') continue
  ok(`column "${field}" is recognised`, idx !== -1, `detectColumns gave ${idx} for ${field}`)
}

const rows = toRows(parsed, map, hasHeader)
ok('both example rows parse', rows.length === 2, `got ${rows.length}`)
ok('phone survives', rows[0].phone === '082 123 4567', `got "${rows[0].phone}"`)
ok('job title survives', rows[0].title === 'Site Manager', `got "${rows[0].title}"`)

const checked = checkRows(rows, [], 10, targets)
ok('both rows are ready to import', checked.every(r => r.status === 'ready'),
   checked.map(r => `${r.name}=${r.status}`).join(', '))
ok('Thabo routes into Site Management', checked[0].departmentName === 'Site Management',
   `got "${checked[0].departmentName}"`)
ok('Sarah routes into Sales', checked[1].departmentName === 'Sales',
   `got "${checked[1].departmentName}"`)

// The mistake the example used to encourage: a company name in that column.
const badGrid = [
  ['Name', 'Email', routingHeader],
  ['Thabo Nkosi', 'thabo@company.co.za', 'TBCo Roofing'],
]
const badParsed = parseDelimited(rowsToCsv(badGrid))
const badChecked = checkRows(toRows(badParsed, detectColumns(badParsed[0]), true), [], 10, targets)
ok('naming a COMPANY in that column does not route (which is why the example names a department)',
   badChecked[0].departmentName === null, `got "${badChecked[0].departmentName}"`)


// ── Routing when two companies each have a "Sales" ─────────────────────────
//
// The real shape that broke: a group whose Cardtly company and Vistio company
// both hold a department called Sales. Naming the department was ambiguous and
// refused; naming the company was refused too, because cards cannot attach to
// a company. There was no third thing an admin could type.
const { matchDepartment, routingHint } = require(join(out, 'csv-import.js'))

const GROUP = [
  { id: 'coA', name: 'Cardtly', kind: 'company', parentName: null },
  { id: 'coB', name: 'Vistio', kind: 'company', parentName: null },
  { id: 'dA1', name: 'Sales', kind: 'department', parentName: 'Cardtly' },
  { id: 'dA2', name: 'Founders', kind: 'department', parentName: 'Cardtly' },
  { id: 'dB1', name: 'Sales', kind: 'department', parentName: 'Vistio' },
]

eq('a bare duplicate name still routes nowhere',
  matchDepartment('Sales', GROUP), null)
ok('and the hint now says exactly what to type instead',
  /Write the company first.*Cardtly Sales.*Vistio Sales/.test(routingHint('Sales', GROUP)),
  routingHint('Sales', GROUP))

eq('qualifying with the company picks the right one',
  matchDepartment('Vistio Sales', GROUP)?.id, 'dB1')
eq('and the other one',
  matchDepartment('Cardtly Sales', GROUP)?.id, 'dA1')

// norm() flattens punctuation to spaces, so every separator someone might
// reach for is the same comparison. These are the ways people actually write
// it in a spreadsheet.
for (const v of ['Vistio > Sales', 'Vistio/Sales', 'Vistio - Sales', 'Vistio: Sales', 'vistio   sales', 'VISTIO SALES']) {
  eq(`"${v}" routes to Vistio's Sales`, matchDepartment(v, GROUP)?.id, 'dB1')
}

eq('an unambiguous department still needs no qualifying',
  matchDepartment('Founders', GROUP)?.id, 'dA2')
eq('a company on its own still routes nowhere',
  matchDepartment('Vistio', GROUP), null)
ok('and points at the departments inside it',
  /Vistio is a company.*Vistio Sales/.test(routingHint('Vistio', GROUP)),
  routingHint('Vistio', GROUP))
eq('a company with no departments yet says so',
  matchDepartment('Empty Co', [{ id: 'x', name: 'Empty Co', kind: 'company', parentName: null }]), null)
ok('nonsense is still nonsense',
  /No department named/.test(routingHint('Marketing', GROUP)))

// The guard that matters most: qualifying must never reach across companies.
eq('"Cardtly Sales" is not Vistio\'s Sales',
  matchDepartment('Cardtly Sales', GROUP)?.id !== 'dB1', true)

// A flat team, no companies at all, must behave exactly as it always did.
const FLAT = [
  { id: 'f1', name: 'Sales', kind: 'department', parentName: null },
  { id: 'f2', name: 'Admin', kind: 'department', parentName: null },
]
eq('a flat team routes on the plain name', matchDepartment('Sales', FLAT)?.id, 'f1')
eq('and is unaffected by the qualified form', matchDepartment('Nothing Sales', FLAT), null)

rmSync(out, { recursive: true, force: true })

console.log(`\n${pass} passed, ${fail.length} failed`)
if (fail.length) {
  for (const f2 of fail) console.error('  FAIL  ' + f2)
  process.exitCode = 1
} else {
  console.log('import + directory helpers: all assertions hold.')
}
