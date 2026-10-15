// Placing the qrcode library's SVG inside a larger SVG: the QR page's vector
// download and its print card.
//
// The library's <svg> already carries width and height. Both exports used to
// add their own pair on top by replacing '<svg ', so the file had every size
// attribute twice. A browser shrugs that off when the SVG sits inside a web
// page, but a downloaded .svg is read as strict XML, and duplicate attributes
// make it not well-formed: it would not open at all ("Attribute width
// redefined"). Reported 2026-10-15.
//
// scripts/check-qr-svg.mjs builds both files from a real QR and parses them as
// strict XML.

/**
 * The QR as a nested <svg> at (x, y), px square: any XML declaration dropped,
 * and the position and size it had replaced rather than repeated.
 */
export function placeQrSvg(svg: string, x: number, y: number, px: number): string {
  return svg
    .replace(/^\s*<\?xml[^>]*\?>\s*/, '')
    .replace(/<svg\b([^>]*)>/, (_m, attrs: string) => {
      const kept = attrs.replace(/\s(?:x|y|width|height)\s*=\s*"[^"]*"/g, '')
      return `<svg${kept} x="${x}" y="${y}" width="${px}" height="${px}">`
    })
    .trim()
}

/**
 * An <image> for the logo, with the reference written both ways: href for
 * browsers and SVG 2, xlink:href for the print software a printer opens it in
 * (Illustrator, CorelDRAW), which may only read the older form.
 */
export function svgImageHref(href: string): string {
  return `href="${href}" xlink:href="${href}"`
}
