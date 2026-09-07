import { pdf } from '@react-pdf/renderer'
import { invoiceDocument, type DocView } from './invoice-document'

// Node only. @react-pdf needs Node streams and pdfkit's font files, so every
// route that calls this must declare `export const runtime = 'nodejs'` or it
// fails on the edge runtime with an unhelpful module error.

export async function renderDocumentPdf(d: DocView): Promise<Buffer> {
  // pdf() with no argument builds the PDFDocument and the empty ROOT container
  // without running the React reconciler. Assigning the tree straight onto the
  // container is what skipping React costs: one line, and the layout engine
  // and pdfkit setup below it are used exactly as they are meant to be.
  const instance: any = pdf()
  instance.container.document = invoiceDocument(d)

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
