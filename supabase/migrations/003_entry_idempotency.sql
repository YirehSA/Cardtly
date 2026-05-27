-- ============================================================
-- Cardtly Promotions Phase 1 (Task 5): Entry tracking refinements
--
-- 1. Tier becomes nullable. The deck specifies entries "carry
--    forward and accumulate" across draws, so binding each entry
--    to a specific tier doesn't fit. At draw time we just pick
--    randomly from all entries; the tier column stays as an
--    optional annotation.
-- 2. Adds idempotency_key + unique index per user. Prevents
--    double-granting an entry from a retried webhook or repeated
--    referral verification.
-- ============================================================

-- 1. Drop NOT NULL so we can write entries without binding to a tier.
alter table public.promo_entries
  alter column tier drop not null;

-- 2. Idempotency key. Scoped per-user so the same key value can
-- exist for different users (e.g. shared Paystack subscription
-- code if Paystack ever reuses one).
alter table public.promo_entries
  add column if not exists idempotency_key text;

create unique index if not exists idx_promo_entries_user_idem
  on public.promo_entries(user_id, idempotency_key)
  where idempotency_key is not null;
