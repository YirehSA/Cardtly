# Cardtly security: one page, on hand

For the Wednesday meeting. Short answers you can say out loud. Detail is in
security-posture.md if someone pushes.

---

**"Where is our data stored?"**
Postgres on Supabase in their West Europe region, hosting on Vercel. Payments
through Paystack, a South African provider.

**"So our data leaves South Africa?"**
Yes, it is processed in the EU, and our privacy policy says so rather than
burying it. POPIA s72 permits this where the receiving jurisdiction gives
adequate protection, and the EU is the benchmark adequacy is measured against.
GDPR is at least as strict as POPIA. The transfer is also needed to run the
service they signed up for, which s72 permits separately.
*(Say this plainly. Hesitating makes it sound like a problem when it is not.
Do NOT say "standard contractual clauses": nothing on file shows we have them,
and the published policy no longer claims them.)*

**"We need data to stay in South Africa."**
Separate conversation, and come back with an answer rather than committing in
the room. It means moving the database region, which is a migration and not a
setting. Most private-sector buyers never raise this; it comes from
public-sector tender conditions.

**"Who can see the leads our staff capture?"**
Only your account. The database itself refuses the row to anyone else, so even
a bug in the website cannot leak them. 48 lead records exist today and a
stranger can read zero of them.

**"Is our card public?"**
Yes, on purpose, that is the product. Anyone with the link sees what is on the
card, exactly like a printed one. Who scanned it and what happened next is not
public.

**"So what should we not put on a card?"**
Anything you would not print on a physical one.

**"What if an employee leaves?"**
The card belongs to the organisation, not the person. An admin reassigns or
removes it, and the leads that card captured stay with you.

**"Do you store our credit card details?"**
No. We never see them. Paystack handles the card, we hold a token that can only
charge the agreed subscription.

**"Is it encrypted?"**
HTTPS only in transit, enforced, the browser will not even try an insecure
connection. Encrypted at rest by the platform, including backups.

**"Can we get our data out?"**
Yes, self-service. One file with everything we hold, downloaded by you, no email
and no waiting.

**"Can we delete everything?"**
Yes, self-service. Deletes the account and cascades through leads, cards, teams,
orders and billing, then the login itself.

**"What about POPIA?"**
Access and deletion rights are built in and self-service (s23 to s25). The
privacy policy names every sub-processor, the retention periods and the
Information Regulator. Breach notification under s22 is a documented process.

**"Who are your sub-processors?"**
Supabase (database, sign-in, files), Vercel (hosting), Paystack (payments),
Resend (email), OpenAI (the AI bio writer and paper card scanning), ipapi.co
(signup location), Google (Wallet passes, and Firebase Analytics in the Android
app) and Apple (App Store). All named, with what each receives, in section 7 of
the published privacy policy, which we can send you.
*(Volunteer OpenAI before they find it. Card scanning sends the PHOTO of a paper
business card, which is someone else's details, so never say "nobody else's
data" or "only the bio writer". No stored lead or contact is ever sent.)*

**"Who at Cardtly can see our data?"**
A small named team, through an admin interface, and admin actions are logged.
Fewer people than at a large vendor with an offshore support floor.

**"What happens if you are breached?"**
Notification to the Information Regulator and to you as soon as reasonably
possible, per POPIA s22. Administrative actions and every billing change are
logged, so we can tell you what was touched and when.

---

## If they ask something sharper

**"Prove it."**
Measured against production, using the same public key any visitor's browser
has. Rows that exist, versus rows a stranger can read:
profiles 76 / 0. Leads 48 / 0. Organisations 8 / 0. Billing 20 / 0.
Admin log 42 / 0. Rep activity 94 / 0.
The left number matters: zero out of zero proves nothing.

**"Do you have MFA?"**
Not our own. If you use Microsoft 365, your staff sign in with their Microsoft
work account, and your own tenant enforces your MFA and conditional access on
that sign-in. That is the better answer anyway.
*(Sign-in options, checked in a real browser on 2026-09-23: email and password,
an emailed one-time sign-in link, or Sign in with Microsoft. There is NO Google
sign-in - never offer it. The Microsoft button uses Microsoft's multi-organisation
endpoint, so any company's work accounts can reach it; before a customer relies
on it in writing, have them try one of their own accounts.)*

**"Have you had an incident?"**
Yes, one, and it was ours not an attacker's: a billing row was deleted during
maintenance and restored the same day. It is why every billing change is now
logged with who, when, and the before and after.

---

## What not to overclaim

- **Any certification.** No ISO 27001, no SOC 2. Say so plainly if asked. Small
  SA company, not a certified multinational, and the controls above are real
  regardless.
- **Penetration testing.** Not independently tested. Do not imply otherwise.
- **Google sign-in.** It does not exist. An earlier version of this sheet listed
  Google as a sign-in provider. Microsoft sign-in is real and live; Google is not.
- **Rate limiting.** Sign-in attempts are limited by the authentication
  platform. Our own API endpoints are not.

Being straight about these is what makes the rest believable.
