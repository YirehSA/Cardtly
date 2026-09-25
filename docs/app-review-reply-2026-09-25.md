# Reply to App Review, rejection of 23 September 2026 (build 8)

Paste everything below the line into the reply in App Store Connect. It must
stay under 4,000 characters (App Store Connect's limit); it is about 3,600.
The screenshot paragraph at the end is only true once the new 13-inch iPad
screenshots are uploaded. If the Stats screenshot is left out, delete
"statistics, " from it.

Every statement was checked against the code on 2026-09-25:
- the login page in the app offers no third-party sign-in (`app/login/page.tsx`)
- the Pro-only editor fields and tabs (`components/card/CardEditor.tsx`)
- the in-app wording for locked features (`ProGate`, `DesignPanel`, `QRPage`)
- NFC orders are invoiced, not paid in the app (`app/api/nfc/order/route.ts`)

---

Hello, and thank you for the review.

GUIDELINE 4.8 - LOGIN SERVICES
We have removed Sign in with Microsoft from the iOS app. The app now offers only Cardtly's own account system: email and password, or a one-time sign-in link sent to the user's email. It has no third-party or social login, so we understand 4.8 no longer applies. The app displays our web service, so this is already live in build 8. Sign in with Microsoft remains on our website only, for company work accounts.

GUIDELINE 2.1(b) - BUSINESS MODEL

1. Who uses the paid subscriptions?
Business users: professionals such as sales representatives, estate agents and consultants who pay for their own digital business card, and companies that pay for their employees' cards.

2. Where can users purchase them?
Only on our website, cardtly.com, outside the app, by card through Paystack. Companies with more than 20 employees are invoiced and pay by bank transfer or debit order. The app has no purchase flow, no subscription prices, no links to our checkout and no instructions to buy elsewhere.

3. What previously purchased subscriptions can be accessed in the app?
- Cardtly Pro for one card, monthly or yearly, bought by the cardholder on our website.
- A Team seat, where a company pays for 2 to 20 employees' cards.
- An Enterprise seat, invoiced to a larger company.
Every new account also starts with a free 7-day trial of every feature.

4. What is unlocked in the app without In-App Purchase?
A subscription is a hosting service for a digital business card: it keeps the card published at cardtly.com/card/their-name, which the people it is shared with open in any web browser, with no app or account. The app is a free companion for managing that card. While a trial or subscription is active, the app's card editor also offers the card's additional fields and options: job title, introduction, WhatsApp and office numbers, address, social and custom links, photos, design templates and a logo in the QR code. When it ends, the public card is no longer published and those options are locked. The user keeps all their data, and the app says the options are part of Cardtly Pro without offering any way to buy it. We believe this fits Guideline 3.1.3(f): a free, stand-alone companion to a paid web-based service, with no purchasing in the app and no calls to action to purchase outside it.

5. Is there a fee to create an account?
No. Creating an account is free, in the app and on the website, and includes a 7-day trial of every feature. No payment details are requested.

6. Are enterprise services sold to single users, consumers, or families?
No. Team and Enterprise plans are sold only to companies and organisations, for their employees; the company is the customer and pays for every seat. Separately, an individual professional can buy Cardtly Pro for their own card on our website.

7. Can physical goods be purchased with digital content in the app?
Users can order printed NFC business cards in the app: a physical card with a chip that opens the user's digital card when tapped against a phone. It is not paid in the app. We email an invoice, paid by bank transfer outside the app. It is a separate, once-off product, not bundled with any subscription, and it unlocks no digital content or feature. NFC cards are delivered within South Africa only.

GUIDELINE 2.3.3 - SCREENSHOTS
We have replaced the 13-inch iPad screenshots with screenshots of the app in use: the dashboard, card editor, statistics, contacts, QR code screen and a published card.

Thank you,
Andre Nel
Cardtly (Pty) Ltd
