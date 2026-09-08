// Can "send my card to this number" send it to the wrong number?
//
// That is the whole risk of the feature. A rep types 083 345 4649 in front of
// a prospect and taps send; if the normaliser adds a country code twice, drops
// a digit, or quietly assumes South Africa over a +44 the rep pasted, a
// stranger gets the card and the prospect gets nothing. None of that is
// visible in the UI - it is one line of string handling behind a button.
//
// Three things are checked here.
//
//   THE NUMBER. Every shape a South African actually types must land on the
//   same international digits, an already-international number must not be
//   given a second country code, and rubbish must come back null rather than
//   as something dialable.
//
//   THE LINK. The card link is appended by code rather than typed into the
//   message box, so a send can never go out without it. A regression that
//   dropped it would produce a perfectly friendly message containing no card.
//
//   THE ALPHABET. An SMS is 160 characters, unless one character outside
//   GSM-7 drops the whole thing to 70. The default message is the one almost
//   nobody edits, so a curly quote pasted into it would silently halve every
//   rep's capacity and double what their phone charges them.
//
// Run: node scripts/check-send-card.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const out = mkdtempSync(join(tmpdir(), 'sendcard-'))
let M
try {
  execFileSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/send-card.ts', '--outDir', out,
     '--module', 'commonjs', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' },
  )
  M = await import(pathToFileURL(join(out, 'send-card.js')).href)
} catch (e) {
  console.error('check-send-card: could not compile lib/send-card.ts')
  console.error(String(e.stdout || e.message).slice(0, 800))
  rmSync(out, { recursive: true, force: true })
  process.exit(1)
}

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }

// ── The number ────────────────────────────────────────────────────────────
const SA = '27833454649'
for (const typed of [
  '0833454649',        // the normal way
  '083 345 4649',      // with spaces
  '083-345-4649',      // with dashes
  '+27 83 345 4649',   // international, spaced
  '+27833454649',      // international, tight
  '0027833454649',     // the old 00 prefix
  '27833454649',       // country code, no plus
  '833454649',         // trunk zero left off
  ' 083 345 4649 ',    // pasted with whitespace
]) {
  const got = M.normaliseMsisdn(typed)
  if (!got) { bad(`"${typed}" was rejected outright`); continue }
  if (got.digits !== SA) bad(`"${typed}" resolved to ${got.digits}, not ${SA}`)
}

// An already-international number must not collect a second country code.
{
  const uk = M.normaliseMsisdn('+44 7700 900123')
  if (!uk) bad('a +44 number was rejected')
  else if (uk.digits !== '447700900123') bad(`a +44 number became ${uk.digits}`)
  else if (uk.digits.startsWith('2744')) bad('a +44 number was given a South African code as well')

  // A plus is the sender ASSERTING the number is already international, and
  // it has to beat every guess made below it. Nine digits is the length that
  // proves it: without the plus those same digits are read as a South African
  // number missing its trunk zero, so if the plus stops being honoured this
  // number silently collects a +27.
  const short = M.normaliseMsisdn('+123456789')
  if (!short) bad('a 9-digit international number was rejected')
  else if (short.digits !== '123456789') {
    bad(`a plus-prefixed number was rewritten to ${short.digits} - the plus is being ignored`)
  }
}

// Nothing dialable comes out of nothing.
for (const junk of ['', '   ', 'abc', '12', '1234567', '+', '0', '00']) {
  if (M.normaliseMsisdn(junk)) bad(`"${junk}" produced a sendable number`)
}
// E.164 tops out at 15 digits.
if (M.normaliseMsisdn('+1234567890123456')) bad('a 16-digit number was accepted')

// The number read back to the sender is the mitigation for the country-code
// assumption, so it has to actually be there and actually be the number.
{
  const p = M.normaliseMsisdn('0833454649')
  if (p.pretty !== '+27 83 345 4649') bad(`the number reads back as "${p.pretty}"`)
  if (p.pretty.replace(/\D/g, '') !== p.digits) {
    bad('the number shown to the sender is not the number that gets dialled')
  }
  const uk = M.normaliseMsisdn('+44 7700 900123')
  if (!uk.pretty.startsWith('+44')) bad('a foreign number is not shown with its own country code')
}

