// Marks lucide does not carry.
//
// Everything else on the social row is an exact logo, so a stand-in from the
// icon set (a music note, a generic play button) reads as a different service
// altogether. One glyph is not worth another icon package, so it lives here and
// every surface that draws a social row imports it - the public card, both
// editors and the previews - rather than each keeping its own copy.

export function TikTokGlyph({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 1 1 .77-5.06V9.7a5.68 5.68 0 0 0-.77-.05A5.66 5.66 0 1 0 15.54 15.3V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.28 4.28 0 0 1-3.24-1.48Z" />
    </svg>
  )
}
