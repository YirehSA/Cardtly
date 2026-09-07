-- Migration 070: a quote can be issued without having been sent
--
-- 064 gave quotes the statuses draft, sent, accepted, declined, expired and
-- cancelled. Invoices got draft AND issued as separate things, and quotes need
-- the same distinction for the same reason: issuing is what allocates the
-- number and freezes the document, and emailing it is a different act that
-- might happen minutes later, or never, because it was printed and handed over
-- in a meeting instead.
--
-- Without this, issuing a quote had to record it as 'sent', so the screen would
-- say a quote had gone to a client when nobody had sent it anything. A status
-- that lies is worse than a status that is missing.

alter table public.quotes drop constraint if exists quotes_status_check;
alter table public.quotes
  add constraint quotes_status_check
  check (status in ('draft','issued','sent','accepted','declined','expired','cancelled'));

-- The client-facing link. Unguessable, and the only way in to the accept page.
create index if not exists quotes_public_token_idx on public.quotes(public_token)
  where public_token is not null;

comment on column public.quotes.status is
  'draft (no number, editable) -> issued (numbered and frozen) -> sent (emailed) -> accepted or declined. A quote past valid_until is shown as expired without the row being rewritten, so no cron is needed to keep it honest.';
comment on column public.quotes.public_token is
  'The unguessable path segment for /quote/<token>. Present from issue, because a quote can be handed over as a link without being emailed.';
