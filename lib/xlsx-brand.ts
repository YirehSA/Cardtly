// Shared palette for every Excel export Cardtly produces.
//
// It was defined inside ExportContactsButton. The analytics export needs the
// same colours, and two copies of a palette is how one export quietly ends up
// a different blue from the other after somebody adjusts one of them.
//
// ARGB: alpha byte first, as ExcelJS expects.
export const XLSX_BRAND = {
  bannerBg:   'FF075985', // deep sky-blue title bar
  subBg:      'FF0369A1', // sky-700 subtitle bar
  headerBg:   'FF0284C7', // sky-600 column headers
  headerLine: 'FF00D4FF', // brand cyan accent underline
  zebra:      'FFF0F9FF', // sky-50 stripe
  gridline:   'FFE5E7EB', // light gray cell borders
  text:       'FF111827', // near-black body text
  linkText:   'FF0369A1', // blue hyperlinks
  white:      'FFFFFFFF',
  subText:    'FFE0F2FE', // pale blue subtitle text
  positive:   'FF15803D', // green for an increase
  negative:   'FFB91C1C', // red for a decrease
} as const

/** en-ZA, spelled out, so a date in a filename or subtitle is unambiguous. */
export function exportStamp(d: Date): string {
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}
