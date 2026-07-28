// Turning a failed lead-form submission into something the visitor can act on.
//
// Both lead forms - the inline one on the card and the exchange modal after
// Save Contact - used to say "Something went wrong". That tells the visitor
// nothing, so they give up rather than fix a typo, and it tells the card owner
// nothing either: a card silently failing to take leads looks exactly like a
// card nobody filled in.
//
// Shared so the two forms cannot drift apart.

export interface ContactErrorResult {
  /** Shown to the visitor. Human, and actionable where the visitor can act. */
  message: string
  /** Logged for us. Never shown - a raw database message would leak schema. */
  detail: string
}

export function describeContactError(status: number, apiError?: string): ContactErrorResult {
  const raw = apiError || `HTTP ${status}`

  // The visitor left something out. The only case they can fix themselves.
  if (status === 400 && /required fields/i.test(raw)) {
    return { message: 'Please add your name and email.', detail: raw }
  }

  // Our fault, not theirs: the page rendered a form that has no card behind it,
  // or the card has since been removed. Telling them to "try again" would be a
  // lie - trying again cannot help.
  if (status === 404 || (status === 400 && /card reference/i.test(raw))) {
    return {
      message: 'This card cannot receive messages right now. Please contact them directly.',
      detail: raw,
    }
  }

  if (status >= 500) {
    return { message: 'Could not send that - please try again in a moment.', detail: raw }
  }

  return { message: 'Could not send that. Please try again.', detail: raw }
}

/** Network-level failure: the request never reached us at all. */
export const CONTACT_NETWORK_ERROR =
  'No connection. Check your signal and try again.'
