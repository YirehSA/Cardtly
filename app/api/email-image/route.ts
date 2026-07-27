import { fetchCardImage, isOwnStorageUrl } from '@/lib/card-image'

// Serves a card image as something a mail client can render.
//
// Why this exists. Uploaded photos and logos are stored as WebP - excellent for
// the website, and unusable in email. Outlook on Windows renders mail through
// the Word engine and has no WebP support at all, so a signature pasted there
// showed a broken box where the profile photo and company logo should be. Gmail
// copes, which is what makes this easy to miss.
//
// The conversion itself lives in lib/card-image.ts, shared with the vCard route
// so the two cannot drift.

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('url')
  if (!raw) return new Response('url required', { status: 400 })

  // Checked here as well as in the helper, so a rejected URL is a 400 rather
  // than an indistinguishable "could not convert".
  if (!isOwnStorageUrl(raw)) return new Response('url not allowed', { status: 400 })

  const image = await fetchCardImage(raw, { size: 256 })
  if (!image) return new Response('could not convert image', { status: 502 })

  return new Response(new Uint8Array(image.buffer), {
    headers: {
      'Content-Type': image.contentType,
      // Long cache: the source URL changes whenever the image does, so a given
      // URL's bytes never change.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
