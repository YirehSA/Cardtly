// Google Wallet pass builder, JWT signer, and REST-API updater.
//
// Two flows:
//   1. Save link: build a Generic Pass JSON + QR, sign it into a JWT,
//      and append to https://pay.google.com/gp/v/save/ - tapping that
//      URL opens Google Wallet's "save pass" sheet. The class is
//      included inline; Google creates it on first save.
//   2. Live update: when a card is edited, PATCH the saved pass object
//      via the Wallet REST API so everyone who saved that card gets
//      the new details automatically (updateGoogleWalletObject).
//
// The class also registers a save/delete callback so we can count how
// many people add a card to their Wallet (see the callback route).

import jwt from 'jsonwebtoken'

const SAVE_URL_PREFIX = 'https://pay.google.com/gp/v/save/'
const WALLET_OBJECT_API = 'https://walletobjects.googleapis.com/walletobjects/v1'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const WALLET_SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer'

// Canonical (non-redirecting) host - Google POSTs the save/delete
// callback here directly, so it must not be the apex that 307s to www.
const APP_ORIGIN = 'https://www.cardtly.com'
const CALLBACK_URL = `${APP_ORIGIN}/api/wallet/google/callback`

// Class suffix versioning: bumping forces Google to treat it as a new
// class, because inline classes in the save JWT are only applied at
// CREATE time (Google won't patch an existing class from the JWT). So a
// new class-level property only takes effect on a freshly-suffixed class.
// v7 moved the logo to the object. v8 added MULTIPLE_HOLDERS.
// v9 registers the save/delete callback (callbackOptions).
const CLASS_SUFFIX = 'cardtly_card_v9'

interface ServiceAccount {
  client_email: string
  private_key: string
  // ...plus other fields we don't use
}

function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT
  if (!raw) return null
  try {
    const sa = JSON.parse(raw) as ServiceAccount
    if (!sa.client_email || !sa.private_key) return null
    return sa
  } catch {
    return null
  }
}

function getIssuerId(): string | null {
  return process.env.GOOGLE_WALLET_ISSUER_ID || null
}

export interface CardForWallet {
  slug: string
  name: string
  title?: string | null
  company?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  profile_image_url?: string | null
}

function objectIdFor(issuerId: string, slug: string): string {
  return `${issuerId}.cardtly_${slug.replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

// The prefix every Cardtly object ID starts with, for the callback to
// recover the slug from an object ID Google sends back.
export function slugFromObjectId(objectId: string): string | null {
  const m = objectId.match(/\.cardtly_(.+)$/)
  return m ? m[1] : null
}

// The mutable half of the pass object - everything that can change when
// a card is edited. Shared by the save flow (which adds id/classId/state)
// and the live-update PATCH (which sends only these fields so it never
// touches the object's class or state). Keeping one builder means a
// saved pass and a pushed update can never drift apart.
function buildObjectFields(card: CardForWallet): Record<string, any> {
  const cardUrl = `https://cardtly.com/card/${card.slug}`

  const textModulesData: Array<{ id: string; header: string; body: string }> = []
  if (card.phone)   textModulesData.push({ id: 'phone',   header: 'Phone',   body: card.phone })
  if (card.email)   textModulesData.push({ id: 'email',   header: 'Email',   body: card.email })
  if (card.website) textModulesData.push({ id: 'website', header: 'Website', body: card.website.replace(/^https?:\/\//, '') })

  const subheader = [card.title, card.company].filter(Boolean).join(' · ')

  const fields: Record<string, any> = {
    // Cardtly app icon at 660x660 (Wallet's hard minimum). On the object,
    // NOT the class - the GenericClass schema silently drops a logo.
    logo: {
      sourceUri: { uri: 'https://cardtly.com/wallet-logo.png' },
      contentDescription: { defaultValue: { language: 'en-US', value: 'Cardtly' } },
    },
    cardTitle: { defaultValue: { language: 'en-US', value: 'Cardtly' } },
    header: { defaultValue: { language: 'en-US', value: card.name || 'Cardtly Card' } },
    ...(subheader && { subheader: { defaultValue: { language: 'en-US', value: subheader } } }),
    textModulesData,
    barcode: {
      type: 'QR_CODE',
      value: cardUrl,
      alternateText: `cardtly.com/card/${card.slug}`,
    },
    hexBackgroundColor: '#0a0a14',
    linksModuleData: {
      uris: [{ uri: cardUrl, description: 'Open full Cardtly card', id: 'cardtly_open' }],
    },
  }

  // Profile photo as the hero image if present. Must be a public https URL.
  if (card.profile_image_url) {
    fields.heroImage = {
      sourceUri: { uri: card.profile_image_url },
      contentDescription: { defaultValue: { language: 'en-US', value: `${card.name}'s photo` } },
    }
  }

  return fields
}

function buildGenericClass(classId: string): Record<string, any> {
  return {
    id: classId,
    // Let the same card's pass (one object per slug) be saved by many
    // different people - essential for a shareable business card.
    multipleDevicesAndHoldersAllowedStatus: 'MULTIPLE_HOLDERS',
    // Fire a callback to us on every save/delete so we can count how many
    // people added the card to their Wallet.
    callbackOptions: { url: CALLBACK_URL },
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            twoItems: {
              startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['phone']" }] } },
              endItem:   { firstValue: { fields: [{ fieldPath: "object.textModulesData['email']" }] } },
            },
          },
          {
            oneItem: { item: { firstValue: { fields: [{ fieldPath: "object.textModulesData['website']" }] } } },
          },
        ],
      },
    },
  }
}

