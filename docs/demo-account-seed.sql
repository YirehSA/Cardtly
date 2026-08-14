-- Fill the App Review demo account with something worth recording.
--
-- NOT a migration. Data only, run by hand in the Supabase SQL editor, safe to
-- run more than once.
--
-- Why: App Review asks for "the typical user flow through its core features".
-- demo@cardtly.com had no job title, zero views and zero captured contacts, so
-- Contacts and Analytics were both empty screens. A reviewer opening an empty
-- app concludes the app does not work, and Apple's own guidance calls out
-- demos that do not show the app in use.
--
-- It also pushes the demo trial out to 2027, because demo@cardtly.com was on
-- the 15 September expiry batch. If review slips past that date the card goes
-- dark mid-review.
--
-- applereview@cardtly.com is deliberately NOT touched. It has to stay expired
-- so the reviewer can confirm the app never offers a way to pay.

-- 1. The trial cannot lapse during review.
update profiles p
set trial_ends_at = timestamptz '2027-06-30 00:00:00+00'
from auth.users u
where u.id = p.user_id
  and u.email = 'demo@cardtly.com';

-- 2. A card with an empty job title does not look finished.
update cards
set job_title = coalesce(nullif(job_title, ''), 'Sales Director')
where slug = 'demo';

-- 3. Clear any previous run of this script, and nothing else. Seeded rows are
--    tagged so real data can never be caught by this.
delete from contacts
where source = 'demo_seed'
  and card_id = (select id from cards where slug = 'demo');

delete from card_events
where referrer = 'demo_seed'
  and card_id = (select id from cards where slug = 'demo');

-- 4. Captured leads, so the Contacts screen has people in it.
insert into contacts (card_id, name, email, phone, company, title, message, source, created_at)
select c.id, v.name, v.email, v.phone, v.company, v.title, v.message, 'demo_seed',
       now() - make_interval(days => v.days, hours => v.hrs)
from cards c,
(values
  ('Naledi Mokoena',  'naledi@example.co.za',  '+27 82 114 7723', 'Mokoena Attorneys',   'Managing Partner',   'Good to meet you at the expo.',           1,  3),
  ('Pieter van Wyk',  'pieter@example.co.za',  '+27 83 447 1290', 'Van Wyk Logistics',   'Operations Manager', 'Please send the team pricing.',           3,  7),
  ('Aisha Patel',     'aisha@example.co.za',   '+27 71 902 3318', 'Patel Interiors',     'Director',           'Loved the card, how do I get one?',       6, 11),
  ('Sipho Dlamini',   'sipho@example.co.za',   '+27 84 220 5567', 'Dlamini Construction','Site Foreman',       null,                                      9,  2),
  ('Elmarie Botha',   'elmarie@example.co.za', '+27 82 771 4408', 'Botha Accounting',    'Senior Accountant',  'Following up on our call.',              14,  5),
  ('Johan Steyn',     'johan@example.co.za',   '+27 76 335 9912', 'Steyn Motors',        'Dealer Principal',   null,                                     21,  9),
  ('Thandi Nkosi',    'thandi@example.co.za',  '+27 79 618 2245', 'Nkosi Consulting',    'Founder',            'Can we set up a meeting next week?',     27,  4)
) as v(name, email, phone, company, title, message, days, hrs)
where c.slug = 'demo';

-- 5. Views across the last 30 days, so Analytics has a curve rather than a
--    flat zero. 240 of them, spread over days and hours.
insert into card_events (card_id, event_type, link_title, device, browser, os, referrer, created_at)
select c.id, 'view', null,
       (array['mobile','mobile','desktop','mobile','tablet'])[1 + (g % 5)],
       (array['Safari','Chrome','Safari','Edge'])[1 + (g % 4)],
       (array['iOS','Windows','Android','macOS'])[1 + (g % 4)],
       'demo_seed',
       now() - make_interval(days => (g % 30), hours => (g % 13), mins => (g % 47))
from cards c, generate_series(1, 240) g
where c.slug = 'demo';

-- 6. Taps on the card's links, so the "what did people actually do" panel is
--    populated too.
insert into card_events (card_id, event_type, link_title, device, browser, os, referrer, created_at)
select c.id, 'link_click',
       (array['WhatsApp','LinkedIn','Website','Email','Call'])[1 + (g % 5)],
       (array['mobile','mobile','desktop','tablet'])[1 + (g % 4)],
       (array['Safari','Chrome','Safari','Edge'])[1 + (g % 4)],
       (array['iOS','Windows','Android','macOS'])[1 + (g % 4)],
       'demo_seed',
       now() - make_interval(days => (g % 28), hours => (g % 17))
from cards c, generate_series(1, 64) g
where c.slug = 'demo';

-- 7. Saves and QR scans, the two that prove the card was actually used.
insert into card_events (card_id, event_type, link_title, device, browser, os, referrer, created_at)
select c.id,
       (array['contact_save','qr_scan','share'])[1 + (g % 3)],
       null,
       'mobile',
       (array['Safari','Chrome'])[1 + (g % 2)],
       (array['iOS','Android'])[1 + (g % 2)],
       'demo_seed',
       now() - make_interval(days => (g % 26), hours => (g % 19))
from cards c, generate_series(1, 36) g
where c.slug = 'demo';

-- 8. The headline number has to agree with the events behind it.
update cards
set view_count = (
  select count(*) from card_events e
  where e.card_id = cards.id and e.event_type = 'view'
)
where slug = 'demo';

-- Check it landed.
select c.slug,
       c.job_title,
       c.view_count,
       (select count(*) from contacts    x where x.card_id = c.id) as contacts,
       (select count(*) from card_events e where e.card_id = c.id) as events,
       (select p.trial_ends_at from profiles p where p.user_id = c.user_id) as trial_ends
from cards c
where c.slug = 'demo';
