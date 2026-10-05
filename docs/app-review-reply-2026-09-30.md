# Reply to App Review, rejection of 30 September 2026 (build 8)

Paste everything below the line into the reply in App Store Connect. It must
stay under 4,000 characters (App Store Connect's limit).

Before sending:
- Upload the new 13-inch iPad screenshots from
  `app-store-screenshots/ipad-13-teams/`, replacing ALL the old ones. The last
  paragraph is only true once that is done. If a screen is left out, remove it
  from the list in that paragraph.
- In App Review Information, change the sign-in username to
  `demo@cardtly.com`, and paste `docs/app-review-notes-short.md` into Notes.
- Check the App Store description, subtitle and promotional text for anything
  aimed at individuals ("create your free card", "7-day trial" and so on). The
  app no longer serves individuals, and a listing that says it does is a 2.3
  problem.

Every statement was checked against the code on 2026-09-30:
- who the app opens for: `iosAppAdmits` in `lib/app-platform.ts`, asked by
  `app/dashboard/layout.tsx`
- the screen everyone else gets: `components/dashboard/CompanyTeamsOnly.tsx`
  (sign out and delete account, nothing else)
- no registration in the app: `/signup` is on `IOS_BLOCKED_ROUTES`, the login
  page shows no sign-up link there, and its emailed sign-in link cannot create
  an account there (`shouldCreateUser: !iosApp`)
- employees join by invite: `/team/claim/<token>`, still open in the app
- demo@cardtly.com owns the comped "Demo Company (Pty) Ltd" team (fictional
  people, hidden from the Network); applereview@cardtly.com belongs to no team
- `scripts/check-ios-teams-only.mjs` holds all of it in the build

---

Hello, and thank you for the review.

GUIDELINES 3.1.1 AND 3.1.3(c) - ENTERPRISE SERVICES
We have taken the first option you suggested: the app now provides our services only to organisations and their employees.

- The app opens only for accounts that belong to a company team: the team's administrators, and employees whose card is provided and paid for by their company.
- Any other account sees a screen explaining that the app is for company teams. That screen offers only sign-out and account deletion. It shows no prices, no purchase option, and no link or instruction to buy anywhere.
- Registration has been removed from the app. Employees join through an invitation from their company, which sets up their account.
- Team plans are sold directly to companies, outside the app, and the company pays for every employee's seat.

As before, the app displays our web service, so these changes are already live in build 1.0 (8).

To verify:
1. Sign in with demo@cardtly.com, the administrator of our demo company team. The full app is available, including Team Cards, where the company manages its employees' cards.
2. Sign in with applereview@cardtly.com, an individual account that is not part of any company team. The app shows only the company-teams screen.
The passwords are in the App Review Information.

GUIDELINE 2.3.3 - SCREENSHOTS
We have replaced the 13-inch iPad screenshots with new captures of the current version of the app in use, in the same iPad layout and appearance as your review device: the home screen, Team Cards, the card editor and its design settings, statistics, contacts, the QR code screen and a published card.

Thank you,
Andre Nel
Cardtly (Pty) Ltd
