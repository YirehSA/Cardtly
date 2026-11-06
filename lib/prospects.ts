// Reseller prospecting: companies a rep is working towards becoming resellers.
//
// WHY THIS EXISTS. Anthony ran this in four Excel workbooks and then typed the
// same calls and emails into his Activity log. Each workbook had its own columns
// and its own status list ("Reply Status", "Call Status", "Status"), and the same
// company could sit in three of them with a different state in each. This is
// those workbooks as one list, in the same words, where marking a prospect also
// writes the log entry, so nothing is entered twice.
//
// ONE VOCABULARY. The four dropdowns below collapse into PROSPECT_STATUSES, and
// STATUS_WORDS keeps every word they used so old sheets still import.
//
// Browser-safe and free of aliases: the board reads it, and
// scripts/check-prospects compiles and runs it.

export const PROSPECT_STATUSES = [
  { id: 'not_contacted',    label: 'Not contacted',     bright: '#94a3b8', deep: '#475569' },
  { id: 'email_sent',       label: 'Email sent',        bright: '#3b82f6', deep: '#1d4ed8' },
  { id: 'called_no_answer', label: 'Called, no answer', bright: '#f59e0b', deep: '#b45309' },
  { id: 'replied',          label: 'Replied',           bright: '#22c55e', deep: '#15803d' },
  { id: 'interested',       label: 'Interested',        bright: '#10b981', deep: '#047857' },
  { id: 'follow_up',        label: 'Follow up',         bright: '#0ea5e9', deep: '#0369a1' },
  { id: 'meeting_booked',   label: 'Meeting booked',    bright: '#a855f7', deep: '#7e22ce' },
  { id: 'signed',           label: 'Signed reseller',   bright: '#34d399', deep: '#047857' },
  { id: 'not_interested',   label: 'Not interested',    bright: '#ef4444', deep: '#b91c1c' },
  { id: 'bounced',          label: 'Bounced',           bright: '#f97316', deep: '#c2410c' },
  { id: 'do_not_contact',   label: 'Do not contact',    bright: '#94a3b8', deep: '#334155' },
] as const

export type ProspectStatus = (typeof PROSPECT_STATUSES)[number]['id']

export const isProspectStatus = (v: unknown): v is ProspectStatus =>
  PROSPECT_STATUSES.some(s => s.id === v)

export const statusInfo = (id: string) =>
  PROSPECT_STATUSES.find(s => s.id === id) || PROSPECT_STATUSES[0]

export const PROSPECT_PRIORITIES = [
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
  { id: 'review', label: 'Review' },
  { id: 'backup', label: 'Backup' },
] as const

export type ProspectPriority = (typeof PROSPECT_PRIORITIES)[number]['id']

export const isProspectPriority = (v: unknown): v is ProspectPriority =>
  PROSPECT_PRIORITIES.some(p => p.id === v)

export const priorityLabel = (id: string) =>
  PROSPECT_PRIORITIES.find(p => p.id === id)?.label || 'Medium'

const squash = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

/** Every word the workbooks used, squashed, against the one status it means. */
const STATUS_WORDS: Record<string, ProspectStatus> = {
  notcontacted: 'not_contacted', notsent: 'not_contacted', prepared: 'not_contacted',
  sent: 'email_sent', emailsent: 'email_sent', awaiting: 'email_sent', noresponse: 'email_sent',
  callednoanswer: 'called_no_answer', noanswer: 'called_no_answer',
  replied: 'replied',
  interested: 'interested', spokeinterested: 'interested',
  followup: 'follow_up',
  meetingbooked: 'meeting_booked', meetingscheduled: 'meeting_booked',
  signed: 'signed', signedreseller: 'signed',
  notinterested: 'not_interested', nointerest: 'not_interested', notafit: 'not_interested', notsuitable: 'not_interested',
  bounced: 'bounced',
  donotcontact: 'do_not_contact', unsubscribe: 'do_not_contact', unsubscribed: 'do_not_contact',
}

export const statusFromSheet = (raw: unknown): ProspectStatus | null => STATUS_WORDS[squash(raw)] || null

/** How far along a prospect is. An import may move one forward and never back,
 *  because a list sent round last week must not undo this morning's call. */
const RANK: Record<ProspectStatus, number> = {
  not_contacted: 0, email_sent: 1, called_no_answer: 1, bounced: 2, replied: 3, follow_up: 3,
  interested: 4, not_interested: 5, meeting_booked: 5, signed: 6, do_not_contact: 9,
}

export const furtherAlong = (a: ProspectStatus, b: ProspectStatus): ProspectStatus => (RANK[b] > RANK[a] ? b : a)

export interface Prospect {
  id: string
  rep_id: string | null
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
  created_at: string
  updated_at: string
}

export type Channel = 'email' | 'call'

