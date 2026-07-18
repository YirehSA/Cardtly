# NFC card samples

Photos of real printed cards, shown on /nfc. Each card needs both sides.

Files (exact names):

    yireh-front.jpg     yireh-back.jpg
    cardtly-front.jpg   cardtly-back.jpg
    sicon-front.jpg     sicon-back.jpg

Front is the branded side, back is the side carrying the QR code.

Keep them web-sized: 1200px on the long edge, JPEG quality ~82, progressive.
The tiles render around 380px wide, so 1200 covers a 3x display. The originals
were 3013px and up to 1.4MB each, which is far too heavy here - the images load
eagerly (see the note in components/marketing/CardSamples.tsx), so page weight
matters more than usual.

Aspect ratio wants to be near 1.586 (85.6 x 54mm). Close is fine; the tile
crops with object-fit: cover.

The section only renders samples whose files are both present, so a missing
file makes that card disappear rather than shipping a broken image. To add
another, drop the two files here and add an entry to CARD_SAMPLES in
app/nfc/page.tsx.
