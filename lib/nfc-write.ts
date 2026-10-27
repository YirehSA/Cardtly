// Writing a card's link onto an NFC tag, in the browser. The rules (which
// writer, what the link is, what an error means) are in lib/nfc-tag.

import { isNativeApp, isNFCSupported, writeNFCTag } from '@/lib/capacitor'
import { pickNfcWriter, nfcErrorText, type NfcWriter, type NfcBlock } from '@/lib/nfc-tag'

export type NfcSupport = { writer: NfcWriter } | { writer: null; block: NfcBlock }

export async function detectNfcWriter(): Promise<NfcSupport> {
  if (typeof window === 'undefined') return { writer: null, block: 'computer' }
  const inApp = isNativeApp()
  return pickNfcWriter({
    ua: navigator.userAgent || '',
    inApp,
    appHasNfc: inApp ? await isNFCSupported() : false,
    hasWebNfc: 'NDEFReader' in window,
  })
}

/** Waits for a tag, writes the link to it, and resolves once written.
 *  Rejects with an Error whose message is ready to show; aborting rejects
 *  with name 'AbortError'. */
export async function writeLinkToTag(writer: NfcWriter, url: string, signal?: AbortSignal): Promise<void> {
  try {
    if (writer === 'app') {
      await writeNFCTag(url, { signal })
      return
    }
    const ndef = new (window as any).NDEFReader()
    await ndef.write({ records: [{ recordType: 'url', data: url }] }, { signal, overwrite: true })
  } catch (e: any) {
    // The app's writer rejects a cancel as a plain 'Cancelled'.
    const aborted = e?.name === 'AbortError' || signal?.aborted || e?.message === 'Cancelled'
    const err = new Error(nfcErrorText(aborted ? 'AbortError' : e?.name, e?.message))
    err.name = aborted ? 'AbortError' : 'NfcWriteError'
    throw err
  }
}
