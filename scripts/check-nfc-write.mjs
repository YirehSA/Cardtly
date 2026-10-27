// Writing Cardtly links onto NFC cards from Cardtly itself.
//
// WHAT THIS PROTECTS (built 2026-10-27, to stop using the NFC Tools app, and to
// write a whole team's cards in a row):
//   1. The link on a tag is the card's real address. A tag is permanent, and
//      the first writer put https://cardtly.com/<slug> on it, a 404. It must be
//      https://www.cardtly.com/card/<slug>?s=nfc, the same page the QR opens.
//   2. The right writer is picked: the Android app's plugin only on Android 13
//      or newer (its write uses an Android 13 call), Chrome's Web NFC
//      otherwise, and nothing at all in the iOS app, which is built without
//      NFC on purpose (ios/App/App/Info.plist).
//   3. A failed write is explained in words.
//   4. The screens use one writer and one link, hide in the iOS app, and a
//      batch waits for Next between cards so one card is not written twice.
//
// Run: node scripts/check-nfc-write.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }

// ── 1-3. The rules, run ─────────────────────────────────────────────────────
const out = mkdtempSync(join(tmpdir(), 'nfc-write-'))
let N
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/nfc-tag.ts', '--outDir', out,
     '--module', 'commonjs', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck', '--esModuleInterop'],
    { stdio: 'pipe' })
  N = createRequire(import.meta.url)(join(out, 'nfc-tag.js'))
} catch (e) {
  console.error('check-nfc-write: could not compile lib/nfc-tag.ts')
  console.error(String(e?.stderr || e?.message || e))
  rmSync(out, { recursive: true, force: true })
  process.exit(1)
}

if (N.cardTagUrl('jane-smith') !== 'https://www.cardtly.com/card/jane-smith?s=nfc') bad(`the tag link is ${N.cardTagUrl('jane-smith')}, not the card's page`)
if (!/^https:\/\/www\.cardtly\.com\/card\//.test(N.cardTagUrl('x'))) bad('the tag link is not on www.cardtly.com/card/')

const CHROME_ANDROID = (v) => `Mozilla/5.0 (Linux; Android ${v}; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36`
const APP_ANDROID = (v) => `${CHROME_ANDROID(v)} wv`
const IOS_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 CardtlyiOS'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
const pick = (ua, o = {}) => {
  const r = N.pickNfcWriter({ ua, inApp: false, appHasNfc: false, hasWebNfc: false, ...o })
  return r.writer || r.block
}
const cases = [
  ['the iOS app', pick(IOS_APP, { inApp: true, appHasNfc: true, hasWebNfc: true }), 'ios-app'],
  ['the Android app on Android 14', pick(APP_ANDROID(14), { inApp: true, appHasNfc: true }), 'app'],
  ['the Android app on Android 13', pick(APP_ANDROID(13), { inApp: true, appHasNfc: true }), 'app'],
  ['the Android app on Android 12', pick(APP_ANDROID(12), { inApp: true, appHasNfc: true }), 'old-android-app'],
  ['the Android app without NFC', pick(APP_ANDROID(14), { inApp: true, appHasNfc: false }), 'no-nfc'],
  ['Chrome on Android 12', pick(CHROME_ANDROID(12), { hasWebNfc: true }), 'browser'],
  ['an Android browser without Web NFC', pick(CHROME_ANDROID(14)), 'no-nfc'],
  ['Safari on iPhone', pick(IPHONE), 'iphone'],
  ['a computer', pick(DESKTOP), 'computer'],
]
for (const [label, got, want] of cases) if (got !== want) bad(`${label}: ${got}, should be ${want}`)
for (const b of ['ios-app', 'old-android-app', 'no-nfc', 'iphone', 'computer']) if (!N.NFC_BLOCK_TEXT[b]) bad(`no words for ${b}`)
if (!/Chrome/.test(N.NFC_BLOCK_TEXT['old-android-app'])) bad('an old Android app is not pointed at Chrome')

const err = (name, msg) => N.nfcErrorText(name, msg)
if (!/Allow NFC/.test(err('NotAllowedError'))) bad('a refused NFC permission is not explained')
if (!/moved away/.test(err('NetworkError'))) bad('a card pulled away mid-write is not explained')
if (!/locked/.test(err(undefined, 'NFC tag is not writable'))) bad('a locked card is not explained')
if (!/too small/.test(err(undefined, 'Message too large for this NFC Tag (max 46 bytes).'))) bad('a too-small card is not explained')
if (err('AbortError') !== 'Stopped.') bad('a stop reads as a failure')
rmSync(out, { recursive: true, force: true })

// ── 4. The screens ──────────────────────────────────────────────────────────
// No writer anywhere builds a tag link by hand, and the old 404 link is gone.
const walk = (dir) => readdirSync(dir).flatMap(f => {
  const p = join(dir, f)
  return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|mjs)$/.test(f) ? [p] : []
})
for (const p of [...walk('components'), ...walk('app'), ...walk('lib')]) {
  const s = read(p)
  if (/writeNFCTag\(|NDEFReader\(/.test(s) && !/lib[\\/](capacitor|nfc-write)\.ts$/.test(p)) bad(`${p} writes a tag itself instead of through lib/nfc-write`)
  if (/https:\/\/cardtly\.com\/\$\{[^}]*slug/.test(s) && /nfc/i.test(p)) bad(`${p} builds the old cardtly.com/<slug> link, which is a 404`)
}

const session = read('components/nfc/NfcWriteSession.tsx')
if (!/writeLinkToTag\(support\.writer, cardTagUrl\(/.test(session)) bad('NfcWriteSession does not write cardTagUrl through writeLinkToTag')
if (!/disabled=\{!nextReady\}/.test(session)) bad('a batch does not wait before Next can write the next card')
if (!/localStorage/.test(session) || !/try \{/.test(session)) bad('NfcWriteSession does not remember progress safely')

const section = read('components/nfc/NFCWriteCard.tsx')
if (!/support\.block === 'ios-app'\) return null/.test(section)) bad('NFCWriteCard is not hidden in the iOS app')
const button = read('components/nfc/NfcWriteButton.tsx')
if (!/support\.block === 'ios-app'\)\) return null/.test(button)) bad('NfcWriteButton is not hidden in the iOS app')

const page = read('app/dashboard/nfc/page.tsx')
if (!/memoryKey=\{`team:\$\{org\.id\}`\}/.test(page)) bad("the NFC page has no team writer for a team's owner")
if (!/getManagedDepartments\(admin, user\.id\)\)\.filter\(d => !d\.viaOwner\)/.test(page) || !/\.in\('department_id', managed\.map/.test(page)) bad('the NFC page has no writer for a department manager\'s cards')
if (!/NfcWriteButton/.test(read('components/admin/TeamsTab.tsx'))) bad('Admin, Teams has no Write NFC cards button')
if (!/NfcWriteButton/.test(read('components/admin/AdminDashboard.tsx'))) bad('Admin, NFC orders has no Write button')

if (fail) { console.error(`check-nfc-write: ${fail} problem${fail === 1 ? '' : 's'}`); process.exit(1) }
console.log('check-nfc-write: ok')
