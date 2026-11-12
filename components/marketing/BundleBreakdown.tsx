import { Check } from 'lucide-react'
import { formatZAR } from '@/lib/nfc-pricing'
import { BUNDLE_PRICE_RAND, bundleParts, bundleSeparateRand } from '@/lib/pro-bundle'

// What the R999 starter package covers, line by line: each part with its
// usual price struck through and "Included" beside it, then the total. Built
// because "a year of Pro and your NFC card" alone left people unsure whether
// the card and its delivery were extra. Figures from lib/pro-bundle.

const INK = 'rgba(255,255,255,0.92)'
const DIM = 'rgba(255,255,255,0.6)'
const MINT = '#34d399'

export default function BundleBreakdown({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      <ul className="space-y-2.5">
        {bundleParts().map(p => (
          <li key={p.key} className="flex items-start gap-3 text-sm">
            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: MINT }} aria-hidden="true" />
            <span className="flex-1" style={{ color: INK }}>{p.label}</span>
            <span className="flex-shrink-0 text-right whitespace-nowrap">
              <span className="line-through text-xs mr-2" style={{ color: DIM }}>
                {p.from ? 'from ' : ''}R{p.rand}
              </span>
              <span className="text-xs font-bold" style={{ color: MINT }}>Included</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 pt-3 flex items-center justify-between gap-3 text-sm"
        style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
        <span style={{ color: DIM }}>
          Bought separately <span className="line-through">{formatZAR(bundleSeparateRand('standard'))}</span>
        </span>
        <span className="font-bold text-white whitespace-nowrap">You pay R{BUNDLE_PRICE_RAND}</span>
      </div>
    </div>
  )
}
