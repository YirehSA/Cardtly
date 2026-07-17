// The NFC order lifecycle, in one place.
//
// This list previously existed only inside AdminDashboard, while the API
// wrote whatever string it was handed. A typo in either would have diverged
// silently: the button would post a status the UI could not colour and the
// route would happily store it.
export const NFC_STATUSES = [
  'pending_payment',
  'paid',
  'in_production',
  'shipped',
  'delivered',
  'cancelled',
] as const

export type NfcStatus = (typeof NFC_STATUSES)[number]

export const NFC_STATUS_COLORS: Record<NfcStatus, string> = {
  pending_payment: '#f59e0b',
  paid: '#0ea5e9',
  in_production: '#a855f7',
  shipped: '#22c55e',
  delivered: '#10b981',
  cancelled: '#ef4444',
}

// Human labels. 'pending_payment' should not reach an operator as-is.
export const NFC_STATUS_LABELS: Record<NfcStatus, string> = {
  pending_payment: 'Awaiting payment',
  paid: 'Paid',
  in_production: 'In production',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export function isNfcStatus(s: unknown): s is NfcStatus {
  return typeof s === 'string' && (NFC_STATUSES as readonly string[]).includes(s)
}
