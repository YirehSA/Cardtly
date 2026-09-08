-- Migration 074: an issued quote can be revised until it is signed
--
-- The original rule froze a quote the moment it was issued, on the grounds that
-- a signed quote must prove what was signed. That reasoning is right about
-- SIGNED and wrong about ISSUED. In practice most quotes come back with "can
-- you take line three out", and cancelling a numbered document to re-raise the
-- same work under a new number turns an ordinary negotiation into a paper
-- trail nobody can follow.
--
-- So the line moves to where it actually belongs:
--
--   draft, issued, sent   editable. The number and the accept link survive,
--                         and each edit bumps the revision.
--   accepted, declined    frozen. Somebody has made a decision against a
--                         specific version of this document.
--   cancelled             frozen. It is withdrawn.
--
-- The revision is what makes editing safe rather than merely allowed. A client
-- can be reading the accept page while the quote is being edited underneath
-- them; the accept form carries the revision it rendered, and the server
-- refuses a signature against a version that has moved on. Without that, the
-- worst case is somebody signing a document they never saw.

alter table public.quotes
  add column if not exists revision integer not null default 1;

comment on column public.quotes.revision is
  'Bumped on every edit after issue. The accept page posts back the revision it rendered, and a signature against a stale revision is refused - which is what stops a client signing a version they never read.';
