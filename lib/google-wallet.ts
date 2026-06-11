// Google Wallet pass builder + JWT signer.
//
// Generates a "Save to Google Wallet" URL for a Cardtly business
// card. The flow:
//   1. Build a Generic Pass JSON containing card data + a QR code
//      pointing to https://cardtly.com/card/<slug>.
//   2. Wrap it in a JWT signed with the Cardtly Wallet service
//      account's RSA private key (RS256).
//   3. Append the JWT to https://pay.google.com/gp/v/save/ -
//      tapping that URL opens Google Wallet's "save pass" sheet.
//
// The pass class definition is included inline in the JWT. Google
// creates the class the first time a pass references it and reuses
// it after - no separate class-creation step needed.

import jwt from 'jsonwebtoken'

const SAVE_URL_PREFIX = 'https://pay.google.com/gp/v/save/'
// Class suffix versioning: bumping forces Google to treat it as a
// new class so existing saved passes don't get stuck on the old
// template. v6 uses /wallet-logo.png at its final resized 660x660
// dimensions (was 192x192, below Wallet's hard minimum).
const CLASS_SUFFIX = 'cardtly_card_v6'

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

/**
 * Build the Google Wallet save URL for a card. Returns null if the
 * service account or issuer ID env vars are missing. Throws on
 * JWT signing errors so the caller can log them.
 */
export function buildGoogleWalletSaveUrl(card: CardForWallet): string | null {
  const sa = loadServiceAccount()
  const issuerId = getIssuerId()
  if (!sa || !issuerId) return null

  const classId = `${issuerId}.${CLASS_SUFFIX}`
  const objectId = `${issuerId}.cardtly_${card.slug.replace(/[^a-zA-Z0-9_-]/g, '_')}`
  const cardUrl = `https://cardtly.com/card/${card.slug}`

  const genericClass = {
    id: classId,
    // Cardtly app icon at 660x660 (Wallet's hard minimum). The
    // file at /wallet-logo.png is the Android xxxhdpi launcher
    // resized via sharp with the dark Cardtly background fill.
    logo: {
      sourceUri: { uri: 'https://cardtly.com/wallet-logo.png' },
      contentDescription: {
        defaultValue: { language: 'en-US', value: 'Cardtly' },
      },
    },
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          // Row 1: phone | email
          {
            twoItems: {
              startItem: {
                firstValue: {
                  fields: [
                    { fieldPath: "object.textModulesData['phone']" },
                  ],
                },
              },
              endItem: {
                firstValue: {
                  fields: [
                    { fieldPath: "object.textModulesData['email']" },
                  ],
                },
              },
            },
          },
          // Row 2: website (full width)
          {
            oneItem: {
              item: {
                firstValue: {
                  fields: [
                    { fieldPath: "object.textModulesData['website']" },
                  ],
                },
              },
            },
          },
        ],
      },
    },
  }

  // Build text modules conditionally so we don't show empty rows.
  const textModulesData: Array<{ id: string; header: string; body: string }> = []
  if (card.phone)   textModulesData.push({ id: 'phone',   header: 'Phone',   body: card.phone })
  if (card.email)   textModulesData.push({ id: 'email',   header: 'Email',   body: card.email })
  if (card.website) textModulesData.push({ id: 'website', header: 'Website', body: card.website.replace(/^https?:\/\//, '') })

  const subheader = [card.title, card.company].filter(Boolean).join(' · ')

  const genericObject: Record<string, any> = {
    id: objectId,
    classId,
    state: 'ACTIVE',
    cardTitle: {
      defaultValue: { language: 'en-US', value: 'Cardtly' },
    },
    header: {
      defaultValue: { language: 'en-US', value: card.name || 'Cardtly Card' },
    },
    ...(subheader && {
      subheader: {
        defaultValue: { language: 'en-US', value: subheader },
      },
    }),
    textModulesData,
    barcode: {
      type: 'QR_CODE',
      value: cardUrl,
      alternateText: `cardtly.com/card/${card.slug}`,
    },
    hexBackgroundColor: '#0a0a14',
    linksModuleData: {
      uris: [
        {
          uri: cardUrl,
          description: 'Open full Cardtly card',
          id: 'cardtly_open',
        },
      ],
    },
  }

  // Add the profile photo as the hero image if we have one. Image
  // must be a publicly reachable https URL - Supabase Storage URLs work.
  if (card.profile_image_url) {
    genericObject.heroImage = {
      sourceUri: { uri: card.profile_image_url },
      contentDescription: {
        defaultValue: { language: 'en-US', value: `${card.name}'s photo` },
      },
    }
  }

  const claims = {
    iss: sa.client_email,
    aud: 'google',
    typ: 'savetowallet',
    origins: ['https://cardtly.com', 'https://www.cardtly.com'],
    payload: {
      genericClasses: [genericClass],
      genericObjects: [genericObject],
    },
  }

  const token = jwt.sign(claims, sa.private_key, { algorithm: 'RS256' })
  return `${SAVE_URL_PREFIX}${token}`
}

/**
 * Check whether the env vars are configured. Used by API routes
 * and UI components to short-circuit before doing work, and to
 * decide whether to show the "Add to Google Wallet" button.
 */
export function isGoogleWalletConfigured(): boolean {
  return !!(process.env.GOOGLE_WALLET_SERVICE_ACCOUNT && process.env.GOOGLE_WALLET_ISSUER_ID)
}
