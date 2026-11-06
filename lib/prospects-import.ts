import {
  companyKey, furtherAlong, isProspectStatus, statusFromSheet,
  type Prospect, type ProspectPriority, type ProspectStatus,
} from './prospects'
import type { CellValue, ReadSheet } from './xlsx-read'

// Turning a rep's spreadsheet into prospects.
//
// Every list so far came from a different template, and the next one will too,
// so columns are recognised by what their headers say rather than by position.
// HEADERS holds every heading in the four original workbooks plus the ones our
// own Excel export writes, which is what makes that export safe to edit offline
// and bring back.
//
// IMPORTING NEVER LOSES WORK. A contact already on the list (same email address)
// only gains: blanks are filled, notes are added to, and the status can move
// forward but never back. Do not contact can never be undone by a list.
//
// Pure and free of aliases: scripts/check-prospects compiles and runs it.

type FieldKey =
  | 'company' | 'contact_name' | 'first_name' | 'last_name' | 'role'
  | 'email' | 'alt_email' | 'email_type' | 'phone' | 'phone_type'
  | 'sector' | 'region' | 'priority' | 'record_type' | 'lists'
  | 'fit' | 'research_notes' | 'evidence'
  | 'source_url' | 'source_url_2' | 'source_confidence'
  | 'status' | 'call_status' | 'sent' | 'date_sent' | 'last_contact' | 'next_follow_up' | 'follow_up_note'
  | 'notes' | 'rep_notes' | 'plain_notes'

const squash = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

const HEADERS: Record<string, FieldKey> = {
  company: 'company', companyname: 'company', business: 'company', businessname: 'company', organisation: 'company', organization: 'company',
  contactname: 'contact_name', contactperson: 'contact_name', contact: 'contact_name', fullname: 'contact_name', name: 'contact_name',
  firstname: 'first_name', lastname: 'last_name', surname: 'last_name',
  role: 'role', roletitle: 'role', position: 'role', title: 'role', jobtitle: 'role',
  email: 'email', emailaddress: 'email', directemail: 'email', businessemail: 'email', mail: 'email',
  publicdirectemail: 'alt_email', emailtype: 'email_type',
  telephone: 'phone', phone: 'phone', tel: 'phone', mobile: 'phone', cell: 'phone', cellphone: 'phone', contactnumber: 'phone', phonenumber: 'phone',
  numbertype: 'phone_type', phonetype: 'phone_type',
  sector: 'sector', industry: 'sector',
  region: 'region', area: 'region', city: 'region', province: 'region', location: 'region',
  priority: 'priority', recordtype: 'record_type', lists: 'lists', list: 'lists',
  whycardtlyfits: 'fit', whyacardtlyfit: 'fit', whyfit: 'fit', valueangle: 'fit',
  researchnotes: 'research_notes', evidencedetail: 'evidence', directemailevidence: 'evidence',
  publicsourceurl: 'source_url', contactsourcelink: 'source_url', contactsourceurl: 'source_url', sourceurl: 'source_url', source: 'source_url', website: 'source_url',
  secondarysourcelink: 'source_url_2', businessemailsourceurl: 'source_url_2', secondsourceurl: 'source_url_2',
  sourceconfidence: 'source_confidence', researchconfidence: 'source_confidence',
  status: 'status', replystatus: 'status', callstatus: 'call_status',
  sent: 'sent', datesent: 'date_sent', lastcontact: 'last_contact', lastcontacted: 'last_contact',
  nextfollowup: 'next_follow_up', followup: 'next_follow_up', followupdate: 'next_follow_up', followupon: 'next_follow_up',
  followupnote: 'follow_up_note',
  feedbacknotes: 'notes', commentsfeedback: 'notes', comments: 'notes', feedback: 'notes',
  callnotes: 'rep_notes', followupnotes: 'rep_notes', repnotes: 'rep_notes',
  notes: 'plain_notes',
}

/** Sheets that repeat or summarise the real list. Offered, but not ticked. */
const NOT_A_LIST = /mail\s*merge|overview|dashboard|script|playbook|summary|left out|named contacts first/i

export interface Incoming {
  company: string
  contact_name: string | null
  first_name: string | null
  role: string | null
  email: string | null
  email_type: string | null
  phone: string | null
  phone_type: string | null
  sector: string | null
  region: string | null
  priority: ProspectPriority
  is_alternate: boolean
  lists: string[]
  fit: string | null
  research_notes: string | null
  source_url: string | null
  source_url_2: string | null
  source_confidence: string | null
  status: ProspectStatus
  last_channel: 'email' | 'call' | null
  emailed_on: string | null
  last_contact_on: string | null
  follow_up_on: string | null
  follow_up_note: string | null
  notes: string | null
}

