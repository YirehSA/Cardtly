import { pdf } from '@react-pdf/renderer'
import { invoiceDocument, type DocView } from './invoice-document'
import { CARDTLY_LOGO_DATA_URI } from './logo'

// Node only. @react-pdf needs Node streams and pdfkit's font files, so every
// route that calls this must declare `export const runtime = 'nodejs'` or it
// fails on the edge runtime with an unhelpful module error.

export async function renderDocumentPdf(d: DocView): Promise<Buffer> {
  // pdf() with no argument builds the PDFDocument and the empty ROOT container
  // without running the React reconciler. Assigning the tree straight onto the
  // container is what skipping React costs: one line, and the layout engine
  // and pdfkit setup below it are used exactly as they are meant to be.
  // Filled in here rather than in invoice-document, which has to stay free of
  // assets and the filesystem: it is compiled and run on its own by
  // scripts/check-pdf-document. A document that carries its own logo keeps it,
  // which is what makes an issued document reproducible.
  const withLogo: DocView = d.from.logoUrl
    ? d
    : { ...d, from: { ...d.from, logoUrl: CARDTLY_LOGO_DATA_URI } }

  const instance: any = pdf()
  instance.container.document = invoiceDocument(withLogo)

  const stream = await instance.toBuffer()
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (c: Buffer) => chunks.push(Buffer.from(c)))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

/** Filename a client sees when they save the attachment. */
export function pdfFilename(d: DocView): string {
  const kind = d.kind === 'credit_note' ? 'Credit-Note' : d.kind === 'quote' ? 'Quote' : 'Invoice'
  return `Cardtly-${kind}-${d.number || 'DRAFT'}.pdf`
}

export type { DocView }
