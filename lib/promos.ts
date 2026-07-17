// Master switch for every giveaway/prize promotion on Cardtly.
//
// Paused 2026-07-17 pending a decision on whether to run promos at all
// under the new R97 pricing. Flip to true to bring the whole programme
// back: the /promotions pages, the homepage and footer entry points,
// the dashboard referral card, and the draw-entry grants all read this.
//
// Deliberately paused, not deleted, so turning it back on is a one-line
// change rather than an archaeology exercise.
//
// NOT covered by this switch: profiles.is_founder / founder_number.
// Those are now just the "N/100" early-member badge on a public card,
// which is a membership marker rather than a prize, so it keeps running.
export const PROMOS_ENABLED = false
