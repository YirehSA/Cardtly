import { cache } from 'react'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cardsEverSold } from '@/lib/reseller-levels-server'
import { levelFor } from '@/lib/reseller-levels'
import {
  cleanListing, listingFromRow, listingState, sortListings,
  type Listing, type ListingState, type PublicReseller,
} from '@/lib/reseller-listing'

// The resellers shown on cardtly.com/find-a-reseller (rules in
// lib/reseller-listing). Read with the service role, because resellers is
// closed to the browser, so this file picks out the public fields itself:
// the select names only what the listing needs, and the result carries only
// PublicReseller's fields.

const PUBLIC_SELECT = 'id, name, status, listed, listing, listing_blocked'

function db() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any
}

/** A reseller's own listing, for its Listing tab. Null before migration 108. */
export function ownListing(reseller: any, cardsSold: number | null): {
  listed: boolean; blocked: boolean; listing: Listing; state: ListingState
} | null {
  if (!reseller || !('listed' in reseller)) return null
  const listing = listingFromRow(reseller.listing)
  return {
    listed: reseller.listed === true,
    blocked: reseller.listing_blocked === true,
    listing,
    state: listingState({ listed: reseller.listed, blocked: reseller.listing_blocked, status: reseller.status, cardsSold: cardsSold ?? 0, listing }),
  }
}

/** The reseller saves its listing. Switching it on needs a complete listing;
 *  switching it off always works, and keeps what was typed for next time. */
export async function saveResellerListing(db: any, reseller: any, body: any): Promise<{ ok: true } | { error: string; status: number }> {
  if (!('listed' in reseller)) return { error: 'Your listing is not switched on yet. Cardtly is setting it up.', status: 503 }
  const listed = body?.listed === true
  if (listed && reseller.listing_blocked === true) {
    return { error: 'Cardtly has taken your listing down, so it cannot be switched on. Contact hello@cardtly.com.', status: 403 }
  }
  let listing: Listing
  if (listed) {
    const checked = cleanListing(body?.listing)
    if (!checked.ok) return { error: checked.error, status: 400 }
    listing = checked.listing
  } else {
    listing = listingFromRow(body?.listing)
  }
  const { error } = await db.from('resellers')
    .update({ listed, listing, updated_at: new Date().toISOString() }).eq('id', reseller.id)
  if (error) {
    return /listed|listing/.test(error.message || '')
      ? { error: 'Your listing is not switched on yet. Cardtly is setting it up.', status: 503 }
      : { error: error.message || 'Could not save your listing.', status: 500 }
  }
  return { ok: true }
}

/** Everybody listed, best level first. Empty before migration 108, and when
 *  cards sold cannot be counted (a level cannot be confirmed). Cached per
 *  request, so the page and its metadata ask once. */
export const publicListings = cache(async (): Promise<PublicReseller[]> => {
  try {
    const client = db()
    const { data, error } = await client.from('resellers').select(PUBLIC_SELECT)
      .eq('listed', true).eq('listing_blocked', false).eq('status', 'active')
    if (error || !data?.length) return []
    const sold = await cardsEverSold(client, data.map((r: any) => r.id))
    if (!sold) return []
    const out: PublicReseller[] = []
    for (const r of data) {
      const listing = listingFromRow(r.listing)
      const cardsSold = sold[r.id] || 0
      if (listingState({ listed: r.listed, blocked: r.listing_blocked, status: r.status, cardsSold, listing }) !== 'live') continue
      out.push({
        name: String(r.name || '').trim() || 'Cardtly reseller',
        level: levelFor(cardsSold).key,
        blurb: listing.blurb, city: listing.city, provinces: listing.provinces,
        phone: listing.phone, email: listing.email, website: listing.website,
      })
    }
    return sortListings(out)
  } catch {
    return []
  }
})
