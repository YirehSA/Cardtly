-- A company under a group can refuse the group's look.
--
-- Migration 053 gave us the tree: a group (the organisation) with companies
-- under it, departments under those. The brand cascades down that chain, each
-- level overriding only the fields it sets.
--
-- That covers "mostly the same, with a different logo". It does not cover the
-- case the tree was built for: The Building Company owns seven businesses that
-- share nothing visually. Under the cascade, a company that sets a logo and a
-- colour still inherits the group's website, socials and address for every
-- field it did not think to override. There was no way to say "this company is
-- its own thing".
--
-- inherit_brand is that switch. Off, the cascade restarts at this node: the
-- company's own brand is the whole brand, and nothing above it applies. Its
-- departments still inherit from IT, because the chain below the break is
-- untouched.
--
-- inherit_brand_locked is who gets to decide. The group owner sets it, and
-- while it is on, the company's own head cannot change the switch. Off, which
-- is the default, the head runs their own look.
--
-- OPT-IN, like 053: every existing row defaults to inheriting, which is
-- exactly what happens today, so no live card changes appearance.

alter table public.departments
  add column if not exists inherit_brand boolean not null default true,
  add column if not exists inherit_brand_locked boolean not null default false;

comment on column public.departments.inherit_brand is
  'Does this node take the brand from its parent chain? Off restarts the cascade here. See lib/department-tree.ts resolveBrandChain.';

comment on column public.departments.inherit_brand_locked is
  'Set by the group owner. While on, only an org owner may change inherit_brand on this node.';

-- Field locks are deliberately NOT affected by inherit_brand.
--
-- Opting out of the group's look says which brand a company wears. It does not
-- say who may edit it. A group that locked the logo still means nobody edits
-- the logo, whichever logo the company ended up with, so lockedColumnsFor
-- keeps accumulating down the whole chain regardless of this switch.
