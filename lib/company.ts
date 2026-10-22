// Cardtly's own company details, as the invoices print them from
// billing_settings. The trust page and the PAIA manual read them from here.
// The privacy policy and the terms still spell them out in their own text, and
// scripts/check-privacy-disclosures fails the build if those copies stop
// matching this one, so change billing_settings, this file and those two pages
// together.
export const COMPANY = {
  name: 'Cardtly (Pty) Ltd',
  regNumber: '2025/727173/07',
  address: '119 Pretoria Road, Benoni, Gauteng, South Africa',
  phone: '062 460 7440',
  website: 'www.cardtly.com',
  // POPIA s55 and PAIA s51: the Information Officer is, by default, the head of
  // the private body. No deputy has been appointed.
  informationOfficer: 'Andre Nel',
  email: 'andre@cardtly.com',
} as const
