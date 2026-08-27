# App Store Connect - App Review Information

Paste the **Notes** block below into App Store Connect:
**My Apps → Cardtly → the version → App Review Information → Notes**.

Two things to fill in before pasting, marked `<<FILL IN>>`: the two demo
passwords, and the devices you actually tested on. Do not invent the device
list - Apple checks it against the crash and install logs.

Keep this file updated rather than rewriting it each rejection. It is the
answer to Guideline 2.1 "Information Needed", which is a documentation
rejection, not a defect in the app.

## Do this first

Run `docs/demo-account-seed.sql` in the Supabase SQL editor before recording
anything. Until it has run, demo@cardtly.com has no job title, no captured
contacts and zero views, so Contacts and Analytics are blank screens and the
recording would show an app that looks like it does nothing. The script also
pushes that account's trial out to 2027 so it cannot lapse mid-review - it was
in the batch that expires on 15 September.

---

## Notes field (copy from here to the end of the section)

CARDTLY - APP REVIEW INFORMATION

1. DEMO ACCOUNTS

Two accounts are provided because the app behaves differently at each
subscription state, and a previous review asked to see the expired one.

  Primary account - use this one for the walkthrough. Full access to every
  feature.
    Username: demo@cardtly.com
    Password: <<FILL IN>>

  Expired account - subscription has lapsed. Provided so you can confirm that
  the app never offers a way to pay outside the App Store at any point.
    Username: applereview@cardtly.com
    Password: <<FILL IN>>

  No other credentials, codes or sample files are needed. The primary account
  already contains a finished card, captured contacts and viewing history, so
  no screen is empty. The second account is intentionally left in the lapsed
  state and is there only for the check described in section 9.

2. WHAT THE APP DOES AND WHO IT IS FOR

Cardtly replaces the paper business card. A user builds one digital business
card carrying their name, job title, company, photo, contact details and
social links, and shares it by QR code or link. Whoever receives it can save
the details straight into their phone contacts, and can send their own
details back, which becomes a captured lead in the sender's dashboard.

The problem it solves: a printed card is out of date the moment a number,
title or logo changes, and the whole box becomes scrap. A Cardtly card is
edited once and everyone who already has the link sees the new version. It
also solves the other half, which paper never did - the sender finds out
whether the card was opened at all, and keeps the recipient's details.

Target audience: working professionals and sales teams, primarily in South
Africa. Two kinds of customer - an individual with one card, and a company
that issues a branded card to every employee and watches which of them are
being used.

3. HOW TO SET UP AND REACH THE MAIN FEATURES

Sign in with the primary account above. Everything below is reachable from
the dashboard immediately after signing in; nothing needs configuring first.

  - My Card - edit the card, change its design, colours and layout
  - Share - QR code, and the public link
  - Contacts - leads captured from the card, exportable
  - Scan - photograph a paper business card and save it to contacts
  - Analytics - views over time, and which links were tapped
  - Network - an opt-in directory of other Cardtly businesses
  - Settings - account, subscription state, and Delete Account

To see the card as a recipient does, open the public link from the Share
screen, or go directly to https://www.cardtly.com/card/demo in Safari.

Account deletion is in the app: Settings, scroll to the bottom, Delete
account. It deletes the account and its data, and is not reversible.

4. DEVICES AND OPERATING SYSTEMS TESTED

  <<FILL IN - list the real devices, for example:
   iPhone 14 Pro, iOS 18.5
   iPad (10th generation), iPadOS 18.5>>

The app supports iPhone and iPad, portrait and landscape.

5. EXTERNAL SERVICES USED

  - Supabase - database, authentication and file storage
  - Vercel - web hosting for the application the app displays
  - OpenAI - two optional features only: suggesting wording for the user's
    bio, and reading the text off a photographed paper business card
  - Resend - transactional email (sign-up confirmation, notifications)
  - Google Wallet API - optional "add to wallet" pass, Android and web only
  - Paystack - subscription billing. NOT reachable from the iOS app. See 9.

No advertising, tracking or analytics SDKs are embedded. The app does not use
App Tracking Transparency because it does not track users across apps or
websites.

6. PERMISSIONS THE APP ASKS FOR

Each one is requested only at the moment the matching feature is used, never
at launch.

  - Camera - to photograph a paper business card for scanning
  - Contacts - to save a received card into the phone's contacts
  - Photo library - to choose a profile or logo image, and to save a
    generated QR code or background image

The app does not request location, microphone, health data, or tracking
permission, and does not read NFC tags on iOS.

7. USER-GENERATED CONTENT AND MODERATION

