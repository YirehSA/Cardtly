# NFC card samples

Photos of real printed cards, shown on /nfc. Each card needs both sides.

Expected files (exact names):

    yireh-front.png     yireh-back.png
    cardtly-front.png   cardtly-back.png
    sicon-front.png     sicon-back.png

Front is the branded side, back is the side carrying the QR code.

Aspect ratio should be 1.586 (85.6 x 54mm, standard card). Anything close is
fine - the tile crops with object-fit: cover. Around 1600px wide is plenty.

The section on /nfc only renders samples whose files are both present, so a
missing file makes that card disappear rather than shipping a broken image.
To add another sample, drop the two files here and add an entry to
CARD_SAMPLES in app/nfc/page.tsx.