// ── The links ─────────────────────────────────────────────────────────────
{
  const wa = M.whatsappHref(SA, 'Hi & hello https://cardtly.com/card/x?s=wa')
  if (!wa.startsWith(`https://wa.me/${SA}?text=`)) bad(`the WhatsApp link is wrong: ${wa}`)
  if (wa.includes(' ')) bad('the WhatsApp text was not encoded')
  if (/text=.*&(?!amp)/.test(wa.slice(wa.indexOf('text=') + 5).replace(/%26/g, ''))) {
    bad('a raw ampersand in the message could truncate the WhatsApp text')
  }

  // iOS wants the body after '&'. Everything else after '?'. Getting this
  // backwards opens the messaging app with an empty message on one platform.
  const ios = M.smsHref(SA, 'hello', true)
  const other = M.smsHref(SA, 'hello', false)
  if (ios !== `sms:+${SA}&body=hello`) bad(`the iOS SMS link is wrong: ${ios}`)
  if (other !== `sms:+${SA}?body=hello`) bad(`the Android SMS link is wrong: ${other}`)
  if (ios === other) bad('iOS and Android are being given the same SMS separator')
}

// ── The card link is always in the message ────────────────────────────────
{
  const url = 'https://cardtly.com/card/andre-nel'
  for (const [note, channel, marker] of [
    ['Hi there', 'whatsapp', 's=wa'],
    ['Hi there', 'sms', 's=sms'],
    ['', 'whatsapp', 's=wa'],          // note wiped out entirely
    ['   ', 'sms', 's=sms'],           // note left as whitespace
  ]) {
    const msg = M.composeMessage(note, url, channel)
    if (!msg.includes(url)) bad(`a ${channel} message went out with no card link (note: "${note}")`)
    if (!msg.includes(marker)) bad(`a ${channel} message is not tagged ${marker}`)
  }
  // A URL that already carries a query must not get a second '?'.
  const marked = M.markUrl('https://cardtly.com/card/x?utm=print', 'sms')
  if (marked.includes('??') || (marked.match(/\?/g) || []).length !== 1) {
    bad(`marking a URL that already had a query produced "${marked}"`)
  }
  if (!marked.endsWith('&s=sms')) bad(`the marker was not appended correctly: ${marked}`)
}

// ── The alphabet ──────────────────────────────────────────────────────────
{
  const ascii = 'a'.repeat(100)
  if (M.smsCost(ascii).segments !== 1) bad('100 plain characters was counted as more than one SMS')
  if (M.smsCost('a'.repeat(160)).segments !== 1) bad('160 plain characters was counted as more than one SMS')
  if (M.smsCost('a'.repeat(161)).segments !== 2) bad('161 plain characters was still counted as one SMS')

  // Extended GSM characters cost two units each, so 80 of them fill a message.
  const brace = M.smsCost('{'.repeat(80))
  if (brace.unicode) bad('a brace was treated as a unicode character')
  if (brace.units !== 160) bad(`80 braces counted as ${brace.units} units, not 160`)

  // One character outside GSM-7 drops the whole message to 70.
  const uni = M.smsCost('a'.repeat(80) + 'ê')
  if (!uni.unicode) bad('a non-GSM character did not switch the count to unicode')
  if (uni.segments < 2) bad('an 81-character unicode message was counted as one SMS')

  // The characters that actually cause this in practice, because they arrive
  // by paste from Word or by a well-meaning edit to a template. These are
  // fixtures rather than prose: the em dash is here precisely so the guard
  // fails if it stops being recognised as the message-halving character it is.
  for (const ch of ['’', '—', '“', '…']) {
    if (!M.smsCost(`hello ${ch}`).unicode) {
      bad(`${JSON.stringify(ch)} was not recognised as a unicode character`)
    }
  }

  // The default message is what nearly everybody sends, so it must be plain.
  for (const [name, company] of [['Andre Nel', 'Cardtly'], ['Andre Nel', null], ['', null]]) {
    const note = M.defaultNote(name, company)
    const full = M.composeMessage(note, 'https://cardtly.com/card/andre-nel', 'sms')
    const cost = M.smsCost(full)
    if (cost.unicode) bad(`the default message for "${name}" contains a non-GSM character`)
    if (cost.segments !== 1) bad(`the default message for "${name}" sends as ${cost.segments} SMSes`)
  }
}

rmSync(out, { recursive: true, force: true })
if (fail) {
  console.error(`\ncheck-send-card: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  'check-send-card: every way a South African types their number lands on the same +27 digits, ' +
  'an international number keeps its own country code, junk is refused, the card link is in the ' +
  'message no matter what the sender does to the note, iOS and Android get their own SMS ' +
  'separators, and the default message sends as one plain SMS.',
)