export interface ParsedSheet {
  name: string
  /** Ticked by default in the preview. */
  isList: boolean
  rows: Incoming[]
  /** Rows dropped because there is no company, or nothing to reach them on. */
  skipped: number
  columns: string[]
}

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s)

const clean = (v: CellValue | undefined, max = 500): string | null => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s ? clip(s, max) : null
}

const iso = (y: number, m: number, d: number): string | null => {
  const t = new Date(Date.UTC(y, m - 1, d))
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null
  return t.toISOString().slice(0, 10)
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }

const daysApart = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000

/**
 * A date out of a cell. Excel stores real dates as a number of days since 1899,
 * and people type the rest: 29/10/2026, 2 Nov 2026 - Meeting booked, 2026-11-05.
 *
 * Written day first, because this is South Africa. Except when that lands months
 * away from today and reading it month first lands close: "Meeting Booked
 * 11/03/2026 & 11:30", written in a sheet full of November dates, is 3 November.
 */
export function parseDateCell(v: CellValue | undefined, today: string): string | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') {
    if (v < 20000 || v > 90000) return null
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10)
  }
  const s = String(v).trim()
  if (/^\d{5}(\.\d+)?$/.test(s)) return parseDateCell(Number(s), today)

  const isoMatch = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) return iso(+isoMatch[1], +isoMatch[2], +isoMatch[3])

  const slash = s.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/)
  if (slash) {
    const dayFirst = iso(+slash[3], +slash[2], +slash[1])
    const monthFirst = iso(+slash[3], +slash[1], +slash[2])
    if (dayFirst && monthFirst && daysApart(dayFirst, today) > 60 && daysApart(monthFirst, today) <= 60) return monthFirst
    return dayFirst || monthFirst
  }

  const words = s.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/)
  if (words) {
    const m = MONTHS[words[2].slice(0, 3).toLowerCase()]
    if (m) return iso(+words[3], m, +words[1])
  }
  return null
}

function priorityFrom(v: string | null): ProspectPriority {
  const k = squash(v)
  if (k === 'a' || k === 'high') return 'high'
  if (k === 'c' || k === 'low') return 'low'
  if (k === 'review') return 'review'
  if (k === 'backup') return 'backup'
  return 'medium'
}

/** Words that mean "a department", not a person to greet by name. */
const NOT_A_PERSON = /\b(team|contact|sales|office|department|desk|accounts|reception|enquiries|admin|support)\b/i

const emailFrom = (v: CellValue | undefined): string | null => {
  const s = clean(v, 320)?.replace(/^mailto:/i, '').toLowerCase() ?? null
  return s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null
}

function joinNotes(...parts: (string | null | undefined)[]): string | null {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    const t = p?.trim()
    if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); out.push(t) }
  }
  return out.length ? clip(out.join('\n'), 8000) : null
}

/** The row holding the headings: the one in the first ten that names the most
 *  known columns, and at least a company and a way to reach them. */
function findHeader(rows: CellValue[][]): { at: number; map: Map<number, FieldKey> } | null {
  let best: { at: number; map: Map<number, FieldKey> } | null = null
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const map = new Map<number, FieldKey>()
    const used = new Set<FieldKey>()
    ;(rows[i] || []).forEach((cell, col) => {
      const key = typeof cell === 'string' ? HEADERS[squash(cell)] : undefined
      // The first column with a given meaning wins, so a second "Email" further
      // along cannot overwrite the real one.
      if (key && !used.has(key)) { map.set(col, key); used.add(key) }
    })
    const usable = used.has('company') && (used.has('email') || used.has('phone'))
    if (usable && (!best || map.size > best.map.size)) best = { at: i, map }
  }
  return best
}

