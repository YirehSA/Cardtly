-- Groups of companies: The Building Company with seven businesses under it,
-- each with its own departments.
--
-- Departments were flat, which gave two levels of grouping (organisation, then
-- department) where a group needs three or more. Rather than a second kind of
-- organisation, a department can now have a parent, so the tree is as deep as
-- the customer's structure and billing stays exactly where it was: one
-- organisation, one seat pool, one invoice.
--
-- OPT-IN. A department with no parent and no slug_segment behaves precisely as
-- it did before, so every organisation on the platform today is unaffected and
-- no live card URL moves.

alter table departments
  add column if not exists parent_id uuid references departments(id) on delete set null,
  -- 'company' marks a business unit that owns a slice of the URL space and can
  -- be walled off from its siblings. 'department' is an ordinary grouping.
  add column if not exists kind text not null default 'department',
  -- The company's segment in /card/<segment>/<person>.
  add column if not exists slug_segment text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'departments_kind_check') then
    alter table departments add constraint departments_kind_check
      check (kind in ('company', 'department'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'departments_no_self_parent') then
    alter table departments add constraint departments_no_self_parent
      check (parent_id is null or parent_id <> id);
  end if;
end $$;

-- GLOBALLY unique, not per organisation.
--
-- The segment is the first path element of a public card URL, so it is shared
-- across every customer on the platform. Two organisations both naming a
-- company "sales" would make /card/sales/john-smith ambiguous, and the card
-- that resolved would depend on query order.
create unique index if not exists departments_slug_segment_key
  on departments (lower(slug_segment))
  where slug_segment is not null;

create index if not exists departments_parent_id_idx on departments (parent_id);

-- A parent in another organisation would let a manager of one customer's
-- department reach another customer's cards through the tree walk. Checked in
-- a trigger because a foreign key cannot compare a second column across rows.
create or replace function departments_check_parent() returns trigger as $$
declare
  parent_org uuid;
  cursor_id  uuid;
  depth      int := 0;
begin
  if new.parent_id is null then
    return new;
  end if;

  select organization_id into parent_org from departments where id = new.parent_id;
  if parent_org is null then
    raise exception 'Parent department % does not exist', new.parent_id;
  end if;
  if parent_org <> new.organization_id then
    raise exception 'A department cannot sit under a department in another organisation';
  end if;

  -- Walk up from the proposed parent. Meeting this row again means the edge
  -- would close a loop, and a loop makes every tree walk in the application
  -- run until it is killed.
  cursor_id := new.parent_id;
  while cursor_id is not null loop
    if cursor_id = new.id then
      raise exception 'That would put a department inside itself';
    end if;
    depth := depth + 1;
    if depth > 20 then
      raise exception 'Department nesting is limited to 20 levels';
    end if;
    select parent_id into cursor_id from departments where id = cursor_id;
  end loop;

  return new;
end $$ language plpgsql;

drop trigger if exists departments_check_parent_trg on departments;
create trigger departments_check_parent_trg
  before insert or update of parent_id, organization_id on departments
  for each row execute function departments_check_parent();

comment on column departments.parent_id is
  'Parent department. NULL is a top-level unit. Cycles and cross-organisation parents are rejected by departments_check_parent().';
comment on column departments.kind is
  'company = a business unit with its own URL segment and its own managers; department = an ordinary grouping inside one.';
comment on column departments.slug_segment is
  'First path element of /card/<segment>/<person>. Globally unique because the URL space is shared across all customers. Treat as permanent once cards are printed.';
