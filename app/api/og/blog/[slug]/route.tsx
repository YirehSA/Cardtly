import { ImageResponse } from 'next/og'
import { getPost } from '@/app/blog/posts'
import { CARDTLY_MARK } from '@/lib/og-cardtly-mark'

// Cover image for a blog post, drawn rather than uploaded.
//
// Three jobs, one implementation: the thumbnail on the blog index, the image
// in each post's BlogPosting schema, and the preview when a post is shared.
// Before this, all three used public/cardtly-icon.png - the same logo on every
// post, which tells a reader nothing and gives Google no post-specific image
// to show.
//
// Drawn from the post's own title instead of a stock photo on purpose. Stock
// photography of people in suits holding blank cards dates badly, costs money
// or licensing attention, and looks like every other B2B blog. This cannot go
// out of date, needs no files in the repo, and a new post gets a cover the
// moment it is added - nobody has to remember to make one.
export const runtime = 'edge'

const FULL_W = 1200
const FULL_H = 630

// The index needs a thumbnail, crawlers and social need the full 1200x630. One
// design, scaled, rather than two: ?w= renders the same layout smaller, so the
// index can load eight covers without pulling ~1.8MB of full-size PNG.
function clampWidth(raw: string | null): number {
  if (!raw) return FULL_W
  const n = Number(raw)
  if (!Number.isFinite(n)) return FULL_W
  return Math.min(FULL_W, Math.max(400, Math.round(n)))
}

// Longer titles step down so a five-word headline and a twelve-word one both
// fill the space without one of them overflowing.
function titleSize(title: string): number {
  if (title.length <= 34) return 82
  if (title.length <= 48) return 70
  if (title.length <= 62) return 60
  return 52
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return new Response('not found', { status: 404 })

  const width = clampWidth(new URL(_request.url).searchParams.get('w'))
  const height = Math.round((width / FULL_W) * FULL_H)
  // Every px below is written at full size and multiplied through, so the
  // thumbnail is the same design rather than a second one to keep in step.
  const S = width / FULL_W
  const px = (n: number) => Math.round(n * S)

  return new ImageResponse(
    (
      <div
        style={{ display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: '#05060d',
          position: 'relative',
          padding: px(72),
          justifyContent: 'space-between',
        }}
      >
        {/* Brand glows, matching the site's own gradient rather than a flat panel */}
        <div
          style={{ display: 'flex', position: 'absolute',
            top: px(-220),
            left: px(-140),
            width: px(760),
            height: px(760),
            borderRadius: px(760),
            background: 'radial-gradient(circle, rgba(0,212,255,0.30) 0%, rgba(124,58,237,0.14) 48%, rgba(5,6,13,0) 72%)',
          }}
        />
        <div
          style={{ display: 'flex', position: 'absolute',
            bottom: px(-280),
            right: px(-160),
            width: px(680),
            height: px(680),
            borderRadius: px(680),
            background: 'radial-gradient(circle, rgba(236,72,153,0.26) 0%, rgba(5,6,13,0) 70%)',
          }}
        />

        {/* Top: mark, wordmark and what this is */}
        <div style={{ display: 'flex', alignItems: 'center', gap: px(18), position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CARDTLY_MARK} width={px(56)} height={px(56)} alt="" style={{ display: 'flex', borderRadius: px(14) }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', color: '#fff', fontSize: px(30), fontWeight: 800, letterSpacing: -0.5 }}>
              Cardtly
            </div>
            <div style={{ display: 'flex', color: 'rgba(255,255,255,0.42)', fontSize: px(19), letterSpacing: 2 }}>
              GUIDE
            </div>
          </div>
        </div>

        {/* The title does the work */}
        <div
          style={{ display: 'flex',
            color: '#fff',
            fontSize: px(titleSize(post.title)),
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: -1.6,
            maxWidth: px(1000),
            position: 'relative',
          }}
        >
          {post.title}
        </div>

        {/* Bottom: a gradient rule, then read time and domain */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: px(22), position: 'relative' }}>
          <div
            style={{ display: 'flex',
              width: px(200),
              height: px(6),
              borderRadius: px(6),
              background: 'linear-gradient(90deg, #00d4ff, #7c3aed, #ec4899)',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: px(16) }}>
            <div style={{ display: 'flex', color: 'rgba(255,255,255,0.62)', fontSize: px(26) }}>
              {post.readMins} min read
            </div>
            <div style={{ display: 'flex', color: 'rgba(255,255,255,0.24)', fontSize: px(26) }}>•</div>
            <div style={{ display: 'flex', color: 'rgba(255,255,255,0.62)', fontSize: px(26) }}>cardtly.com</div>
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
      headers: {
        // Covers change only when a post's title or read time changes, which is
        // rare, so let them cache hard rather than re-rendering on every crawl.
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    }
  )
}
