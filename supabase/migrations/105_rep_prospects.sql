-- 105: reseller prospects, replacing the rep's Excel workbooks (lib/prospects).
--
-- One row per contact a rep is working towards becoming a reseller. The email
-- address is unique across the whole table, not per rep, because two reps
-- writing to the same director is what this list exists to prevent. Which is
-- also why do_not_contact is a status on a row that stays: it is what stops the
-- address being approached again when it turns up on the next list.
--
-- Only the server reads or writes these: the rep's own page and the admin panel
-- both go through /api/prospects with the service role, scoped by rep there.

create table if not exists public.rep_prospects (
  id uuid primary key default gen_random_uuid(),
  -- Set null, not cascade: a rep leaving must not delete the company's prospects
  -- or its do-not-contact record.
  rep_id uuid references public.reps(id) on delete set null,

  company text not null,
  contact_name text,
  first_name text,
  role text,
  email text,
  email_type text,
  phone text,
  phone_type text,
  sector text,
  region text,

  priority text not null default 'medium'
    check (priority in ('high', 'medium', 'low', 'review', 'backup')),
  -- A second person at a company already on the list.
  is_alternate boolean not null default false,
  -- Which lists this contact came from. A contact can be on several.
  lists text[] not null default '{}',

  fit text,
  research_notes text,
  source_url text,
  source_url_2 text,
  source_confidence text,

  status text not null default 'not_contacted'
    check (status in (
      'not_contacted', 'email_sent', 'called_no_answer', 'replied', 'interested', 'follow_up',
      'meeting_booked', 'signed', 'not_interested', 'bounced', 'do_not_contact'
    )),
  last_channel text check (last_channel in ('email', 'call')),
  emailed_on date,
  last_contact_on date,
  follow_up_on date,
  follow_up_note text,
  notes text,

  -- The Activity log rows the last status change wrote, and when, so correcting
  -- a slip within a few minutes replaces them instead of counting twice.
  last_log jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists rep_prospects_email_key
  on public.rep_prospects (lower(email)) where email is not null;
create index if not exists rep_prospects_rep_idx on public.rep_prospects (rep_id, status);
create index if not exists rep_prospects_follow_up_idx on public.rep_prospects (follow_up_on) where follow_up_on is not null;

alter table public.rep_prospects enable row level security;

grant select, insert, update, delete on public.rep_prospects to service_role;

-- The call script and email template, one shared copy. It lives here rather than
-- in the code because it is the rep's to change, and this repository is public.
create table if not exists public.rep_playbook (
  id boolean primary key default true check (id),
  script text,
  email_subject text,
  email_body text,
  updated_at timestamptz not null default now()
);

alter table public.rep_playbook enable row level security;

grant select, insert, update, delete on public.rep_playbook to service_role;
