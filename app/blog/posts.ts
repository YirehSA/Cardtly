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
      'A digital business card is a shareable online profile you send by NFC tap, QR code, or link. Learn how it works, what it costs, and how to get one.',
    excerpt:
      'A plain-English guide to digital business cards: what they are, how sharing works, the benefits over paper, and what one costs.',
    date: '2026-07-01',
    readMins: 6,
    body: `<p>A digital business card is an online version of a paper business card. It lives as a web page that holds your name, role, contact details, links, and social profiles, and you share it with a phone tap, a QR code, or a link. The person who receives it can save your details straight to their phone with no app to download.</p>

<p>If you have ever handed over a paper card and watched it disappear into a wallet, you already know the problem a <strong>digital business card</strong> solves. Your details stay live, easy to update, and simple to pass on. Below we explain what one is, how it works, what it costs, and how to get yours.</p>

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

<p>With Cardtly all three sharing methods come with every card. If you want the physical tap experience, an optional <a href="/nfc">NFC card</a> is available as a once-off add-on.</p>

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
<tr><td>Running cost</td><td>Pay per print run</td><td>From R97 a month, no reprints ever</td></tr>
</tbody>
</table>

<h2>Who a digital business card is for</h2>

<p>Almost anyone who meets people for work can use one. It suits sales reps and estate agents who network daily, small business owners and freelancers who want to look professional without a print budget, tradespeople who want a WhatsApp button and reviews in one place, and larger teams who need everyone on the same branding. For businesses, a <a href="/features">Teams plan</a> lets you lock company branding, add seats, and manage everyone from an admin dashboard.</p>

<h2>How to get a digital business card with Cardtly</h2>

<p>Cardtly is a South African digital business card platform, so pricing is in rand and local payment works out of the box. You can build a card in minutes:</p>

<ol>
<li><a href="/signup">Sign up</a> and get 7 days of everything, no credit card required.</li>
<li>Pick one of 12 customisable templates and set your colours, fonts, logo, and light or dark mode.</li>
<li>Add your details, links, socials, and an AI-written bio if you want a hand with the wording.</li>
<li>Share your card by NFC, QR, or link, and start saving the contacts you meet.</li>
</ol>

<p>Every signup gets 7 days with the full product, no card required: a built-in contacts CRM, lead capture, a paper card scanner, an email signature generator, and a weekly performance digest. After that it is from R97 a month to keep the card live. Here is what you get:</p>

<table>
<thead>
<tr><th>Plan</th><th>Price</th><th>Best for</th></tr>
</thead>
<tbody>
<tr><td>First 7 days</td><td>R0, no card required</td><td>The whole product, so you can judge it before you pay</td></tr>
<tr><td>Pro</td><td>From R97/month</td><td>Analytics, CRM, lead capture, card scanner, and more</td></tr>
<tr><td>Teams</td><td>From R97/card/month</td><td>Locked company branding and an admin dashboard</td></tr>
</tbody>
</table>

<p>See the full breakdown on the <a href="/pricing">pricing page</a>, or browse everything included on the <a href="/features">features page</a>. Want the physical tap experience too? A Cardtly NFC card is R150 once-off, or R200 designed around your brand, plus R100 shipping in South Africa, and it links straight to the digital card you already made.</p>

<p>A digital business card gives you a smarter, cheaper, and more useful way to share who you are. You can create yours in a few minutes and never run out of cards again.</p>`,
    faq: [
      { q: 'What is a digital business card?', a: 'A digital business card is an online version of a paper business card that lives as a web page holding your contact details, links, and social profiles. You share it by NFC tap, QR code, or a link, and the recipient can save your details straight to their phone with no app needed.' },
      { q: 'Do I need an NFC card to use a digital business card?', a: 'No. You can share your card by QR code or link without any hardware. An NFC card is an optional add-on from Cardtly, R150 once-off with your logo on our layout or R200 designed around your brand, plus R100 shipping in South Africa.' },
      { q: 'Does the person receiving my card need an app?', a: 'No. Your card opens as a normal web page in their browser, whether you share it by NFC, QR code, or link. They can also save your details to their phone contacts with one tap.' },
      { q: 'Is Cardtly free to try?', a: 'Yes. Every signup gets 7 days of the full product with no credit card required, including a customisable card, all three sharing methods, analytics, a contacts CRM and lead capture. After the 7 days it is from R97 a month, billed in rand through Paystack.' },
    ],
  },

  {
    slug: 'digital-business-cards-south-africa',
    title: 'Digital Business Cards South Africa: 2026 Guide',
    description:
      'The complete 2026 guide to digital business cards in South Africa. ZAR pricing, local NFC card delivery, WhatsApp sharing, and what Cardtly costs.',
    excerpt:
      'Everything South African professionals need to know about digital and NFC business cards in 2026, with ZAR pricing and local delivery.',
    date: '2026-07-02',
    readMins: 7,
    body: `<p>A digital business card is a shareable online version of your contact details that lives on your phone and opens in any web browser, so the person you meet can save your info instantly without an app or a paper card. <strong>Cardtly</strong> is a South African digital business card platform, built in South Africa, that lets you share your card by NFC tap, QR code, or a link over WhatsApp, and bills in rand through Paystack. You can start with no credit card, try everything for 7 days, and then keep it live from R97 a month.</p>

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
<tr><td>First 7 days</td><td>R0, no credit card</td><td>Everything below, so you can try it before you pay</td></tr>
<tr><td>Pro</td><td>From R97 / month</td><td>Analytics, lead capture and CRM, AI card scanner, Excel export, weekly digest</td></tr>
<tr><td>Physical NFC card</td><td>R150 standard or R200 custom, + R100 shipping per order in SA</td><td>A tap-to-share card linked to your profile</td></tr>
<tr><td>Teams</td><td>From R97 / card / month</td><td>Locked company branding, per-card billing, admin dashboard</td></tr>
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

<h2>How to get started</h2>
<p>Getting a card live takes a few minutes and costs nothing to try.</p>
<ol>
<li>Create your account. No credit card is needed for the first 7 days.</li>
<li>Pick one of the 16 templates and add your details, links, and logo.</li>
<li>Share your card by link, QR, or NFC, and start saving contacts.</li>
</ol>
<p>Analytics, lead capture and the AI card scanner are all in the 7 days, and keeping them is from R97 a month. If you run a team, the Teams plan keeps everyone on-brand from R97 per card. There is also an Android app on Google Play, with iOS on the way. Ready to begin? <a href="/signup">Create your card</a> and share it today.</p>`,
    faq: [
      { q: 'What is a digital business card?', a: 'A digital business card is an online version of your contact details that opens in any web browser when you share it by tap, QR code, or link. The person receiving it can save your details to their phone without downloading an app.' },
      { q: 'How much does a digital business card cost in South Africa?', a: 'Cardtly is from R97 a month, billed in rand through Paystack. Every signup gets 7 days first with no credit card required. An optional physical NFC card is R150 once-off, or R200 designed around your brand, plus R100 shipping within South Africa.' },
      { q: 'Do I need an NFC card to use Cardtly?', a: 'No. You can share your card by QR code or a link over WhatsApp, email, or SMS without any physical card. The NFC card is an optional add-on for tap-to-share convenience.' },
      { q: 'Does the person receiving my card need an app?', a: 'No. Your card opens in any standard web browser, and they can save your details straight to their phone contacts as a vCard with one tap.' },
      { q: 'Can I use Cardtly for my whole team?', a: 'Yes. Teams are from R97 per card per month and include locked company branding, per-card billing, and an admin dashboard so everyone stays on-brand.' },
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
<p>A paper card looks cheap per unit, but the real cost is repetition. Every time your number, title, or branding changes, the old box becomes scrap and you order another. A digital card removes that cycle. Cardtly gives you <strong>7 days free</strong> with no credit card required, and is from R97 a month after that. If you want the physical tap, an optional <a href="/nfc">NFC card</a> is R150 once-off, or R200 designed around your brand, plus R100 shipping in South Africa, and you keep using it for years without reprinting.</p>

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
<p>On cost, updates, sustainability, analytics, and reach, the <strong>NFC vs paper business cards</strong> comparison lands firmly on the digital side, with paper holding a small niche. The good news is you do not have to choose blind. You can <a href="/signup">create your digital card</a> in minutes, run it free for a week before you decide anything, and add an NFC card only if you want the tap. In 2026, that is the smarter way to share who you are.</p>`,
    faq: [
      { q: 'How does an NFC business card actually work?', a: 'An NFC business card has a small chip inside. When you tap it against the back of a modern phone, the phone reads the chip and opens your digital profile in the browser instantly. No app is needed on either phone.' },
      { q: 'Is an NFC card more expensive than printing paper cards?', a: 'Not over time. A paper card seems cheap per unit but you reprint every time details change. A Cardtly NFC card is R150 once-off, or R200 designed around your brand, plus R100 shipping in South Africa, and you reuse it for years, while the digital card behind it is from R97 a month however many times your details change.' },
      { q: 'Do people need an app to receive my digital or NFC card?', a: 'No. The recipient just taps, scans a QR code, or opens a link, and your profile opens in their normal browser. They can then save your details straight to their phone contacts with no app required.' },
      { q: 'Should I still keep paper business cards in 2026?', a: 'You can, and some settings still expect them since paper needs no phone or signal. Many professionals use a digital card as the everyday default and keep a small run of paper for the rare occasions that call for it.' },
    ],
  },

  {
    slug: 'how-to-make-a-free-digital-business-card',
    title: 'How to Make a Free Digital Business Card',
    description:
      'Create a digital business card in South Africa, free for 7 days. Step by step: sign up, pick a template, add your details, share by link, QR or NFC.',
    excerpt:
      'A beginner-friendly, step-by-step guide to making a digital business card, free for 7 days, that you can share by link, QR code or NFC tap.',
    date: '2026-07-03',
    readMins: 7,
    body: `<p>To make a digital business card free of charge, sign up on <a href="/signup">Cardtly</a>, pick one of the 16 templates, then add your name, role, contact details, socials and links. Customise the colours, fonts and logo, and you instantly get a public card URL like cardtly.com/card/yourname plus a downloadable QR code. Share it by link, QR code or an NFC tap, add it to Google Wallet, and track your views from your dashboard. It costs nothing to build and nothing for the first 7 days, with no credit card needed. Keeping it live after that is from R97 a month.</p>

<p>A paper business card gets lost, goes out of date the moment your number changes, and there is no way to know if anyone ever looked at it. A digital business card fixes all of that. It is a live web page, so you edit it once and everyone who already has your link sees the update. Below is the full walkthrough for South African professionals who are starting from scratch.</p>

<h2>Step by step: create your digital business card</h2>

<h3>1. Sign up</h3>
<p>Head to the <a href="/signup">sign up page</a> and create your account. No credit card is required, and you get 7 days with everything switched on, so you can build your whole card and share it before deciding anything. That is the part beginners worry about, and there is no catch to getting started: after the 7 days it is from R97 a month to keep your card live.</p>

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

<h2>What you get</h2>

<p>There is no cut-down version. Your 7 days are the complete product, and nothing is added or taken away when you start paying, so what you try is what you keep:</p>

<ul>
<li>Your public card URL and downloadable QR code</li>
<li>16 templates with full control of colours, fonts, logo and light or dark mode</li>
<li>Contact details, socials, custom links, gallery and WhatsApp button</li>
<li>Sharing by link, QR or NFC tap, and Add to Google Wallet</li>
<li>Analytics, lead capture and the contacts CRM</li>
<li>The AI paper card scanner, Excel export and the weekly digest email</li>
</ul>

<p>After the 7 days it is from R97 a month. If you decide not to continue, your card stops being served rather than dropping to a lesser version of itself, so it is worth deciding before the week is up.</p>

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

<p>Making a digital business card takes about ten minutes and costs nothing to start. You end up with a professional, shareable card that works from any phone, keeps itself up to date, and shows you exactly who is engaging. <a href="/signup">Create your digital business card now</a> and share it today.</p>`,
    faq: [
      { q: 'Is a digital business card really free to start?', a: 'Yes to start. Cardtly asks for no credit card and gives you 7 days with everything included, so you can build your card, get your public link and QR code, and share it before paying anything. Keeping it live after that is from R97 a month.' },
      { q: 'Does the person I share my card with need an app?', a: 'No. Your card is just a web page, so anyone can open it by link, QR scan or NFC tap on any phone. They can save your details straight to their contacts without downloading anything.' },
      { q: 'How do I share my digital business card?', a: 'Three ways: send the link over WhatsApp, email or SMS; let people scan your QR code; or tap an optional NFC card on a phone. You can also add your card to Google Wallet for quick access.' },
      { q: 'Do I need the physical NFC card to get started?', a: 'No. The NFC card is optional and costs R150 once-off, or R200 designed around your brand, plus R100 shipping in South Africa. Your link and QR code work on their own, so you can share your card straight away without any hardware.' },
    ],
  },
  {
    slug: 'digital-business-cards-for-teams',
    title: 'Digital Business Cards for Teams: A Rollout Guide',
    description:
      'How to roll out digital business cards across a team: seats, branding control, department structure, and what it costs per person in South Africa.',
    excerpt:
      'Ordering cards for one person is easy. Doing it for thirty, keeping them on brand, and handling the people who join and leave is the actual job.',
    date: '2026-07-20',
    readMins: 8,
    body: `<p>Buying a <strong>digital business card</strong> for yourself takes about two minutes. Rolling them out across a team is a different problem: you have thirty people, half of them will never open the settings screen, two are leaving next month, and the marketing manager wants every card to look the same.</p>

<p>This is a practical guide to doing that properly, written around what actually goes wrong.</p>

<h2>Decide who controls what, before you invite anyone</h2>

<p>This is the decision that determines whether the rollout holds together six months later. On any team card there are two kinds of field:</p>

<ul>
<li><strong>Company fields.</strong> Logo, company name, office number, website, address, social profiles, link buttons, gallery photos, and the card design itself. These should look identical on every card.</li>
<li><strong>Personal fields.</strong> Name, photo, job title, bio, mobile number. These belong to the individual and should stay editable.</li>
</ul>

<p>Cardtly lets an admin lock any of those company fields so members cannot change them. The important part is that locking is enforced on the server, not just hidden in the editor - a member cannot get around it with developer tools. Whatever you do not lock stays fully theirs to edit.</p>

<p>Get this right at the start. Unlocking later is easy; retrofitting consistency onto forty cards that have already drifted is not.</p>

<h2>Structure by department if you are more than about ten people</h2>

<p>A flat team works fine up to a point. Past that, one person approving every change becomes the bottleneck.</p>

<p>Departments give each area - Sales, Support, a branch office - its own head who invites their own people, applies their own look on top of the company brand, and sees their own numbers. A department head can lock more fields for their team, but cannot unlock anything the company has set. That ordering matters: it means delegation never weakens the company standard.</p>

<h2>What it costs, and where the line is</h2>

<p>Cardtly is <strong>from R97 per card per month</strong>. Self-serve billing covers 2 to 20 seats and is collected automatically. Above 20 seats it moves to a debit order arrangement rather than card payment, which is usually what a company that size wants anyway.</p>

<p>Every card is the full product rather than a stripped-down preview - there are no feature tiers to pick between, so a rollout does not start with a procurement argument about which plan each person needs. Trial periods are available on request if you want to onboard a team and settle the branding before billing starts.</p>

<p>If you want physical cards too, an NFC card is R150 once-off with your logo and colours on our layout, or R200 designed around your brand, plus R100 shipping in South Africa, delivered in 5 to 7 business days. Artwork and proofing are included in both. The physical card is optional - the digital card works by QR code and link without it.</p>

<h2>Invite in waves, not all at once</h2>

<p>The failure mode with a big-bang rollout is that twenty people hit the same confusion on the same afternoon and you spend a day answering the same question.</p>

<p>Start with one department. Get their cards right, note what confused them, then use that to write two or three lines of guidance for everyone else. An unclaimed card sits waiting with an invite against it, so you can create cards ahead of time and send invites when each group is ready.</p>

<h2>Plan for people leaving</h2>

<p>This is the part most teams do not think about until it happens. When someone leaves, their card is still out in the world - on other people's phones, in email signatures, possibly printed on an NFC card in a drawer.</p>

<p>Revoking a member removes their access but keeps the card, so the admin still controls what it says. That is usually what you want: the link someone saved six months ago should not break, it should show whoever took over the role.</p>

<h2>Measure whether it is actually being used</h2>

<p>The honest question after a rollout is whether people are sharing their cards at all. Per-person analytics answer it: views, taps, link clicks, and saved contacts for each team member, plus every lead they capture in one shared list.</p>

<p>If a rep has ten views in a month, they are not sharing their card, and no feature will fix that - it is a conversation, not a product problem. Seeing it in the numbers is what lets you have that conversation.</p>

<h2>The bits people forget to set up</h2>

<ul>
<li><strong>Email signatures.</strong> Every person on the team sends email all day. A signature with the card link and a QR code turns that into a sharing channel that needs no effort from anyone.</li>
<li><strong>Virtual backgrounds.</strong> On video calls, a background carrying a QR code lets anyone on the call get the card without asking.</li>
<li><strong>Industry.</strong> Setting it takes seconds and it is what makes a company findable by niche in the <a href="/network">Cardtly Network</a>, the directory other members search.</li>
</ul>

<h2>A rollout checklist</h2>

<ol>
<li>Decide which fields are company-controlled and lock them.</li>
<li>Set the team brand once - logo, colours, company details.</li>
<li>Create departments if you are over ten people, and appoint heads.</li>
<li>Roll out to one department first, then the rest.</li>
<li>Set up email signatures at the same time, not later.</li>
<li>Check per-person numbers after a month and act on the quiet ones.</li>
</ol>

<p>See <a href="/features">every feature grouped by what it does</a>, or <a href="/pricing">what a team of your size costs</a>.</p>`,
    faq: [
      {
        q: 'How many people can I have on a team account?',
        a: 'Self-serve billing covers 2 to 20 seats from R97 per card per month, collected automatically. Above 20 seats it moves to a debit order arrangement, which is usually what a company that size prefers anyway.',
      },
      {
        q: 'Can I stop staff changing the company logo on their card?',
        a: 'Yes. An admin chooses which fields are locked - company logo, company name, office number, website, address, social profiles, link buttons, gallery photos and the card design. Locking is enforced on the server, so a member cannot work around it. Everything you do not lock stays theirs to edit, including their name, photo, job title, bio and mobile number.',
      },
      {
        q: 'What happens to someone’s card when they leave the company?',
        a: 'Revoking their access removes their control of the card but keeps the card itself, so the admin decides what it shows. Links people saved months ago keep working and can point at whoever takes over the role, rather than breaking.',
      },
      {
        q: 'Do we have to pay before we can try it with the team?',
        a: 'No. Every card is the complete product, not a limited preview, and there are no feature tiers to choose between. If you need time to onboard everyone and settle the branding before billing starts, ask us about a trial period.',
      },
      {
        q: 'Can different departments have their own branding?',
        a: 'Yes. Each department can carry its own colours on top of the company look, and its head invites their own people and sees their own numbers. A department head can lock more fields for their team but cannot unlock anything the company has already locked.',
      },
    ],
  },
  {
    slug: 'business-card-costs-for-sales-teams',
    title: 'What Business Cards Really Cost a Sales Team',
    description:
      'Printed cards look cheap until you count reprints, staff changes and leads that never arrive. Here is the honest maths for a South African sales team.',
    excerpt:
      'The print quote is the smallest number in this calculation. The expensive parts are the reprint you did not plan and the lead that never reached your CRM.',
    date: '2026-07-20',
    readMins: 7,
    body: `<p>Printed business cards are cheap. That is the whole argument for them, and on the print quote alone it is a good one.</p>

<p>The problem is that the print quote is not the cost. This is an attempt to write down the rest of it honestly, including the parts that are hard to put a number on.</p>

<h2>The part you can price exactly</h2>

<p>Say a ten-person sales team, and say you pay R900 for a box of 500 cards. Use your own figure here - print prices vary enormously by finish and quantity, and any article quoting a single national rate is guessing.</p>

<p>Ten people, one box each, is R9 000. That is the number that goes in the budget.</p>

<p>For comparison, ten Cardtly cards at the starting price of <strong>R97 per card per month</strong> is R970 a month, or R11 640 a year. On the print quote alone, paper wins comfortably. If cards were printed once and never reprinted, the conversation would end here.</p>

<h2>The part everyone forgets: reprints</h2>

<p>Cards get reprinted for reasons nobody schedules:</p>

<ul>
<li>Someone is promoted and the job title is wrong.</li>
<li>The office moves.</li>
<li>The company rebrands, or the logo changes slightly.</li>
<li>A phone number or domain changes.</li>
<li>Somebody joins.</li>
</ul>

<p>Any one of those invalidates a box that is 80% full. Two reprints in a year and the R9 000 is R27 000, and you have thrown away roughly 800 printed cards.</p>

<p>A digital card has no equivalent event. You change the title once and every card already in circulation shows the new one, including the ones handed out last year.</p>

<h2>The part that actually costs money: leads that go nowhere</h2>

<p>This is the expensive one, and it is worth being careful rather than dramatic about it.</p>

<p>When you hand someone a paper card, what happens next is entirely out of your hands. They keep it or they do not. They type your details in correctly or they do not. They follow up or they forget. You will never know which, because a paper card sends no signal back.</p>

<p>You cannot put a confident number on that, and anyone who tells you they can is making it up. What you can say precisely is what the alternative gives you:</p>

<ul>
<li><strong>They save your details correctly.</strong> One tap adds you to their phone as a contact, so your number is not retyped wrong.</li>
<li><strong>You can see it happened.</strong> Views, taps, link clicks and saved contacts, per person on the team.</li>
<li><strong>The lead lands somewhere.</strong> A visitor who shares their details back appears in the owner’s dashboard and inbox, not on the back of a card in a jacket pocket.</li>
<li><strong>You can follow up the same day.</strong> Every captured lead has a one-tap WhatsApp button, which in South Africa is usually the channel that gets answered.</li>
</ul>

<p>The honest framing is not "digital cards win you X% more deals". It is that one of these two options tells you what happened after the handshake and the other does not.</p>

<h2>The staff turnover problem</h2>

<p>Sales teams turn over faster than most. Every departure leaves printed cards in circulation with a phone number that now rings a person who does not work there, and every arrival needs a new print run before they can attend anything.</p>

<p>With a digital card, a new starter has a working card the day they start, and a leaver’s card can be reassigned so the link keeps working and points at whoever took the accounts over.</p>

<h2>Where paper still makes sense</h2>

<p>Not everything favours digital, and it is worth saying so.</p>

<p>A physical card is still the more natural object to hand over. It works with no phone, no signal and no explanation. Some industries and some age groups simply expect one.</p>

<p>Which is why the useful answer is usually both: an NFC card is R150 once-off, or R200 designed around your brand, plus R100 shipping in South Africa, with artwork included. You hand over a physical card, it opens a digital one, and the details behind it stay current. See <a href="/nfc">what those look like printed</a>.</p>

<h2>The summary</h2>

<p>On a one-year view for ten people, printed cards start cheaper and stay cheaper only if nothing changes. In a sales team, something always changes. Add two reprints and the gap closes; add the fact that one option reports back and the other does not, and the comparison stops being about the print quote at all.</p>

<p>Work out your own number on the <a href="/pricing">pricing page</a>, or read the <a href="/blog/digital-business-cards-for-teams">team rollout guide</a>.</p>`,
    faq: [
      {
        q: 'Are digital business cards cheaper than printed ones?',
        a: 'Not on the print quote. Ten Cardtly cards cost R970 a month against a one-off print run that may be under R1 000. Digital gets cheaper once you count reprints - a promotion, an office move or a rebrand invalidates a box that is mostly full, and two reprints a year roughly triples the printing cost while a digital card updates for nothing.',
      },
      {
        q: 'What does a Cardtly card cost per person?',
        a: 'From R97 per card per month. Self-serve billing covers 2 to 20 seats; above that it moves to a debit order arrangement. Every card is the full product, and trial periods are available on request.',
      },
      {
        q: 'Do I still need printed cards?',
        a: 'Often yes, and that is fine. A physical card needs no phone, no signal and no explanation, and some industries still expect one. An NFC card is R150 once-off, or R200 designed around your brand, plus R100 shipping in South Africa with artwork included, and it opens your digital card when tapped, so the details behind it stay current.',
      },
      {
        q: 'How do I know whether my team is actually using their cards?',
        a: 'Per-person analytics show views, taps, link clicks and saved contacts for each team member, plus every lead they capture in one shared list. A rep with almost no views is not sharing their card, which is a management conversation rather than a product problem - but you have to be able to see it first.',
      },
    ],
  },
  {
    slug: 'employee-business-card-brand-consistency',
    title: 'Keeping Every Employee Business Card On Brand',
    description:
      'Logos drift, job titles go stale and everyone edits their own card. How to lock company branding across a team while leaving people their own details.',
    excerpt:
      'Brand guidelines do not survive contact with thirty people editing their own cards. Locking the company fields does, and it leaves the personal ones alone.',
    date: '2026-07-20',
    readMins: 6,
    body: `<p>Every company with more than about ten staff has the same quiet problem. Somebody has an old version of the logo. Somebody else wrote their job title in a way nobody else uses. One card lists the switchboard, another lists a mobile, a third lists both. None of it is anyone’s fault and all of it is visible to customers.</p>

<p>Brand guidelines do not fix this, because guidelines rely on people reading them. What fixes it is making the branded fields not editable in the first place.</p>

<h2>Separate the two kinds of field</h2>

<p>The useful distinction is between what represents the company and what represents the person.</p>

<p><strong>Company fields</strong> should be identical everywhere: company logo, company name, office number, website, address, social profiles, link buttons, gallery photos, and the card design itself. There is no good reason for these to differ between two people at the same business.</p>

<p><strong>Personal fields</strong> should stay with the individual: their name, photo, job title, bio and mobile number. Locking these achieves nothing and irritates people.</p>

<p>Cardtly lets an admin choose exactly which company fields are locked. Members see locked fields marked as set by the company rather than hidden, which matters - a field that silently disappears reads as a bug, while one that says who set it reads as a decision.</p>

<h2>Enforce it on the server, not in the interface</h2>

<p>This sounds like an implementation detail and is not. If the only thing stopping a member editing a locked field is that the input is disabled in their browser, then anyone who opens developer tools can send the change anyway - and the admin will believe the lock is holding when it is not.</p>

<p>A lock nobody can rely on is worse than no lock, because it produces false confidence. Cardtly enforces locks on the save endpoint, so what the browser sends is irrelevant to what reaches the card.</p>

<p>It is a fair question to ask of any tool you are evaluating: if I disable this field, what actually stops a determined member changing it?</p>

<h2>Let departments tighten, never loosen</h2>

<p>In a bigger company one person cannot approve everything, so department heads need real control. The ordering that keeps this safe is simple: a department head can lock <em>more</em> fields for their team, but cannot unlock anything the company has locked.</p>

<p>That way delegation never weakens the company standard. Sales can standardise their link buttons without being able to undo the logo lock.</p>

<h2>Set the brand once and apply it</h2>

<p>Rather than asking thirty people to upload the same logo, set the team brand once - logo, company name, website, colours - and apply it to every card. A department can carry its own colours on top of that if it needs to.</p>

<p>The practical benefit shows up at rebrand time. Changing the company logo becomes one change rather than a request to thirty people, of whom four will not do it and two will use the wrong file.</p>

<h2>The stale title problem</h2>

<p>Job titles go out of date faster than anything else on a card, and on paper they stay wrong until the next print run.</p>

<p>Leave job title unlocked - it is a personal field and people should maintain it - but understand what changes: on a digital card, when someone updates their title, every person who already has their card sees the new one. The correction reaches the people who received the card last year, which printing never does.</p>

<h2>What good looks like</h2>

<ul>
<li>One logo file, on every card, that you can change in one place.</li>
<li>Company phone, address and website identical everywhere.</li>
<li>Card design consistent, so two colleagues’ cards look related.</li>
<li>Name, photo, title, bio and mobile owned by the person.</li>
<li>Department heads able to tighten their own team’s standard.</li>
<li>Nothing relying on people remembering a PDF of guidelines.</li>
</ul>

<p>See <a href="/features">how the locks and team brand work</a>, or read the <a href="/blog/digital-business-cards-for-teams">rollout guide</a> for the order to do this in.</p>`,
    faq: [
      {
        q: 'Which fields can a company lock on an employee card?',
        a: 'Company logo, company name, office number, website, address, social profiles, link buttons, gallery photos and the card design. Anything not locked stays editable by the member, which normally means their name, photo, job title, bio and mobile number.',
      },
      {
        q: 'Can a staff member get around a locked field?',
        a: 'No. Locks are enforced on the save endpoint rather than only in the editor, so it does not matter what the browser sends. That distinction is worth checking in any tool you evaluate - a lock enforced only by a disabled input can be bypassed by anyone who opens developer tools, while the admin believes it is holding.',
      },
      {
        q: 'Can a department set its own branding?',
        a: 'Yes, on top of the company look. A department head can also lock further fields for their own team, but cannot unlock anything the company has locked, so delegating control never weakens the company standard.',
      },
      {
        q: 'What happens to cards already handed out when we rebrand?',
        a: 'They update. A digital card is a live page, so changing the company logo or details once changes every card already in circulation, including ones shared a year ago. There is no reprint and nothing to reissue.',
      },
    ],
  },
  {
    slug: 'trade-show-lead-capture',
    title: 'Trade Show Lead Capture That Survives Follow-Up',
    description:
      'Most expo leads die between the stand and the CRM. A practical system for capturing, qualifying and following up B2B leads from a South African trade show.',
    excerpt:
      'The leads are not lost at the stand. They are lost in the three days afterwards, in a pile of paper cards nobody has typed up yet.',
    date: '2026-07-20',
    readMins: 7,
    body: `<p>Every stand at every expo runs the same way. Three good days, a fishbowl of business cards, a stack of scribbled notes, and then everyone goes back to their normal job. Two weeks later somebody finds the cards and cannot remember which conversations were worth having.</p>

<p>The leads were not lost at the show. They were lost in the week afterwards. This is a system for not losing them.</p>

<h2>Fix the direction of the exchange</h2>

<p>The instinct at a stand is to hand out as many cards as possible. It feels productive and it is almost exactly backwards.</p>

<p>A card you hand out is a lead you do not have. You have given them the ability to contact you and kept nothing. Whether anything happens next is entirely their decision, and mostly nothing happens - not out of rudeness, but because they went to forty other stands that day.</p>

<p>The exchange you want is the other way round: they get your details, <em>and</em> you get theirs, in a form you still have on Monday.</p>

<h2>Capture on the spot, not afterwards</h2>

<p>Anything that relies on someone typing up notes later will not happen. The capture has to be finished before the conversation ends.</p>

<p>Practically, that means:</p>

<ul>
<li><strong>They open your card</strong> by tapping an NFC card or scanning a QR code. No app to install, which matters when someone is standing in a noisy hall holding a coffee.</li>
<li><strong>They save your details</strong> to their phone in one tap, so your number is stored correctly rather than typed in wrong.</li>
<li><strong>They share theirs back.</strong> After saving your details, the visitor is prompted to leave their own - and that lead lands in your dashboard and your inbox immediately, not in a fishbowl.</li>
</ul>

<p>The point is that the record exists before they walk away, while you still remember the conversation.</p>

<h2>Qualify while you can still remember</h2>

<p>Fifty leads with no context are barely more useful than none, because on Monday they are fifty identical names.</p>

<p>A short questionnaire on the card - up to five of your own questions - captures the context at the moment it is fresh. What are they looking for, what size is the project, when do they need it. The answers save against each lead, so the list you work through afterwards is sorted by something real rather than by the order the cards came out of the bowl.</p>

<p>Keep it to two or three questions at a stand. Nobody fills in a form standing up.</p>

<h2>Collect the paper cards anyway - then photograph them</h2>

<p>Plenty of people will still hand you a printed card, and refusing it is rude. Take it, then deal with it before you leave the hall.</p>

<p>Photographing a paper card and having the details extracted turns it into a saved contact in seconds. Do it at the stand between conversations rather than saving a pile for later, because later is exactly where these die.</p>

<h2>Follow up within 48 hours, on the channel they use</h2>

<p>Expo follow-up has a short half-life. After a week, they have forgotten which stand you were.</p>

<p>In South Africa the practical channel is usually WhatsApp rather than email - it gets read and it gets answered. Every captured lead has a one-tap WhatsApp button for exactly that reason.</p>

<p>The message that works is short and refers to something specific from the conversation. That is only possible if you captured context at the stand, which is the whole argument for the questionnaire.</p>

<h2>Work out afterwards whether the show was worth it</h2>

<p>Most exhibitors cannot answer this, which is why the decision to rebook is usually a feeling rather than a number.</p>

<p>If every lead is timestamped and attributed, you can count what the three days actually produced: how many people opened a card, how many saved your details, how many left theirs. Export the lot to Excel with sources and questionnaire answers, and the rebook conversation has evidence in it.</p>

<h2>A stand checklist</h2>

<ol>
<li>Everyone working the stand has a working card, tested that morning.</li>
<li>NFC cards and a printed QR code on the stand itself, not just on phones.</li>
<li>Two or three qualifying questions set up, no more.</li>
<li>Paper cards photographed at the stand, not taken home.</li>
<li>Follow-up started within 48 hours, on WhatsApp.</li>
<li>Numbers exported and reviewed before the rebook decision.</li>
</ol>

<p>See <a href="/features">how lead capture and the contacts list work</a>, or <a href="/nfc">order NFC cards for the stand</a> - R150 once-off, or R200 designed around your brand, plus R100 shipping per order, delivered in 5 to 7 business days, so allow time before the show.</p>`,
    faq: [
      {
        q: 'How do I capture leads at a trade show without an app?',
        a: 'The visitor taps an NFC card or scans a QR code to open your digital business card in their browser - nothing to install. They save your details in one tap, and are then prompted to share their own. That lead arrives in your dashboard and inbox straight away, so the record exists before the conversation ends.',
      },
      {
        q: 'What should I ask visitors at a stand?',
        a: 'Two or three questions, no more, because nobody completes a form standing up in a hall. What they are looking for, rough size or budget, and timing are usually enough to sort the list afterwards. Cardtly allows up to five of your own questions and saves the answers against each lead.',
      },
      {
        q: 'What do I do with the paper cards people hand me?',
        a: 'Take them - refusing is rude - then photograph them at the stand and let the details be extracted into your contacts. Doing it between conversations rather than saving a pile for the office is the difference between a usable list and a drawer.',
      },
      {
        q: 'How soon should I follow up after an expo?',
        a: 'Within 48 hours, while they can still place which stand you were. In South Africa WhatsApp usually gets answered where email does not, and every captured lead has a one-tap WhatsApp button. Referring to something specific from the conversation is what makes the message land, which is why capturing context at the stand matters.',
      },
      {
        q: 'How do I tell whether a trade show was worth the money?',
        a: 'Count what it produced rather than how it felt. Card opens, saved contacts and captured leads are all timestamped, and the full list exports to Excel with sources and questionnaire answers, so the decision to rebook can be made against evidence.',
      },
    ],
  },
  // Construction is the largest single industry on Cardtly's team accounts:
  // 14 of 37 team cards, against 7 for IT and 2 for motor. Nothing on the blog
  // spoke to it. Written from that data rather than from a guess about who
  // might be interested.
  {
    slug: 'digital-business-cards-for-construction',
    title: 'Digital Business Cards for Construction Companies',
    description:
      'Digital business cards for construction companies: branded cards for site teams, reassigned when people leave, and site-visit leads kept by the company.',
    excerpt:
      'A construction company is not one office. It is a head office, six sites and a rotating cast of subcontractors, and the paper card was designed for none of that.',
    date: '2026-09-08',
    readMins: 8,
    body: `<p>A construction company is not one office with everyone in it. It is a head office, a yard, half a dozen live sites, and a rotating cast of subcontractors who are with you for one project. The paper business card was designed for a person who sits at a desk and meets people in a boardroom, and that describes almost nobody in this industry.</p>

<p>This is how South African construction firms are actually using <strong>digital business cards for teams</strong>, and the specific problems they solve.</p>

<h2>The card does not survive the site</h2>

<p>Start with the physical reality. A printed card lives in a back pocket, in a bakkie, on a site where it is dusty in summer and wet in winter. By the time the site agent needs to hand one to a client on a walkabout, the box in the vehicle is bent, faded, or finished.</p>

<p>The people who most need to hand over details are the ones furthest from the stationery cupboard. Head office reprints for the whole company at once, so a site that runs out in month three waits until the next print run. In practice, the people on site stop handing out cards and start saying "I'll WhatsApp you", which works, except that nothing about the company goes with it.</p>

<p>A digital card removes the object entirely. The site agent shares from the phone already in their hand, by tap, QR code or a WhatsApp link, and the company's logo and branding go with it every time.</p>

<h2>Turnover is the real argument</h2>

<p>Construction has movement that most industries do not. Project teams are assembled and disbanded, people move between sites, and subcontract staff come and go with the contract.</p>

<p>With printed cards, every one of those events wastes money. You print 250 cards for a site agent who is on a different project in eight months, and the remaining 200 go in a drawer. Multiply that across a company of forty and the waste is not small, but it is also not the worst part.</p>

<p>The worst part is what happens to the contacts. When somebody leaves, the relationships they built leave with them - their phone, their WhatsApp history, their pile of cards from suppliers and clients. The company paid for the site, the vehicle and the salary, and kept none of the network that came out of it.</p>

<p>A team account inverts this. The cards belong to the company, not the person. When somebody leaves, their card is archived, which takes it offline immediately, and the seat is reissued to whoever replaces them. Every lead that card ever captured stays in the company's shared contact list.</p>

<h2>One group, several companies</h2>

<p>Construction groups are rarely one legal entity. A typical structure is a holding company over a building arm, a civils arm, maybe a plant hire business and an interiors division, each with its own name, its own branding, and often its own directors.</p>

<p>That structure breaks most software, which assumes one company with one logo. Cardtly has three levels: a group at the top, companies beneath it, and departments inside those. A group runs everything from one account, on one invoice and one seat pool, while each company keeps its own logo, colours and web address.</p>

<p>Each company chooses whether to wear the group look or its own, and the group owner can lock that choice. Departments inherit from their own company rather than from the group, so the civils arm stays consistent down its own structure even if it looks nothing like the interiors arm. Read more about <a href="/teams">how the group, company and department structure works</a>.</p>

<h2>Branding that survives a rebrand</h2>

<p>Every construction company has a story about the rebrand that cost a fortune in reprinting, or worse, the rebrand where half the company carried on using the old cards for two years because throwing away good stock felt wasteful.</p>

<p>Because a digital card is a live page, an administrator changes the logo, the head office address or the switchboard number once, and every card in the company updates at the same moment. Nothing is reprinted and nothing is left in circulation showing the old brand.</p>

<p>The same applies to what people are allowed to change. The company sets its brand at organisation level and locks the fields that must stay the same - logo, company name, website, head office address - while leaving the person's own details for them to keep current. A site agent updating their mobile number does not need to ask marketing, and cannot accidentally replace the company logo with a photo of a bakkie.</p>

<h2>Capturing the site visit</h2>

<p>A lot of construction business happens at a site, in a conversation with somebody who came to look at the work. A prospective client walking a completed unit, a specifier visiting to see a product in place, a homeowner who stopped because they saw the board.</p>

<p>These are among the warmest leads the business gets, and they are almost never recorded. The conversation ends with "send me a quote" and a number typed into a phone, and whether anything happens next depends on whether that person remembers.</p>

<p>The exchange that works is two-way. They open your card by tap or QR, save your details in one tap, and are then prompted to leave their own. That lead lands in the company's dashboard and inbox before they have left the site. Add two or three of your own questions - what the project is, roughly what size, when it starts - and the estimator picking it up on Monday has something to work from rather than a name.</p>

<h2>Where the QR code goes</h2>

<p>Construction has more good places to put a QR code than most industries, and almost all of them are already there:</p>

<ul>
<li><strong>The site board.</strong> Every site has one and everybody walking past reads it. A QR code on it turns a passing look into a saved contact.</li>
<li><strong>Vehicle branding.</strong> Bakkies and trucks are already carrying the logo and a phone number that nobody writes down at a traffic light.</li>
<li><strong>Hoarding and safety signage.</strong> Where the public spends the longest looking at your company name.</li>
<li><strong>Tender and prequalification documents.</strong> A card link next to each named team member, so the client can see who they will actually be dealing with.</li>
<li><strong>Email signatures.</strong> Generated from the card, so the whole company's signatures match and update with it.</li>
</ul>

<p>Each card keeps a permanent address of its own, so a QR code printed on a site board two years ago still opens a current card today. If a card's link is deliberately changed, the old one keeps redirecting.</p>

<h2>What it costs against what you print now</h2>

<p>The comparison most construction companies have not done is against their actual print spend, which is usually spread across a year and never added up.</p>

<p>Cardtly is from R97 per card per month. For a team of twenty that is R1 940 a month, and every card carries the full feature set - analytics, lead capture, the contacts list, the paper card scanner - with no cut-down tier. Teams of 2 to 20 seats are self-serve; above that it is quoted and billed by debit order, which is usually what a finance department wants anyway.</p>

<p>Physical <a href="/nfc">NFC cards</a> are optional and separate: R150 each with your logo on our layout, or R200 designed around your brand, once off, plus R100 shipping per order rather than per card. A set for the directors and the site agents who meet clients is the common pattern, with everyone else sharing by QR and link.</p>

<h2>A rollout that fits a construction company</h2>

<ol>
<li>Set up the group, then each company under it with its own logo and colours.</li>
<li>Lock the brand fields. Leave mobile numbers and titles unlocked.</li>
<li>Import the staff list from a spreadsheet, which payroll already has.</li>
<li>Send the invitations. Each person claims their card with one click, already branded.</li>
<li>Order NFC cards for the directors, estimators and site agents who meet clients face to face.</li>
<li>Put the QR code on the site boards and the vehicles at the next reprint, not before.</li>
<li>Check the dashboard after a month to see which cards are being shared and which have never been opened.</li>
</ol>

<p>That last step is the one companies skip and then regret. Issuing cards is not the same as people using them, and the difference is visible without having to ask anyone.</p>

<p>See <a href="/teams">Cardtly for teams</a>, or <a href="/pricing">what it costs</a>.</p>`,
    faq: [
      {
        q: 'Why do construction companies move away from printed business cards?',
        a: 'Three reasons, in order of cost. Cards do not survive a site, so the people who most need them run out first. Turnover wastes most of every print run, because a site agent who moves to another project in eight months leaves 200 cards in a drawer. And when somebody leaves, the contacts they built leave with them, because the cards and the WhatsApp history are on their phone. A team account keeps the cards and the captured leads with the company.',
      },
      {
        q: 'Can one account cover a holding company with several construction businesses?',
        a: 'Yes. Cardtly has three levels: a group, companies beneath it, and departments inside those. A group with a building arm, a civils arm and a plant hire business runs all of them from one account, on one invoice and one seat pool, while each keeps its own logo, colours and web address. Each company chooses whether to wear the group look or its own, and the group owner can lock that choice.',
      },
      {
        q: 'What happens to a card when a site agent leaves?',
        a: 'The administrator archives it, which takes it offline immediately, and the seat is reissued to their replacement. Every lead that card captured stays in the company\'s shared contacts list and can still be exported. Nothing has to be reprinted for the person taking over, because their card is created branded and ready.',
      },
      {
        q: 'Where should a construction company put its QR code?',
        a: 'The places that already exist and already get looked at: the site board, vehicle branding, hoarding and safety signage, tender and prequalification documents, and email signatures. Each card keeps a permanent address, so a QR code printed on a site board two years ago still opens a current card today.',
      },
      {
        q: 'What does it cost for a construction team of twenty?',
        a: 'From R97 per card per month, so R1 940 a month for twenty, with every feature included and no cut-down tier. Teams of 2 to 20 seats are self-serve; above that it is quoted and billed by debit order. Physical NFC cards are optional at R150 each, or R200 designed around your brand, once off, plus R100 shipping per order.',
      },
    ],
  },
  // POPIA comes up in every tender and in most enterprise conversations, and
  // no South African digital card competitor has written it up properly.
  // Written after auditing Cardtly's own position, so the claims here about
  // hosting, data subject rights and sub-processors are measured rather than
  // aspirational. Deliberately does NOT claim the lead capture form carries a
  // privacy notice, because it does not yet.
  {
    slug: 'digital-business-cards-and-popia',
    title: 'Digital Business Cards and POPIA: What to Do',
    description:
      'Capturing a lead makes you the responsible party under POPIA. What the Act requires of a digital business card, and what to ask a vendor before you sign.',
    excerpt:
      'The moment someone fills in their details on your card, POPIA applies to you, not to your card provider. Here is what that actually requires.',
    date: '2026-09-14',
    readMins: 9,
    body: `<p>The Protection of Personal Information Act applies to any South African business that processes personal information, and a business card is personal information by definition: a name, a phone number, an email address, an employer.</p>

<p>Most people assume this is their software vendor's problem. It is not. The moment somebody fills in their details on your card, <strong>you</strong> are the responsible party for that record. The vendor is your operator, which makes them accountable to you, and you accountable to the person whose details you now hold.</p>

<p>This is a practical guide to what that means day to day, and what to ask a vendor before you commit. It is not legal advice, and a compliance officer at a large organisation will want more detail than this.</p>

<h2>What counts as processing</h2>

<p>POPIA defines processing very broadly: collecting, storing, using, sharing and deleting all count. So does simply holding a list.</p>

<p>Practically, a digital business card involves processing at three points, and they have different obligations:</p>

<ul>
<li><strong>Your own staff details</strong> on the cards you issue. You are processing your employees' information, which you already do for payroll.</li>
<li><strong>The leads you capture.</strong> Someone gives you their name and number through your card. This is the part most businesses handle worst.</li>
<li><strong>The analytics.</strong> Card views and clicks, which are generally not personal information unless tied to an identified person.</li>
</ul>

<h2>Tell people what you are collecting and why</h2>

<p>Section 18 is the one that gets skipped. When you collect personal information directly from someone, you have to tell them who is collecting it, why, and whether giving it is voluntary or required.</p>

<p>This does not mean a page of legal text on a form somebody is filling in while standing up at an expo. It means a short, honest line near the field: who you are, what you will use it for, and a link to your privacy policy. "We will use this to follow up on your enquiry" is a legitimate purpose, plainly stated.</p>

<p>What it rules out is collecting an email address to follow up on an enquiry and then adding it to a monthly newsletter. That is a different purpose, and it needs its own consent. Section 69 governs direct marketing specifically, and it is stricter than most South African businesses behave as though it is.</p>

<h2>Keep it only as long as you need it</h2>

<p>Section 14 says you may not keep personal information for longer than is necessary for the purpose you collected it for. A lead from an expo three years ago that never went anywhere is not something you have a reason to still hold.</p>

<p>The practical version is a retention habit rather than a policy document: review the captured list periodically and delete what is dead. If your card platform lets you delete contacts and export what remains, this takes an afternoon a year.</p>

<h2>Secure it, and be able to prove you did</h2>

<p>Section 19 requires appropriate, reasonable technical and organisational measures to protect personal information. The Act does not prescribe a specific technology, which is why "appropriate" is doing a lot of work in that sentence.</p>

<p>For a hosted card platform, the questions worth asking are concrete:</p>

<ul>
<li>Is the data encrypted in transit and at rest?</li>
<li>Can anyone read another customer's records? Ask how it is enforced, not whether it is.</li>
<li>Who inside the vendor can see your data, and is that access logged?</li>
<li>Are leads captured by your staff visible to other customers of the same platform?</li>
</ul>

<p>The best answer to the second question is that the database itself refuses the record, rather than the application remembering to filter it. That is the difference between a rule that holds when a page has a bug and one that does not.</p>

<h2>Know where the data physically sits</h2>

<p>Section 72 restricts sending personal information outside South Africa. This is the question a procurement or compliance reviewer asks first, and most vendors cannot answer it on the spot.</p>

<p>It is not a prohibition. Transfer is permitted where the receiving country's law provides adequate protection substantially similar to POPIA, and separately where the transfer is necessary to perform the contract with the person concerned. The European Union is the jurisdiction that "adequate" is usually measured against, and GDPR is at least as strict as POPIA rather than weaker.</p>

<p>So "our database is in the EU" is a good answer, not an embarrassing one. What matters is that the vendor knows, says so in their privacy policy rather than burying it, and can tell you which sub-processors are involved. Cardtly's database runs in the EU, and the privacy policy names every sub-processor along with the retention periods.</p>

<p>The only version that needs care is a hard data residency requirement, which turns up in public sector tenders. If your tender says the data must stay in South Africa, ask early, because moving a database region is a migration and not a setting.</p>

<h2>People can ask for their data, and ask you to delete it</h2>

<p>Sections 23 to 25 give a data subject the right to ask what you hold about them and to have it corrected or deleted. Somebody who left their details at your stand can ask you to remove them, and you have to be able to do it.</p>

<p>This is worth testing rather than assuming. Can you find every record for one person, and can you remove it? If the answer involves a spreadsheet somebody downloaded and emailed around, you have a problem that is not about software.</p>

<p>The same right applies to you as a customer of your card platform. Ask whether you can export everything the platform holds about your account, and whether you can delete the account and have the data actually go. Cardtly does both without a support ticket: a single file containing everything held about the account, and a deletion that cascades through leads, cards, teams, organisations and billing.</p>

<h2>Have a plan for the day it goes wrong</h2>

<p>Section 22 requires notification to the Information Regulator and to the affected people as soon as reasonably possible after a breach. Nobody enjoys this conversation, which is why most businesses have never had it in advance.</p>

<p>Two questions decide whether you can comply at all. Would you know? And could you say what was affected?</p>

<p>The second is the one that turns a bad day into a much worse one. Without a log of who changed what and when, a breach investigation becomes guesswork, and "we cannot determine the scope" is not an answer the Regulator finds reassuring.</p>

<h2>What to ask before you sign</h2>

<p>A short list you can send a vendor, and which any serious one can answer in a paragraph each:</p>

<ol>
<li>Where is the data hosted, and does personal information leave South Africa?</li>
<li>Who are your sub-processors, and are they named publicly?</li>
<li>How is one customer's data kept separate from another's, technically?</li>
<li>Can I export everything you hold about my account, myself?</li>
<li>Can I delete my account and have the data actually removed, and what is the backup window?</li>
<li>What are your retention periods?</li>
<li>Is administrative access to customer data logged?</li>
<li>What is your breach notification process, and what would you be able to tell me?</li>
</ol>

<p>The answers matter less than whether they arrive quickly and specifically. A vendor who needs two weeks to find out where their own database is has told you something.</p>

<h2>The short version</h2>

<p>POPIA is not the obstacle to digital business cards that people assume. A digital card is generally easier to comply with than a paper one, because the records are in one place that can be searched, exported and deleted, rather than in a drawer of cards, a spreadsheet on a laptop and a WhatsApp history.</p>

<p>What you have to do is tell people what you are collecting and why, keep it no longer than you need, secure it, know where it lives, and be able to find and delete it when somebody asks. None of that is exotic. Most of it is a habit rather than a project.</p>

<p>See <a href="/privacy">Cardtly's privacy policy</a> for sub-processors and retention periods, or <a href="/contact">ask us a specific question</a> if you are working through a tender.</p>`,
    faq: [
      {
        q: 'Does POPIA apply to digital business cards?',
        a: 'Yes, because a name, phone number and email address are personal information. The important point is who it applies to: when someone fills in their details on your card, you are the responsible party for that record, and your card platform is your operator. The obligation to tell people what you are collecting and why sits with you, not with the vendor.',
      },
      {
        q: 'Do I need consent to capture a lead on my digital business card?',
        a: 'Consent is one lawful basis but not the only one, and for a genuine enquiry the purpose is usually obvious enough to satisfy the Act. What section 18 does require is that you tell the person who is collecting the information and why, in plain language, near the field. Where consent clearly matters is direct marketing under section 69: using an address you collected to answer an enquiry for a newsletter instead is a different purpose and needs its own permission.',
      },
      {
        q: 'Is it a POPIA problem if the data is hosted outside South Africa?',
        a: 'Not in itself. Section 72 permits cross-border transfer where the receiving jurisdiction provides adequate protection substantially similar to POPIA, and separately where the transfer is necessary to perform the contract. The EU is the benchmark adequacy is usually measured against, and GDPR is at least as strict as POPIA. What matters is that the vendor knows where the data sits, discloses it in their privacy policy, and names their sub-processors. A hard data residency requirement in a public sector tender is a different conversation and worth raising early.',
      },
      {
        q: 'How long can I keep leads I captured at an expo?',
        a: 'Section 14 says no longer than is necessary for the purpose you collected them for, which for a dead enquiry from three years ago is difficult to argue. The practical approach is a retention habit rather than a policy document: review the captured list periodically and delete what has gone nowhere. If the platform lets you export and delete contacts, this is an afternoon a year.',
      },
      {
        q: 'What should I ask a digital business card vendor about POPIA?',
        a: 'Eight questions, and how fast they answer tells you as much as the answers. Where is the data hosted and does it leave South Africa; who are your sub-processors and are they named publicly; how is one customer\'s data separated from another\'s technically; can I export everything myself; can I delete my account and have the data removed, and what is the backup window; what are your retention periods; is administrative access logged; and what is your breach notification process. A vendor who needs two weeks to find out where their own database is has told you something.',
      },
    ],
  },

  {
    slug: 'digital-business-cards-for-car-dealerships',
    title: 'Digital Business Cards for Car Dealerships',
    description:
      'Digital business cards for car dealerships that lead with stock, not the salesperson. Put vehicles and prices on the card and keep leads when staff move.',
    excerpt:
      'A dealership card has the wrong thing on it. The buyer came for the car, and the card opens with a photograph of the salesperson.',
    date: '2026-09-23',
    readMins: 8,
    body: `<p>Walk onto any forecourt in the country and watch what a buyer actually does. They look at the metal. They walk around it, they check the mileage, they ask what it is going for. Somewhere in the next twenty minutes they learn the salesperson's name, and by the following week they have forgotten it.</p>

<p>Every business card ever printed for a dealership gets this backwards. It opens with the person, because that is what a business card is, and the person is the part the buyer cares least about. This is how South African dealers are using <strong>digital business cards for car dealerships</strong> to put the stock first, and the specific problems it solves.</p>

<h2>The card should lead with the car</h2>

<p>Cardtly has a template built for this called Showroom, and it inverts the usual layout on purpose. A photograph fills the top of the card, the dealership's name carries the headline, and the salesperson is a small round chip you tap to ask about a vehicle.</p>

<p>Under that sits a gallery of up to ten vehicles, and each one carries a caption and its own link. So a listing reads "2021 Ranger Wildtrak, 64 000 km, R589 000" under the photograph, and tapping it opens that unit on your website. That is the difference between a business card and a pocket-sized stock list.</p>

<p>Three buttons lead the rest of the card, and the dealer writes them. Most choose a version of book a test drive, value my trade-in, and apply for finance, because those are the three things a buyer on a forecourt is actually trying to do. They sit above everything else rather than fourth in a list under "Our Facebook".</p>

<h2>The floor turns over and the cards do not</h2>

<p>Vehicle sales has staff movement that most industries would find alarming. A salesperson who stays three years is a veteran, and a dealer principal budgets for a floor that looks different at the end of the year to how it looked at the start.</p>

<p>Printed cards make every one of those moves cost money twice. You print 250 for somebody who leaves in month seven, and the other 190 go in a drawer. Then you print again for their replacement, who may also leave.</p>

<p>The worse cost is invisible. When a salesperson walks, the relationships go with them - the phone, the WhatsApp threads, the buyers who said "call me in March when my balloon is up". The dealership paid for the floor, the stock, the advertising and the salary, and kept none of the pipeline that came out of it.</p>

<p>A team account turns that around. The cards belong to the dealership, not the person. When somebody leaves, their card is archived, which takes it offline the same minute, and the seat goes to whoever replaces them. Every lead that card ever captured stays in the dealership's shared contact list.</p>

<h2>South African buyers are on WhatsApp</h2>

<p>This is not a small detail here. A buyer who is interested but not ready does not want a phone call at work, and will not fill in a form. They want to message.</p>

<p>Every card carries a WhatsApp button, and the card itself can be sent to a number as a WhatsApp or SMS link, so a salesperson who takes a call from a listing can put their whole card in the buyer's hand before the call ends. The buyer taps once to save the details to their phone contacts, and the dealership is stored properly instead of as "Ford guy".</p>

<h2>Stock photographs, framed by the dealer</h2>

<p>A vehicle photograph is a wide shot of a long object, and a card is a tall rectangle. Left alone, a browser crops from the middle of the picture, which on a forecourt shot is usually tarmac and sky with the roof of the car cut off.</p>

<p>Cardtly lets you drag the photograph inside the frame to choose which part survives the crop, on the hero image and on every gallery photo. It takes a few seconds per picture and it is the difference between a listing that looks like a listing and one that looks like a mistake.</p>

<h2>A group with four franchises is still one account</h2>

<p>Motor groups are rarely one brand. A typical structure is a holding company over several franchises, each with a manufacturer's corporate identity that is not negotiable, plus a used-vehicle operation with branding of its own.</p>

<p>That breaks most software, which assumes one company with one logo. Cardtly has three levels: a group at the top, companies beneath it, and departments inside those. The group is billed once on one invoice from one seat pool, while each franchise keeps its own logo, colours and web address.</p>

<p>Departments inherit from their own franchise rather than from the group, so new-vehicle sales, used vehicles, service and parts stay consistent inside their own brand. Read more about <a href="/teams">how the group, company and department structure works</a>.</p>

<h2>What it costs against printing</h2>

<p>The comparison most dealers run is against their current print bill, so here it is plainly.</p>

<table>
<thead>
<tr><th></th><th>Printed cards</th><th>Cardtly</th></tr>
</thead>
<tbody>
<tr><td>New salesperson starts</td><td>Print run, wait for delivery</td><td>Card live the same day</td></tr>
<tr><td>Salesperson leaves</td><td>Remaining cards wasted</td><td>Seat reassigned, card archived</td></tr>
<tr><td>Price or model change</td><td>Reprint, or hand out stale cards</td><td>Edit once, live everywhere</td></tr>
<tr><td>Stock on the card</td><td>None</td><td>Ten vehicles with prices and links</td></tr>
<tr><td>Leads when somebody walks</td><td>Leave with them</td><td>Stay with the dealership</td></tr>
<tr><td>Cost</td><td>Per print run, repeated</td><td>From R97 per card a month</td></tr>
</tbody>
</table>

<h2>Getting the floor onto it</h2>

<p>The order that works is to set the dealership up first and add people second, so nobody builds a card that has to be corrected later.</p>

<ol>
<li><strong>Set the brand once.</strong> Logo, dealership name, website, address and switchboard, then lock the fields that must not change. A salesperson can edit their own name, photograph, cell number and job title, and nothing else, unless you decide otherwise.</li>
<li><strong>Choose Showroom and load the stock.</strong> Hero photograph across the top, then up to ten vehicles with a price under each. One person doing this for the whole floor is faster than sixteen people each doing their own.</li>
<li><strong>Write the three lead buttons.</strong> Test drive, trade-in valuation, finance application, pointed at whichever pages or forms you already use.</li>
<li><strong>Add the salespeople.</strong> Seats can be added one at a time or imported from a spreadsheet for a whole floor at once.</li>
<li><strong>Decide how they share it.</strong> The QR code and link work immediately on every card. An <a href="/nfc">NFC card</a> for the tap is optional, at R150 once-off with your logo on our layout or R200 designed around your brand, plus R100 shipping per order in South Africa.</li>
</ol>

<h2>The part that pays for itself</h2>

<p>Ask a dealer principal how many enquiries came off the floor last month and most can answer. Ask which salesperson's card was opened, how often, and what the buyer tapped once it was open, and almost nobody can.</p>

<p>Every card reports its views, its taps and its saves, and every contact captured lands in a shared list the dealership owns. When a salesperson resigns, you do not lose the pipeline and you do not spend a fortnight reconstructing it from a phone nobody can unlock.</p>

<p>If you want to see it before committing, every signup gets 7 days of the full product with no credit card. Build one card for one salesperson, load ten vehicles into it, and hand it to a buyer on Saturday.</p>`,
    faq: [
      {
        q: 'What makes a digital business card different for a car dealership?',
        a: 'The layout. A normal business card opens with the person, and a buyer on a forecourt came for the vehicle. Cardtly has a template called Showroom that puts a photograph across the top, the dealership name as the headline, and the salesperson as a small chip, with up to ten vehicles underneath, each with a price caption and its own link.',
      },
      {
        q: 'Can I put stock and prices on a digital business card?',
        a: 'Yes. The gallery holds up to ten photographs, and each one takes a caption and a link. A caption like "2021 Ranger Wildtrak, 64 000 km, R589 000" sits under the picture, and tapping it opens that unit on your website.',
      },
      {
        q: 'What happens to the leads when a salesperson leaves?',
        a: 'They stay with the dealership. On a team account the cards belong to the company, so an archived card goes offline immediately, the seat is reassigned to the replacement, and every contact that card captured remains in the shared list in the team dashboard.',
      },
      {
        q: 'Can a motor group with several franchises use one account?',
        a: 'Yes. A group sits above several companies, and each franchise keeps its own logo, colours and web address while the group is billed once from one seat pool. Departments such as new vehicles, used vehicles, service and parts inherit from their own franchise rather than from the group.',
      },
      {
        q: 'How much does it cost for a dealership?',
        a: 'From R97 per card a month, billed in rand through Paystack, with 7 days of the full product first and no credit card required. A physical NFC card is optional at R150 once-off with your logo on our layout, or R200 designed around your brand, plus R100 shipping per order in South Africa.',
      },
      {
        q: 'Do buyers need an app to open the card?',
        a: 'No. The card opens as an ordinary web page whether you share it by tap, QR code, or a WhatsApp link, and the buyer can save your details to their phone contacts with one tap.',
      },
    ],
  },

  {
    slug: 'digital-business-cards-for-corporate-companies',
    title: 'Digital Business Cards for Corporate Companies',
    description:
      'Digital business cards for corporate companies: lock branding, run several brands on one account, roll out in bulk and keep the leads when staff leave.',
    excerpt:
      'One person with the wrong logo is a mistake. Two hundred people each ordering their own cards is a brand with no owner.',
    date: '2026-09-23',
    readMins: 9,
    body: `<p>In a company of eight, business cards are stationery. Somebody orders a box, everybody takes a handful, and the logo is right because one person chose it.</p>

<p>In a company of eight hundred, they are a control problem. Cards get ordered by region, by division, by whoever has a budget code and a deadline, and within two years there are four versions of the logo in circulation, three phone numbers for a switchboard that moved, and a set of job titles HR has never seen. Nobody decided this. It is just what happens when a physical object is printed by many people over a long time.</p>

<p>This is what changes when a corporate moves to <strong>digital business cards</strong>, and the questions procurement will ask before it signs anything.</p>

<h2>Branding stops being a request</h2>

<p>The usual method for keeping cards on-brand is asking people nicely and checking at the proof stage. It works until somebody is in a hurry.</p>

<p>On a team account, an administrator sets the logo, company name, website, address and social profiles once, and then chooses which of those an employee may change. A locked field is not a rule in a brand manual. The editor will not let it be typed, and the server refuses the write even if somebody opens the browser tools and tries to send it anyway.</p>

<p>What stays personal is the part that should be: name, photograph, direct line, cell number. What the company standardises is the part that carries the brand. A job title can go either way, which matters more than it sounds - locking it means the company decides what somebody's title is, rather than the person deciding for themselves.</p>

<h2>Corporates are not one company</h2>

<p>Most large South African businesses are a group. A holding company over several operating companies, each with its own name, its own registration, often its own board, and sometimes branding that shares nothing but a shareholder.</p>

<p>Cardtly has three levels for this: a group at the top, companies beneath it, and departments inside those. The group is billed once, from one seat pool, on one invoice, while each operating company keeps its own logo, colours and slice of the web address.</p>

<p>Each company chooses whether to wear the group look or its own, and the group owner can lock that choice. Departments inherit from their own company rather than from the group, so a subsidiary stays internally consistent even when it looks nothing like its parent. Department heads can tighten the rules for their own people without being given control of the whole group.</p>

<h2>Onboarding and offboarding stop being print jobs</h2>

<p>The week somebody starts, a corporate has to get them a laptop, an email address, a building card and, eventually, business cards. The cards are always last because they involve an outside supplier and a minimum order quantity.</p>

<p>A digital card is issued the same day, from the same dashboard, by the same person who does the rest of it. A whole intake can be imported from a spreadsheet in one go rather than typed in one at a time.</p>

<p>Offboarding is the half nobody plans for and the half that matters. When an employee leaves a company with printed cards, several hundred of those cards are in other people's wallets, and they keep working. The number on them still rings. A digital card is archived and it is offline immediately, everywhere, including the copy somebody saved to their phone months ago.</p>

<h2>The leads belong to the company</h2>

<p>This is the argument that usually lands in a boardroom, because it is the one with money attached.</p>

<p>When a salesperson at a large company leaves, the network leaves too. The contacts are in their phone, the conversations are in their WhatsApp, and the pile of cards they collected at three years of conferences is in their drawer. The company paid for every one of those trips.</p>

<p>Cards on a team account capture contacts into a shared list the company owns. Somebody scanning a paper card into the app, somebody exchanging details at a conference, somebody filling in a lead form on a card - all of it lands somewhere the company can still see it after that employee has gone.</p>

<h2>What procurement will ask</h2>

<p>Corporate buying is a different exercise to a small business signing up, and the questions arrive in a predictable order.</p>

<table>
<thead>
<tr><th>Question</th><th>Answer</th></tr>
</thead>
<tbody>
<tr><td>Who controls what staff can put on a card?</td><td>The company admin, field by field, enforced on the server</td></tr>
<tr><td>What happens when someone leaves?</td><td>Card archived and offline immediately, seat reassigned</td></tr>
<tr><td>Who owns the contacts collected?</td><td>The company, in a shared list in the team dashboard</td></tr>
<tr><td>Can we run several brands?</td><td>Yes, group over companies over departments</td></tr>
<tr><td>Can we add people in bulk?</td><td>Yes, spreadsheet import</td></tr>
<tr><td>Can it talk to our systems?</td><td>Yes, through a team API key</td></tr>
<tr><td>How is it billed?</td><td>From R97 per card a month in rand, one invoice for the group</td></tr>
<tr><td>What about POPIA?</td><td>See the questions below</td></tr>
</tbody>
</table>

<p>Self-serve covers 2 to 20 cards. Above twenty, the sizing and the invoicing are arranged directly, which is usually what a corporate wants anyway.</p>

<h2>POPIA is a procurement question, not a footnote</h2>

<p>A business card holds personal information, so a card platform processes personal information on the company's behalf, which makes it an operator under POPIA. That is not alarming, but it does mean somebody in legal will want answers before the rollout.</p>

<p>The questions worth asking any vendor are where the data is hosted, who the sub-processors are, how one customer's data is separated from another's, whether you can export everything yourself, and what happens to it when you leave. We wrote those out in full, with what a good answer looks like, in <a href="/blog/digital-business-cards-and-popia">digital business cards and POPIA</a>.</p>

<h2>What employees actually get</h2>

<p>None of the control matters if the thing is unpleasant to use, because people quietly stop sharing it.</p>

<p>An employee gets a card that opens as a normal web page for whoever receives it, with no app to download on either side. They share it by tap, by QR code, or as a link over WhatsApp or email. They pick from 16 designed templates, within whatever the company has locked. They can carry up to ten custom links and a gallery of up to ten photographs, and they can see how often their own card was opened and what people tapped.</p>

<p>The recipient saves the details to their phone with one tap, which is the whole point, and is the part a paper card has never managed.</p>

<h2>How a rollout usually goes</h2>

<ol>
<li><strong>Set the group and the companies.</strong> Get the structure right before anybody is invited, because moving people afterwards is more work than doing it once.</li>
<li><strong>Brand each company and lock the fields.</strong> Decide deliberately what an employee may change. Most corporates lock logo, company name, website, address and socials, and leave name, photograph and direct line open.</li>
<li><strong>Pilot one department.</strong> Twenty people for a month tells you more than a policy document. Sales is the usual choice because they will complain fastest if something is wrong.</li>
<li><strong>Import the rest.</strong> A spreadsheet per company, rather than a form per person.</li>
<li><strong>Decide about NFC.</strong> The QR code and the link need no hardware. Physical <a href="/nfc">NFC cards</a> are optional at R150 once-off with your logo on our layout, or R200 designed around your brand, plus R100 shipping per order in South Africa.</li>
</ol>

<p>Every signup gets 7 days of the full product with no credit card required, which is enough to run the pilot before anybody signs a purchase order. See <a href="/teams">how team accounts work</a> or read the comparison of <a href="/blog/business-card-costs-for-sales-teams">what business cards cost a sales team</a>.</p>`,
    faq: [
      {
        q: 'How do digital business cards keep a large company on-brand?',
        a: 'An administrator sets the logo, company name, website, address and social profiles once, then chooses which fields an employee may change. A locked field is enforced on the server, not just hidden in the editor, so it cannot be written even by someone bypassing the interface.',
      },
      {
        q: 'Can one account hold several operating companies?',
        a: 'Yes. Cardtly has three levels: a group at the top, companies beneath it, and departments inside those. Each company keeps its own logo, colours and web address while the group is billed once from one seat pool, and departments inherit from their own company rather than from the group.',
      },
      {
        q: 'What happens to an employee card when they resign?',
        a: 'It is archived from the team dashboard and goes offline immediately, including for anyone who saved the link. The seat is reassigned to their replacement, and every contact that card captured stays in the company shared list.',
      },
      {
        q: 'Who owns the contacts an employee collects?',
        a: 'The company. Contacts captured through a card, scanned from a paper card, or exchanged at an event land in a shared list in the team dashboard, so a person leaving does not take the network with them.',
      },
      {
        q: 'How many cards can a company have?',
        a: '2 to 20 cards can be set up self-serve. Above twenty, sizing and invoicing are arranged directly with Cardtly, which is usually what a larger company prefers.',
      },
      {
        q: 'Does Cardtly comply with POPIA?',
        a: 'A card platform processes personal information on the company behalf, which makes it an operator under POPIA. The questions worth putting to any vendor are where data is hosted, who the sub-processors are, how customer data is separated, whether you can export everything, and what happens to it when you leave. Those are set out in full in our POPIA guide.',
      },
      {
        q: 'Can we add staff in bulk and connect it to our systems?',
        a: 'Yes. A whole intake can be imported from a spreadsheet rather than added one at a time, and a team API key is available for connecting card creation to your own systems.',
      },
    ],
  },
  {
    slug: 'best-digital-business-card',
    title: 'How to Choose the Best Digital Business Card',
    description:
      'Comparing digital business card apps? A 10-point checklist: sharing, saving to phone, lead capture, team control, privacy and pricing, plus red flags.',
    excerpt:
      'Most digital business cards look alike in a demo. Ten questions that separate the ones that work in a real meeting from the ones that do not.',
    date: '2026-10-14',
    readMins: 8,
    body: `<p>The best digital business card is the one the other person can open without installing anything, save to their phone in one tap, and still find you on months later. Everything else, the templates, the animations, the extras, matters less than those three things. This guide is a checklist for comparing digital business card apps, written for anyone about to choose one for themselves or for a whole team.</p>

<p>Most products in this space look alike in a demo. The differences show up later: when a client cannot open your card because it needs an app, when you rename your card and every printed QR code points at nothing, or when a salesperson leaves and takes every lead with them. Here is what to check before you commit.</p>

<h2>The checklist at a glance</h2>

<table>
<thead>
<tr><th>What to check</th><th>Why it matters</th></tr>
</thead>
<tbody>
<tr><td>1. Opens without an app</td><td>The person you meet will not install anything to see your details.</td></tr>
<tr><td>2. Saves to contacts in one tap</td><td>A card that is not saved is forgotten by Friday.</td></tr>
<tr><td>3. Shares by NFC, QR code and link</td><td>You meet people in person, on screens and over WhatsApp.</td></tr>
<tr><td>4. A link you control</td><td>Printed QR codes and NFC cards must keep working when details change.</td></tr>
<tr><td>5. Captures leads, not just views</td><td>Views do not pay. Contacts you can follow up do.</td></tr>
<tr><td>6. Analytics you can act on</td><td>You should know which events and channels actually work.</td></tr>
<tr><td>7. Design without a designer</td><td>It has to look like your brand on day one.</td></tr>
<tr><td>8. Company control</td><td>A business needs one brand, locked fields and leads it owns.</td></tr>
<tr><td>9. Privacy</td><td>You are collecting other people's personal information.</td></tr>
<tr><td>10. Honest pricing</td><td>Something given away can be taken away.</td></tr>
</tbody>
</table>

<h2>1. It opens without an app</h2>

<p>This is the single most important test. A <strong>digital business card</strong> is only useful if the person receiving it can see it straight away, on whatever phone they have, without downloading anything or creating an account. If a product asks the recipient to install its app, most people will simply not bother, and your card never reaches them.</p>

<p>Ask the vendor to send you a card and open it on a phone that has never seen their product. It should load as an ordinary web page.</p>

<h2>2. It saves to the phone in one tap</h2>

<p>A card that is looked at and closed is barely better than no card. What you want is your name, number, email and company landing in the other person's contacts, spelled correctly, so you show up when they search for you next month. Good platforms do this with a standard contact file (a vCard) behind a single Save button that works on iPhone and Android alike.</p>

<p>Check that the saved contact includes your photo, job title and company, not only a name and a number.</p>

<h2>3. It shares three ways: NFC, QR code and link</h2>

<p>You will hand your card over in very different situations, so one sharing method is not enough:</p>

<ul>
<li><strong>NFC tap</strong> for meetings in person. Hold an NFC card near their phone and your card opens. It is the quickest option, and it feels like handing over a business card.</li>
<li><strong>QR code</strong> for screens, slides, stands, name badges and print. Every modern phone camera reads one. Our guide to <a href="/blog/qr-code-business-card">QR code business cards</a> covers how to make one people actually manage to scan.</li>
<li><strong>A link</strong> for WhatsApp, email and SMS, when you are not in the same room.</li>
</ul>

<p>All three should open the same card. With Cardtly they come with every card, and the physical <a href="/nfc">NFC card</a> is an optional once-off extra rather than a requirement.</p>

<h2>4. You control a link that survives change</h2>

<p>This one catches people a year in. Your QR code is printed on a banner, your NFC card is in your wallet, and your link sits in a hundred email signatures. Then you rename the card or change role, the link changes with it, and every printed copy goes dead.</p>

<p>Look for a short, readable link you choose yourself, such as cardtly.com/card/yourname, and a clear answer on what happens when you rename it. On Cardtly the old address keeps redirecting to the new one, so anything already printed still works. If a vendor's answer is that the old link simply stops, everything you print is on borrowed time.</p>

<h2>5. It captures leads, not just views</h2>

<p>A view count tells you somebody opened your card. A lead tells you who. The better platforms turn a card into a way for the other person to give you their details too:</p>

<ul>
<li>a contact exchange that invites them to share their details back after saving yours,</li>
<li>a short form with your own questions, so you know what they are interested in,</li>
<li>a book-a-meeting button that sends the request straight to you,</li>
<li>one list of every lead, with a one-tap WhatsApp follow-up and an export to Excel.</li>
</ul>

<p>If you meet people at events, this is where the return on a card comes from. Our <a href="/blog/trade-show-lead-capture">trade show lead capture guide</a> covers how to make those leads survive the trip back to the office.</p>

<h2>6. The analytics answer real questions</h2>

<p>Useful analytics answer the questions you would actually ask. How many people opened my card this week? How many saved me? Which links did they click? Did the expo produce anything? Per-card views, taps, link clicks and saved contacts are the minimum, and it helps to see how people arrived: a QR scan, an NFC tap, your email signature or a card you sent on WhatsApp.</p>

<p>For a team, you want the same numbers per person, so a manager can see whose card is working and whose is sitting in a drawer. Be wary of one big number with no breakdown. Views on their own are easy to inflate and hard to act on.</p>

<h2>7. It looks like your brand without a designer</h2>

<p>You should be able to make a card that looks like your business on the first day: your logo, your exact colours rather than the nearest preset, a font that suits you, and a layout that fits what you do. A car salesperson wants stock photos up front, while a consultant wants a clean profile and a booking button. Check that you can set any colour by its hex code, upload your own logo and photos, and reframe a photo so faces and products are not cropped awkwardly.</p>

<h2>8. It gives a company control</h2>

<p>If you are buying for a team, this is where products differ the most. The questions to ask:</p>

<ul>
<li>Can the company set its logo, colours and design once and apply them to every card?</li>
<li>Can it lock specific fields, such as the company name, office number and website, while each person still edits their own name, photo and mobile number?</li>
<li>Can it split the company into departments or branches, each with its own manager?</li>
<li>Does the company own the leads its cards capture, so a person leaving does not take the contacts with them?</li>
<li>Can a card be switched off the day somebody resigns?</li>
</ul>

<p>Our guides to <a href="/blog/digital-business-cards-for-teams">digital business cards for teams</a> and <a href="/blog/employee-business-card-brand-consistency">keeping every employee card on brand</a> go into each of these in detail.</p>

<h2>9. It takes privacy seriously</h2>

<p>A digital business card collects personal information: the details of everyone who saves your card or fills in your form. In South Africa that brings POPIA into play, and other countries have similar laws. Ask where the data is hosted, who can see it, whether you can export everything, and what happens to it when you leave. A directory of users should never publish phone numbers or email addresses, and people should be able to take themselves out of it. Our <a href="/blog/digital-business-cards-and-popia">POPIA guide</a> lists the questions to put to any vendor.</p>

<h2>10. The price is honest</h2>

<p>Pricing in this market comes in three shapes: a monthly subscription per card, a once-off fee for a physical NFC card, and no-cost versions with limits. Watch for three things:</p>

<ul>
<li><strong>Versions you do not pay for that shrink.</strong> What a company gives away is often the first thing it changes. If your whole sales team depends on it, you are exposed to that decision.</li>
<li><strong>Prices in another currency.</strong> A dollar price billed in rand moves with the exchange rate every month.</li>
<li><strong>Hardware that only works with one service.</strong> An NFC card should open an ordinary web link, so it does not become useless if you ever move.</li>
</ul>

<p>Cardtly costs from R97 per card per month in South African rand, with every feature on every card and no permanent free tier to be withdrawn later. An NFC card is an optional once-off purchase: R150 for the standard design or R200 for a custom one, plus R100 shipping per order within South Africa. The <a href="/pricing">pricing page</a> has the details.</p>

<h2>Red flags</h2>

<ul>
<li>The person receiving your card has to install an app.</li>
<li>Your link changes when you edit your name, with no redirect.</li>
<li>You cannot export your contacts.</li>
<li>Leads go to the individual only, with no copy for the company.</li>
<li>The NFC card can only be set up by the vendor and only opens their app.</li>
<li>There is no way to see whether anyone opened your card.</li>
</ul>

<h2>How Cardtly measures up</h2>

<p>Cardtly is a South African digital business card platform used by individuals, teams and companies here and abroad. Every card opens in any phone browser with no app, saves to contacts in one tap, and shares by NFC tap, QR code or link. You choose your own short link, and renaming it keeps the old one redirecting. A card holds up to 10 custom links, a gallery of up to 10 photos, social profiles, WhatsApp and a booking button, and every lead lands in a contacts list with WhatsApp follow-up and Excel export.</p>

<p>For companies, Cardtly runs a group, its companies and their departments from one account. Set the brand once, lock the fields that must stay the same, and keep every lead in a shared company list. Teams of 2 to 20 cards are self-serve, and larger companies are set up directly. See everything on the <a href="/features">features page</a>, or read <a href="/teams">how Cardtly works for teams</a>.</p>`,
    faq: [
      {
        q: 'What is the best digital business card app?',
        a: 'The best one opens without an app for the person receiving it, saves to their contacts in one tap, shares by NFC, QR code and link, captures leads you can follow up, and keeps your link working when your details change. For a company, add central brand control, locked fields and leads the company owns.',
      },
      {
        q: 'Do people need an app to open a digital business card?',
        a: 'They should not. A good digital business card is an ordinary web page that opens in any phone browser. Cardtly cards need no app to view or save.',
      },
      {
        q: 'Is a no-cost digital business card good enough?',
        a: 'For trying the idea, often yes. For a business, check what happens if that version changes, whether you can export your contacts, and whether your link and printed QR codes keep working if you move. Cardtly has no permanent free tier: every card has the full feature set from R97 per card per month.',
      },
      {
        q: 'How much does a digital business card cost in South Africa?',
        a: 'Most are priced per card per month, with NFC cards sold once-off. Cardtly is from R97 per card per month in rand, and an optional NFC card is R150 standard or R200 custom, plus R100 shipping per order in South Africa.',
      },
      {
        q: 'Can a company manage digital business cards for its staff?',
        a: 'Yes, if the platform supports teams. Look for one place to set the brand, locks on the fields that must stay the same, departments with their own managers, and leads that belong to the company. Cardtly does all four, self-serve for 2 to 20 cards.',
      },
    ],
  },
  {
    slug: 'qr-code-business-card',
    title: 'QR Code Business Cards: How to Make One That Works',
    description:
      'A QR code business card opens your details with one phone scan. How to make one people actually scan, where to put it, and the mistakes that break it.',
    excerpt:
      'A QR code is the easiest way onto somebody else\'s phone. Most are printed too small, too pale, or pointing at the wrong thing.',
    date: '2026-10-14',
    readMins: 7,
    body: `<p>A QR code business card is a QR code that opens your contact details when somebody points a phone camera at it. The best ones do not hold your details inside the code. They point at a <a href="/blog/what-is-a-digital-business-card">digital business card</a> online, so the person scanning sees your photo, number, email, links and a Save button, and you can change any of it later without reprinting a thing.</p>

<p>Every modern phone reads QR codes with its built-in camera, so nobody needs an app. That makes a QR code the simplest way to get your card onto somebody else's phone from a printed card, a screen, a stand or a slide. This guide covers how they work, how to make one people actually manage to scan, where to put it, and the mistakes that quietly break it.</p>

<h2>How a QR code business card works</h2>

<p>A QR code is a picture of a short piece of text. For a business card, that text is usually one of two things:</p>

<ul>
<li><strong>Your details themselves</strong>, written into the code as a contact file (a vCard). Scanning offers to save the contact straight away.</li>
<li><strong>A link to your digital business card.</strong> Scanning opens your card as a web page, where the person can save you, message you on WhatsApp, open your links or book a meeting.</li>
</ul>

<p>Both work on the day you print them. Only one keeps working afterwards.</p>

<h2>Contact-file codes versus link codes</h2>

<table>
<thead>
<tr><th></th><th>vCard code</th><th>Link code</th></tr>
</thead>
<tbody>
<tr><td>New number</td><td>Reprint</td><td>Edit once</td></tr>
<tr><td>Opens</td><td>A contact</td><td>Your full card</td></tr>
<tr><td>Scans</td><td>Dense, slower</td><td>Simple, quick</td></tr>
<tr><td>Tracked</td><td>No</td><td>Yes</td></tr>
<tr><td>Leads</td><td>No</td><td>Yes</td></tr>
<tr><td>No signal</td><td>Works</td><td>Needs data</td></tr>
</tbody>
</table>

<p>A contact-file code packs everything into the pattern, so a full set of details makes a dense, fiddly code that small or older phone cameras struggle with. Worse, it is frozen: change your mobile number and every printed code hands out the wrong one. A link code holds only a short web address, so it stays simple to read, and what it opens is always your current card. Unless you genuinely need it to work with no signal, point your QR code at a link.</p>

<h2>How to make a QR code business card</h2>

<ol>
<li><strong>Make your digital business card.</strong> Add your name, role, photo, contact details and links. This is what people see when they scan.</li>
<li><strong>Choose a short link you will keep.</strong> Something like cardtly.com/card/yourname. The code points at it, so pick one you are happy to print. If you rename it later, Cardtly keeps the old link redirecting, so printed codes still work.</li>
<li><strong>Style the code.</strong> Pick a colour and decide what goes in the middle: your logo, the Cardtly mark or nothing. Keep the contrast high, as explained below.</li>
<li><strong>Download the right size.</strong> A small image suits email and slides, a large one posters and PDFs, and a print size or a vector SVG anything printed big. A vector file stays sharp at any size.</li>
<li><strong>Test it.</strong> Scan it with at least two phones, an iPhone and an Android, from the distance people will really stand.</li>
</ol>

<p>Every Cardtly card has a QR page that does all of this. It deepens a colour that is too pale to scan reliably, switches on the strongest error correction whenever there is a logo in the middle so the logo cannot stop the code reading, and lets you choose the colour behind your logo. Downloads come in web, large and print sizes, as a vector SVG, or as a ready-made print card with your name under the code.</p>

<h2>Design rules that keep it scannable</h2>

<ul>
<li><strong>Dark on light.</strong> Phone cameras look for dark squares on a light background. A dark code on white is safest. A pale code, or a light code on a dark background, fails on many phones.</li>
<li><strong>High contrast.</strong> Your brand colour is fine if it is dark enough. Pale gold, mint and sky blue usually are not, which is why Cardtly deepens a pale colour until it scans.</li>
<li><strong>A quiet border.</strong> Keep a clear margin of plain background around the code. Text, frames or graphics pressed right up against it confuse scanners.</li>
<li><strong>Size it for the distance.</strong> A good rule of thumb is that a code scans from about ten times its width. On a business card, 2 cm across is the practical minimum and 2.5 cm is safer. On a banner read from three metres away it needs to be around 30 cm.</li>
<li><strong>A modest logo.</strong> A logo in the middle works because QR codes carry spare information to survive damage. Keep it small and centred, and never stretch or rotate the code.</li>
<li><strong>A matte finish.</strong> Gloss, foil and laminate can bounce light straight back into the camera. A matte finish behind the code scans more reliably.</li>
<li><strong>Say what it does.</strong> "Scan to save my details" gets more scans than a code on its own.</li>
</ul>

<h2>Where to put your QR code</h2>

<ul>
<li><strong>The back of a paper card.</strong> Keep the paper cards you still need, and let the code turn each one into your full, current card.</li>
<li><strong>Your email signature.</strong> Cardtly's signature generator can add your QR code beside your details.</li>
<li><strong>Video calls.</strong> A branded virtual background with your QR code works on Zoom and Teams, so people on the call can scan you straight off the screen.</li>
<li><strong>Your last slide.</strong> Leave it up during questions.</li>
<li><strong>Name badges and expo stands.</strong> Visitors scan without queueing for a card. Our <a href="/blog/trade-show-lead-capture">trade show guide</a> covers turning those scans into leads.</li>
<li><strong>Vehicles, shopfronts and site boards.</strong> Anywhere people stand still for a few seconds.</li>
<li><strong>Quotes and invoices.</strong> So a customer can save the person who quoted them.</li>
</ul>

<h2>Know where your scans come from</h2>

<p>A printed code is only worth its space if people use it. Cardtly puts a small marker on the link inside each code it makes, so your analytics show how people arrived: a scan of your QR code, a tap of your NFC card, the QR in your email signature, the one on your virtual background, or a card you sent on WhatsApp. That tells you whether the code on your stand, your slides or your vehicle is actually earning its place.</p>

<h2>QR code or NFC?</h2>

<p>Both, ideally. A QR code works with any camera, from whatever distance you print it for, and costs nothing to add to things you already print. An <a href="/nfc">NFC card</a> is quicker face to face: a tap with no aiming, which feels like handing over a business card. Both open the same digital card, so you use whichever suits the moment. Our comparison of <a href="/blog/nfc-vs-paper-business-cards">NFC and paper business cards</a> covers the trade-offs in more detail, and our checklist on <a href="/blog/best-digital-business-card">choosing the best digital business card</a> covers what else to look for.</p>

<h2>Common mistakes</h2>

<ul>
<li><strong>Pointing the code at your website's home page.</strong> The person wanted your details, not your company history. Point it at your card.</li>
<li><strong>Printing a contact-file code, then changing your number.</strong> Every printed copy is now wrong.</li>
<li><strong>Printing too small or too pale.</strong> If it takes three attempts, most people give up after one.</li>
<li><strong>Using a QR service that can expire.</strong> Some short-link QR services stop redirecting when an account lapses, or start showing adverts. Your code should point at an address you control.</li>
<li><strong>Not testing the print.</strong> Scan the printed proof, not just the file on your screen.</li>
</ul>`,
    faq: [
      {
        q: 'Do people need an app to scan a QR code business card?',
        a: 'No. The camera app on any recent iPhone or Android phone reads QR codes. The code opens your card in the phone browser, with nothing to install.',
      },
      {
        q: 'Can I change my details after printing the QR code?',
        a: 'Yes, if the code points at a digital business card rather than holding your details itself. Edit the card and every printed code shows the new version. With Cardtly, even renaming your link keeps the old one redirecting.',
      },
      {
        q: 'What size should a QR code be on a business card?',
        a: 'At least 2 cm across, and 2.5 cm is safer, with a plain margin around it. As a rule of thumb a code scans from about ten times its width, so codes on stands and banners need to be much larger.',
      },
      {
        q: 'Can I put my logo in the middle of a QR code?',
        a: 'Yes. QR codes carry spare information so they survive damage, and a small centred logo uses some of it. Cardtly switches on the strongest error correction whenever you add a logo, and you can choose the colour behind it.',
      },
      {
        q: 'Is a QR code business card safe?',
        a: 'It is as safe as the page it opens. Point it at a card with a provider you trust and a link you control, and only put on the card what you are happy for anyone holding it to see.',
      },
    ],
  },
  {
    slug: 'digital-business-cards-for-real-estate-agents',
    title: 'Digital Business Cards for Real Estate Agents',
    description:
      'Digital business cards for estate agents: listings with prices on the card, a QR code on every board, show day leads captured, and an agency that keeps them.',
    excerpt:
      'An estate agent hands out more cards than almost anyone, and most of them end up in a show-house bin. The card should carry the listings, not just the name.',
    date: '2026-10-14',
    readMins: 8,
    body: `<p>Stand at the door of a show house on a Sunday afternoon and count the business cards that leave with visitors. Then count how many of those visitors phone the agent afterwards. The first number is large. The second is small, and the cards are in a car door pocket or a kitchen bin by Monday.</p>

<p>Estate agents hand out more business cards than almost anyone, and the card does very little of the work. It carries a name and a number, while the thing the buyer actually cared about, the house, is nowhere on it. This is how agents and agencies are using <strong>digital business cards for real estate</strong> to put listings on the card, turn show day visitors into leads, and keep those leads when agents move on.</p>

<h2>The card should carry the listings</h2>

<p>A buyer remembers the house, not the agent. So the card should open with property. Cardtly has a layout called Showroom, built first for car dealerships, that does exactly this: a photograph fills the top of the card, the agency name carries the headline, and the agent is a small round chip below it.</p>

<p>Underneath sits a gallery of up to ten listings. Each photo takes a caption and its own link, so a listing reads "3 bed, 2 bath, Fourways, R2 450 000" under the picture, and tapping it opens that property on your website or the portal it is listed on. When a property sells, swap the photo for the next listing. Nothing is reprinted, and every card already handed out shows the new stock.</p>

<p>Agents who prefer a more personal card can use any other layout and still keep the listings gallery. Either way, you can drag and zoom each photo inside its frame, so the front of the house is what shows rather than the sky above it.</p>

<h2>Show day leads that survive until Monday</h2>

<p>The paper register at the front door is the weakest part of a show day. Handwriting is hard to read, numbers are wrong, and the page holds every visitor's details in plain view of the next person signing in.</p>

<p>Put a QR code on a stand at the door with "Scan to register and get the details" underneath. The visitor scans with their phone camera, no app needed, and lands on your card. From there:</p>

<ul>
<li>they save your details to their phone in one tap,</li>
<li>a contact exchange invites them to share theirs back, so you have a correct number and email,</li>
<li>up to five questions of your own ask what matters, such as buying or selling, budget, area, and whether they have a home to sell first,</li>
<li>the book-a-meeting button lets them request a time for a private viewing, and you are emailed straight away.</li>
</ul>

<p>Every one of those leads lands in a contacts list with a one-tap WhatsApp button, so the follow-up message on Sunday evening takes a minute, not an hour of deciphering a register. If you run show days often, our <a href="/blog/trade-show-lead-capture">lead capture guide</a> covers the follow-up habits that turn a list into appointments.</p>

<h2>A QR code on every board</h2>

<p>An estate agent already prints more than most businesses: For Sale boards, show-house signs, window cards, brochures and flyers. Each one is a place a QR code can send a buyer straight to you.</p>

<p>Cardtly marks the link inside each QR code, so your analytics show how people arrived: a scan of a board or brochure, a tap of your NFC card, a link you sent on WhatsApp, or the QR in your email signature. That tells you which boards and which suburbs are producing interest, rather than guessing. Our guide to <a href="/blog/qr-code-business-card">QR code business cards</a> covers the size and contrast rules that keep a code scannable on a board seen from the pavement.</p>

<h2>Buyers and sellers are on WhatsApp</h2>

<p>South African property runs on WhatsApp. A buyer who saw a board on the way home will message before they call. Every card carries a WhatsApp button, and an agent can send their whole card to a number as a WhatsApp or SMS link while they are still on the phone with a buyer, so the buyer saves the agent properly instead of as "estate agent Saturday".</p>

<h2>Agents move, and the database should stay</h2>

<p>Agents change agencies more often than most professionals change jobs, and when they leave, the database usually leaves with them: the WhatsApp threads, the buyers waiting for a three-bedroom in the right school zone, the sellers who said to call in spring.</p>

<p>On a team account, the cards belong to the agency. When an agent leaves, their card is archived and goes offline immediately, and the seat goes to whoever replaces them. Every contact the card captured, from every show day and every board, stays in the agency's shared contact list. The principal keeps the pipeline the agency paid to build.</p>

<h2>One brand across every branch</h2>

<p>Agencies grow by branches and franchises, and keeping every agent's card on brand is a constant job. Cardtly runs a group, the companies inside it and their departments from one account. A franchise group can sit at the top, each franchisee office as a company with its own manager, and each office's teams, such as sales and rentals, as departments.</p>

<p>The principal sets the logo, colours, office number, address and website once, applies that look to every agent's card, and locks what must stay the same. Each agent still edits their own name, photo, title and mobile number. Leave the Skills and accreditations field open, so each agent can show their own designation and Fidelity Fund Certificate number rather than one copied from the principal's card. Our guide to <a href="/blog/employee-business-card-brand-consistency">keeping every employee card on brand</a> covers which fields agencies usually lock.</p>

<h2>Printed cards against digital</h2>

<table>
<thead>
<tr><th></th><th>Printed</th><th>Cardtly</th></tr>
</thead>
<tbody>
<tr><td>Listings</td><td>None</td><td>Ten, with prices and links</td></tr>
<tr><td>Show day</td><td>Paper register</td><td>Scan, save, leads</td></tr>
<tr><td>Property sells</td><td>Card goes stale</td><td>Swap the photo</td></tr>
<tr><td>Agent leaves</td><td>Leads leave too</td><td>Leads stay</td></tr>
<tr><td>Cost</td><td>Each print run</td><td>From R97 per card a month</td></tr>
</tbody>
</table>

<h2>Setting up an agency</h2>

<ol>
<li><strong>Set the brand once.</strong> Logo, agency name, office number, address and website on the principal's card, then apply that look to every agent's card and lock the fields that must not change.</li>
<li><strong>Choose a layout and load the listings.</strong> Showroom puts property first. Add up to ten listings with a price caption and a link under each.</li>
<li><strong>Write your show day questions.</strong> Buying or selling, budget, area and timing are a good start.</li>
<li><strong>Add the agents.</strong> One at a time, or a whole office at once from a spreadsheet.</li>
<li><strong>Print the QR codes.</strong> Boards, show-house stands, window cards and brochures. An <a href="/nfc">NFC card</a> for the tap is optional, at R150 once-off with your logo on our layout or R200 designed around your brand, plus R100 shipping per order in South Africa.</li>
</ol>

<p>Every signup gets 7 days of the full product with no credit card, so an agent can build a card, load this weekend's listings and use it at Sunday's show day before anyone commits. Agencies setting up more than one agent can read how <a href="/teams">Cardtly works for teams</a>.</p>`,
    faq: [
      {
        q: 'What should an estate agent put on a digital business card?',
        a: 'Name, photo, mobile and WhatsApp, the agency details, and your current listings. Cardtly holds up to ten listings in a gallery, each with a caption such as the price and suburb and a link to the property, plus a book-a-meeting button for viewings and your own short questions for buyers.',
      },
      {
        q: 'Can a digital business card replace the show-house register?',
        a: 'It can do the same job better. Visitors scan a QR code at the door, save your details, share theirs back and answer up to five questions, and every lead lands in your contacts list with a WhatsApp button, instead of on a paper page every other visitor can read.',
      },
      {
        q: 'What happens to an agent\'s contacts when they leave the agency?',
        a: 'On a team account they stay with the agency. The departing agent\'s card is archived and goes offline immediately, the seat is reassigned, and every contact the card captured remains in the agency\'s shared list.',
      },
      {
        q: 'Can I put a QR code on For Sale boards?',
        a: 'Yes. Any board, sign, brochure or window card can carry your card\'s QR code, and Cardtly\'s analytics show scans separately from NFC taps and links sent on WhatsApp, so you can see which boards are producing interest.',
      },
      {
        q: 'Can a franchise group manage all its offices in one account?',
        a: 'Yes. A group sits at the top, each office is a company with its own manager, and teams such as sales and rentals are departments. The brand is set once and locked where it must stay the same, while each agent edits their own details.',
      },
      {
        q: 'How much does it cost?',
        a: 'From R97 per card a month, billed in rand, with 7 days of the full product first and no credit card required. An NFC card is optional at R150 once-off with your logo, or R200 designed around your brand, plus R100 shipping per order in South Africa.',
      },
    ],
  },
  {
    slug: 'digital-business-cards-for-financial-advisors',
    title: 'Digital Business Cards for Financial Advisors',
    description:
      'Digital business cards for financial advisors and brokers: approved firm wording on every card, meetings booked from the card, and client details kept safe.',
    excerpt:
      'An adviser\'s card is the first thing a client checks before trusting them with their money. It should say exactly what compliance signed off, every time.',
    date: '2026-10-14',
    readMins: 8,
    body: `<p>Before a client trusts somebody with their retirement, their medical aid or their family's cover, they check who that person is. They look at the card, they look up the firm, and they notice whether the details match. In a regulated business, a business card is not just contact details. It is the first thing a client uses to decide whether you are legitimate.</p>

<p>That makes cards awkward for advisory firms. Every adviser wants their own card, and every card has to say the same thing about the firm, worded exactly as compliance approved it. This is how financial advisers, insurance brokers and the firms they work for are using <strong>digital business cards</strong> to get both.</p>

<h2>The firm's wording, the same on every card</h2>

<p>Advisory firms are regulated, and what goes in front of a client is not a free-for-all. Most firms want the registered name, the FSP number, the office details and an approved paragraph about the business on every card, exactly as it was signed off, with no adviser improvising their own version.</p>

<p>On a Cardtly team account, the firm sets its look on one main card, applies it to every adviser's card, and locks what must stay the same in Company rules. Locked items then come from that main card on every adviser's card, and the advisers cannot change them:</p>

<ul>
<li><strong>Company name and logo,</strong> so the registered name appears consistently.</li>
<li><strong>Office number, address and website,</strong> so clients always reach the firm, not an old cellphone.</li>
<li><strong>Bio,</strong> which can carry the approved paragraph about the firm, including its FSP number and the products it is licensed for.</li>
<li><strong>Design,</strong> so every card looks like the firm.</li>
</ul>

<p>Change the wording on the main card, and every adviser's card shows the new version the same minute. There is no reprint and no adviser left handing out last year's disclosure. Check with your compliance officer what belongs on a client-facing card; once it is decided, the card enforces it.</p>

<h2>Each adviser's own credentials</h2>

<p>Clients want to know the person, not just the firm: who they are, what they are qualified in, how to reach them directly. Each adviser keeps control of their own name, photo, job title and mobile number. Leave the Skills and accreditations field open in Company rules, so each adviser shows their own qualifications and designations. Locked, every card would show the same list, copied from the firm's main card.</p>

<h2>Meetings booked from the card</h2>

<p>Most advice starts with a meeting, and most clients put off booking one. Every card carries a book-a-meeting button: the client requests a time from the card, the adviser is emailed straight away, and the client is saved to their contacts.</p>

<p>A short questionnaire on the card, up to five questions of the firm's choosing, can ask what the client wants to discuss before the meeting: retirement, investments, medical aid, life or short-term cover. The answers are saved against the lead, so the adviser walks into the meeting prepared rather than starting from a blank page.</p>

<h2>Referrals that arrive properly</h2>

<p>Advice grows by referral. A happy client says "speak to my adviser" and forwards a contact, often with the number typed wrong. Send the client your card as a link instead, and they forward that. Whoever opens it gets the adviser's full, current card, saves it in one tap, and is invited to share their own details back, so the referral lands as a proper lead instead of a missed call from an unknown number.</p>

<h2>Client details, handled with care</h2>

<p>Financial advice runs on personal information, and South Africa's POPIA applies to every lead a card captures. Ask any card vendor where the data is hosted, who can see it, whether you can export everything, and what happens to it if you leave. Our <a href="/blog/digital-business-cards-and-popia">POPIA guide</a> lists the questions.</p>

<p>On Cardtly, leads captured through a firm's cards land in the firm's shared contact list in the team dashboard, not on an adviser's personal phone. Cardtly's directory of users, the Network, never shows a phone number or email address, and any card can be taken out of it.</p>

<h2>When an adviser moves on</h2>

<p>Advisers move between firms, and the client relationships they built at the firm are often the most valuable thing the firm owns. When an adviser leaves, their card is archived and goes offline immediately, and every contact that card captured stays in the firm's list. Their replacement gets a card in minutes, already branded and worded correctly.</p>

<h2>Video consultations and email</h2>

<p>Much advice now happens on a screen. Cardtly creates a branded virtual background for Zoom and Teams with your QR code on it, so a prospect on a call can scan and save you during the meeting. The email signature generator puts your card details and QR code under every email, matching the card exactly.</p>

<h2>Printed cards against digital</h2>

<table>
<thead>
<tr><th></th><th>Printed</th><th>Cardtly</th></tr>
</thead>
<tbody>
<tr><td>Firm wording</td><td>Reprint to change</td><td>Change once, live</td></tr>
<tr><td>Booking</td><td>Phone or email</td><td>From the card</td></tr>
<tr><td>Referrals</td><td>Number retyped</td><td>Card forwarded</td></tr>
<tr><td>Adviser leaves</td><td>Contacts leave</td><td>Contacts stay</td></tr>
<tr><td>Cost</td><td>Each print run</td><td>From R97 per card a month</td></tr>
</tbody>
</table>

<h2>Setting up a practice</h2>

<ol>
<li><strong>Write the firm's card first.</strong> Logo, registered name, office number, address, website and the approved bio, on one main card.</li>
<li><strong>Apply it and lock what compliance signed off.</strong> Apply the firm's look to every adviser's card, then lock company name, logo, office number, address, website, bio and design. Leave Skills and accreditations open for each adviser.</li>
<li><strong>Add a meeting button and your questions.</strong> Up to five questions about what the client wants to discuss.</li>
<li><strong>Add the advisers.</strong> One at a time, or a whole office from a spreadsheet. A larger firm can split into branches or teams, each with its own manager.</li>
<li><strong>Share it everywhere.</strong> Link, QR code, email signature and virtual background are included. An <a href="/nfc">NFC card</a> for the tap is optional, at R150 once-off or R200 designed around your brand, plus R100 shipping per order in South Africa.</li>
</ol>

<p>Every signup gets 7 days of the full product with no credit card, so a practice can build the firm's card and one adviser's card and see them side by side before rolling out. Read how <a href="/teams">Cardtly works for teams</a> for the full company setup, or our <a href="/blog/best-digital-business-card">checklist for choosing a digital business card</a> if you are comparing options.</p>`,
    faq: [
      {
        q: 'Can every adviser\'s card show the same approved firm wording?',
        a: 'Yes. The firm writes its details and approved bio on one main card, applies that look to every adviser\'s card, and locks them in Company rules. Locked items then come from the main card, cannot be changed by the advisers, and update everywhere at once when the firm changes them.',
      },
      {
        q: 'Where does our FSP number go on a digital business card?',
        a: 'Most firms put it in the approved bio paragraph, alongside the registered name and the products the firm is licensed for. Lock the bio and every adviser\'s card shows the same wording. Check with your compliance officer what your cards should say.',
      },
      {
        q: 'Can each adviser still show their own qualifications?',
        a: 'Yes. Leave the Skills and accreditations field open in Company rules and each adviser fills in their own. Each adviser also keeps their own name, photo, job title and mobile number.',
      },
      {
        q: 'Can clients book a meeting from the card?',
        a: 'Yes. Every card has a book-a-meeting button. The client requests a time, the adviser is emailed straight away, and the client is saved to contacts, with answers to up to five questions about what they want to discuss.',
      },
      {
        q: 'What happens to client contacts when an adviser leaves?',
        a: 'Contacts captured through the firm\'s cards stay in the firm\'s shared list. The adviser\'s card is archived and goes offline immediately, and the seat is reassigned to their replacement.',
      },
      {
        q: 'How much does it cost?',
        a: 'From R97 per card a month, billed in rand, with 7 days of the full product first and no credit card required. Teams of 2 to 20 cards are self-serve, and larger firms are set up directly.',
      },
    ],
  },
  {
    slug: 'digital-business-cards-for-travel-and-tourism',
    title: 'Digital Business Cards for Travel and Tourism',
    description:
      'Digital business cards for tour operators, travel agents and lodges: your tours on the card, WhatsApp for overseas guests, and enquiries you can follow up.',
    excerpt:
      'A tourist meets your guide once, flies home, and tries to remember the name of the company a month later. The card is the only thing that goes with them.',
    date: '2026-10-14',
    readMins: 7,
    body: `<p>A visitor spends a day with your guide, has the best afternoon of their trip, and flies home. A month later a friend asks who they toured with, and they cannot remember the name. The paper card they were given is in a hotel bin in another country.</p>

<p>Tourism is a business of short meetings and long memories. Most of your future bookings come from people who met you once, often from abroad, and the business card is the one thing that leaves with them. This is how tour operators, travel agents, lodges and guesthouses are using <strong>digital business cards</strong> so that the card works long after the guest has gone home.</p>

<h2>Put the experiences on the card</h2>

<p>A tourist does not remember a phone number. They remember the sunset drive, the wine farm, the township walk. So the card should show them. A Cardtly card holds a gallery of up to ten photos, and each photo takes a caption and its own link. A tour reads "Full-day Cape Peninsula, from R1 450 per person" under the picture, and tapping it opens that tour's booking page.</p>

<p>The Showroom layout puts a photograph across the top of the card with your company name as the headline and your guide as a small chip below, so the first thing a guest sees is the place, not the person. You can drag and zoom every photo inside its frame, so the mountain fits and the vehicle in the foreground does not crowd it out.</p>

<h2>Guests from abroad, on any phone</h2>

<p>Your guests come from everywhere, and none of them will install an app to see your details. A digital card opens in any phone browser in any country, by a tap, a QR code scan or a link. The guest saves you to their contacts in one tap, with your name spelled correctly, so you are there when they want to book again.</p>

<p>Cardtly is billed in rand, but the cards themselves work anywhere with a browser, so it makes no difference to your guests where they live.</p>

<h2>WhatsApp is how they will contact you</h2>

<p>International visitors rarely phone a South African number. They message. Every card carries a WhatsApp button, so a guest can ask about another tour, a transfer or a recommendation without the cost of a call. You can also send your whole card to a guest's number as a WhatsApp link before they arrive, so your details are on their phone from the moment they land.</p>

<h2>Turn an enquiry into a booking</h2>

<p>A guest who is interested but not ready to book is a lead, and most tourism businesses lose them because there is no easy way to follow up. A card can collect what you need to follow up properly:</p>

<ul>
<li>a contact exchange invites the guest to share their details back after saving yours,</li>
<li>up to five questions of your own ask what matters, such as travel dates, group size and interests,</li>
<li>a book-a-meeting button lets them request a time for a call to plan a trip,</li>
<li>every enquiry lands in one contacts list with a one-tap WhatsApp button and an Excel export.</li>
</ul>

<p>At a travel expo, the same card captures every visitor to your stand. Our <a href="/blog/trade-show-lead-capture">trade show lead capture guide</a> covers how to follow up before the leads go cold.</p>

<h2>A QR code everywhere a guest stands still</h2>

<p>Tourism has more places to put a QR code than most businesses: the back of a vehicle, the lodge reception desk, a card in each room, the concierge desk of a partner hotel, a brochure rack, the last page of an itinerary. Each one can send a guest straight to your card.</p>

<p>Cardtly marks the link inside each QR code, so your analytics show how people arrived: a QR scan, a tap of an NFC card, a link sent on WhatsApp or the QR in your email signature. That tells you whether the brochure at the partner hotel is producing anything. Our guide to <a href="/blog/qr-code-business-card">QR code business cards</a> covers the size and contrast rules that keep a code scannable.</p>

<h2>Reviews and links in one place</h2>

<p>A guest who loved the day is most willing to leave a review in the first few hours. Put the link on your card, along with your booking page, your social profiles and anything else you want them to find. A card holds up to 10 custom links, so a review link, a booking page, a gift voucher and a newsletter can all sit one tap away.</p>

<h2>Seasonal guides and a team that changes</h2>

<p>Many operators take on guides and drivers for the season. Printed cards for people who leave in a few months are money in a drawer. On a team account, each guide gets a card in minutes, branded and filled in, with the company's logo, details and links locked so they stay correct. When the season ends, the card is archived and goes offline, the seat goes to next season's guide, and every enquiry that card captured stays with the company.</p>

<h2>Printed cards against digital</h2>

<table>
<thead>
<tr><th></th><th>Printed</th><th>Cardtly</th></tr>
</thead>
<tbody>
<tr><td>Tours</td><td>None</td><td>Ten, with links</td></tr>
<tr><td>Overseas guest</td><td>Lost in transit</td><td>Saved on phone</td></tr>
<tr><td>Contact</td><td>A phone call</td><td>WhatsApp</td></tr>
<tr><td>Guide leaves</td><td>Cards wasted</td><td>Seat reassigned</td></tr>
<tr><td>Cost</td><td>Each print run</td><td>From R97 per card a month</td></tr>
</tbody>
</table>

<h2>Getting started</h2>

<ol>
<li><strong>Build the company card.</strong> Logo, name, office number, website and booking links, with your best tours in the gallery.</li>
<li><strong>Write your enquiry questions.</strong> Travel dates, group size and interests are a good start.</li>
<li><strong>Add your guides and staff.</strong> Apply the company look to every card and lock what must stay the same.</li>
<li><strong>Print the QR codes.</strong> Vehicles, reception, rooms, brochures and itineraries. An <a href="/nfc">NFC card</a> for the tap is optional, at R150 once-off with your logo or R200 designed around your brand, plus R100 shipping per order in South Africa.</li>
</ol>

<p>Every signup gets 7 days of the full product with no credit card, so you can build a card, load your tours and hand it to your next guests before deciding. For more than one guide, read how <a href="/teams">Cardtly works for teams</a>.</p>`,
    faq: [
      {
        q: 'Can overseas guests open a South African digital business card?',
        a: 'Yes. The card is an ordinary web page that opens in any phone browser in any country, with no app, and guests save your details to their contacts in one tap.',
      },
      {
        q: 'Can I show my tours and prices on the card?',
        a: 'Yes. The gallery holds up to ten photos, each with a caption and its own link, so each tour can show a price and open its booking page.',
      },
      {
        q: 'How do guests contact me from the card?',
        a: 'Most use the WhatsApp button. Every card also has your phone and email, a book-a-meeting button, and an optional enquiry form with up to five questions of your own, such as travel dates and group size.',
      },
      {
        q: 'Where should a tourism business put its QR code?',
        a: 'Anywhere a guest stands still: vehicles, reception, guest rooms, partner hotel concierge desks, brochures and itineraries. Cardtly\'s analytics show QR scans separately from NFC taps and WhatsApp links, so you can see which places produce enquiries.',
      },
      {
        q: 'What happens to a seasonal guide\'s card at the end of the season?',
        a: 'It is archived from the team dashboard and goes offline, the seat is reassigned to the next guide, and every enquiry the card captured stays in the company\'s contact list.',
      },
      {
        q: 'How much does it cost?',
        a: 'From R97 per card a month, billed in rand, with 7 days of the full product first and no credit card required. An NFC card is optional at R150 once-off with your logo, or R200 designed around your brand, plus R100 shipping per order in South Africa.',
      },
    ],
  },
  {
    slug: 'digital-business-cards-for-wholesalers-and-distributors',
    title: 'Digital Business Cards for Wholesalers',
    description:
      'Digital business cards for wholesalers and distributors: product ranges on every rep\'s card, branch details kept right, and customers that stay with you.',
    excerpt:
      'A wholesale rep visits the same trade customers for years. When they leave for a competitor, the customers usually go with them. The card should not.',
    date: '2026-10-14',
    readMins: 7,
    body: `<p>A good wholesale rep knows every electrician, plumber, builder and buyer on their route by name. They visit the same customers every few weeks for years, and the customer orders through them because they trust them. Then the rep takes a job at a competitor down the road, and within a month half of those customers are ordering from the competitor.</p>

<p>That is the hidden cost in wholesale and distribution: the relationships live in the rep's phone, not in the business. The business card is a small part of the answer, but it is the part that touches every customer. This is how wholesalers and distributors are using <strong>digital business cards</strong> to give every rep a better card and to keep the customer relationships with the company.</p>

<h2>The product ranges on every card</h2>

<p>A trade customer wants to know what you carry, what is in stock and where to order it. A paper card tells them a name and a number. A digital card can show the ranges. Each card holds a gallery of up to ten photos with a caption and a link under each, so "Cable and wiring", "Lighting" and "Solar and backup power" each open the right page of your online catalogue or price list.</p>

<p>Add up to 10 custom links for the things customers ask for most: the online store, the latest price list, a credit account application, the specials of the month and the branch locations. Change a link once, and every rep's card shows the new version the same minute.</p>

<h2>Branch details that stay correct</h2>

<p>Distributors usually run several branches, each with its own trade counter, address and phone number, and those details go wrong on printed cards all the time: a rep moves branches, a branch moves premises, the switchboard changes.</p>

<p>Cardtly runs a group, the companies inside it and their departments from one account, so each branch can be a department with a look of its own that carries that branch's address and office number. Head office sets the logo, colours and website once, applies that look to every card, and locks what must stay the same, including the address and office number, which each branch's look then supplies. Each rep still edits their own name, photo, title and cell number. Move a rep to another branch and their card picks up that branch's details.</p>

<h2>Customers stay with the company</h2>

<p>On a team account, the cards belong to the business, not the rep. Every customer a rep meets can save the rep's card in one tap and share their own details back, and those contacts land in the company's shared contact list, not only in the rep's phone. Reps can also photograph a customer's paper business card on site, and the details are read into a saved contact.</p>

<p>When a rep leaves, their card is archived and goes offline the same minute, so their old card does not keep sending customers to a person who now works for a competitor. The seat goes to the new rep, and every contact the card captured stays with the company. The new rep starts with the customer list, not a blank phone.</p>

<h2>WhatsApp orders and follow-ups</h2>

<p>Trade customers order and query on WhatsApp more than by email. Every card carries a WhatsApp button, and every captured contact has a one-tap WhatsApp follow-up in the contacts list. A rep can send their whole card to a new customer's number as a WhatsApp link while standing at the trade counter, so the customer has the right details before they leave.</p>

<h2>Trade shows and site visits</h2>

<p>Distributors spend heavily on trade shows and get frustratingly little back, mostly because the leads from the stand are never followed up. With a digital card, every visitor who scans at the stand and shares their details back becomes a lead in the shared list, with their answers to up to five questions of your choosing. Our <a href="/blog/trade-show-lead-capture">trade show lead capture guide</a> covers how to make those leads survive the trip back to the office.</p>

<h2>Know which reps are working their cards</h2>

<p>Every card reports its views, taps, link clicks and saved contacts, and the team dashboard shows the same numbers per rep, so a sales manager can see whose card is being used and whose is sitting in a drawer. A weekly email summarises the past seven days of views and new leads. Our guide on <a href="/blog/business-card-costs-for-sales-teams">what business cards really cost a sales team</a> covers how this compares with a print budget.</p>

<h2>Printed cards against digital</h2>

<table>
<thead>
<tr><th></th><th>Printed</th><th>Cardtly</th></tr>
</thead>
<tbody>
<tr><td>Product ranges</td><td>None</td><td>Ten, with links</td></tr>
<tr><td>Branch moves</td><td>Reprint</td><td>Updates itself</td></tr>
<tr><td>Rep leaves</td><td>Customers follow</td><td>Contacts stay</td></tr>
<tr><td>Who is using it</td><td>No idea</td><td>Per rep</td></tr>
<tr><td>Cost</td><td>Each print run</td><td>From R97 per card a month</td></tr>
</tbody>
</table>

<h2>Rolling it out</h2>

<ol>
<li><strong>Build the company card.</strong> Logo, name, website, product range gallery and the links customers need most.</li>
<li><strong>Set up the branches.</strong> One department per branch, each with a look carrying its own address and office number.</li>
<li><strong>Apply the look and lock it.</strong> Apply the company look to every card, then lock the logo, company name, website, links, address, office number and design.</li>
<li><strong>Add the reps.</strong> One at a time, or a whole branch at once from a spreadsheet.</li>
<li><strong>Give them a way to share.</strong> The link and QR code work immediately. An <a href="/nfc">NFC card</a> for the tap is optional, at R150 once-off with your logo or R200 designed around your brand, plus R100 shipping per order in South Africa.</li>
</ol>

<p>Every signup gets 7 days of the full product with no credit card. Teams of 2 to 20 cards are self-serve, and larger distributors are set up directly. Read how <a href="/teams">Cardtly works for teams</a> for the full company setup.</p>`,
    faq: [
      {
        q: 'Can each rep\'s card show our product ranges?',
        a: 'Yes. Each card holds a gallery of up to ten photos with a caption and a link under each, so every range can open the right page of your online catalogue, plus up to 10 custom links for the store, price list and account applications.',
      },
      {
        q: 'Can different branches show their own address and phone number?',
        a: 'Yes. Each branch can be a department with a look carrying its own address and office number. With those fields locked in Company rules, every card in the branch shows that branch\'s details, while head office sets the company brand once for all of them.',
      },
      {
        q: 'What happens to a rep\'s customers when they leave?',
        a: 'Contacts captured through the company\'s cards stay in the shared contact list. The rep\'s card is archived and goes offline immediately, so it stops sending customers to them, and the seat goes to their replacement.',
      },
      {
        q: 'Can reps scan a customer\'s paper business card?',
        a: 'Yes. A rep photographs the paper card and the details are read into a saved contact in the shared list.',
      },
      {
        q: 'Can managers see which reps are using their cards?',
        a: 'Yes. The team dashboard shows views, taps, link clicks and saved contacts for each rep, and a weekly email summarises views and new leads.',
      },
      {
        q: 'How much does it cost?',
        a: 'From R97 per card a month, billed in rand, with 7 days of the full product first and no credit card required. Teams of 2 to 20 cards are self-serve, and larger distributors are set up directly.',
      },
    ],
  },
]

export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find(p => p.slug === slug)
}
