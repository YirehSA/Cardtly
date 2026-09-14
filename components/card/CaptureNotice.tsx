import Link from 'next/link'

// The line that has to appear wherever a visitor is asked for their details.
//
// WHY IT EXISTS. POPIA section 18 says that when you collect personal
// information directly from someone, you tell them who is collecting it, why,
// and whether giving it is voluntary. Both capture forms on a public card
// asked for a name, an email and a phone number and said none of those things.
//
// WHO THE OBLIGATION BELONGS TO. Not Cardtly. The card owner is the
// responsible party for a lead captured on their card, and Cardtly is their
// operator. So the notice names the OWNER: "Sipho Dlamini at Horizon Build
// receives these details", because Sipho is who the visitor is handing them to
// and who they would go back to. The link to Cardtly's privacy policy is
// secondary and explains the platform's part.
//
// ONE COMPONENT, TWO FORMS. The inline form on the card and the exchange modal
// ask for the same data and were written separately. A notice copied into both
// would eventually say two different things, which is the failure mode the
// billing code documents elsewhere in this repo.
//
// Deliberately short. This is read by somebody standing up at an expo with a
// coffee in one hand, and a paragraph of legal text there is worse than no
// text at all: it does not get read, and it makes the form look like a trap.
//
// THE COLOUR IS ONE VALUE, MUTED BY OPACITY, AND THAT IS DELIBERATE. The
// obvious implementation passes the theme's `subtext` for the sentence and
// `text` for the link. Measured across all sixteen card palettes with the
// translucent layers composited, `subtext` on the form's ground fails AA on
// six of them: neon 3.26, executive 3.67, modern and split 4.04, the shared
// light palette 4.34, editorial 4.4. The accent is worse again, because every
// owner picks their own and a pale one is unreadable.
//
// `text` passes everywhere, 9.45 at worst, so the sentence takes `text` at 70%
// and the link takes it whole. 70% was chosen by measurement rather than by
// eye: the worst palette at that opacity is modern at 5.58, still clear of
// 4.5. The opacity sits on a span around the sentence rather than on the
// paragraph, because a paragraph-level opacity would drag the link down with
// it and the link is the part that has to stay obviously a link.

export default function CaptureNotice({
  owner,
  company,
  colour,
}: {
  /** The card owner's name. They are the responsible party, so they are named. */
  owner: string
  /** Their company, when the card has one. "Sipho Dlamini at Horizon Build". */
  company?: string | null
  /** The theme's strong text colour. Muted here, never passed in pre-muted. */
  colour: string
}) {
  const who = company ? `${owner} at ${company}` : owner

  return (
    <p className="text-[11px] leading-relaxed" style={{ color: colour }}>
      <span style={{ opacity: 0.7 }}>
        {who} receives these details so they can contact you. Sharing them is
        optional, and you can ask them to delete your details at any time.{' '}
      </span>
      <Link
        href="/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:opacity-80 transition"
        style={{ color: colour }}
      >
        How Cardtly handles your information
      </Link>
    </p>
  )
}
