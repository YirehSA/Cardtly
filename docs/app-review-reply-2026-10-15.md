# Reply to App Review, rejection of 14 October 2026 (build 8)

Paste everything below the line into the reply in App Store Connect. It must
stay under 4,000 characters (App Store Connect's limit); it is about 1,000.

This time Apple raised only the listing's Marketing URL. Nothing in the app
was cited, so the teams-only change of 2026-09-30 appears to have been
accepted.

Before sending, in App Store Connect, on the version page (1.0):
- **Marketing URL:** change it to `https://www.cardtly.com/app-support`.
  (It is optional, so clearing it also works. Pointing it at the support page
  is what the reply below says, so if you clear it instead, change the first
  paragraph to say it was removed.)
- **Support URL:** change it to `https://www.cardtly.com/app-support` too.
  Apple opens it the same way, and if it is the home page or /contact it has
  the same Pricing link in the header.
- **Description, subtitle, promotional text and keywords:** check for a price,
  "pricing", "free trial", "sign up", or the web address of any page other
  than /app-support. Remove any you find.
- Leave the Privacy Policy URL on /privacy; Apple did not raise it.
- Save the version. "Resubmit to App Review" stays greyed out until the
  version itself is edited and saved.

What /app-support is, checked 2026-10-15:
- `app/app-support/page.tsx`: no header, no footer, no link into the site.
  Its only link is `mailto:hello@cardtly.com`. No price, no sign-up, nothing
  to buy. Not indexed by search engines.
- `scripts/check-app-store-page.mjs` (in prebuild) fails the build if a site
  link, a price or sign-up wording is ever added to it.

---

Hello,

Thank you for the review.

Guideline 3.1.1: we have changed the app's Marketing URL and Support URL to https://www.cardtly.com/app-support.

That page is written for the people who use the app: employees whose company provides their Cardtly card. It explains who the app is for, how to sign in, what the app does, how to delete an account, and how to contact support. It contains no prices, no account registration, no call to action to purchase or subscribe, and no links to any other page of our website. Its only link is our support email address.

We have also checked the app's description, subtitle and promotional text, and they contain no prices, purchase links or links to our website.

Nothing in the app itself has changed since your last review (build 8). As before, the app is for company teams only. It offers no purchases, shows no prices, has no account registration, and contains no links to our pricing page.

Thank you,
Andre Nel
Cardtly
