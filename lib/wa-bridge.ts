import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { toIntlDigits } from './whatsapp'

// The WhatsApp button in an EMAIL. Server-only: it uses node crypto, which is
// why it lives here and not in lib/whatsapp, which the dashboard imports in
// the browser.
//
// WHY AN EMAIL BUTTON GOES THROUGH cardtly.com/wa. Most mail apps refuse to
// open a whatsapp:// link, and a wa.me link opens WhatsApp's web page in the
// mail app's own browser instead of the chat. So the button goes to
// cardtly.com/wa, and that page opens the app from a tap (see app/wa).
//
// WHY THE NUMBER IS SEALED INTO THE PATH. The first version (3c14f5e) carried
// the number after a #, which no browser sends to a server. But work email
// often passes through a scanner such as Mimecast, which swaps every link for
// its own and sends the click on later, and a client could not reply on
// WhatsApp (2026-10-20). A plain path survives any of those, so the number and
// message now travel in the path, encrypted (AES-256-GCM): server logs only
// ever see a blob, and a changed blob is refused rather than opening a chat to
// a different number.
//
// The key is a dedicated secret if one is set, otherwise derived from the
// service role key, the same fallback as lib/visitor-hash, so this works the
// moment it deploys. Changing either one breaks the WhatsApp buttons in emails
// already sent; the page then says so and points to the number in the email.

export interface WaTarget { phone: string; text: string }

const LABEL = 'cardtly-wa-link-v1'
const IV = 12
const TAG = 16

function key(): Buffer | null {
  const secret = process.env.WA_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!secret) return null
  return createHash('sha256').update(`${LABEL}\n${secret}`).digest()
}

function cleanPhone(raw: string): string | null {
  const d = raw.replace(/\D/g, '')
  return d.length >= 9 && d.length <= 15 ? d : null
}

/** URL-safe token for a number and message, or null with no key. */
export function sealWaTarget(t: WaTarget): string | null {
  const k = key()
  const phone = cleanPhone(t.phone)
  if (!k || !phone) return null
  const iv = randomBytes(IV)
  const cipher = createCipheriv('aes-256-gcm', k, iv)
  const body = Buffer.concat([cipher.update(`${phone}\n${(t.text || '').slice(0, 1000)}`, 'utf8'), cipher.final()])
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64url')
}

/** The number and message back, or null for anything changed, foreign or broken. */
export function openWaTarget(token: string): WaTarget | null {
  const k = key()
  if (!k || typeof token !== 'string' || token.length > 3000 || !/^[A-Za-z0-9_-]+$/.test(token)) return null
  try {
    const raw = Buffer.from(token, 'base64url')
    if (raw.length <= IV + TAG) return null
    const decipher = createDecipheriv('aes-256-gcm', k, raw.subarray(0, IV))
    decipher.setAuthTag(raw.subarray(raw.length - TAG))
    const plain = Buffer.concat([decipher.update(raw.subarray(IV, raw.length - TAG)), decipher.final()]).toString('utf8')
    const nl = plain.indexOf('\n')
    const phone = cleanPhone(nl < 0 ? plain : plain.slice(0, nl))
    if (!phone) return null
    return { phone, text: nl < 0 ? '' : plain.slice(nl + 1).slice(0, 1000) }
  } catch {
    return null
  }
}

// The link for the email button. Null when the number is unusable. With no key
// at all it falls back to the older # form, which still works where nothing
// rewrites links, rather than leaving the email without a button.
export function waBridgeLink(phone: string | null | undefined, text?: string): string | null {
  const d = toIntlDigits(phone || '')
  if (d.length < 9) return null
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com').replace(/\/$/, '')
  const token = sealWaTarget({ phone: d, text: text || '' })
  if (token) return `${appUrl}/wa/${token}`
  const params = new URLSearchParams({ phone: d })
  if (text) params.set('text', text)
  return `${appUrl}/wa#${params.toString()}`
}
