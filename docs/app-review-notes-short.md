# App Review Notes - short version for the Notes field

The full notes in `app-review-notes.md` run to 7,456 characters and the App
Store Connect Notes field takes 4,000. This is the same content compressed to
fit, in Apple's own order, so each of their seven requested items is answered
where they expect to find it.

Fill in the two passwords and the device list, then paste everything below the
line. Do NOT commit the passwords: this file is in a public repository.

---

SCREEN RECORDING
Attached to this submission, and also at <<VIDEO LINK>>. Recorded on a physical
iPhone, starting from the home screen. It shows app launch, account
registration, sign-in, editing a card, the camera card scanner including the
camera permission prompt, saving a scanned card to the phone's contacts,
reporting and blocking a card in the Network directory, account deletion, and
the expired-subscription state.

1. DEMO ACCOUNTS
Primary, and the account shown in the video:
  demo1@cardtly.com / <<FILL IN>>
Expired subscription, for the check in section 9:
  applereview@cardtly.com / <<FILL IN>>
The second account is deliberately left lapsed. No other credentials, codes or
sample files are needed.

2. WHAT THE APP DOES AND WHO IT IS FOR
Cardtly is a digital business card. A card carries a name, photo, job title,
company, contact details and links, and is shared by QR code, NFC tag or a
plain link. The person receiving it needs no app and no account. It solves the
problem that printed cards go out of date the moment anything changes, cannot
be updated once handed out, and cannot be measured. Users are individual
professionals and companies issuing cards to their staff.

3. SETTING UP AND REACHING THE MAIN FEATURES
Sign in with the account above. The bottom bar reaches everything: Home for a
summary, Card to edit details and design, QR to show or save the code, Stats
for views and taps, and More for Contacts, Scan Card, Network, Email
Signature, NFC Cards, Team Cards and Settings. The demo account already has a
finished card, so no screen is empty.

4. DEVICES AND OPERATING SYSTEMS TESTED
<<FILL IN>>

5. EXTERNAL SERVICES USED
Supabase for database and authentication, Vercel for hosting, Paystack for
payments on the website only, Resend for email, and OpenAI for two optional
features: drafting a bio from a name, job title and company, and reading the
text off a photographed paper business card. Sign-in in the app is Cardtly's
own account only: email and
password, or a one-time link emailed to the user. There is no third-party or
social login in the app.

6. PERMISSIONS THE APP ASKS FOR
Camera, to photograph a paper business card. Contacts, to save a received card
into the phone. Photo library, to choose a profile or logo image. Each is
requested only when that feature is first used, never at launch. The app does
not request location, microphone, health data or tracking, and does not read
NFC tags on iOS. The video shows the camera prompt in full; iOS does not show
the contacts prompt again because it had already been granted on the device
used for the recording.

7. USER-GENERATED CONTENT AND MODERATION
Cards are user-generated. Every public card and every entry in the Network
directory carries a report action, with reasons, and a block action beside it.
Reporting is answered within 24 hours and a card that breaks the rules is
removed along with its account; blocking hides that card from the reporter
immediately. Both are shown in the video.

8. REGIONAL DIFFERENCES
None. The app behaves identically in every region. Website prices are shown in
South African rand with a live estimate in the visitor's currency. Physical NFC
cards are posted within South Africa only; the digital cards have no
geographic limit.

9. SUBSCRIPTIONS AND IN-APP PURCHASE
The app contains no purchase flow, no prices, and no link to a checkout.
Subscriptions are sold only on the website, outside the app, and the app never
directs a user there. An account whose subscription has lapsed keeps all its
data and simply stops serving its public card. The video shows this using the
expired account in section 1.

10. REGULATED INDUSTRY AND THIRD-PARTY MATERIAL
Cardtly does not operate in a regulated industry and contains no protected
third-party material. Everything on a card is entered by the cardholder about
themselves.