/**
 * Build the Google Wallet save URL for a card. Returns null if the
 * service account or issuer ID env vars are missing. Throws on JWT
 * signing errors so the caller can log them.
 */
export function buildGoogleWalletSaveUrl(card: CardForWallet): string | null {
  const sa = loadServiceAccount()
  const issuerId = getIssuerId()
  if (!sa || !issuerId) return null

  const classId = `${issuerId}.${CLASS_SUFFIX}`
  const genericObject = {
    id: objectIdFor(issuerId, card.slug),
    classId,
    state: 'ACTIVE',
    ...buildObjectFields(card),
  }

  const claims = {
    iss: sa.client_email,
    aud: 'google',
    typ: 'savetowallet',
    origins: ['https://cardtly.com', 'https://www.cardtly.com'],
    payload: {
      genericClasses: [buildGenericClass(classId)],
      genericObjects: [genericObject],
    },
  }

  const token = jwt.sign(claims, sa.private_key, { algorithm: 'RS256' })
  return `${SAVE_URL_PREFIX}${token}`
}

// Cache the OAuth access token in-memory for its lifetime (warm
// serverless instances reuse it instead of re-minting every call).
let cachedToken: { token: string; exp: number } | null = null

async function getAccessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token

  const assertion = jwt.sign(
    { iss: sa.client_email, scope: WALLET_SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 },
    sa.private_key,
    { algorithm: 'RS256' }
  )
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    })
    if (!res.ok) {
      console.error('wallet token exchange failed', res.status, await res.text().catch(() => ''))
      return null
    }
    const data = await res.json()
    if (!data.access_token) return null
    cachedToken = { token: data.access_token, exp: now + (data.expires_in || 3600) }
    return data.access_token
  } catch (err) {
    console.error('wallet token exchange error', err)
    return null
  }
}

/**
 * Push updated card details to a saved Google Wallet pass. The pass
 * object ID is deterministic ({issuerId}.cardtly_{slug}), so we PATCH
 * it directly - no stored IDs needed. If nobody has saved this card to
 * Wallet yet, the object doesn't exist (404) and we quietly no-op.
 *
 * Best-effort and non-throwing: callers should fire-and-forget.
 * Returns 'updated' | 'not_saved' | 'skipped' | 'error' for logging.
 */
export async function updateGoogleWalletObject(
  card: CardForWallet
): Promise<'updated' | 'not_saved' | 'skipped' | 'error'> {
  const sa = loadServiceAccount()
  const issuerId = getIssuerId()
  if (!sa || !issuerId) return 'skipped'

  const token = await getAccessToken(sa)
  if (!token) return 'error'

  const objectId = objectIdFor(issuerId, card.slug)
  try {
    const res = await fetch(
      `${WALLET_OBJECT_API}/genericObject/${encodeURIComponent(objectId)}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        // Only the mutable fields - never id/classId/state - so this is a
        // clean merge that works regardless of which class version the
        // saved object was created under.
        body: JSON.stringify(buildObjectFields(card)),
      }
    )
    if (res.ok) return 'updated'
    if (res.status === 404) return 'not_saved' // nobody saved it yet
    console.error('wallet object patch failed', res.status, await res.text().catch(() => ''))
    return 'error'
  } catch (err) {
    console.error('wallet object patch error', err)
    return 'error'
  }
}

/**
 * Check whether the env vars are configured. Used by API routes and UI
 * components to short-circuit before doing work, and to decide whether
 * to show the "Add to Google Wallet" button.
 */
export function isGoogleWalletConfigured(): boolean {
  return !!(process.env.GOOGLE_WALLET_SERVICE_ACCOUNT && process.env.GOOGLE_WALLET_ISSUER_ID)
}
