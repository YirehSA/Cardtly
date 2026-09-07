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
  outputFileTracingIncludes: {
    '/api/admin/billing/**': ['./node_modules/pdfkit/js/standard-fonts/**'],
  },
}

module.exports = nextConfig
