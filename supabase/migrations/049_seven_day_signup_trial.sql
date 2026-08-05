-- 049: a new signup gets seven days.
--
-- 046 made trials code-only by setting this default to now(), which is a date
-- that has already passed. It did stop automatic long trials, and it also meant
-- every account was expired in the same second it was created: sign up, confirm,
-- build a card, and the public link 404s before you have shown it to anybody.
-- The first person it happened to signed up, confirmed, signed in and made a
-- card inside three minutes, and her link was dead the whole time.
--
-- Seven days is enough to see the product working and hand the card to somebody
-- twice. The 30 and 60 day codes are unchanged and stay the way a rep gives
-- somebody a proper run at it.

alter table public.profiles
  alter column trial_ends_at set default (now() + interval '7 days');

-- Repair the accounts caught by the old default.
--
-- Scoped to rows stamped as expiring within a minute of being created, which is
-- the signature of the default rather than of a trial that genuinely ran out.
-- Anyone who redeemed a code is left alone, and a paying account is unaffected
-- either way: a live subscription is checked before the trial date is looked at.
update public.profiles
   set trial_ends_at = now() + interval '7 days',
       updated_at    = now()
 where trial_code is null
   and trial_ends_at is not null
   and trial_ends_at <= created_at + interval '1 minute';
