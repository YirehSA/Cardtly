# Cardtly Growth Promotions — End-to-End Test Plan

A practical, copy-paste-friendly checklist to walk through before the
promotion goes public. Every step has a clear "expected outcome" so
you (or anyone) can spot a regression instantly.

The plan is grouped into 4 phases:

1. **[Prerequisites](#1-prerequisites)** — environment checks before
   you start testing.
2. **[Functional flows](#2-functional-flows)** — every promotion
   pathway, end to end, with the data each step should produce.
3. **[Admin + draw verification](#3-admin--draw-verification)** — what
   the admin dashboard should show, and how to validate the draw.
4. **[Pre-launch sign-off](#4-pre-launch-sign-off)** — the final gates
   before you flip the switch publicly.

> **Test environment recommendation.** Run the full functional pass
> against a **staging or local dev** copy of the database first, then
> repeat the smoke tests in production with one or two real test
> accounts before sharing the `/promotions` URL anywhere public.
> Production has live Paystack now, so any test signup that upgrades
> will charge a real card and grant a real entry.

---

## 1. Prerequisites

Tick these off **once** at the start of the test session. If any fail,
stop and fix before running the functional flows — those steps assume
this section is clean.

### 1.1 Database migrations

- [ ] `supabase/migrations/001_promotions_phase1.sql` has been applied
- [ ] `supabase/migrations/002_founder_assignment.sql` has been applied
- [ ] `supabase/migrations/003_entry_idempotency.sql` has been applied

Verify by running this SQL in Supabase SQL Editor:

```sql
-- Should return four rows
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('referrals', 'promo_entries', 'promo_winners');

-- Should return three rows
select column_name from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in ('referral_code', 'is_founder', 'founder_number', 'founder_lifetime_pro');

-- Should return the founder_count view
select * from public.founder_count;
```

### 1.2 Environment variables

- [ ] `NEXT_PUBLIC_SUPABASE_URL` is set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set (server-side only, never exposed)
- [ ] `PAYSTACK_SECRET_KEY` is set (live key for prod, test key for staging)
- [ ] `NEXT_PUBLIC_APP_URL` is set to `https://cardtly.com` in prod
- [ ] `RESEND_API_KEY` is set (used by founder welcome / winner notification)

### 1.3 Routes resolve

Hit each of these in a browser, signed-out:

- [ ] `https://cardtly.com/promotions` — landing page renders, counter shows
- [ ] `https://cardtly.com/promotions/terms` — T&Cs render, yellow draft banner visible
- [ ] `https://cardtly.com/?ref=ABCDEF` — homepage loads (referral code captured silently to `localStorage`)
- [ ] `https://cardtly.com/admin/promotions` — redirects to `/dashboard` (you are signed-out so not admin)

### 1.4 Admin gate

- [ ] Sign in as the admin user (info@yireh.co.za, user id `6216ca40-72e5-47f2-af6a-a37d35f9d169`)
- [ ] Visit `https://cardtly.com/admin/promotions` — dashboard renders
- [ ] Sign in as any non-admin test account
- [ ] Visit `https://cardtly.com/admin/promotions` — redirected to `/dashboard`

### 1.5 Counter API works

- [ ] `curl https://cardtly.com/api/promotions/counter` returns
      `{"filled":N,"remaining":100-N,"total":100}` (signed-out is fine,
      it's a public endpoint)

---

## 2. Functional flows

Each flow is a complete user journey. Start each one with a fresh
incognito window unless the step says otherwise — referral codes are
stored in `localStorage` and you don't want carry-over.

### 2.1 Standard signup → founder slot grant

**Goal:** confirm a new user lands a founder slot, gets a referral
code, and gets the 3-month Pro grant automatically.

| # | Step | Expected outcome |
|---|---|---|
| 1 | Open incognito → `https://cardtly.com/signup` | Sign-up form loads |
| 2 | Create account with `tester+founder@yireh.co.za` | Redirected to dashboard |
| 3 | DB check: `select referral_code, is_founder, founder_number from public.profiles where user_id = '<new user id>'` | `referral_code` is 6 chars (no I/O/0/1), `is_founder` = true, `founder_number` is the next sequential integer |
| 4 | DB check: `select plan_id, status, metadata from public.whop_subscriptions where user_id = '<new user id>'` | One row, `plan_id = 'founder_3m'`, `status = 'active'`, `metadata.grant_type = 'founder'` |
| 5 | Visit `https://cardtly.com/promotions` | Counter `filled` count is now one higher than it was in 1.5 |
| 6 | Visit `https://cardtly.com/card/<the user's slug>` | Gold founder ribbon visible top-left, showing "Founder #N" |
| 7 | DB check: `select user_id, period_end from public.whop_subscriptions where user_id = '<new user id>'` | `period_end` is ~90 days from now |

### 2.2 Referred signup → referral pending

**Goal:** confirm `?ref=` capture works and the referrals row is
inserted in `pending` state.

| # | Step | Expected outcome |
|---|---|---|
| 1 | Pick a referrer code from step 2.1 (e.g. `XK4PQR`) | Record both the code and the referrer's user id for the assertions below |
| 2 | Open a **fresh** incognito → `https://cardtly.com/?ref=XK4PQR` | Homepage renders normally, no visible UI |
| 3 | Open DevTools → Application → Local Storage → check `cardtly_ref` | Value matches the code; expiry is ~30 days out |
| 4 | Click "Sign up" → register `tester+referred@yireh.co.za` | Redirected to dashboard |
| 5 | DB check: `select * from public.referrals where referred_user_id = '<new user id>'` | One row, `referrer_user_id` matches step 1, `status = 'pending'`, `became_paid_at` is NULL |
| 6 | DevTools → Local Storage → `cardtly_ref` | Cleared (signup wipes it) |
| 7 | Repeat steps 1-4 with the **same** referral code in a new incognito for a **second** referred user → DB check | A second row in `referrals`, same `referrer_user_id`, different `referred_user_id` |

### 2.3 Self-referral guard

**Goal:** confirm a user can't refer themselves.

| # | Step | Expected outcome |
|---|---|---|
| 1 | Sign in as the founder created in 2.1 | OK |
| 2 | Note their referral_code (e.g. `XK4PQR`) | OK |
| 3 | Sign out, then in a new incognito visit `https://cardtly.com/?ref=XK4PQR` | `cardtly_ref` set |
| 4 | Sign in (NOT sign up) as the same user `tester+founder@yireh.co.za` | Logged in |
| 5 | Manually POST to `/api/referrals/track` with `{ user_id: '<their id>', referral_code: 'XK4PQR' }` from DevTools fetch console | Response `{ error: 'Cannot refer yourself' }` or similar self-block. DB has no new referrals row. |

> Note: self-referral via signup is naturally blocked because the
> signup flow creates a new user with a different id, so this check is
> mainly for the bare API.

### 2.4 Paid upgrade → entries granted

**Goal:** confirm Paystack webhook grants a `paid` promo entry for the
upgrader and (if applicable) a `referral` entry for the referrer.

> **Use Paystack test mode** for this one if at all possible — the
> webhook hits the same code path, but you don't burn real cards.

| # | Step | Expected outcome |
|---|---|---|
| 1 | Sign in as `tester+referred@yireh.co.za` (the referred user from 2.2) | OK |
| 2 | Visit `/dashboard/upgrade` → start a Pro subscription via Paystack | Payment completes, redirect to `/upgrade/success` |
| 3 | DB check: `select plan_id, status from public.whop_subscriptions where user_id = '<their id>'` | `plan_id` starts with `paystack_`, `status = 'active'`. The `founder_3m` row from 2.1 is deleted (webhook does delete-then-insert) |
| 4 | DB check: `select source, idempotency_key from public.promo_entries where user_id = '<their id>'` | One row, `source = 'paid'`, `idempotency_key = 'paid:<paystack reference>'` |
| 5 | DB check: `select status, became_paid_at from public.referrals where referred_user_id = '<their id>'` | `status = 'paid'`, `became_paid_at` is just now |
| 6 | DB check: `select source, idempotency_key from public.promo_entries where user_id = '<referrer id>'` | One row, `source = 'referral'`, `idempotency_key = 'referral:<referral row id>'` |

### 2.5 Webhook idempotency

**Goal:** confirm a retried Paystack webhook can't double-grant.

| # | Step | Expected outcome |
|---|---|---|
| 1 | Paystack Dashboard → Webhooks → find the `charge.success` event from 2.4 | Found |
| 2 | Click "Resend" on the same event | Paystack reports 200 OK |
| 3 | DB check: `select count(*) from public.promo_entries where idempotency_key = 'paid:<the reference>'` | Still 1 (not 2) |
| 4 | DB check: `select count(*) from public.promo_entries where idempotency_key = 'referral:<the referral row id>'` | Still 1 (not 2) |
| 5 | DB check: `select count(*) from public.whop_subscriptions where user_id = '<their id>'` | Still 1 (delete-then-insert collapsed correctly) |

### 2.6 Entry cap (10 per user)

**Goal:** confirm a user can't accumulate more than 10 entries even
with many referrals.

> This needs setup. Easiest way: insert 10 fake entries manually,
> then try to add an 11th via API.

```sql
-- Setup: create 10 fake entries for tester+founder
insert into public.promo_entries (user_id, source, idempotency_key)
select '<founder user id>', 'referral', 'cap-test-' || generate_series(1, 10);
```

| # | Step | Expected outcome |
|---|---|---|
| 1 | Run the SQL above with the founder's user id | 10 rows inserted |
| 2 | `curl -X POST https://cardtly.com/api/promotions/grant-entry -H "Content-Type: application/json" -d '{"user_id":"<founder id>","source":"referral","idempotency_key":"cap-test-11"}'` | Returns `{"success":true,"granted":false,"reason":"cap_reached","count":10}` |
| 3 | DB check: `select count(*) from public.promo_entries where user_id = '<founder id>'` | Still 10 |
| 4 | Cleanup: `delete from public.promo_entries where idempotency_key like 'cap-test-%'` | 10 rows deleted |

### 2.7 Founder cap (101st signup gets nothing)

**Goal:** confirm signup #101 onwards is no longer a founder.

> Heavy setup. Best run on staging with a recently-cleaned DB so you
> can hit 100 founders quickly. If you can't, simulate by manually
> setting `is_founder = true` on 100 dummy profile rows.

```sql
-- One-shot way to fake the cap being reached
update public.profiles
   set is_founder = true,
       founder_number = row_number() over (order by created_at)
 where user_id in (select user_id from public.profiles limit 100);
```

| # | Step | Expected outcome |
|---|---|---|
| 1 | Confirm `select filled from public.founder_count` returns 100 | OK |
| 2 | Sign up a new user `tester+101@yireh.co.za` in incognito | OK |
| 3 | DB check: `select is_founder, founder_number from public.profiles where user_id = '<new id>'` | `is_founder = false`, `founder_number` is NULL |
| 4 | DB check: `select count(*) from public.whop_subscriptions where user_id = '<new id>'` | 0 (no founder_3m grant) |
| 5 | Visit `/card/<their slug>` | NO founder ribbon visible |
| 6 | Visit `/promotions` | Tier 1 panel shows "all 100 founder slots have been claimed", "Claim a founder slot" CTA hidden |

### 2.8 Subscription cancellation → status flip

**Goal:** confirm cancelling Pro flips `whop_subscriptions.status` to
`cancelled` but leaves entries intact (no clawback).

| # | Step | Expected outcome |
|---|---|---|
| 1 | Sign in to the user from 2.4 | OK |
| 2 | Trigger a Paystack `subscription.disabled` event (Dashboard → Customers → cancel, or use Paystack's webhook test sender) | OK |
| 3 | DB check: `select status from public.whop_subscriptions where user_id = '<their id>'` | `status = 'cancelled'` |
| 4 | DB check: `select count(*) from public.promo_entries where user_id = '<their id>'` | Unchanged from 2.4 (entries persist; CPA-compliant — they earned them while paid) |
| 5 | Future enhancement (NOT in scope yet): 30-day verification cron that flips `referrals.status` back to `cancelled` if a user paid then refunded within 30 days | NOT tested here |

### 2.9 T&Cs page

| # | Step | Expected outcome |
|---|---|---|
| 1 | Visit `https://cardtly.com/promotions/terms` | Renders |
| 2 | Yellow "DRAFT — PENDING LEGAL REVIEW" banner visible at top | Visible |
| 3 | Search the page for the string `[Insert` | Multiple matches — these are the placeholders the lawyer still needs to fill |
| 4 | All 20 numbered sections present (1. Promoter ... 20. Contact) | All present |
| 5 | `mailto:contest@cardtly.com` links work | Click opens mail client |
| 6 | Linked from `/promotions` footer ("Read the full T&Cs") | Click navigates |
| 7 | Linked from main site footer ("Promotion rules") | Click navigates |

### 2.10 Email-alt route (manual)

**Goal:** confirm the no-purchase free entry route works end to end.

This one is currently **manual** — there is no automated handler for
incoming emails to `contest@cardtly.com`. The CPA only requires that
the route exists and is honoured within a reasonable period.

| # | Step | Expected outcome |
|---|---|---|
| 1 | Send an email from a personal address to `contest@cardtly.com` with subject "Cardtly Promotion Entry" and the required fields per `/promotions/terms` clause 5.2 | Email arrives in the inbox monitored by you |
| 2 | Within 7 business days, send an acknowledgement reply | Acknowledgement sent |
| 3 | Manually create an entry via SQL: `insert into public.promo_entries (user_id, source, idempotency_key) values ('<their user id, if they have one>', 'email_alt', 'email_alt:<unique key>')` | One row inserted |
| 4 | If they don't yet have an account, create a profile row for them (or attach to a fresh signup using their email) | Their entry is counted in any draw they're eligible for |

> **TODO for v2:** automate this with a Resend inbound webhook so
> entries are recorded without manual intervention. Out of scope for
> Phase 1 launch.

---

## 3. Admin + draw verification

### 3.1 Dashboard data accuracy

Sign in as admin. Visit `/admin/promotions`.

| # | Tab | Expected vs DB |
|---|---|---|
| 1 | Overview | Stat card "Founders claimed" matches `select filled from public.founder_count`. "Total referrals" matches `select count(*) from public.referrals`. "Total entries" matches `select count(*) from public.promo_entries`. "Winners drawn" matches `select count(*) from public.promo_winners` |
| 2 | Founders | Row count matches `select count(*) from public.profiles where is_founder = true`. Founder numbers are sequential 1..N with no gaps |
| 3 | Referrals | Row count matches `select count(*) from public.referrals`. Pending/active/paid/cancelled counts in the pipeline card match the DB |
| 4 | Entries | Source counts sum to total. Top users leaderboard sorted desc by count. No user has a count > 10 |
| 5 | Winners | Empty initially (or matches `select count(*) from public.promo_winners`) |

### 3.2 Draw dry run

| # | Step | Expected outcome |
|---|---|---|
| 1 | At `/admin/promotions` → Winners tab | Draw form visible |
| 2 | Tier dropdown defaults to `tier1_founder_lifetime` | Prize text field auto-populates to "Cardtly Pro for life", count = 10 |
| 3 | Click "Dry run" | Result panel appears with N picks (up to 10), yellow PREVIEW chip visible |
| 4 | DB check: `select count(*) from public.promo_winners` | Unchanged (dry run does NOT write) |
| 5 | Repeat dry run 3 times | Pick set changes each time (random) |
| 6 | If entry pool is smaller than 10, "n_picked" returned matches pool size, not 10 | Correct |

### 3.3 Draw live (caution — writes to DB)

> Only do this against staging unless you really mean to record a
> winner publicly.

| # | Step | Expected outcome |
|---|---|---|
| 1 | Set winners=1 in the form | OK |
| 2 | Click "Record live draw" → confirm the prompt | API responds success, toast "1 winners recorded" |
| 3 | DB check: `select * from public.promo_winners where tier = 'tier1_founder_lifetime' order by drawn_at desc limit 1` | One new row with `prize`, `user_id`, `drawn_by = 'admin'` |
| 4 | Run another live draw for 1 winner, same tier | The previous winner is excluded — the second pick has a different user_id |
| 5 | Public verification: query `select user_id, prize, drawn_at from public.promo_winners` from a signed-out client | Works (RLS allows public read) |

### 3.4 Source-filtered draw

| # | Step | Expected outcome |
|---|---|---|
| 1 | In the draw form, set "Filter by source" to `Referral` | OK |
| 2 | Click Dry run | Result only contains users with at least one `referral` source entry |
| 3 | DB check: each picked user has at least one row in `promo_entries` with `source = 'referral'` | True |

### 3.5 Draw with empty pool

| # | Step | Expected outcome |
|---|---|---|
| 1 | Pick a tier with no eligible entries yet (e.g. tier3_5000 if you're nowhere near 5,000 paid) | OK |
| 2 | Click Dry run | API returns 400 `"No eligible entries yet"` and a toast |
| 3 | Nothing written | DB unchanged |

---

## 4. Pre-launch sign-off

The legal + business gates that must be cleared before sharing
`/promotions` publicly.

### 4.1 T&Cs finalised

- [ ] Lawyer has reviewed `/promotions/terms`
- [ ] All `[placeholders]` filled in (Promoter legal name, reg number,
      address, dates, ZAR prize values)
- [ ] Yellow DRAFT banner removed from the page
- [ ] `Last updated:` date set
- [ ] Final HTML saved as a PDF copy and filed alongside the
      promotion records (for the 3-year retention obligation)

### 4.2 Independent verifier (if required)

- [ ] Lawyer confirmed whether the website prize (R~25k retail) needs
      an independent person to oversee the draw under CPA Regulation
      11(4). If yes:
  - [ ] Verifier identified and appointed in writing
  - [ ] Verifier briefed on the draw method (server-side random,
        recorded in `promo_winners`)
  - [ ] A protocol agreed for them to witness or audit the draw

### 4.3 Records ready

- [ ] You can produce, on demand, a list of every entry at the time of
      a draw, the random selection method, and the resulting winner.
- [ ] You know where backups of the `promo_entries` and
      `promo_winners` tables live and how to export them.

### 4.4 NCC posture

- [ ] Lawyer confirmed whether rules need to be lodged with the NCC
      (probably not for this scope — see decision note from
      2026-05-27 conversation, but get it in writing from the lawyer)
- [ ] If lodging is recommended, lodging is done before launch

### 4.5 Operational

- [ ] `contest@cardtly.com` is monitored daily — you (or someone you
      trust) will respond to email-alt entries within 7 business days
- [ ] Paystack is on **live** keys in production and the webhook URL
      `https://cardtly.com/api/webhooks/paystack` is verified active
- [ ] Resend domain `cardtly.com` is verified, winner notification
      email template is drafted
- [ ] Marketing rollout is ready (social posts written + scheduled,
      email blast queued)

### 4.6 Rollback safety net

If something goes wrong publicly and you need to disable the promo
quickly:

- [ ] **Soft disable:** edit `app/promotions/page.tsx` to render a
      "promotion paused" message instead of `PromotionsClient`. Deploy.
      The grant-founder + entry hooks still run for existing signups,
      so you don't lose anyone in-flight.
- [ ] **Hard disable (data preserved):** comment out the trigger and
      webhook hooks. New signups stop getting founder slots, but
      existing founders keep their prizes.
- [ ] **Database safety:** before any pre-launch destructive ops, run
      `git tag working-state-YYYY-MM-DD-pre-promo-launch` and snapshot
      the Supabase DB.

### 4.7 Post-launch monitoring

After launch, check these for at least the first 2 weeks:

- [ ] **Daily:** `/admin/promotions` Overview tab — founders claimed,
      total entries, total referrals trending up
- [ ] **Daily:** Supabase logs — no webhook errors, no `grant-entry`
      failures
- [ ] **Daily:** Resend logs — no spike in bounces from welcome /
      founder confirmation emails
- [ ] **Weekly:** Spot check 5 random entries against their source —
      do they tie back to a real Paystack reference or a real referral?
- [ ] **Weekly:** Cap reached count — how many users are at 10
      entries? If lots, consider whether the cap is too low or whether
      the fraud filter is working

---

## Reference: useful SQL snippets

Drop these into Supabase SQL Editor for quick spot checks.

```sql
-- Live counter
select * from public.founder_count;

-- All founders, newest first
select p.founder_number, u.email, p.referral_code,
       p.founder_lifetime_pro, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.user_id
 where p.is_founder = true
 order by p.founder_number;

-- Referral pipeline
select status, count(*) from public.referrals group by status;

-- Entries by source
select source, count(*) from public.promo_entries group by source order by 2 desc;

-- Top entrants
select u.email, count(e.*) as entries
  from public.promo_entries e
  join auth.users u on u.id = e.user_id
 group by u.email
 order by entries desc
 limit 20;

-- All winners
select w.tier, w.prize, u.email, w.drawn_at, w.drawn_by
  from public.promo_winners w
  join auth.users u on u.id = w.user_id
 order by w.drawn_at desc;

-- Active paid pro users (for tier 3 + 4 progress)
select count(*)
  from public.whop_subscriptions
 where status = 'active'
   and subscription_tier = 'pro'
   and plan_id like 'paystack_%';
```

---

## Glossary

| Term | Means |
|---|---|
| Founder slot | One of the first 100 signups, auto-granted 3 months Pro |
| Lifetime founder | 10 of the 100 founders drawn for Pro-for-life |
| `?ref=XXXXXX` | URL param captured to `localStorage` for 30 days |
| Entry | One row in `promo_entries`. Caps at 10 per user. |
| Idempotency key | A string that makes a retry safe — same key = same row |
| Tier | Milestone-keyed prize bucket: tier1_founder_lifetime, tier1_founder_3m, tier2_website_full, tier3_1000/2500/5000, tier4_10000 |
| Dry run | Draw API mode that returns picks without writing — always use first |

---

_Maintained alongside `supabase/migrations/001_promotions_phase1.sql`,
`002_founder_assignment.sql`, `003_entry_idempotency.sql`. If the
schema or flow changes, update this file in the same commit._
