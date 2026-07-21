// How a card's public URL is built. One place, because there were three.
//
// generateSlug existed twice - in app/api/team/route.ts and again in
// app/api/department/route.ts - and the two copies had already drifted: one
// truncated at 20 characters and left stray leading hyphens behind, the other
// truncated at 40 and stripped them. Three separate call sites created team
// cards through those two functions, so "what a team card's URL looks like"
// had no single answer. Adding the company prefix to all of them meant either
// editing the rule in three places or moving it here.

// A URL-safe fragment. Accents are folded rather than dropped, so Zoë becomes
// zoe rather than zo, and André becomes andre rather than andr.
export function slugifyPart(input: string, max = 40): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '')
}

// The company part of a team card's URL, suggested from the company name.
// This is only ever a default: it is stored on the organisation and editable,
// because legal names slugify badly - "Sicon Group (Pty) Ltd" would otherwise
// put "pty-ltd" in the URL of every card the company owns.
export function orgSlugPrefix(orgName: string): string {
  const cleaned = (orgName || '')
    .replace(/\((pty|ltd|inc|llc|cc)\)/gi, ' ')
    .replace(/\b(pty|ltd|limited|inc|incorporated|llc|cc|bpk|edms)\b\.?/gi, ' ')
  return slugifyPart(cleaned, 24) || slugifyPart(orgName, 24) || 'team'
}

// company-firstname-surname. The person is all the human types.
//
// The prefix is optional so this still works for an organisation that has not
// been given one, and for personal cards, which have no company at all.
export function composeCardSlug(prefix: string | null | undefined, personName: string): string {
  const person = slugifyPart(personName, 40)
  const company = prefix ? slugifyPart(prefix, 24) : ''
  if (!company) return person
  if (!person) return company
  // Someone whose name already starts with the company name should not become
  // sicon-group-sicon-group-reception.
  if (person === company || person.startsWith(company + '-')) return person
  return `${company}-${person}`
}

// Make a slug unique against slugs already in use.
//
// Numbered rather than random: a second John Smith at Sicon gets
// sicon-group-john-smith-2, which is a URL you can read down a phone. The old
// behaviour appended five random characters to every slug whether it collided
// or not, so every card URL carried noise for a clash that almost never
// happened.
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const seed = base || 'card'
  if (!used.has(seed)) return seed
  for (let n = 2; n < 200; n++) {
    const candidate = `${seed}-${n}`
    if (!used.has(candidate)) return candidate
  }
  // 200 people with the same name in one company is not a real case, but
  // returning something colliding would be worse than something ugly.
  return `${seed}-${Math.random().toString(36).slice(2, 7)}`
}

// Slugs the app must never hand out, because a card would shadow a real page.
export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'dashboard', 'login', 'signup', 'card', 'team', 'network',
  'blog', 'pricing', 'about', 'contact', 'privacy', 'terms', 'settings', 'new',
])

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug)
}