/**
 * The entry a status writes to the rep's Activity log, so it is not typed twice.
 *
 * Statuses that are about what the person SAID (interested, not interested, a
 * meeting) go wherever the conversation happened, which is why the channel
 * matters: a call outcome on the Call log, an email outcome on the Email log.
 * The figures the rep is measured on read those logs, so the words match theirs
 * (lib/rep-calls CALL_OUTCOMES, lib/rep-activities ACTIVITY_STATUSES).
 *
 * Null means nothing happened that a log would record: a date was set, or a
 * company was marked do not contact.
 */
export type LogEntry =
  | { table: 'activity'; status: 'email_sent' | 'replied' | 'bounced' | 'not_interested' | 'meeting_booked' }
  | { table: 'call'; outcome: 'no_answer' | 'answered' | 'callback' | 'not_interested' | 'meeting_booked' | 'signed' }

export function logEntryFor(status: ProspectStatus, channel: Channel): LogEntry | null {
  switch (status) {
    case 'email_sent': return { table: 'activity', status: 'email_sent' }
    case 'bounced': return { table: 'activity', status: 'bounced' }
    case 'replied': return { table: 'activity', status: 'replied' }
    case 'called_no_answer': return { table: 'call', outcome: 'no_answer' }
    case 'interested': return channel === 'call' ? { table: 'call', outcome: 'answered' } : { table: 'activity', status: 'replied' }
    case 'follow_up': return channel === 'call' ? { table: 'call', outcome: 'callback' } : null
    case 'meeting_booked': return channel === 'call' ? { table: 'call', outcome: 'meeting_booked' } : { table: 'activity', status: 'meeting_booked' }
    case 'not_interested': return channel === 'call' ? { table: 'call', outcome: 'not_interested' } : { table: 'activity', status: 'not_interested' }
    case 'signed': return channel === 'call' ? { table: 'call', outcome: 'signed' } : null
    default: return null
  }
}

/** Which channel a status belongs to when the rep did not say. */
export function channelFor(
  status: ProspectStatus,
  p: Pick<Prospect, 'last_channel' | 'emailed_on'>,
): Channel {
  if (status === 'email_sent' || status === 'replied' || status === 'bounced') return 'email'
  if (status === 'called_no_answer') return 'call'
  return p.last_channel || (p.emailed_on ? 'email' : 'call')
}

/** Mailboxes nobody in particular reads. His sheet's rule: a named greeting only
 *  goes to a person's own address, because "Hi Lindsay" at info@ reads as a
 *  mail merge that guessed. */
const SHARED_MAILBOX = /^(info|sales|admin|hello|contact|contactus|enquiries|enquiry|office|accounts|support|marketing|reception|mail|design|print|team|general|studio|quotes|orders)@/i

export function isSharedInbox(p: Pick<Prospect, 'email' | 'email_type'>): boolean {
  if (/shared/i.test(p.email_type || '')) return true
  return SHARED_MAILBOX.test(p.email || '')
}

const PERSONAL_DOMAIN = /@(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|icloud|me|mweb|telkomsa|vodamail|webmail|lantic|absamail)\.[a-z.]+$/i

/** A private mailbox rather than a company's, which is a person's home inbox and
 *  gets checked by hand before anything goes to it. */
export const isPersonalAddress = (email: string | null | undefined) => PERSONAL_DOMAIN.test(email || '')

export function greetingFor(p: Pick<Prospect, 'email' | 'email_type' | 'first_name'>): string {
  return p.first_name && !isSharedInbox(p) ? `Hi ${p.first_name},` : 'Hello,'
}

/** Companies written differently are still one company: "Blue Digital (Pty) Ltd"
 *  and "Blue Digital" must count as already contacted. */