The app contains user-generated content: a card carries a name, photo, job
title and links supplied by the account holder, and signed-in members can
browse other members' cards in the Network directory. There is no feed, no
comments, no messaging between users and no public index - the Network is
visible only to signed-in members, and every card can be excluded from it by
its holder or by their company administrator.

  - REPORTING. Every card can be reported, both from the Network and from the
    card itself. The reporter chooses a reason (impersonation, offensive,
    spam, not a real person, or other) and can add detail. Reporting does not
    require an account, so somebody being impersonated can report the card
    without signing up.

  - BLOCKING. A signed-in member can block any card. It disappears from their
    Network immediately and permanently, and they are told how many cards they
    have blocked so it is never a silent change.

  - ACTING ON REPORTS. Reports go to a moderation queue reviewed by Cardtly
    staff, which flags anything older than 24 hours. An upheld report removes
    the card from the directory and the account can be terminated. Reports are
    also reachable by email at hello@cardtly.com.

To see this in review: open the Network from the dashboard menu and use the
flag icon on any card, or scroll to the bottom of any public card and use
"Report this card".

8. REGIONAL DIFFERENCES

None. The app's features and content are identical in every region, and
nothing is geo-restricted. The only regional element in the business is
outside the app: the public website prices in South African rand, and the
optional physical NFC card ships within South Africa.

9. SUBSCRIPTIONS AND IN-APP PURCHASE

There is no purchase mechanism of any kind inside the iOS app, and no way to
unlock a subscription from it. Every route that sells or that quotes a price
is blocked for the app specifically, including the marketing pages, so a
reviewer cannot reach a checkout, a price or a promotional code by navigating
or by typing a URL. The expired demo account in section 1 is provided so this
can be verified in the state where a prompt to pay would be most expected.

Subscriptions are sold only on the website, in a browser, to customers who
arrive there independently.

10. REGULATED INDUSTRY AND THIRD-PARTY MATERIAL

Cardtly does not operate in a regulated industry and requires no licence. It
handles no health, financial or government data. All content on a card is
supplied by the account holder about themselves - their own name, photo,
company logo and contact details. The remaining branding is Cardtly's own.

END OF NOTES

---

## Screen recording - shot list

Record on a **physical iPhone**, latest iOS, starting from the home screen.
Apple asked for the typical flow from launch, so do not start mid-session.
Around three to four minutes is enough. No narration is required, but move
slowly and let each screen settle.

Record it **after** the current deploy is live, so the app opens on the sign
in screen rather than the marketing page.

1. Tap the Cardtly icon on the home screen. Let it open by itself.
2. The sign in screen appears. Sign in as demo@cardtly.com.
3. Dashboard. Pause so the whole screen is readable.
4. Open My Card. Edit one field - change the job title - and save it.
5. Open the design or colour settings, change something visible, save.
6. Open Share. Show the QR code. Open the public link so the finished card
   is on screen as a recipient sees it, then come back.
7. Tap Save Contact on the card. **Let the Contacts permission prompt appear
   on camera** and accept it. Apple asked specifically to see permission
   prompts.
8. Open Scan. **Let the Camera permission prompt appear on camera.** Point it
   at any paper card and let it read the details.
9. Open Contacts and show a captured lead.
10. Open Analytics.
11. Open Settings and scroll down so **Delete account** is visible on screen.
    Tap it to show the confirmation screen. Do NOT confirm - back out.
12. Open Network from the menu. Tap the flag on any card to show the report
    and block options, choose a reason, and send it. Apple asked specifically
    to see content reporting and blocking, so do not skip this one - and it is
    the answer to the Guideline 1.2 question they have not asked yet.
13. Sign out.
14. Sign in as applereview@cardtly.com, the expired account. Show the
    dashboard and open Settings, so it is on record that the app offers no
    way to pay even once the subscription has lapsed.

That order covers every item Apple listed: launch, registration and deletion,
the subscription state, and both permission prompts.

## Before you submit

  - Reply to the App Review message as well as filling in Notes. A reply
    without the Notes field filled in has been read as not answering.
  - Resubmit the existing build. Nothing in this round needs a new binary.
  - Do not comp or extend applereview@cardtly.com until the app is approved.
    It has to stay expired for section 8 to be verifiable.

## Guideline 1.2, and why section 7 exists

Apple's list named "user-generated content, including content reporting and
blocking mechanisms". This was a genuine gap: the Network is a directory where
a signed-in member browses other people's cards, and there was no way to
report one or block one. A reviewer opening it and looking for a report action
would have found nothing.

It is built now - flag on every Network tile, "Report this card" on every
public card, and a queue in /admin that marks anything past 24 hours. Section
7 of the notes says so, and tells the reviewer exactly where to look, which
turns what would have been the next rejection into an answered question.

Needs migration 056 applied. It is.
