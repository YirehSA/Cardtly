import { NextResponse } from 'next/server'
import { requireAdmin, adminDb, migrationMissing } from '@/lib/admin-api'

// Who Cardtly is on a document, and the terms it promises.
//
// One row, by construction (billing_settings_singleton). Everything here is
// snapshotted onto a document at issue, so editing it changes what FUTURE
// documents say and touches nothing already sent.

export const runtime = 'nodejs'

// An allow-list, not a spread of the body. A blanket update would let a
// malformed request write `id`, `updated_at`, or a column that does not exist,
// and on a singleton table writing `id` is how you end up with two of them.
const TEXT_FIELDS = [
  'legal_name', 'trading_name', 'reg_number', 'vat_number',
  'email', 'phone', 'address', 'website', 'logo_url',
  'bank_name', 'bank_account_name', 'bank_account_no',
  'bank_branch_code', 'bank_account_type', 'bank_swift',
] as const

const DUE_RULES = ['end_of_month', 'days', 'on_issue']

export async function GET() {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const db = adminDb()
  const { data, error } = await db.from('billing_settings').select('*').eq('id', true).maybeSingle()
  if (error) return migrationMissing()

  const { data: terms } = await db
    .from('billing_terms').select('*').order('version', { ascending: false })

  return NextResponse.json({ settings: data || null, terms: terms || [] })
}

export async function PATCH(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })
  }

  const patch: Record<string, any> = {}

  for (const f of TEXT_FIELDS) {
    if (!(f in body)) continue
    const raw = body[f]
    const v = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw).trim()
    // Empty means "we do not have one", which has to be null rather than an
    // empty string: the PDF prints a VAT line if the field is truthy, and ''
    // is falsy today but a stray space is not.
    patch[f] = v === '' ? null : v
  }

  // A legal name is the one field a document cannot be issued without.
  if ('legal_name' in patch && !patch.legal_name) {
    return NextResponse.json({ error: 'A legal name is required. It is what a document is issued under.' }, { status: 400 })
  }

  if ('vat_rate_bp' in body) {
    const n = Math.round(Number(body.vat_rate_bp))
    if (!Number.isFinite(n) || n < 0 || n > 10000) {
      return NextResponse.json({ error: 'VAT rate must be between 0% and 100%.' }, { status: 400 })
    }
    patch.vat_rate_bp = n
  }

  if ('payment_terms_days' in body) {
    const n = Math.round(Number(body.payment_terms_days))
    if (!Number.isFinite(n) || n < 0 || n > 365) {
      return NextResponse.json({ error: 'Payment terms must be between 0 and 365 days.' }, { status: 400 })
    }
    patch.payment_terms_days = n
  }

  if ('quote_valid_days' in body) {
    const n = Math.round(Number(body.quote_valid_days))
    if (!Number.isFinite(n) || n < 1 || n > 365) {
      return NextResponse.json({ error: 'Quote validity must be between 1 and 365 days.' }, { status: 400 })
    }
    patch.quote_valid_days = n
  }

  if ('invoice_due_rule' in body) {
    if (!DUE_RULES.includes(body.invoice_due_rule)) {
      return NextResponse.json({ error: 'Unknown due date rule.' }, { status: 400 })
    }
    patch.invoice_due_rule = body.invoice_due_rule
  }

  if ('auto_send_reminders' in body) patch.auto_send_reminders = !!body.auto_send_reminders

  if ('reminder_days' in body) {
    const days = String(body.reminder_days).split(',')
      .map((n: string) => Math.round(Number(n.trim())))
      .filter((n: number) => Number.isFinite(n) && n >= 0 && n <= 365)
      // Sorted and de-duplicated: two rungs on the same day would send two
      // emails, and an out-of-order ladder escalates backwards.
      .filter((n: number, i: number, a: number[]) => a.indexOf(n) === i)
      .sort((a: number, b: number) => a - b)
    if (!days.length || days.length > 5) {
      return NextResponse.json({
        error: 'Give between one and five reminder days, each from 0 to 365. A ladder with twenty rungs is not a policy.',
      }, { status: 400 })
    }
    patch.reminder_days = days
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })
  }

  patch.updated_at = new Date().toISOString()
  patch.updated_by = gate.user.id

  const db = adminDb()
  const { data, error } = await db
    .from('billing_settings').update(patch).eq('id', true).select('*').maybeSingle()

  if (error) {
    // 067 adds invoice_due_rule and quote_valid_days. Saving one on a database
    // that has not run it fails on the column, not on the value.
    if (/column .* does not exist/i.test(error.message || '')) return migrationMissing('This setting')
    return NextResponse.json({ error: error.message || 'Could not save' }, { status: 500 })
  }

  return NextResponse.json({ settings: data })
}