export function companyKey(name: string | null | undefined): string {
  return String(name ?? '').toLowerCase()
    .replace(/\((pty|proprietary)\)|\bpty\b|\bltd\b|\blimited\b|\bcc\b|\binc\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

const CONTACTED: ReadonlySet<ProspectStatus> = new Set<ProspectStatus>([
  'email_sent', 'called_no_answer', 'replied', 'interested', 'follow_up', 'meeting_booked', 'signed', 'not_interested',
])

export const wasContacted = (s: ProspectStatus) => CONTACTED.has(s)

/** Never to be emailed, whatever list or tick box they are in. */
export const isBarred = (p: Pick<Prospect, 'status'>) => p.status === 'do_not_contact' || p.status === 'bounced'

/**
 * Someone else at this company has already been approached. His sheet's rule:
 * "Do not email an alternate AND the primary at the same company as separate
 * prospects". Returned per company, so the board can say so on the row too.
 */
export function contactedCompanies(rows: Pick<Prospect, 'company' | 'status' | 'id'>[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const r of rows) {
    if (wasContacted(r.status) || r.status === 'do_not_contact') {
      const key = companyKey(r.company)
      if (key && !out.has(key)) out.set(key, r.id)
    }
  }
  return out
}

export interface MergeResult {
  send: Prospect[]
  leftOut: { prospect: Prospect; reason: string }[]
}

/**
 * Who a mail merge goes to.
 *
 * With nothing ticked this is the safe list, following the rules on his own
 * overview sheets. Ticking rows is a rep deciding for themselves, so only the
 * hard bars hold: no email address, do not contact, and bounced. Everything left
 * out is reported with its reason, so it can be checked rather than vanish.
 */
export function mailMergeList(rows: Prospect[], all: Prospect[], explicit: boolean): MergeResult {
  const send: Prospect[] = []
  const leftOut: MergeResult['leftOut'] = []
  const taken = contactedCompanies(all)
  const seenCompany = new Set<string>()
  for (const p of rows) {
    const key = companyKey(p.company)
    let reason: string | null = null
    if (!p.email) reason = 'No email address'
    else if (p.status === 'do_not_contact') reason = 'Do not contact'
    else if (p.status === 'bounced') reason = 'Bounced'
    else if (!explicit) {
      if (wasContacted(p.status)) reason = `Already contacted: ${statusInfo(p.status).label}`
      else if (p.is_alternate) reason = 'Alternate contact: the primary at this company goes first'
      else if (taken.has(key) && taken.get(key) !== p.id) reason = 'Someone at this company was already contacted'
      else if (seenCompany.has(key)) reason = 'Someone at this company is already on this merge'
      else if (isPersonalAddress(p.email)) reason = 'Personal address: check by hand'
      else if (/recheck/i.test(p.source_confidence || '')) reason = 'Older source: check it is still current'
    }
    if (reason) { leftOut.push({ prospect: p, reason }); continue }
    seenCompany.add(key)
    send.push(p)
  }
  return { send, leftOut }
}

export const lastNameOf = (p: Pick<Prospect, 'contact_name' | 'first_name'>): string => {
  const full = (p.contact_name || '').trim()
  const first = (p.first_name || '').trim()
  if (first && full.toLowerCase().startsWith(first.toLowerCase())) return full.slice(first.length).trim()
  return ''
}

export interface ProspectSummary {
  total: number
  notContacted: number
  emailed: number
  called: number
  replied: number
  meetings: number
  signed: number
  notInterested: number
  bounced: number
  doNotContact: number
  followUpsDue: number
}

export const isoDay = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Follow-ups owed today or earlier, on anyone still in play. */
export const isDue = (p: Pick<Prospect, 'follow_up_on' | 'status'>, today: string) =>
  !!p.follow_up_on && p.follow_up_on <= today
  && p.status !== 'do_not_contact' && p.status !== 'not_interested' && p.status !== 'signed' && p.status !== 'bounced'

export function summarise(rows: Prospect[], today: string): ProspectSummary {
  const n = (...s: ProspectStatus[]) => rows.filter(r => s.includes(r.status)).length
  return {
    total: rows.length,
    notContacted: n('not_contacted'),
    // Everyone an email has gone to, whatever has happened since.
    emailed: rows.filter(r => !!r.emailed_on || r.status === 'email_sent').length,
    called: n('called_no_answer'),
    replied: n('replied', 'interested', 'follow_up'),
    meetings: n('meeting_booked'),
    signed: n('signed'),
    notInterested: n('not_interested'),
    bounced: n('bounced'),
    doNotContact: n('do_not_contact'),
    followUpsDue: rows.filter(r => isDue(r, today)).length,
  }
}

export const PLAYBOOK_DEFAULTS = {
  email_subject: 'Cardtly reseller partnership | [Company Name]',
  email_body: '[Greeting]\n\nI am developing the Cardtly reseller partner programme and would like to explore whether we can work together.\n\nKind regards,\n[Your name]\nCardtly | [Your phone]',
}

export interface Playbook {
  script: string
  email_subject: string
  email_body: string
}

/** Fills the placeholders his email template uses. */
export function fillTemplate(
  template: string,
  p: Pick<Prospect, 'company' | 'first_name' | 'email' | 'email_type'>,
  me: { name?: string | null; phone?: string | null },
): string {
  return template
    .replace(/\[Greeting\]/gi, greetingFor(p))
    .replace(/\[First name\]/gi, p.first_name || '')
    .replace(/\[Company( Name)?\]/gi, p.company || '')
    .replace(/\[Your name\]/gi, me.name || '')
    .replace(/\[Your phone\]/gi, me.phone || '')
}

export function mailtoFor(
  p: Pick<Prospect, 'company' | 'first_name' | 'email' | 'email_type'>,
  playbook: Pick<Playbook, 'email_subject' | 'email_body'>,
  me: { name?: string | null; phone?: string | null },
): string {
  const subject = encodeURIComponent(fillTemplate(playbook.email_subject, p, me))
  // CRLF: mail clients read a bare %0A as nothing at all in some versions of Outlook.
  const body = encodeURIComponent(fillTemplate(playbook.email_body, p, me).replace(/\r?\n/g, '\r\n'))
  return `mailto:${encodeURIComponent(p.email || '').replace(/%40/g, '@')}?subject=${subject}&body=${body}`
}
