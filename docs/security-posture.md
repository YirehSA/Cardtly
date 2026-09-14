# Cardtly: security and POPIA, in answer form

Written 2026-09-14 for the Wednesday meeting. Every number here was measured
against production on that date, read only, not estimated. If you are asked
something that is not in here, say you will check rather than guess: this
document is worth more if nothing in it turns out to be wrong.

**One thing to confirm before you walk in.** See "The one open question" at the
bottom. It takes two minutes in the Supabase dashboard and it is the single
question most likely to be asked by anyone who has done this before.

---

## The short version, if you only get one minute

Cardtly stores customer data in Postgres behind row-level security, which means
the database itself refuses to hand out a row to anyone who is not entitled to
it, rather than relying on the application to remember to ask. The public
business card is public, because that is the product. Everything behind it,
the leads captured from that card, the account, the billing, is not.

We do not store card numbers. We never see them: Paystack does.

A customer can download everything we hold on them, and delete their account
and all of it, without emailing anyone and without our help.

---

## The questions you will actually get

### "Who can see the leads our staff capture?"

Only the account that captured them. Measured today: 48 contact records exist,
and an anonymous request to the database returns 0 of them. The same request
returns 0 profiles out of 76, 0 organisations out of 8, and 0 subscriptions out
of 20.

This is worth stating precisely, because "it's secure" means nothing in a room
like this. The mechanism is row-level security: the rule lives in the database,
not in the website. Even if a page had a bug and asked for every contact in the
system, Postgres would return an empty set.

### "Is our card itself public?"

Yes, and deliberately. A business card that needs a login is not a business
card. Anyone with the link sees the name, title, company, phone, email and
whatever links the owner put on it, exactly as if they had been handed a
printed one.

Be straight about the consequence: a card's contents are as public as its link.
Anything a staff member would not print on a physical card should not go on a
Cardtly one. What is *not* public is who scanned it, who saved it, and what
happened next.

### "What if one of our people leaves?"

The card belongs to the organisation, not the person. An admin can reassign or
remove it, and the link keeps working or stops working as you choose. The
leads that card captured stay with the organisation.

### "Do you store our credit card details?"

No, and we could not produce them if asked. Payments go through Paystack, a
South African payment provider, and the card details are entered on their
infrastructure. What we hold is a token: a reference that lets us charge the
agreed subscription and nothing else. Those tokens are stripped out of any data
export.

### "Is it encrypted?"

In transit, yes: the site is HTTPS only and refuses plain HTTP, enforced by a
strict-transport header so a browser will not even attempt an insecure
connection after the first visit.

At rest, the database and backups are encrypted by the platform (Supabase, on
AWS). Say that as a platform property, because that is what it is. We did not
implement it and we cannot demonstrate it in a meeting.

### "What happens if you are breached?"

POPIA section 22 requires notification to the Information Regulator and to
affected data subjects as soon as reasonably possible. The honest answer is
that this is a documented process and a small team, not an automated pipeline
with a 24-hour SLA. Do not overclaim it. What you *can* point at concretely:

- Administrative actions are written to an audit log (42 entries today).
- As of this week, every change to a subscription is logged with who did it,
  from where, and the before and after state.

That second one exists because of a real incident. On 2026-09-14 a subscription
row was deleted by accident during maintenance and nothing anywhere recorded
it. Working out whose it was took an afternoon. It was restored the same day.
If it comes up, that is a better story told plainly than discovered later: the
gap was found, closed, and the logging that would have made it a one-minute
question is now in place.

### "Can we get our data out? Can we delete it?"

Both, self-service, no email and no waiting:

- **Export.** One JSON file containing everything held about the account:
  profile, cards, organisations, orders, subscriptions, bookings. Tokens and
  session credentials are redacted, because those are dangerous in a file people
  forward around and are not personal information in any useful sense.
- **Delete.** Removes the account and cascades through contacts, cards, teams,
  organisations, orders and subscriptions, then deletes the login itself.

The export deliberately mirrors the deletion cascade, so the two can be read
side by side and checked against each other. If they ever disagree, one of them
is wrong about what an account contains.

