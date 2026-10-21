// The reseller application form: its choices and the one check both the page
// and the server run. No imports, so scripts/check-reseller-apply can compile
// it alone.
//
// What Cardtly needs to decide on an application, and then to set the reseller
// up and invoice it without a second round of emails: who the business is
// (registered name, registration and VAT numbers, address, for the invoices),
// who to talk to, and what they plan to sell. Prices are not on the page; they
// are agreed once an application is approved.

export const BUSINESS_TYPES = [
  'Marketing or design agency',
  'Print shop or signage',
  'Promotional products or corporate gifting',
  'IT or tech services',
  'Business consultant',
  'Other',
] as const

export const CLIENT_RANGES = ['1 to 5', '6 to 20', '21 to 50', 'More than 50'] as const
export const SEAT_RANGES = ['Under 50', '50 to 200', '200 to 1 000', 'More than 1 000', 'Not sure yet'] as const
export const PRINTING_CHOICES = [
  'We will print the cards ourselves',
  'Cardtly should print them',
  'A mix of both',
  'Not sure yet',
] as const

export const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga',
  'North West', 'Northern Cape', 'Western Cape', 'Outside South Africa',
] as const

/** A person typing the form takes longer than this; a script posting it does not. */
export const MIN_FILL_MS = 4000

export interface ApplicationInput {
  trading_name?: unknown; registered_name?: unknown; registration_number?: unknown; vat_number?: unknown
  business_type?: unknown; website?: unknown
  address?: unknown; city?: unknown; province?: unknown; postal_code?: unknown
  contact_name?: unknown; contact_role?: unknown; email?: unknown; phone?: unknown
  expected_clients?: unknown; expected_seats?: unknown; printing?: unknown; pitch?: unknown; heard_about?: unknown
  consent?: unknown
}

export interface Application {
  trading_name: string; registered_name: string | null; registration_number: string | null; vat_number: string | null
  business_type: string; website: string | null
  address: string; city: string; province: string; postal_code: string
  contact_name: string; contact_role: string | null; email: string; phone: string
  expected_clients: string; expected_seats: string | null; printing: string; pitch: string; heard_about: string | null
}

const text = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const opt = (v: unknown, max: number) => text(v, max) || null
const oneOf = (v: unknown, list: readonly string[]) => (list as readonly string[]).includes(String(v)) ? String(v) : ''

/** Clean what was sent, or say which field is wrong, in words for the person filling it in. */
export function checkApplication(input: ApplicationInput): { ok: true; data: Application } | { ok: false; field: string; error: string } {
  const need = (field: string, value: string, what: string) => value ? null : { ok: false as const, field, error: `Please fill in ${what}.` }

  const data: Application = {
    trading_name: text(input.trading_name, 160),
    registered_name: opt(input.registered_name, 160),
    registration_number: opt(input.registration_number, 40),
    vat_number: opt(input.vat_number, 40),
    business_type: oneOf(input.business_type, BUSINESS_TYPES),
    website: opt(input.website, 200),
    address: text(input.address, 240),
    city: text(input.city, 80),
    province: oneOf(input.province, PROVINCES),
    postal_code: text(input.postal_code, 12),
    contact_name: text(input.contact_name, 120),
    contact_role: opt(input.contact_role, 80),
    email: text(input.email, 200).toLowerCase(),
    phone: text(input.phone, 40),
    expected_clients: oneOf(input.expected_clients, CLIENT_RANGES),
    expected_seats: oneOf(input.expected_seats, SEAT_RANGES) || null,
    printing: oneOf(input.printing, PRINTING_CHOICES),
    // The pitch keeps its line breaks: it is the one field written in paragraphs.
    pitch: String(input.pitch ?? '').trim().slice(0, 3000),
    heard_about: opt(input.heard_about, 200),
  }

  const missing =
    need('trading_name', data.trading_name, 'your business name') ||
    need('business_type', data.business_type, 'what kind of business you are') ||
    need('address', data.address, 'your business address') ||
    need('city', data.city, 'your city or town') ||
    need('province', data.province, 'your province') ||
    need('postal_code', data.postal_code, 'your postal code') ||
    need('contact_name', data.contact_name, 'your name') ||
    need('email', data.email, 'your email address') ||
    need('phone', data.phone, 'a phone number') ||
    need('expected_clients', data.expected_clients, 'how many clients you expect') ||
    need('printing', data.printing, 'who will print the NFC cards') ||
    need('pitch', data.pitch, 'a little about your clients and how you would sell Cardtly')
  if (missing) return missing

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(data.email)) return { ok: false, field: 'email', error: 'That email address does not look right.' }
  const digits = data.phone.replace(/\D/g, '')
  if (digits.length < 9 || digits.length > 15) return { ok: false, field: 'phone', error: 'That phone number does not look right.' }
  if (data.pitch.length < 20) return { ok: false, field: 'pitch', error: 'Tell us a little more about your clients and how you would sell Cardtly.' }
  if (input.consent !== true) return { ok: false, field: 'consent', error: 'Please tick the box to agree that we may use these details to review your application.' }

  return { ok: true, data }
}

/** One line for the reseller's billing address, the shape billing_clients keeps. */
export function addressLine(a: Pick<Application, 'address' | 'city' | 'province' | 'postal_code'>): string {
  return [a.address, a.city, a.province, a.postal_code].map(s => (s || '').trim()).filter(Boolean).join(', ')
}
