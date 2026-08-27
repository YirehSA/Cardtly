import CardSamples, { type CardSample } from '@/components/marketing/CardSamples'
import { Sparkles } from 'lucide-react'

// "Here is what we can print" for the dashboard's NFC section.
//
// Wraps the same CardSamples component the public /nfc page uses, in the
// dashboard's own header-block shape, so someone deciding whether to order can
// see real printed cards without leaving to the marketing site and losing their
// place. One component, one list (lib/nfc-samples.ts) - the alternative was a
// second copy that stops matching the moment a card is added to one of them.
export default function NFCSamplesSection({ samples }: { samples: CardSample[] }) {
  if (!samples.length) return null

  return (
    <div className="rounded-3xl border border-border overflow-hidden mb-5">
      <div
        className="p-6 sm:p-8"
        style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.14), transparent 65%)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl grid place-items-center text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}
          >
            <Sparkles className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold leading-tight">
              Cards we&rsquo;ve actually printed
            </h2>
            <p className="text-muted-foreground text-sm">
              Real Cardtly NFC cards, not mock-ups. Tap one to see the back.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8 pt-0">
        <CardSamples samples={samples} />
        {/* Wording follows /nfc and llms.txt exactly. An earlier draft said we
            design it "with you before anything goes to print", which implied a
            proofing step nothing on the site actually promises. */}
        <p className="mt-8 text-sm text-muted-foreground leading-relaxed">
          Standard puts your logo and colours onto our layout. Custom is designed
          around your brand instead. Artwork and proofing are included in both,
          with no separate design fee.
        </p>
      </div>
    </div>
  )
}