POPIA sections 23 to 25 are the data subject access and deletion rights. This
is what satisfying them looks like in practice.

### "Who at Cardtly can see our data?"

Support access is through an admin interface, and admin actions are logged.
Being honest about scale helps here rather than hurts: Cardtly is a small South
African company, not a multinational with an offshore support floor. Fewer
people have access than at a larger vendor, and the ones who do are named.

### "What are your sub-processors?"

Named in the published privacy policy, not just internally: Supabase (database
and authentication), Vercel (hosting), Paystack (payments), Resend (email),
Google (sign-in). The policy also states retention periods, a 30-day deletion
window, a 90-day backup window, and points to the Information Regulator at
inforegulator.org.za for complaints.

A policy that names its sub-processors is a reasonable thing to be asked to
show. Offer it before they ask.

---

## The evidence, if someone technical is in the room

Measured 2026-09-14 with the public key that ships in the website's own
JavaScript, which is the exact position an attacker starts from:

| Table | Rows that exist | Rows a stranger can read |
|---|---|---|
| profiles | 76 | 0 |
| contacts (captured leads) | 48 | 0 |
| organizations | 8 | 0 |
| subscriptions | 20 | 0 |
| admin audit log | 42 | 0 |
| rep activity | 94 | 0 |
| trial emails | 56 | 0 |
| cards | 46 | 44 (public by design) |
| team cards | 37 | 37 (public by design) |

The left column matters as much as the right one. Zero readable rows out of
zero rows proves nothing; zero out of 76 is the claim.

Also shipped this week: a full set of browser security headers. The site cannot
be framed inside someone else's page, file types cannot be reinterpreted as
code, and the address of the card being viewed no longer leaks to every site
that card links to.

---

## What is still open, said out loud

Volunteering these is what makes the rest credible. A vendor with no gaps is a
vendor who has not looked.

1. **No two-factor authentication on login.** Email and password, or Google, or
   Microsoft sign-in. If they use Microsoft 365, their own tenant enforces MFA
   on that path, which is a genuinely good answer and worth offering.
2. **A content security policy is deployed but not yet enforcing.** It is in
   report-only mode by design, collecting evidence on real traffic before being
   switched on, because a wrong one takes the site down.
3. **Cards can be listed in bulk.** Each card is public by design, but the whole
   set can be requested at once rather than one link at a time. That is a
   decision to make deliberately rather than an accident, and it is worth
   deciding before someone else raises it.
4. **No application-level rate limiting** on our own endpoints. Sign-in attempts
   are rate limited by the authentication platform; our own API routes are not.

Fixed on 2026-09-14, in the course of preparing this document: the subscription
table and the physical card order table were both readable by the public key.
The order table included shipping addresses. Both are now closed and verified
closed. This is mentioned here because the same review that produced the
reassuring table above produced these, and a security summary that only reports
the good half is not a security summary.

---

## Cross-border transfer, answered

**The database runs in Supabase's West Europe region. Personal information is
processed in the European Union, not in South Africa.** Confirmed in the
dashboard on 2026-09-14.

POPIA section 72 permits this where the recipient is subject to a law providing
an adequate level of protection substantially similar to POPIA's own conditions.
The EU is the jurisdiction that standard is usually measured against, and GDPR
is at least as strict as POPIA rather than weaker. Section 72 also permits
transfer where it is necessary to perform the contract with the data subject,
which independently covers running the service they signed up for.

The published privacy policy already discloses this, in section 5,
"International transfers". It names the United States and the European Union,
states that information may be processed outside South Africa, and says
standard contractual clauses are relied on. That disclosure is what POPIA
section 18 requires, so the obligation is met rather than outstanding.

**Say it plainly and without apology.** "In the EU, under GDPR" is a stronger
answer than most local hosting arrangements. Hesitating over it is what makes it
sound like a problem.

The only version of this that needs care is a hard data-residency requirement,
which occasionally appears in public-sector tender conditions. That is a
separate conversation and a database migration, not a setting, so it should be
taken away and answered rather than committed to in the room.
