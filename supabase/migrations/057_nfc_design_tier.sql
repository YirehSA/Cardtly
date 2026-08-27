-- NFC orders: which design tier was ordered.
--
-- Two tiers now: standard (R150) puts the customer's logo and colours into
-- our layout; custom (R200) is designed around their brand. The order row
-- has to carry which one, because the invoice is raised by hand off the
-- admin notification and there was previously nothing in the record saying
-- what was actually bought.
--
-- amount stops being 0 at the same time. It was written as a placeholder and
-- never read, so filling it in costs nothing and means an order row states
-- its own value: unit price times quantity, excluding shipping, which is
-- charged once per consignment rather than per card.

alter table nfc_orders
  add column if not exists design_tier text not null default 'standard';

-- Constrained rather than free text: a typo here becomes a wrong invoice.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'nfc_orders_design_tier_check'
  ) then
    alter table nfc_orders
      add constraint nfc_orders_design_tier_check
      check (design_tier in ('standard', 'custom'));
  end if;
end $$;

-- Every existing order predates the split and was quoted at R150, which is
-- exactly the standard tier, so the default above is already correct for
-- them. This backfills amount for the same rows, which were all stored as 0.
update nfc_orders
   set amount = 150 * greatest(coalesce(quantity, 1), 1)
 where coalesce(amount, 0) = 0;

comment on column nfc_orders.design_tier is
  'standard = our layout with the customer''s branding (R150/card); custom = designed around their brand (R200/card). Shipping is separate and per consignment.';
