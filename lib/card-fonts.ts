// THE FONTS A CARD CAN BE SET IN, actually loaded.
//
// WHAT WAS WRONG. types/design listed five choices - Inter, Georgia, DM Sans,
// Nunito, Fira Code - and the app loaded none of them. Only Plus Jakarta Sans
// and Instrument Sans were ever fetched, for Cardtly's own interface. So four
// of the five font choices silently fell back: "Clean", "Modern" and
// "Friendly" all rendered in the same system sans, and "Tech" in whatever
// generic monospace the device had. Three different options, one result.
// Confirmed on the live site by width-comparison before touching anything:
// Inter, DM Sans, Nunito and Fira Code all measured identical to the fallback.
// Georgia worked, and only because it is installed on the machine already.
//
// HOW THIS FIXES IT. Every family is declared through next/font/google, which
// self-hosts the files at build time and emits a CSS variable. The variables
// are attached to <html> in app/layout, so a card's font-family can be
// `var(--font-roboto)` and be certain the face exists.
//
// THE COST IS NOT WHAT IT LOOKS LIKE. Twenty families are DECLARED, but a
// browser only downloads a font file when something on the page is painted
// with it, so a card in Montserrat fetches Montserrat and nothing else. What
// this does cost is build time, once, which is the right place to pay it.
//
// WEIGHTS ARE EXPLICIT on every family. The templates ask for 800 and 900 in
// places; a family that only shipped 400 would have the browser synthesising a
// fake bold, which looks smeared next to a real one. Where a family genuinely
// has no heavy weight - Bebas Neue is one weight by design - that is stated
// here rather than discovered on somebody's card.
//
// EVERY CALL IS WRITTEN OUT IN FULL, with no shared options object and no
// spread. next/font reads these arguments at BUILD time by static analysis, so
// `{ ...common, weight: [...] }` fails the build with "Unexpected spread". The
// repetition is the price of the files being fetched at all.

import {
  Inter, DM_Sans, Nunito, Fira_Code,
  Roboto, Open_Sans, Montserrat, Lato, Poppins, Raleway, Oswald,
  Playfair_Display, Merriweather, Lora, Work_Sans, Rubik, Quicksand,
  Bebas_Neue, Josefin_Sans,
} from 'next/font/google'

// The four that were listed and never loaded.
const inter = Inter({ subsets: ['latin'], display: 'swap', weight: ['400', '600', '700', '900'], variable: '--font-inter' })
const dmSans = DM_Sans({ subsets: ['latin'], display: 'swap', weight: ['400', '700'], variable: '--font-dm-sans' })
const nunito = Nunito({ subsets: ['latin'], display: 'swap', weight: ['400', '600', '700', '900'], variable: '--font-nunito' })
const firaCode = Fira_Code({ subsets: ['latin'], display: 'swap', weight: ['400', '600', '700'], variable: '--font-fira-code' })

// The fifteen added, chosen by how widely they are actually used rather than
// by taste: these are the top of Google Fonts by usage, filtered to faces that
// suit a name and a job title. Display faces that cannot set a paragraph
// (Bebas Neue, Oswald) are paired with a body font in types/design rather than
// left to wreck a bio.
const roboto = Roboto({ subsets: ['latin'], display: 'swap', weight: ['400', '500', '700', '900'], variable: '--font-roboto' })
const openSans = Open_Sans({ subsets: ['latin'], display: 'swap', weight: ['400', '600', '700', '800'], variable: '--font-open-sans' })
const montserrat = Montserrat({ subsets: ['latin'], display: 'swap', weight: ['400', '600', '700', '900'], variable: '--font-montserrat' })
const lato = Lato({ subsets: ['latin'], display: 'swap', weight: ['400', '700', '900'], variable: '--font-lato' })
const poppins = Poppins({ subsets: ['latin'], display: 'swap', weight: ['400', '600', '700'], variable: '--font-poppins' })
const raleway = Raleway({ subsets: ['latin'], display: 'swap', weight: ['400', '600', '700', '900'], variable: '--font-raleway' })
const oswald = Oswald({ subsets: ['latin'], display: 'swap', weight: ['400', '600', '700'], variable: '--font-oswald' })
const playfair = Playfair_Display({ subsets: ['latin'], display: 'swap', weight: ['400', '700', '900'], variable: '--font-playfair' })
const merriweather = Merriweather({ subsets: ['latin'], display: 'swap', weight: ['400', '700', '900'], variable: '--font-merriweather' })
const lora = Lora({ subsets: ['latin'], display: 'swap', weight: ['400', '600', '700'], variable: '--font-lora' })
const workSans = Work_Sans({ subsets: ['latin'], display: 'swap', weight: ['400', '600', '700', '900'], variable: '--font-work-sans' })
const rubik = Rubik({ subsets: ['latin'], display: 'swap', weight: ['400', '600', '700', '900'], variable: '--font-rubik' })
const quicksand = Quicksand({ subsets: ['latin'], display: 'swap', weight: ['400', '600', '700'], variable: '--font-quicksand' })
const bebas = Bebas_Neue({ subsets: ['latin'], display: 'swap', weight: ['400'], variable: '--font-bebas' })
const josefin = Josefin_Sans({ subsets: ['latin'], display: 'swap', weight: ['400', '600', '700'], variable: '--font-josefin' })

/** Every card font variable, for the <html> className.
 *
 *  One string rather than nineteen interpolations in layout.tsx, so adding a
 *  font is one line here and nothing else. A family whose variable is not on
 *  the element resolves to nothing and falls back silently, which is the exact
 *  failure this file exists to end. scripts/check-card-fonts.mjs holds the two
 *  lists together. */
export const cardFontVariables = [
  inter, dmSans, nunito, firaCode,
  roboto, openSans, montserrat, lato, poppins, raleway, oswald,
  playfair, merriweather, lora, workSans, rubik, quicksand, bebas, josefin,
].map(f => f.variable).join(' ')
