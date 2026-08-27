// Turning a spreadsheet a company already has into team cards.
//
// Nothing is imported here on purpose, so this can be compiled and tested on
// its own the way lib/calendar.ts is. Every decision that decides whether
// somebody gets a card, or gets skipped, is made in this file rather than in
// the request handler, because that is the part worth testing exhaustively.
//
// The rule the whole design serves: an admin must see exactly what is about to
// happen before any of it happens. Firing 500 invitations off a mis-read
// spreadsheet is not recoverable - you cannot un-email someone.

export type ImportRow = {
  /** 1-based line in the source file, so an error can be pointed at. */
  line: number
  name: string
  email: string
  title: string
  phone: string
  company: string
  /**
   * Which department this person lands in, matched from the company column.
   * Null means no match: the card is still created, it just wears the company
   * look rather than a business unit's.
   */
  departmentId?: string | null
  departmentName?: string | null
}

/** A department a row can be routed into. */
export type ImportTarget = { id: string; name: string; kind?: 'company' | 'department' }

/**
 * Match a spreadsheet's business-unit column to a real department.
 *
 * Deliberately forgiving on punctuation and case, because the column is typed
 * by whoever exported the file: "Company A", "company a" and "COMPANY-A" are
 * all the same unit. Deliberately NOT fuzzy beyond that - guessing that
 * "Sales" means "Sales & Marketing" would route people into the wrong business
 * silently, and a card in the wrong company is worse than a card in none.
 */
export function matchDepartment(value: string, targets: ImportTarget[]): ImportTarget | null {
  const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const wanted = norm(value)
  if (!wanted) return null

  // Departments only. A card belongs to a department, never to the company
  // above it, so a column naming a company is reported as unrouted rather
  // than quietly parking somebody outside every team.
  const exact = targets.filter(t => t.kind !== 'company' && norm(t.name) === wanted)
  // Two departments with the same name in different companies is legal, and
  // there is no way to tell which was meant. Route neither.
  if (exact.length === 1) return exact[0]
  return null
}

/**
 * Why a row was not routed, in words the person reading it can act on.
 *
 * "Nowhere" on its own invites the admin to check their spelling when the real
 * answer is that they named a company and needed a department inside it.
 */
export function routingHint(value: string, targets: ImportTarget[]): string {
  const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const wanted = norm(value)
  if (!wanted) return 'No business unit in this row'

  const company = targets.find(t => t.kind === 'company' && norm(t.name) === wanted)
  if (company) return `${company.name} is a company. Name one of its departments instead.`

  const dupes = targets.filter(t => t.kind !== 'company' && norm(t.name) === wanted)
  if (dupes.length > 1) return `More than one department is called "${value}". Cannot tell which was meant.`

  return `No department named "${value}"`
}

export type RowStatus =
  | 'ready'
  | 'invalid_email'
  | 'missing_name'
  | 'missing_email'
  | 'duplicate_in_file'
  | 'already_in_team'
  | 'over_seat_limit'

export type CheckedRow = ImportRow & { status: RowStatus }

/** Which spreadsheet column feeds which card field. -1 means not found. */
export type ColumnMap = {
  name: number
  firstName: number
  lastName: number
  email: number
  title: number
  phone: number
  company: number
}

const ALIASES: Record<keyof ColumnMap, string[]> = {
  // Longest, most specific aliases first: "first name" must not be matched by
  // the "name" rule, or every HR export lands with surnames missing.
  firstName: ['first name', 'firstname', 'first_name', 'given name', 'forename'],
  lastName: ['last name', 'lastname', 'last_name', 'surname', 'family name'],
  name: ['full name', 'fullname', 'full_name', 'employee name', 'staff name', 'display name', 'name', 'employee'],
  email: ['email address', 'e-mail address', 'work email', 'email', 'e-mail', 'mail', 'email_address'],
  title: ['job title', 'jobtitle', 'job_title', 'position', 'designation', 'role', 'title'],
  phone: ['mobile number', 'cell phone', 'cellphone', 'contact number', 'phone number', 'mobile', 'phone', 'cell', 'telephone', 'tel', 'msisdn'],
  company: ['company name', 'company', 'business unit', 'organisation', 'organization', 'division', 'entity', 'branch'],
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Work out the delimiter from the first non-empty line.
 *
 * Tab comes first because pasting a block straight out of Excel is
 * tab-separated, and that is the path most people take rather than saving a
 * file. Semicolon matters because a spreadsheet saved on a machine with a
 * comma decimal separator, which is the default in much of Europe, writes
 * semicolons and would otherwise parse as one enormous column.
 */
export function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find(l => l.trim().length > 0) || ''
  const counts: Array<[string, number]> = [
    ['\t', (line.match(/\t/g) || []).length],
    [';', (line.match(/;/g) || []).length],
    [',', (line.match(/,/g) || []).length],
  ]
  counts.sort((a, b) => b[1] - a[1])
  return counts[0][1] > 0 ? counts[0][0] : ','
}

/**
 * Parse delimited text into a grid.
 *
 * Handles quoted fields, delimiters and newlines inside quotes, and the ""
 * escape. A naive split on the delimiter breaks on the first job title
 * containing a comma, which in practice is immediately.
 */
