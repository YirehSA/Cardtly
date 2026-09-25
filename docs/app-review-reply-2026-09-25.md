# Reply to App Review, rejection of 23 September 2026 (build 8)

Paste everything below the line into the reply in App Store Connect. The
screenshot paragraph at the end is only true once the new 13-inch iPad
screenshots are uploaded.

Every statement was checked against the code on 2026-09-25:
- the login page in the app offers no third-party sign-in (`app/login/page.tsx`)
- the Pro-only editor fields and tabs (`components/card/CardEditor.tsx`)
- the in-app wording for locked features (`ProGate`, `DesignPanel`, `QRPage`)
- NFC orders are invoiced, not paid in the app (`app/api/nfc/order/route.ts`)

---

Hello, and thank you for the review.

GUIDELINE 4.8 - LOGIN SERVICES
We have removed Sign in with Microsoft from the iOS app. The app now offers only Cardtly's own account system: an email address and password, or a one-time sign-in link sent to the user's email. It offers no third-party or social login, so we understand Guideline 4.8 no longer applies. The app displays our web service, so this change is already live in build 8 and no new binary is needed. Sign in with Microsoft remains on our website only, for companies whose staff use Microsoft work accounts.

GUIDELINE 2.1(b) - BUSINESS MODEL

1. Who are the users that will use the paid subscriptions in the app?
Business users: individual professionals such as sales representatives, estate agents and consultants who pay for their own digital business card, and companies that pay for cards for their employees.

2. Where can users purchase the subscriptions that can be accessed in the app?
Only on our website, cardtly.com, outside the app, paid by card through our payment provider Paystack. Companies with more than 20 employees are invoiced and pay by bank transfer or debit order. The app contains no purchase flow, no subscription prices, no links to our checkout and no instructions to buy elsewhere.

3. What specific types of previously purchased subscriptions can a user access in the app?
- Cardtly Pro for one card, billed monthly or yearly, bought by the cardholder on our website.
- A Team seat, where a company pays for 2 to 20 of its employees' cards.
- An Enterprise seat, where a larger company is invoiced for its employees' cards.
Every new account also starts with a free 7-day trial of every feature.

4. What paid content, subscriptions, or features are unlocked within the app that do not use In-App Purchase?
A Cardtly subscription is a hosting service for a digital business card. It keeps the user's card published at cardtly.com/card/their-name, where the people they share it with open it in any web browser, with no app or account. The app is a free companion for managing that card. While a trial or subscription is active, the card editor in the app also offers the card's additional fields and options: job title, introduction, WhatsApp and office numbers, address, social and custom links, photos, design templates, and a company logo in the QR code. When a trial or subscription ends, the public card is no longer published and those options are locked. The user keeps all their data, and the app states that the options are part of Cardtly Pro without offering any way to buy it. We believe the app fits Guideline 3.1.3(f): a free, stand-alone companion to a paid web-based service, with no purchasing inside the app and no calls to action to purchase outside it.

5. Do users have to pay a fee to create an account?
No. Creating an account is free, in the app and on the website, and includes a 7-day trial of every feature. No payment details are requested.

6. Are the enterprise services in your app sold to single users, consumers, or for family use?
No. Team and Enterprise plans are sold only to companies and organisations, for their employees. The company is the customer and pays for every seat. They are not sold to consumers or for family use. Separately, an individual professional can buy Cardtly Pro for their own business card on our website.

7. Can users purchase physical goods or services together with digital content in your app?
Users can order printed NFC business cards from the NFC Cards screen. This is a physical card with a chip that opens the user's digital card when tapped against a phone. The order is not paid in the app: we email an invoice, which the customer pays by bank transfer outside the app. It is a separate, once-off physical product. It is not bundled with any subscription, and ordering one does not unlock any digital content or feature. NFC cards are delivered within South Africa only.

GUIDELINE 2.3.3 - ACCURATE METADATA
We have replaced the 13-inch iPad screenshots with screenshots of the app in use on iPad: the dashboard, the card editor, statistics, collected contacts, the QR code screen and a published card.

Thank you,
Andre Nel
Cardtly (Pty) Ltd
