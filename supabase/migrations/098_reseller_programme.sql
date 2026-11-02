-- 098: a rep can run the reseller programme, and an application is recommended
-- before it is approved. (Andre, 2026-11-02: Anthony "will also be in charge of
-- the Reseller Program ... maybe he can approve then the final approval must
-- come from myself or Tio. He must be able to see the resellers and adjust
-- pricing and seats".)
--
--   reps.manages_resellers                 switched on in admin, Reps: that rep
--                                          gets a Resellers page in their own
--                                          dashboard (lib/reseller-programme).
--   reseller_applications.status           gains 'recommended', between
--                                          'pending' and 'approved'.
--   reseller_applications.recommended_by   who recommended it, when, and why.
--   reseller_applications.recommended_at
--   reseller_applications.recommendation_note
--
-- No new tables, so no grants (scripts/check-migration-grants). Both tables
-- stay service-role only, as migrations 030 and 095 left them.

alter table public.reps
  add column if not exists manages_resellers boolean not null default false;

comment on column public.reps.manages_resellers is
  'Runs the reseller programme: sees every reseller, changes prices, seat pools and details, puts one on hold, and recommends or declines applications. Final approval, logins, ending a reseller and invoices stay with admins.';

alter table public.reseller_applications
  add column if not exists recommended_by uuid,
  add column if not exists recommended_at timestamptz,
  add column if not exists recommendation_note text;

alter table public.reseller_applications
  drop constraint if exists reseller_applications_status_check;
alter table public.reseller_applications
  add constraint reseller_applications_status_check
  check (status in ('pending', 'recommended', 'approved', 'declined'));