export function parseSheet(sheet: ReadSheet, today: string): ParsedSheet | null {
  const header = findHeader(sheet.rows)
  if (!header) return null
  const hasFeedback = [...header.map.values()].some(k => k === 'notes' || k === 'rep_notes')
  const rows: Incoming[] = []
  let skipped = 0

  for (let i = header.at + 1; i < sheet.rows.length; i++) {
    const cells = sheet.rows[i] || []
    const get = new Map<FieldKey, CellValue>()
    header.map.forEach((key, col) => { if (cells[col] !== null && cells[col] !== undefined) get.set(key, cells[col]) })
    if (get.size === 0) continue

    const company = clean(get.get('company'), 200)
    const email = emailFrom(get.get('email')) || emailFrom(get.get('alt_email'))
    const phone = clean(get.get('phone'), 40)
    if (!company || (!email && !phone)) { skipped++; continue }

    const alt = emailFrom(get.get('alt_email'))
    const firstRaw = clean(get.get('first_name'), 80)
    const lastRaw = clean(get.get('last_name'), 80)
    const contact = clean(get.get('contact_name'), 160) || [firstRaw, lastRaw].filter(Boolean).join(' ') || null
    const first = firstRaw || (contact && !NOT_A_PERSON.test(contact) ? contact.split(/\s+/)[0] : null)

    const feedback = clean(get.get('notes'), 8000)
    // In the tracker "Notes" is the researcher's and "Comments / Feedback" is
    // the rep's. On a sheet with only one notes column, it is the rep's.
    const plain = clean(get.get('plain_notes'), 4000)
    const notes = joinNotes(feedback, clean(get.get('rep_notes'), 8000), hasFeedback ? null : plain)
    const research = joinNotes(
      clean(get.get('research_notes'), 4000),
      clean(get.get('evidence'), 1000),
      hasFeedback ? plain : null,
      alt && alt !== email ? `Direct address also published: ${alt}` : null,
    )

    const statusCell = get.get('status')
    const callCell = get.get('call_status')
    const word = statusFromSheet(statusCell) || statusFromSheet(callCell)
    const sentYes = squash(get.get('sent')) === 'yes'
    const dateSent = parseDateCell(get.get('date_sent'), today)
    let status: ProspectStatus = word && isProspectStatus(word) ? word : 'not_contacted'
    if (status === 'not_contacted' && (sentYes || dateSent)) status = 'email_sent'
    // A comment in the tracker's feedback column is somebody writing back, even
    // if nobody remembered to change the dropdown. Only that column: "Called, no
    // answer, sent email" in Call Notes is the rep's own diary, not a reply.
    if (status === 'email_sent' && feedback) status = 'replied'

    let lastContact = parseDateCell(get.get('last_contact'), today)
    if (!lastContact && dateSent) lastContact = dateSent

    const followRaw = get.get('next_follow_up')
    const followOn = parseDateCell(followRaw, today)
    const followText = typeof followRaw === 'string' && followRaw.trim() && !/^[\d/.\-\s]+$/.test(followRaw) ? followRaw.trim() : null

    const recordType = clean(get.get('record_type'), 80)
    const priority = priorityFrom(clean(get.get('priority'), 20))
    const url1 = clean(get.get('source_url'), 800)
    const url2 = clean(get.get('source_url_2'), 800)
    const listCell = clean(get.get('lists'), 400)

    rows.push({
      company,
      contact_name: contact,
      first_name: first,
      role: clean(get.get('role'), 160),
      email,
      email_type: clean(get.get('email_type'), 120),
      phone,
      phone_type: clean(get.get('phone_type'), 80),
      sector: clean(get.get('sector'), 120),
      region: clean(get.get('region'), 120),
      priority,
      is_alternate: /alternate/i.test(recordType || '') || priority === 'backup',
      lists: listCell ? listCell.split(/\s*,\s*/).filter(Boolean) : [],
      fit: clean(get.get('fit'), 2000),
      research_notes: research,
      source_url: url1 || url2,
      source_url_2: url1 && url2 && url1 !== url2 ? url2 : null,
      source_confidence: clean(get.get('source_confidence'), 120),
      status,
      last_channel: status === 'called_no_answer' || (callCell !== undefined && status !== 'email_sent') ? 'call' : (dateSent || status === 'email_sent' || status === 'replied' ? 'email' : null),
      // The call sheet says "Email sent" and only dates the last contact.
      emailed_on: dateSent || (status === 'email_sent' ? lastContact : null),
      last_contact_on: lastContact,
      follow_up_on: followOn,
      follow_up_note: joinNotes(followText, clean(get.get('follow_up_note'), 300)),
      notes,
    })
  }

  return {
    name: sheet.name,
    isList: !NOT_A_LIST.test(sheet.name) && !sheet.hidden,
    rows,
    skipped,
    columns: [...new Set(header.map.values())],
  }
}

export function parseWorkbook(sheets: ReadSheet[], today: string): ParsedSheet[] {
  return sheets.map(s => parseSheet(s, today)).filter((s): s is ParsedSheet => !!s && s.rows.length + s.skipped > 0)
}

/** What makes two rows the same contact. */
export const contactKey = (p: { email: string | null; company: string; phone: string | null }): string =>
  p.email ? `e:${p.email.toLowerCase()}` : `p:${companyKey(p.company)}:${String(p.phone || '').replace(/\D/g, '')}`

const PRIORITY_ORDER: ProspectPriority[] = ['high', 'medium', 'low', 'review', 'backup']

const betterPriority = (a: ProspectPriority, b: ProspectPriority): ProspectPriority =>
  PRIORITY_ORDER.indexOf(b) < PRIORITY_ORDER.indexOf(a) ? b : a

const earliest = (a: string | null, b: string | null) => (a && b ? (a < b ? a : b) : a || b)
const latest = (a: string | null, b: string | null) => (a && b ? (a > b ? a : b) : a || b)

