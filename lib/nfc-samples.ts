import { existsSync } from 'fs'
import { join } from 'path'
import type { CardSample } from '@/components/marketing/CardSamples'

// The real NFC cards we have printed, shown on the public /nfc page and in the
// dashboard's NFC section.
//
// Shared from here rather than declared on each page: two copies of this list
// drift the moment a card is added to one and not the other, and the dashboard
// existing at all is the point where that became likely.
//
// Server-only - it touches the filesystem, so it must not be imported by a
// client component. CardSamples takes its list as a prop precisely so this stays
// on the server side of that line. The CardSample type comes from the component
// as a type-only import, which is erased at build time and pulls no runtime code.
export const CARD_SAMPLES: CardSample[] = [
  { name: 'André Nel',       role: 'Yireh Business Solutions',
    front: '/nfc-samples/yireh-front.jpg',   back: '/nfc-samples/yireh-back.jpg' },
  { name: 'Tio Geldenhuys',  role: 'Cardtly',
    front: '/nfc-samples/cardtly-front.jpg', back: '/nfc-samples/cardtly-back.jpg' },
  { name: 'Dwain Atterbury', role: 'Sicon Group',
    front: '/nfc-samples/sicon-front.jpg',   back: '/nfc-samples/sicon-back.jpg' },
]

// Only the samples whose images are actually on disk. A card listed here with a
// missing file would otherwise render as a broken image on a page whose whole
// job is to show that the printing looks good.
export function availableSamples(): CardSample[] {
  return CARD_SAMPLES.filter(s =>
    [s.front, s.back].every(src => existsSync(join(process.cwd(), 'public', src)))
  )
}
