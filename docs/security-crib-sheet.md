# Cardtly security: one page, on hand

For the Wednesday meeting. Short answers you can say out loud. Detail is in
security-posture.md if someone pushes.

---

**"Where is our data stored?"**
Postgres on Supabase, hosting on Vercel, both enterprise cloud infrastructure.
Payments through Paystack, a South African provider.
*(Confirm the region first: Supabase dashboard, Project Settings, General.)*

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
Supabase, Vercel, Paystack, Resend, Google. All named in the published privacy
policy, which we can send you.

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
Not our own yet. If you use Microsoft 365, sign in with Microsoft and your own
tenant enforces your MFA policy. That is the better answer anyway.

**"Have you had an incident?"**
Yes, one, and it was ours not an attacker's: a billing row was deleted during
maintenance and restored the same day. It is why every billing change is now
logged with who, when, and the before and after.

---

## Do not guess these

- **The Supabase region.** POPIA s72 governs personal information leaving South
  Africa. Check it before the meeting.
- **Any certification.** No ISO 27001, no SOC 2. Say so plainly if asked. Small
  SA company, not a certified multinational, and the controls above are real
  regardless.
- **Penetration testing.** Not independently tested. Do not imply otherwise.

Being straight about these is what makes the rest believable.