const TEXT_FIELDS = [
  'contact_name', 'first_name', 'role', 'email_type', 'phone', 'phone_type', 'sector', 'region',
  'fit', 'source_url', 'source_url_2', 'source_confidence',
] as const

/**
 * Folds a second sighting of a contact into the first, from another sheet or
 * another list. Blanks are filled and notes kept. This is one person.
 */
export function combine(a: Incoming, b: Incoming): Incoming {
  const out: Incoming = { ...a }
  for (const f of TEXT_FIELDS) if (!out[f] && b[f]) out[f] = b[f]
  out.priority = betterPriority(a.priority, b.priority)
  // Primary on any list means primary. A backup row only stands if every list
  // that mentions this person calls them one.
  out.is_alternate = a.is_alternate && b.is_alternate
  out.lists = [...new Set([...a.lists, ...b.lists])]
  out.status = furtherAlong(a.status, b.status)
  out.last_channel = a.status === out.status ? a.last_channel || b.last_channel : b.last_channel || a.last_channel
  out.emailed_on = earliest(a.emailed_on, b.emailed_on)
  out.last_contact_on = latest(a.last_contact_on, b.last_contact_on)
  out.follow_up_on = a.follow_up_on || b.follow_up_on
  out.follow_up_note = joinNotes(a.follow_up_note, b.follow_up_note)
  out.research_notes = joinNotes(a.research_notes, b.research_notes)
  out.notes = joinNotes(a.notes, b.notes)
  return out
}

/** One row per contact across everything being imported. */
export function collapse(rows: Incoming[]): Incoming[] {
  const byKey = new Map<string, Incoming>()
  for (const r of rows) {
    const key = contactKey(r)
    const had = byKey.get(key)
    byKey.set(key, had ? combine(had, r) : r)
  }
  return [...byKey.values()]
}

/**
 * What an import would change on a contact already on the list. Empty means
 * nothing would.
 */
export function patchFor(existing: Prospect, inc: Incoming): Partial<Prospect> {
  const merged = combine(toIncoming(existing), inc)
  const patch: Partial<Prospect> = {}
  const keys = [...TEXT_FIELDS, 'priority', 'is_alternate', 'status', 'last_channel', 'emailed_on', 'last_contact_on', 'follow_up_on', 'follow_up_note', 'research_notes', 'notes'] as const
  for (const k of keys) {
    if ((merged[k] ?? null) !== (existing[k] ?? null)) (patch as any)[k] = merged[k]
  }
  if (merged.lists.length !== existing.lists.length) patch.lists = merged.lists
  return patch
}

function toIncoming(p: Prospect): Incoming {
  return {
    company: p.company, contact_name: p.contact_name, first_name: p.first_name, role: p.role,
    email: p.email, email_type: p.email_type, phone: p.phone, phone_type: p.phone_type,
    sector: p.sector, region: p.region, priority: p.priority, is_alternate: p.is_alternate,
    lists: p.lists || [], fit: p.fit, research_notes: p.research_notes, source_url: p.source_url,
    source_url_2: p.source_url_2, source_confidence: p.source_confidence, status: p.status,
    last_channel: p.last_channel, emailed_on: p.emailed_on, last_contact_on: p.last_contact_on,
    follow_up_on: p.follow_up_on, follow_up_note: p.follow_up_note, notes: p.notes,
  }
}

export interface ImportPlan {
  create: Incoming[]
  update: { id: string; patch: Partial<Prospect> }[]
  /** Already here and nothing new to add. */
  unchanged: number
  /** Already being worked by another rep, so left alone. */
  otherRep: number
}

/**
 * Sorts what came in against what is here. A contact with another rep stays with
 * them, because two reps phoning one director is the failure this list exists to
 * prevent. The same address never goes in twice.
 */
export function planImport(rows: Incoming[], existing: Prospect[], repId: string | null): ImportPlan {
  const byKey = new Map(existing.map(p => [contactKey(p), p]))
  const plan: ImportPlan = { create: [], update: [], unchanged: 0, otherRep: 0 }
  for (const inc of collapse(rows)) {
    const here = byKey.get(contactKey(inc))
    if (!here) { plan.create.push(inc); continue }
    if (here.rep_id && repId && here.rep_id !== repId) { plan.otherRep++; continue }
    const patch = patchFor(here, inc)
    if (!here.rep_id && repId) patch.rep_id = repId
    if (Object.keys(patch).length) plan.update.push({ id: here.id, patch })
    else plan.unchanged++
  }
  return plan
}

/** "Cardtly_100_Reseller_Emails_Sent_Feedback_Tracker.xlsx" as a list name. */
export function listNameFromFile(filename: string): string {
  const base = filename.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/^\s*cardtly\s+/i, '').trim()
  return clip(base || 'Imported list', 80)
}
