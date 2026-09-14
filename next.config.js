/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // pdfkit, underneath @react-pdf, loads the metrics for its built-in fonts
  // with a require() built from the font NAME at the moment text is first
  // measured. Nothing imports Helvetica.cjs statically, so Next's file tracer
  // never sees it, never copies it into the function bundle, and production
  // dies on the first render with:
  //
  //   Cannot find module '/var/task/node_modules/pdfkit/js/standard-fonts/Helvetica.cjs'
  //
  // A dev server cannot reproduce this. It has the whole node_modules on disk,
  // so the lazy require always succeeds there no matter what the tracer did.
  //
  // All 29 files, not just Helvetica: the set is 190KB, and listing only the
  // faces used today means the next document that reaches for Times or a bold
  // oblique fails in production exactly the same way.
  // The cron is on this list because it sends overdue reminders, and a
  // reminder carries the invoice as a PDF. It was added after
  // scripts/check-pdf-tracing caught it: nothing about the cron route looks
  // like a PDF route, and without the guard it would have failed in production
  // the first morning somebody switched automatic chasing on.

  // ---------------------------------------------------------------------------
  // Security headers.
  //
  // Before this the only one set was HSTS, which Vercel adds. Everything else
  // was absent: a page could be framed by anyone, MIME types were sniffable,
  // and full URLs leaked to every external site a card links to.
  //
  // Two of these are shaped by things the codebase actually does, and both
  // would have broken the site if set the obvious way:
  //
  //   X-Frame-Options is SAMEORIGIN, not DENY. The home page lazy-loads real
  //   /card/[slug] pages inside iframes (components/marketing/FeaturedCards).
  //   DENY would blank every showcase tile on the front page.
  //
  //   Permissions-Policy allows camera on self. The scanner is a file input
  //   with capture=environment, which browsers gate behind the camera
  //   permission, so camera=() would stop a rep photographing a business card.
  //
  // The CSP is REPORT-ONLY for now, deliberately. There are no third-party
  // scripts at all - Paystack checkout is a server redirect, not an in-page
  // script, and there is no analytics tag - so a tight policy is realistic.
  // But a CSP that is wrong takes a page down, and the honest way to find out
  // is to collect violations from real traffic rather than to guess from a dev
  // server. Switch Report-Only to the enforcing header once it is quiet.
  //
  // unsafe-inline is required by things that are not going away soon: Next's
  // own bootstrap script, the anti-flash script in app/page.tsx, and inline
  // style attributes throughout. unsafe-eval is here because dev builds need
  // it; it is the first thing worth removing when this goes enforcing.
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.paystack.co",
      "media-src 'self' data: blob:",
      "worker-src 'self' blob:",
      "frame-src 'self'",
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Send the origin to other sites but never the path. A card links out
          // to a customer's own site, and the full URL of the card somebody was
          // looking at is not that site's business.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
          },
          { key: 'Content-Security-Policy-Report-Only', value: csp },
        ],
      },
    ]
  },

  outputFileTracingIncludes: {
    '/api/admin/billing/**': ['./node_modules/pdfkit/js/standard-fonts/**'],
    '/api/cron/trial-reminders': ['./node_modules/pdfkit/js/standard-fonts/**'],
  },
}

module.exports = nextConfig
