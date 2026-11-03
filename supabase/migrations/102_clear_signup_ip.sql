-- 102: clear the sign-up IP addresses.
--
-- /api/track-signup wrote the IP address a new account was created from to
-- profiles.signup_ip, while the privacy policy (section 3) said "We do not store
-- the IP address itself on your profile". Nothing in the product ever read it
-- back. The route stopped writing it on 2026-11-03; this removes the ones
-- already stored, so the policy is true of what is in the database too.
--
-- The approximate location (country, region, city) stays: the policy states
-- that one, and the admin panel shows it.
--
-- The column is left in place, empty, so nothing that names it breaks.

update public.profiles set signup_ip = null where signup_ip is not null;