export function parseDelimited(text: string, delimiter?: string): string[][] {
  const d = delimiter || detectDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  // Strip a UTF-8 BOM, which Excel writes and which otherwise becomes part of
  // the first header name so it never matches an alias.
  const src = text.replace(/^﻿/, '')

  for (let i = 0; i < src.length; i++) {
    const c = src[i]

    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
      continue
    }

    if (c === '"') { inQuotes = true; continue }
    if (c === d) { row.push(field); field = ''; continue }
    if (c === '\r') continue
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue }
    field += c
  }
  row.push(field)
  rows.push(row)

  // Drop rows that are entirely empty, which trailing newlines always produce.
  return rows.filter(r => r.some(cell => cell.trim().length > 0))
}

/**
 * Rows back to CSV text, quoted so the parser above reads them unchanged.
 *
 * The .xlsx reader hands its cells here rather than to a separate code path,
 * so a spreadsheet upload goes through exactly the same column detection,
 * validation and department routing as a paste. A job title containing a
 * comma, a quote or a line break survives the round trip.
 */
export function rowsToCsv(rows: Array<Array<string | null | undefined>>): string {
  return rows
    .map(row => row
      .map(cell => {
        const v = cell == null ? '' : String(cell)
        return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
      })
      .join(','))
    .join('\n')
}

/** Match header names to card fields. */
export function detectColumns(header: string[]): ColumnMap {
  const cells = header.map(norm)
  const map: ColumnMap = { name: -1, firstName: -1, lastName: -1, email: -1, title: -1, phone: -1, company: -1 }

  for (const key of Object.keys(ALIASES) as Array<keyof ColumnMap>) {
    for (const alias of ALIASES[key]) {
      const exact = cells.indexOf(alias)
      if (exact !== -1 && !Object.values(map).includes(exact)) { map[key] = exact; break }
    }
  }
  return map
}

/** Does this look like a header row, or is the file straight into data? */
export function looksLikeHeader(row: string[]): boolean {
  const m = detectColumns(row)
  const found = [m.name, m.firstName, m.lastName, m.email].filter(i => i !== -1).length
  // A header is only credible if it names a person and a way to reach them.
  return found >= 2 || (m.email !== -1 && row.every(c => !c.includes('@')))
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Grid plus mapping into rows ready to be checked. */
export function toRows(grid: string[][], map: ColumnMap, hasHeader: boolean): ImportRow[] {
  const body = hasHeader ? grid.slice(1) : grid
  const offset = hasHeader ? 2 : 1
  const at = (r: string[], i: number) => (i >= 0 && i < r.length ? r[i].trim() : '')

  return body.map((r, idx) => {
    const joined = [at(r, map.firstName), at(r, map.lastName)].filter(Boolean).join(' ').trim()
    return {
      line: idx + offset,
      name: at(r, map.name) || joined,
      email: at(r, map.email).toLowerCase(),
      title: at(r, map.title),
      phone: at(r, map.phone),
      company: at(r, map.company),
    }
  })
}

/**
 * Decide what happens to every row, before anything happens to any of them.
 *
 * Order matters. A row is reported against the FIRST reason it cannot proceed,
 * and seat limit is checked last so that a row is never reported as "no seats"
 * when it was going to be skipped as a duplicate anyway - which would make the
 * admin buy seats they do not need.
 */
export function checkRows(
  rows: ImportRow[],
  existingEmails: string[],
  seatsAvailable: number,
  /**
   * Departments the company column can route into. Omitted for an
   * organisation with no structure, in which case nothing is routed and every
   * row behaves exactly as it did before departments could nest.
   */
  targets: ImportTarget[] = [],
): CheckedRow[] {
  const already = new Set(existingEmails.map(e => e.trim().toLowerCase()).filter(Boolean))
  const seenInFile = new Set<string>()
  let taken = 0

  return rows.map(r => {
    // Normalised here rather than trusting the caller. toRows already
    // lowercases, but relying on that made duplicate detection silently
    // case-sensitive for any row built another way, and the failure mode is
    // inviting the same person twice.
    const email = r.email.trim().toLowerCase()
    let status: RowStatus = 'ready'

    if (!r.name) status = 'missing_name'
    else if (!email) status = 'missing_email'
    else if (!EMAIL_RE.test(email)) status = 'invalid_email'
    else if (already.has(email)) status = 'already_in_team'
    else if (seenInFile.has(email)) status = 'duplicate_in_file'

    if (status === 'ready') {
      if (taken >= seatsAvailable) status = 'over_seat_limit'
      else taken++
    }
    if (email) seenInFile.add(email)

    // Routing is worked out for every row, including skipped ones, so the
    // preview can show where a person WOULD have gone. An admin fixing a
    // duplicate wants to see it was headed to the right place.
    const target = targets.length ? matchDepartment(r.company, targets) : null

    return {
      ...r,
      email,
      status,
      departmentId: target?.id ?? null,
      departmentName: target?.name ?? null,
    }
  })
}

export const STATUS_LABEL: Record<RowStatus, string> = {
  ready: 'Will be added',
  invalid_email: 'Email is not valid',
  missing_name: 'No name',
  missing_email: 'No email address',
  duplicate_in_file: 'Listed twice in this file',
  already_in_team: 'Already on the team',
  over_seat_limit: 'No seat available',
}

/** One line summarising what the admin is about to do. */
export function summarise(rows: CheckedRow[]): { ready: number; skipped: number; byStatus: Record<string, number> } {
  const byStatus: Record<string, number> = {}
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1
  const ready = byStatus.ready || 0
  return { ready, skipped: rows.length - ready, byStatus }
}
