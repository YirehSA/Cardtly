-- Reporting a card, and blocking one.
--
-- The Network is a directory where a signed-in member browses other people's
-- cards, which makes it user-generated content. App Store Guideline 1.2
-- expects three things of an app carrying that: a way to report objectionable
-- content, a way to block an abusive user, and evidence that reports are
-- acted on rather than collected. This is the first two; the queue in /admin
-- is the third.
--
-- Nothing here is Apple-specific. A directory of real people with no way to
-- say "this one is a problem" is a gap whether or not anybody reviews the app.

create table if not exists card_reports (
  id                uuid primary key default gen_random_uuid(),
  -- Null for a report made from a public card by somebody not signed in.
  -- Anonymous reports are worth having: the person best placed to notice an
  -- impersonation is usually the one being impersonated, and they may not be
  -- a customer.
  reporter_user_id  uuid,
  -- Exactly one of these, matching whichever table the card lives in.
  card_id           uuid references cards(id) on delete set null,
  team_card_id      uuid references team_cards(id) on delete set null,
  -- Snapshot, so a report still says what it was about after the card is
  -- deleted - which is exactly what happens when the report is upheld.
  card_slug         text not null,
  card_name         text,
  reason            text not null,
  detail            text,
  status            text not null default 'open',
  resolved_at       timestamptz,
  resolved_by       uuid,
  resolution_note   text,
  created_at        timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'card_reports_status_check') then
    alter table card_reports add constraint card_reports_status_check
      check (status in ('open', 'actioned', 'dismissed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'card_reports_reason_check') then
    alter table card_reports add constraint card_reports_reason_check
      check (reason in ('impersonation', 'offensive', 'spam', 'not_a_person', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'card_reports_target_check') then
    -- A report about neither card, or about both, is a report about nothing.
    alter table card_reports add constraint card_reports_target_check
      check ((card_id is not null) <> (team_card_id is not null));
  end if;
end $$;

-- The queue is read by status and worked oldest first.
create index if not exists card_reports_open_idx
  on card_reports (status, created_at)
  where status = 'open';

-- Blocking. Personal to the person who blocked: it hides the card from their
-- Network and nobody else's, and it is not a moderation decision. Taking a
-- card down for everyone is the admin's call, on a report.
create table if not exists network_blocks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  card_id      uuid references cards(id) on delete cascade,
  team_card_id uuid references team_cards(id) on delete cascade,
  created_at   timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'network_blocks_target_check') then
    alter table network_blocks add constraint network_blocks_target_check
      check ((card_id is not null) <> (team_card_id is not null));
  end if;
end $$;

-- Blocking the same card twice is the same block, not two. Partial indexes
-- because one of the two columns is always null and NULLs do not collide.
create unique index if not exists network_blocks_user_card_key
  on network_blocks (user_id, card_id) where card_id is not null;
create unique index if not exists network_blocks_user_team_card_key
  on network_blocks (user_id, team_card_id) where team_card_id is not null;

create index if not exists network_blocks_user_idx on network_blocks (user_id);

comment on table card_reports is
  'Reports about a card in the Network. Worked from the Reports tab in /admin; status open, actioned or dismissed.';
comment on table network_blocks is
  'One person choosing not to see another in the Network. Personal, immediate, and not a moderation decision.';
