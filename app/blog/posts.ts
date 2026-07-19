// Blog post content. Each post's `body` is trusted, hand-reviewed HTML
// rendered inside the .article-prose container (see globals.css). The
// `faq` array powers both the on-page FAQ and the FAQPage JSON-LD so
// they never drift.

export interface BlogPost {
  slug: string
  title: string
  description: string
  excerpt: string
  date: string // ISO yyyy-mm-dd
  readMins: number
  body: string
  faq: { q: string; a: string }[]
}

export const POSTS: BlogPost[] = [
  {
    slug: 'what-is-a-digital-business-card',
    title: 'What Is a Digital Business Card? A Simple Guide',
    description:
      'A digital business card is a shareable online profile you send by NFC tap, QR code, or link. Learn how it works and how to get one free.',
    excerpt:
      'A plain-English guide to digital business cards: what they are, how sharing works, the benefits over paper, and how to start free.',
    date: '2026-07-01',
    readMins: 6,
    body: `<p>A digital business card is an online version of a paper business card. It lives as a web page that holds your name, role, contact details, links, and social profiles, and you share it with a phone tap, a QR code, or a link. The person who receives it can save your details straight to their phone with no app to download.</p>

<p>If you have ever handed over a paper card and watched it disappear into a wallet, you already know the problem a <strong>digital business card</strong> solves. Your details stay live, easy to update, and simple to pass on. Below we explain what one is, how it works, and how to get yours free.</p>

<h2>How a digital business card works</h2>

<p>Because a digital business card is a live web page rather than a printed object, it behaves differently to paper in a few useful ways:</p>

<ul>
<li><strong>It updates instantly.</strong> Change your phone number, job title, or logo once, and every person who opens your card sees the new version. No reprinting.</li>
<li><strong>It holds more than contact details.</strong> Add photo galleries, custom links, social profiles, a WhatsApp button, certifications, and a book-a-meeting button.</li>
<li><strong>It saves to the recipient's phone.</strong> One tap adds your details to their contacts as a vCard, so you are stored correctly and not lost on a scrap of card.</li>
<li><strong>It shows you what is working.</strong> With analytics you can see views, clicks, and saves, so you know when your card is doing its job.</li>
</ul>

<h2>How you share a virtual business card</h2>

<p>A <strong>virtual business card</strong> is built to be shared in the moment, whether you are at a meeting, an expo, or a coffee shop. There are three simple ways to hand it over, and the recipient needs no app for any of them:</p>

<ul>
<li><strong>NFC tap.</strong> Hold an <strong>NFC business card</strong> or NFC-enabled phone near someone's phone, and your card opens on their screen. This is the quickest option in person.</li>
<li><strong>QR code.</strong> They point their camera at your QR code and your card loads. Handy for a screen, a slide, a poster, or the back of a printed card.</li>
<li><strong>Link.</strong> Send your card as a link over WhatsApp, email, or SMS. This works when you are not in the same room.</li>
</ul>

<p>With Cardtly you get all three sharing methods on every plan, including the free one. If you want the physical tap experience, an optional <a href="/nfc">NFC card</a> is available as a once-off add-on.</p>

<h2>Digital vs paper business cards</h2>

<p>Paper still has a place, but it has clear limits. Here is how the two compare:</p>

<table>
<thead>
<tr><th>Feature</th><th>Paper card</th><th>Digital business card</th></tr>
</thead>
<tbody>
<tr><td>Update details</td><td>Reprint the whole batch</td><td>Edit once, live everywhere</td></tr>
<tr><td>Sharing</td><td>Hand over a physical card</td><td>NFC tap, QR code, or link</td></tr>
<tr><td>Saved to phone</td><td>Typed in by hand, if at all</td><td>One tap to save as a contact</td></tr>
<tr><td>Extra content</td><td>Name and number only</td><td>Links, gallery, socials, WhatsApp, more</td></tr>
<tr><td>See who viewed it</td><td>No way to tell</td><td>Views, clicks, and saves tracked</td></tr>
<tr><td>Running cost</td><td>Pay per print run</td><td>Free to start</td></tr>
</tbody>
</table>

<h2>Who a digital business card is for</h2>

<p>Almost anyone who meets people for work can use one. It suits sales reps and estate agents who network daily, small business owners and freelancers who want to look professional without a print budget, tradespeople who want a WhatsApp button and reviews in one place, and larger teams who need everyone on the same branding. For businesses, a <a href="/features">Teams plan</a> lets you lock company branding, add seats, and manage everyone from an admin dashboard.</p>

<h2>How to get a digital business card free with Cardtly</h2>

<p>Cardtly is a South African digital business card platform, so pricing is in rand and local payment works out of the box. You can build a card in minutes:</p>

<ol>
<li><a href="/signup">Sign up free</a> with no credit card required.</li>
<li>Pick one of 12 customisable templates and set your colours, fonts, logo, and light or dark mode.</li>
<li>Add your details, links, socials, and an AI-written bio if you want a hand with the wording.</li>
<li>Share your card by NFC, QR, or link, and start saving the contacts you meet.</li>
</ol>

<p>The free plan is free forever. When you are ready for more, Pro adds tools like a built-in contacts CRM, lead capture, a paper card scanner, an email signature generator, and a weekly performance digest. Here is how the plans compare:</p>

<table>
<thead>
<tr><th>Plan</th><th>Price</th><th>Best for</th></tr>
</thead>
<tbody>
<tr><td>Free</td><td>R0 forever</td><td>A polished card, all three sharing methods, and contact saves</td></tr>
<tr><td>Pro</td><td>R65/month</td><td>Analytics, CRM, lead capture, card scanner, and more</td></tr>
<tr><td>Teams</td><td>R65/seat/month</td><td>Locked company branding and an admin dashboard</td></tr>
</tbody>
</table>

<p>See the full breakdown on the <a href="/pricing">pricing page</a>, or browse everything included on the <a href="/features">features page</a>. Want the physical tap experience too? A Cardtly NFC card is R150 once-off plus R100 shipping in South Africa, and it links straight to the digital card you already made.</p>

<p>A digital business card gives you a smarter, cheaper, and more useful way to share who you are. You can create yours in a few minutes and never run out of cards again.</p>`,
    faq: [
      { q: 'What is a digital business card?', a: 'A digital business card is an online version of a paper business card that lives as a web page holding your contact details, links, and social profiles. You share it by NFC tap, QR code, or a link, and the recipient can save your details straight to their phone with no app needed.' },
      { q: 'Do I need an NFC card to use a digital business card?', a: 'No. You can share your card by QR code or link on any plan without any hardware. An NFC card is an optional add-on from Cardtly at R150 once-off plus R100 shipping in South Africa if you want the tap-to-share experience in person.' },
      { q: 'Does the person receiving my card need an app?', a: 'No. Your card opens as a normal web page in their browser, whether you share it by NFC, QR code, or link. They can also save your details to their phone contacts with one tap.' },
      { q: 'Is Cardtly really free?', a: 'Yes. Cardtly has a free forever plan with no credit card required, which includes a customisable card and all three sharing methods. Pro is R65 per month via Paystack and adds analytics, a contacts CRM, lead capture, and more.' },
    ],
  },

  {
    slug: 'digital-business-cards-south-africa',
    title: 'Digital Business Cards South Africa: 2026 Guide',
    description:
      'The complete 2026 guide to digital business cards in South Africa. ZAR pricing, local NFC card delivery, WhatsApp sharing, and how to start free with Cardtly.',
    excerpt:
      'Everything South African professionals need to know about digital and NFC business cards in 2026, with ZAR pricing and local delivery.',
    date: '2026-07-02',
    readMins: 7,
    body: `<p>A digital business card is a shareable online version of your contact details that lives on your phone and opens in any web browser, so the person you meet can save your info instantly without an app or a paper card. <strong>Cardtly</strong> is a South African digital business card platform, built in South Africa, that lets you share your card by NFC tap, QR code, or a link over WhatsApp, and bills in rand through Paystack. You can start free, with no credit card, and upgrade to Pro for R65 a month when you need more.</p>

<h2>Why South African professionals are switching</h2>
<p>Paper business cards get lost, run out at the worst moment, and cost money to reprint every time a number or title changes. A digital business card fixes all three problems at once. You update your details in one place and everyone who opens your card sees the latest version, so a reprint is never needed again.</p>
<p>There are local reasons this shift is happening faster in South Africa. WhatsApp is how most of us actually swap details, and a digital card drops straight into a chat as a tappable link. Pricing in rand means no forex surprises on your statement, and if you want a physical NFC card, it ships inside South Africa rather than sitting in customs for weeks.</p>

<h2>How sharing works: NFC, QR, or link</h2>
<p>Cardtly gives you three ways to share the same card, and the person receiving it needs no app at all.</p>
<ul>
<li><strong>NFC tap:</strong> tap your optional physical NFC card on someone's phone and your profile opens instantly.</li>
<li><strong>QR code:</strong> let them scan your on-screen QR code across a table or counter.</li>
<li><strong>Link:</strong> send your card over WhatsApp, email, or SMS in one message.</li>
</ul>
<p>However they open it, they can save your details straight to their phone contacts as a vCard, so your name, number, and email land in their address book with one tap. You can also scan a stack of paper cards you have collected and turn them into saved contacts using the Pro AI card scanner.</p>

<h2>What it costs in rand</h2>
<p>Everything is priced in South African rand and billed through Paystack, which suits local businesses and also accepts international cards. Here is the full picture.</p>
<table>
<thead>
<tr><th>Plan or add-on</th><th>Price (ZAR)</th><th>What you get</th></tr>
</thead>
<tbody>
<tr><td>Free</td><td>R0 forever, no credit card</td><td>A live digital card, all sharing options, save to contacts</td></tr>
<tr><td>Pro</td><td>R65 / month</td><td>Analytics, lead capture and CRM, AI card scanner, Excel export, weekly digest</td></tr>
<tr><td>Physical NFC card</td><td>R150 once-off + R100 shipping in SA</td><td>A tap-to-share card linked to your profile</td></tr>
<tr><td>Teams</td><td>R65 / seat / month</td><td>Locked company branding, per-seat billing, admin dashboard</td></tr>
</tbody>
</table>
<p>You can compare everything side by side on the <a href="/pricing">pricing page</a>, and order a physical card from the <a href="/nfc">NFC card page</a> when you are ready.</p>

<h2>What you can build into your card</h2>
<p>Your card is more than a name and a number. On Cardtly you get 12 customisable templates with control over colours, fonts, your logo, light or dark mode, and backgrounds, so your card matches your brand. From there you can add:</p>
<ul>
<li>Photo galleries, custom links, and social profiles</li>
<li>A one-tap WhatsApp button and a book-a-meeting button</li>
<li>Certifications and an AI-written bio if you are stuck for words</li>
<li>An email signature generator and Zoom or Teams virtual backgrounds</li>
<li>Add to Google Wallet, so your card sits with your boarding passes and loyalty cards</li>
</ul>
<p>On Pro you also get analytics showing views, clicks, and saves, plus built-in lead capture and a contacts CRM with one-click Excel export and a weekly performance digest email. See the full list on the <a href="/features">features page</a>.</p>

<h2>Who it is for</h2>
<p>Digital business cards suit anyone who meets people for a living, and a few South African use cases stand out.</p>
<table>
<thead>
<tr><th>Who</th><th>Why it works</th></tr>
</thead>
<tbody>
<tr><td>Sales reps</td><td>Share on the road over WhatsApp and capture leads on the spot</td></tr>
<tr><td>Estate agents</td><td>One link on every listing, show house, and email signature</td></tr>
<tr><td>Entrepreneurs</td><td>Look established from day one without a print run</td></tr>
<tr><td>Tradespeople</td><td>Tap a card, drop a WhatsApp number, and get the callback</td></tr>
<tr><td>Teams</td><td>Every staff member on-brand, managed from one admin dashboard</td></tr>
</tbody>
</table>

<h2>How to get started free</h2>
<p>Getting a card live takes a few minutes and costs nothing to try.</p>
<ol>
<li>Create a free account, no credit card needed.</li>
<li>Pick one of the 12 templates and add your details, links, and logo.</li>
<li>Share your card by link, QR, or NFC, and start saving contacts.</li>
</ol>
<p>When you want analytics, lead capture, and the AI card scanner, upgrade to Pro for R65 a month. If you run a team, the Teams plan keeps everyone on-brand at R65 per seat. There is also an Android app on Google Play, with iOS on the way. Ready to begin? <a href="/signup">Create your free card</a> and share it today.</p>`,
    faq: [
      { q: 'What is a digital business card?', a: 'A digital business card is an online version of your contact details that opens in any web browser when you share it by tap, QR code, or link. The person receiving it can save your details to their phone without downloading an app.' },
      { q: 'How much does a digital business card cost in South Africa?', a: 'Cardtly is free forever with no credit card required. Pro is R65 per month, billed in rand through Paystack, and an optional physical NFC card is R150 once-off plus R100 shipping within South Africa.' },
      { q: 'Do I need an NFC card to use Cardtly?', a: 'No. You can share your card by QR code or a link over WhatsApp, email, or SMS without any physical card. The NFC card is an optional add-on for tap-to-share convenience.' },
      { q: 'Does the person receiving my card need an app?', a: 'No. Your card opens in any standard web browser, and they can save your details straight to their phone contacts as a vCard with one tap.' },
      { q: 'Can I use Cardtly for my whole team?', a: 'Yes. The Teams plan is R65 per seat per month and includes locked company branding, per-seat billing, and an admin dashboard so everyone stays on-brand.' },
    ],
  },

  {
    slug: 'nfc-vs-paper-business-cards',
    title: 'NFC vs Paper Business Cards: Which Wins in 2026?',
    description:
      'NFC vs paper business cards on cost, updates, sustainability, analytics and reach - and why NFC wins for South African professionals in 2026.',
    excerpt:
      'A fair 2026 comparison of NFC and paper business cards across cost, updates, waste, analytics and reach, and why digital usually wins.',
    date: '2026-07-02',
    readMins: 6,
    body: `<p>For most South African professionals in 2026, an <strong>NFC business card is the better choice than a paper one</strong>. It costs less over time because you never reprint, it updates everywhere the moment you change a detail, and it shows you real analytics on who viewed and saved your profile. Paper still has a narrow place, but on nearly every practical measure the <strong>digital vs paper business card</strong> question now favours digital.</p>

<h2>What is an NFC business card and how does it work?</h2>
<p>NFC stands for Near Field Communication, the same short-range wireless tech behind tap-to-pay. An <a href="/nfc">NFC business card</a> is a physical card with a tiny chip inside. When you tap it against the back of any modern phone, the phone reads the chip and instantly opens your digital profile in the browser. No app is needed on either side, and the person you are meeting does not have to type anything.</p>
<p>That profile is really a live web page. You can also share the exact same page as a QR code or a plain link, so a tap is just one of three ways in. Once someone lands on it, they can save your details straight to their phone contacts with one button.</p>

<h2>NFC vs paper business cards: the quick comparison</h2>
<table>
<thead>
<tr><th>Criteria</th><th>NFC / Digital card</th><th>Paper card</th></tr>
</thead>
<tbody>
<tr><td>Cost over time</td><td>One card or link, reused forever, no reprints</td><td>Recurring print runs every time details change</td></tr>
<tr><td>Staying up to date</td><td>Edit once, updates everywhere instantly</td><td>Outdated the moment a number or title changes</td></tr>
<tr><td>Sustainability</td><td>No paper waste, one card lasts for years</td><td>Boxes printed, most discarded within days</td></tr>
<tr><td>Analytics and follow-up</td><td>See who viewed and saved you, capture leads</td><td>No tracking, easy to lose or forget</td></tr>
<tr><td>Sharing and reach</td><td>Tap, QR, or link; works even without a card on hand</td><td>Only works in person, one card per person</td></tr>
<tr><td>First impression</td><td>Modern, memorable tap moment</td><td>Familiar but forgettable</td></tr>
</tbody>
</table>

<h2>Cost over time</h2>
<p>A paper card looks cheap per unit, but the real cost is repetition. Every time your number, title, or branding changes, the old box becomes scrap and you order another. A digital card removes that cycle. Cardtly has a <strong>free forever</strong> plan with no credit card required, and Pro is R65 per month. If you want the physical tap, an optional <a href="/nfc">NFC card</a> is R150 once-off plus R100 shipping in South Africa, and you keep using it for years without reprinting.</p>

<h2>Staying up to date</h2>
<p>This is where paper struggles most. A printed card is a snapshot frozen on the day it left the printer. A digital card is a live web page, so when you change a phone number, add a new role, or swap your booking link, it updates everywhere instantly. Everyone who taps, scans, or clicks always sees the current version, and you never hand out wrong details again.</p>

<h2>Sustainability and waste</h2>
<p>Most paper business cards are thrown away within a week of being handed over. Multiply that across every event, and a lot of card stock ends up in the bin. A digital card produces no ongoing paper waste, and even the optional NFC card is a single object you reuse for years rather than a box you replace. For professionals who care about a lighter footprint, this is a clear win for digital.</p>

<h2>Analytics and follow-up</h2>
<p>A paper card goes silent the moment it leaves your hand. You have no idea if it was kept, saved, or binned. A digital card gives you <a href="/features">analytics</a>: you can see who viewed and saved your profile, capture leads, and keep every contact in a simple CRM. That turns a handshake into a follow-up you can actually act on, which matters most for salespeople, founders, and anyone working a room.</p>

<h2>Convenience and reach</h2>
<p>With paper, you have reach only when you remembered to bring cards and only for as many as you packed. A digital card travels differently. You can tap an NFC card, show a QR code, or drop a link into a chat, an email signature, or a social bio. The recipient needs no app and can save you to their contacts in seconds. One profile, shared three ways, reaches people you would never have handed a card to in person.</p>

<h2>First impression and the tech factor</h2>
<p>There is a real moment when you tap your card on someone's phone and your profile pops up. It signals that you are current and organised, and it tends to stick in memory more than another rectangle of cardboard. Paper is familiar and comfortable, which is not nothing, but familiar rarely stands out in a stack of twenty similar cards.</p>

<h2>Where paper still has a place</h2>
<p>To be fair, paper is not dead. It needs no phone, no signal, and no battery, so it works in any setting instantly. Some industries and older audiences still expect a physical card as a courtesy, and a beautifully printed card can be a lovely keepsake for special occasions. Many professionals do best with both: a digital card as the everyday default, and a small run of paper for the rare moments that call for it.</p>

<h2>The verdict for 2026</h2>
<p>On cost, updates, sustainability, analytics, and reach, the <strong>NFC vs paper business cards</strong> comparison lands firmly on the digital side, with paper holding a small niche. The good news is you do not have to choose blind. You can <a href="/signup">create your free digital card</a> in minutes, keep it forever at no cost, and add an NFC card only if you want the tap. In 2026, that is the smarter way to share who you are.</p>`,
    faq: [
      { q: 'How does an NFC business card actually work?', a: 'An NFC business card has a small chip inside. When you tap it against the back of a modern phone, the phone reads the chip and opens your digital profile in the browser instantly. No app is needed on either phone.' },
      { q: 'Is an NFC card more expensive than printing paper cards?', a: 'Not over time. A paper card seems cheap per unit but you reprint every time details change. A Cardtly NFC card is R150 once-off plus R100 shipping in South Africa and you reuse it for years, while the digital card itself is free forever.' },
      { q: 'Do people need an app to receive my digital or NFC card?', a: 'No. The recipient just taps, scans a QR code, or opens a link, and your profile opens in their normal browser. They can then save your details straight to their phone contacts with no app required.' },
      { q: 'Should I still keep paper business cards in 2026?', a: 'You can, and some settings still expect them since paper needs no phone or signal. Many professionals use a digital card as the everyday default and keep a small run of paper for the rare occasions that call for it.' },
    ],
  },

  {
    slug: 'how-to-make-a-free-digital-business-card',
    title: 'How to Make a Free Digital Business Card',
    description:
      'Learn how to create a free digital business card in South Africa. A simple step-by-step guide: sign up, pick a template, add details, share by link, QR or NFC.',
    excerpt:
      'A beginner-friendly, step-by-step guide to making a free digital business card you can share by link, QR code or NFC tap.',
    date: '2026-07-03',
    readMins: 7,
    body: `<p>To make a free digital business card, sign up for a free account on <a href="/signup">Cardtly</a>, pick one of the 12 templates, then add your name, role, contact details, socials and links. Customise the colours, fonts and logo, and you instantly get a public card URL like cardtly.com/card/yourname plus a downloadable QR code. Share it by link, QR code or an NFC tap, add it to Google Wallet, and track your views from your dashboard. The whole thing is free forever, with no credit card needed.</p>

<p>A paper business card gets lost, goes out of date the moment your number changes, and there is no way to know if anyone ever looked at it. A digital business card fixes all of that. It is a live web page, so you edit it once and everyone who already has your link sees the update. Below is the full walkthrough for South African professionals who are starting from scratch.</p>

<h2>Step by step: create your digital business card</h2>

<h3>1. Sign up free</h3>
<p>Head to the <a href="/signup">sign up page</a> and create your free account. There is no credit card required and the free plan lasts forever, so you can build your whole card and share it without paying a cent. This is the "<strong>free digital business card</strong>" part that beginners worry about, and there really is no catch to getting started.</p>

<h3>2. Pick a template</h3>
<p>Choose from 12 customisable templates. Each one sets the overall look of your card, and you can switch templates later without losing your details. Pick something that suits your profession: clean and minimal for a consultant, bold and colourful for a creative. Do not overthink this step, because you can change it in seconds.</p>

<h3>3. Add your details</h3>
<p>This is where your card comes to life. Fill in the essentials:</p>
<ul>
<li><strong>Name and role</strong>: your full name and job title or business name.</li>
<li><strong>Contact details</strong>: phone, email and a WhatsApp button so people can message you in one tap.</li>
<li><strong>Socials</strong>: link your LinkedIn, Instagram, Facebook or any platform you use for work.</li>
<li><strong>Custom links</strong>: your website, booking page, portfolio, price list or anything else.</li>
<li><strong>Bio</strong>: a short intro. If you get stuck, the AI-written bio tool can draft one for you.</li>
</ul>
<p>You can also add a photo gallery to show your work, products or team.</p>

<h3>4. Customise the design</h3>
<p>Make the card yours. Adjust the colours and fonts, upload your logo, choose a background, and switch between light and dark mode. Matching your card to your brand takes a minute and makes you look far more professional than a generic paper card.</p>

<h3>5. Get your link and QR code</h3>
<p>Once your details are in, you get a public card URL like cardtly.com/card/yourname and a downloadable QR code. The link is ready to use immediately. Save the QR code image so you can print it on flyers, your shop window, a name badge or the back of a physical card.</p>

<h3>6. Share it and add to Google Wallet</h3>
<p>You can share your card three ways, and the person receiving it never needs to download an app:</p>
<ul>
<li><strong>Link</strong>: send it over WhatsApp, email or SMS.</li>
<li><strong>QR code</strong>: let people scan it with their phone camera at a meeting or event.</li>
<li><strong>NFC tap</strong>: tap an optional physical <a href="/nfc">NFC card</a> on a phone to open your card instantly.</li>
</ul>
<p>Whoever opens your card can save you straight to their phone contacts. You can also add your card to Google Wallet so it is always one swipe away on your own phone.</p>

<h3>7. Track views and capture leads</h3>
<p>This is where a digital card beats paper for good. Your analytics show how many people viewed your card, and lead capture lets visitors leave their details, which flow into a simple CRM. Add a book-a-meeting button so prospects can book time with you directly, and generate an email signature so every message you send doubles as a mini business card.</p>

<h2>What you get free vs Pro</h2>

<p>Everything you need to make and share a card is free. Pro unlocks the extras for people who want to get more from their card.</p>

<table>
<thead>
<tr><th>Feature</th><th>Free</th><th>Pro (R65/month)</th></tr>
</thead>
<tbody>
<tr><td>Public card URL and QR code</td><td>Yes</td><td>Yes</td></tr>
<tr><td>12 templates and design customisation</td><td>Yes</td><td>Yes</td></tr>
<tr><td>Contact details, socials and links</td><td>Yes</td><td>Yes</td></tr>
<tr><td>Share by link, QR or NFC</td><td>Yes</td><td>Yes</td></tr>
<tr><td>Add to Google Wallet</td><td>Yes</td><td>Yes</td></tr>
<tr><td>Analytics, lead capture and CRM</td><td>Limited</td><td>Full</td></tr>
<tr><td>Card scanner, Excel export, weekly digest</td><td>-</td><td>Yes</td></tr>
</tbody>
</table>

<p>See the full breakdown on the <a href="/pricing">pricing page</a> and the complete list on the <a href="/features">features page</a>.</p>

<h2>Tips for a card that actually works</h2>

<ul>
<li><strong>Lead with one clear action</strong>: decide the main thing you want people to do, such as message you on WhatsApp or book a meeting, and make it easy to find.</li>
<li><strong>Keep it tidy</strong>: add the links that matter and leave out the ones that do not. A short card is easier to scan than a long one.</li>
<li><strong>Use a real photo and your logo</strong>: people trust a face and a brand. It takes seconds and lifts the whole card.</li>
<li><strong>Match your brand colours</strong>: a card that looks like the rest of your business feels far more trustworthy.</li>
<li><strong>Add the QR code everywhere</strong>: put it on your car, your storefront, your email signature and your printed flyers.</li>
<li><strong>Update it as you grow</strong>: new role, new number or new offer, edit once and every existing link updates instantly.</li>
</ul>

<h2>Ready to make yours?</h2>

<p>Making a digital business card takes about ten minutes and costs nothing to start. You end up with a professional, shareable card that works from any phone, keeps itself up to date, and shows you exactly who is engaging. <a href="/signup">Create your free digital business card now</a> and share it today.</p>`,
    faq: [
      { q: 'Is a digital business card really free?', a: 'Yes. Cardtly has a free forever plan with no credit card required. You can build your card, get your public link and QR code, and share it without paying. Pro is optional at R65 per month for extra features.' },
      { q: 'Does the person I share my card with need an app?', a: 'No. Your card is just a web page, so anyone can open it by link, QR scan or NFC tap on any phone. They can save your details straight to their contacts without downloading anything.' },
      { q: 'How do I share my digital business card?', a: 'Three ways: send the link over WhatsApp, email or SMS; let people scan your QR code; or tap an optional NFC card on a phone. You can also add your card to Google Wallet for quick access.' },
      { q: 'Do I need the physical NFC card to get started?', a: 'No. The NFC card is optional and costs R150 once-off plus R100 shipping in South Africa. Your link and QR code work on their own, so you can share your card straight away without any hardware.' },
    ],
  },
]

export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find(p => p.slug === slug)
}
