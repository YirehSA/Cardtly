# App Review Notes - short version for the Notes field

The full notes in `app-review-notes.md` run well past 4,000 characters, which
is all the App Store Connect Notes field takes. This is the same content
compressed to fit, in Apple's own order, so each of their requested items is
answered where they expect to find it.

Rewritten 2026-09-30 for the company-teams-only app (App Review rejection 6,
Guideline 3.1.3(c)): the primary account is now demo@cardtly.com, the owner of
a demo company team, and applereview@cardtly.com is the individual account that
shows the app is not offered to individuals.

Fill in the two passwords and the device list, then paste everything below the
line. Do NOT commit the passwords: this file is in a public repository.

---

SCREEN RECORDING
The iPhone recording attached to an earlier submission predates one change: registration is no longer in the app (sections 2 and 9).

1. DEMO ACCOUNTS
Company team account, full access. Administrator of the demo team "Demo Company (Pty) Ltd":
  demo@cardtly.com / <<FILL IN>>
Individual account, not part of any company team, for the check in section 9:
  applereview@cardtly.com / <<FILL IN>>
No other credentials, codes or sample files are needed.

2. WHAT THE APP DOES AND WHO IT IS FOR
Cardtly is a digital business card. A card carries a name, photo, job title, company, contact details and links, and is shared by QR code, NFC tag or a plain link. The person receiving it needs no app and no account. It solves the problem that printed cards go out of date the moment anything changes, cannot be updated once handed out, and cannot be measured.
The iOS app is for companies that issue cards to their employees: team administrators manage the company's cards, and employees use the card their company provides. Companies buy Cardtly directly from us, outside the app. The app is not offered to individual consumers.

3. SETTING UP AND REACHING THE MAIN FEATURES
Sign in with demo@cardtly.com. The bottom bar reaches everything: Home for a summary, Card to edit details and design, QR to show or save the code, Stats for views and taps, and More for Team Cards (the company's cards), Contacts, Scan Card, Network, Email Signature, NFC Cards and Settings. The demo account already has a finished card and a demo team, so no screen is empty. Account deletion: More, Settings, Danger zone.

4. DEVICES AND OPERATING SYSTEMS TESTED
<<FILL IN>>

5. EXTERNAL SERVICES USED
Supabase for database and authentication, Vercel for hosting, Paystack for payments on the website only, Resend for email, and OpenAI for two optional features: drafting a bio, and reading the text off a photographed paper business card. Sign-in is Cardtly's own account only (email and password, or an emailed one-time link). There is no third-party or social login in the app.

6. PERMISSIONS THE APP ASKS FOR
Camera, to photograph a paper business card. Contacts, to save a received card into the phone. Photo library, to choose a profile or logo image. Each is requested only when that feature is first used, never at launch. The app does not request location, microphone, health data or tracking, and does not read NFC tags on iOS.

7. USER-GENERATED CONTENT AND MODERATION
Cards are user-generated. Every public card and every entry in the Network directory carries a report action, with reasons, and a block action beside it. Reports are answered within 24 hours and a card that breaks the rules is removed along with its account; blocking hides that card from the reporter immediately.

8. REGIONAL DIFFERENCES
None. The app behaves identically in every region. Physical NFC cards are posted within South Africa only; the digital cards have no geographic limit.

9. ENTERPRISE SERVICES AND IN-APP PURCHASE (3.1.3(c))
Cardtly sells team plans directly to companies and organisations for their employees, on our website or by invoice, outside the app; the company pays for every seat. The app serves only those organisations: it opens for team administrators and for employees whose card their company provides. Anyone else who signs in, such as the individual account in section 1, sees a screen saying the app is for company teams, offering only sign-out and account deletion. There is no registration in the app (employees join through their company's invitation), and no purchase flow, price, or link or instruction to buy anywhere in the app.

10. REGULATED INDUSTRY AND THIRD-PARTY MATERIAL
Not a regulated industry, and no protected third-party material. Card content is entered by the cardholder or their company.
