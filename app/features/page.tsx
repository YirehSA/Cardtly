import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import Reveal from '@/components/marketing/Reveal'
import {
  Wifi, Smartphone, Globe, LayoutTemplate, Palette, Images, Link2, Share2, Award, Sparkles,
  Users, CalendarDays, ClipboardList, Repeat, ScanLine,
  MessageCircle, Contact, FileSpreadsheet, CalendarClock,
  BarChart2, Mail, Monitor, Building2, ArrowRight, Zap, Check, Wallet, UserPlus, Lock,
  Layers, FileUp, Search, ShieldCheck, Network, KeyRound, Download, Flag,
} from 'lucide-react'

export const metadata: Metadata = {
  // The old title ran to 73 characters once the "%s | Cardtly" template was
  // applied, so Google cut it. absolute skips the template; this is 52.
  title: { absolute: 'Features: Digital Business Cards for Teams | Cardtly' },
  // 153 characters, and it leads with the team controls the page now covers
  // rather than listing individual-user features only.
  description:
    'Every Cardtly feature: NFC tap, QR, lead capture, per-rep analytics, and the company controls - group and company structure, locked branding, CRM delivery.',
  alternates: { canonical: '/features' },
  openGraph: {
    title: 'Every Cardtly feature, for one person or forty',
    description:
      'NFC and QR sharing, lead capture, analytics per rep, and the company controls: a group holding its companies and their departments, field locks, and leads delivered to your CRM.',
  },
}

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

// 'Free' and 'Pro' collapsed into 'Included' when the free tier was
// dropped: every card is Pro now, so splitting features across two
// tiers described a choice that no longer exists. Add-on and Team are
// still real distinctions and stay.
type Tier = 'Included' | 'Add-on' | 'Team'

// ── Small UI atoms ─────────────────────────────────────────────────────

function TierPill({ tier }: { tier: Tier }) {
  const s = {
    Included: { bg: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: 'rgba(124,58,237,0.4)' },
    'Add-on': { bg: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: 'rgba(0,212,255,0.35)' },
    Team: { bg: 'rgba(236,72,153,0.14)', color: '#f472b6', border: 'rgba(236,72,153,0.35)' },
  }[tier]
  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {tier}
    </span>
  )
}

function NewBadge() {
  return (
    <span className="badge-glow px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap"
      style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed)' }}>
      New
    </span>
  )
}

function IconBox({ Icon, accent, big }: { Icon: React.ComponentType<{ className?: string }>; accent: string; big?: boolean }) {
  return (
    <div className={`${big ? 'w-12 h-12' : 'w-11 h-11'} rounded-xl flex items-center justify-center text-white flex-shrink-0`}
      style={{ background: accent }}>
      <Icon className={big ? 'w-6 h-6' : 'w-5 h-5'} />
    </div>
  )
}

function HowLine({ how, accent }: { how: string; accent: string }) {
  return (
    <p className="text-sm leading-relaxed">
      <span className="font-semibold" style={{ color: accent }}>How it works: </span>
      <span style={{ color: 'rgba(255,255,255,0.5)' }}>{how}</span>
    </p>
  )
}

// ── Visual mockups (used beside key features) ──────────────────────────

function MockPanel({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div className="relative rounded-2xl p-6 sm:p-8 overflow-hidden flex items-center justify-center min-h-[240px]"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(circle at 70% 15%, ${accent}22, transparent 60%)` }} />
      <div className="relative w-full flex items-center justify-center">{children}</div>
    </div>
  )
}

function CardMock() {
  return (
    <div className="relative float-soft">
      <div className="absolute inset-0 w-56 h-36 rounded-2xl"
        style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '1px solid rgba(255,255,255,0.1)', transform: 'translate(-9px,-9px) rotate(-5deg)' }} />
      <div className="relative w-56 h-36 rounded-2xl p-4 flex flex-col justify-between"
        style={{ background: grad, boxShadow: '0 20px 50px rgba(124,58,237,0.4)' }}>
        <div className="text-white text-[10px] font-bold uppercase tracking-widest opacity-80">Cardtly</div>
        <div>
          <div className="text-white text-sm font-bold">Andre Nel</div>
          <div className="text-white/70 text-[10px]">cardtly.com/andrenel</div>
        </div>
        <Wifi className="absolute top-3 right-3 w-4 h-4 text-white/70" />
      </div>
    </div>
  )
}

function TemplatesMock() {
  const cards = [{ c: '#00d4ff' }, { c: '#ec4899' }, { c: '#22c55e' }]
  return (
    <div className="flex gap-3 justify-center">
      {cards.map((t, i) => (
        <div key={i} className="w-24 h-36 rounded-xl p-2.5 flex flex-col"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', transform: `rotate(${(i - 1) * 5}deg)` }}>
          <div className="w-9 h-9 rounded-full mb-2 mx-auto" style={{ background: t.c }} />
          <div className="h-1.5 rounded w-3/4 mx-auto mb-1.5" style={{ background: 'rgba(255,255,255,0.3)' }} />
          <div className="h-1 rounded w-1/2 mx-auto" style={{ background: 'rgba(255,255,255,0.15)' }} />
          <div className="mt-auto h-5 rounded" style={{ background: t.c, opacity: 0.85 }} />
        </div>
      ))}
    </div>
  )
}

function ContactsMock() {
  const rows = [
    { n: 'Sarah Mokoena', s: 'Meeting request', c: '#06b6d4' },
    { n: 'James Kruger', s: 'Contact form', c: '#22c55e' },
    { n: 'Priya Naidoo', s: 'Scanned card', c: '#a855f7' },
  ]
  return (
    <div className="w-full max-w-[320px] space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl p-2.5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: grad }}>
            {r.n.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-semibold truncate">{r.n}</div>
            <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{r.s}</div>
          </div>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: r.c }} />
        </div>
      ))}
    </div>
  )
}

function ChatMock() {
  const bubbles: { text: string; me?: boolean }[] = [
    { text: 'Great meeting you! Here is my card 👋' },
    { text: 'Thanks! Let us chat Monday.', me: true },
    { text: 'Perfect, I will send an invite 📅' },
  ]
  return (
    <div className="w-full max-w-[300px] flex flex-col gap-2">
      {bubbles.map((b, i) => (
        <div key={i}
          className={`px-4 py-2.5 text-xs font-medium max-w-[85%] ${b.me ? 'self-end rounded-2xl rounded-br-sm' : 'self-start rounded-2xl rounded-tl-sm text-white'}`}
          style={b.me
            ? { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }
            : { background: '#25D366' }}>
          {b.text}
        </div>
      ))}
    </div>
  )
}

function SheetMock() {
  const rows = [['Sarah M.', 'sarah@…', 'Meeting'], ['James K.', 'james@…', 'Form'], ['Priya N.', 'priya@…', 'Scan']]
  return (
    <div className="w-full max-w-[320px] rounded-lg overflow-hidden text-[10px]" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
      <div className="grid grid-cols-3 font-bold text-white" style={{ background: '#0284c7' }}>
        <div className="px-2.5 py-2">Name</div><div className="px-2.5 py-2">Email</div><div className="px-2.5 py-2">Source</div>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-3" style={{ background: i % 2 ? 'rgba(240,249,255,0.06)' : 'transparent', color: 'rgba(255,255,255,0.7)' }}>
          {r.map((c, j) => (
            <div key={j} className="px-2.5 py-2 border-t truncate" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>{c}</div>
          ))}
        </div>
      ))}
    </div>
  )
}

function DigestMock() {
  return (
    <div className="w-full max-w-[280px] rounded-xl p-4" style={{ background: '#0b1220', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="text-white text-xs font-bold mb-0.5">Your Cardtly week</div>
      <div className="text-[10px] mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>Last 7 days</div>
      <div className="flex gap-2 mb-3">
        {[{ n: '128', l: 'views' }, { n: '6', l: 'new leads' }].map((s, i) => (
          <div key={i} className="flex-1 rounded-lg py-3 text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="text-lg font-black text-white">{s.n}</div>
            <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.l}</div>
          </div>
        ))}
      </div>
      <div className="h-6 rounded-lg flex items-center justify-center text-[9px] font-bold text-white" style={{ background: grad }}>
        See your new leads
      </div>
    </div>
  )
}

function ChartMock() {
  const bars = [40, 65, 50, 80, 55, 90, 75, 100, 70, 85]
  return (
    <div className="flex items-end justify-center gap-1.5 h-32">
      {bars.map((h, i) => (
        <div key={i} className="w-3 rounded-t"
          style={{ height: `${h}%`, background: 'linear-gradient(180deg, #f59e0b, #ec4899)', opacity: 0.4 + (i / 10) * 0.6 }} />
      ))}
    </div>
  )
}

// ── Feature data ───────────────────────────────────────────────────────

type Feature = {
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
  how: string
  tier: Tier
  isNew?: boolean
  visual?: React.ReactNode
}
type Group = { eyebrow: string; color: string; heading: string; features: Feature[] }

const GROUPS: Group[] = [
  {
    eyebrow: 'Share & connect',
    color: '#00d4ff',
    heading: 'Share your details any way they like',
    features: [
      {
        icon: Wifi, title: 'NFC physical cards', tier: 'Add-on', visual: <CardMock />,
        desc: 'Tap a Cardtly NFC card to any phone and your profile opens instantly. No app needed on either end. R150 with your logo and colours on our layout, or R200 designed around your brand, plus R100 shipping for the whole order. Posted across South Africa in 5 to 7 business days.',
        how: 'Order a card, we encode your link, then tap it to any phone to open your live profile.',
      },
      {
        icon: Smartphone, title: 'Share in one tap', tier: 'Included',
        desc: 'QR code, short link or NFC. Whichever way the person in front of you prefers to receive it. There is an Android app on Google Play that adds tap-to-share and offline access; on iPhone the card works fully in the browser while the app is in progress.',
        how: 'Download your QR code or copy your cardtly.com link and share it anywhere, on or offline.',
      },
      {
        icon: Globe, title: 'Always up to date', tier: 'Included',
        desc: 'Change your number, title or photo once. It updates everywhere your card lives. Never reprint a card again.',
        how: 'Edit your card in the dashboard and every shared link, QR code and NFC tap reflects it instantly.',
      },
      {
        icon: Wallet, title: 'Add to Google Wallet', tier: 'Included',
        desc: 'Save your card to Google Wallet so it sits with your boarding passes and loyalty cards, one swipe away, and updates itself when you edit your card.',
        how: 'Tap Add to Google Wallet on your card; edits you make later push to the saved pass automatically.',
      },
      {
        icon: Link2, title: 'Your own short link', tier: 'Included',
        desc: 'cardtly.com/card/yourname, yours to pick. Change it later and the old one keeps redirecting, so business cards already in someone’s wallet still land in the right place.',
        how: 'Set your link in the card editor. Old links keep working automatically.',
      },
      {
        icon: Share2, title: 'A QR code that never goes stale', tier: 'Included',
        desc: 'Download your QR as a PNG or vector and put it on a poster, a van, a name badge or a slide. It points at your live card, so the details behind it change without reprinting anything.',
        how: 'QR Code in the dashboard: pick a size and colour, download, print.',
      },
      {
        icon: UserPlus, title: "Share a teammate's card", tier: 'Team',
        desc: 'On a team, hand out a colleague’s card on the spot. "Let me give you our sales director’s card" is now a single tap from your dashboard.',
        how: 'Your dashboard lists every teammate’s card with copy and share buttons, ready to send by WhatsApp or link.',
      },
    ],
  },
  {
    eyebrow: 'Your card',
    color: '#7c3aed',
    heading: 'A card that does far more than contact details',
    features: [
      {
        icon: LayoutTemplate, title: 'Designer templates', tier: 'Included', visual: <TemplatesMock />,
        desc: 'Professionally designed layouts for every profession, and every one is fully editable to fit your brand.',
        how: 'Pick a template, then tweak colours, fonts, logo size and content in the design panel.',
      },
      {
        icon: Palette, title: 'Custom colours & fonts', tier: 'Included',
        desc: 'Match your brand exactly with custom accent colours, font choices and logo sizing.',
        how: 'Set your colour and font in the design panel; the whole card restyles live as you edit.',
      },
      {
        icon: Images, title: 'Photo gallery', tier: 'Included',
        desc: 'Show your work, products or portfolio with a built-in image gallery right on your card.',
        how: 'Upload up to six images; visitors swipe through them without leaving your card.',
      },
      {
        icon: Link2, title: 'Custom links', tier: 'Included',
        desc: 'Add your own buttons linking anywhere: website, booking page, menu, catalogue, price list.',
        how: 'Add up to 10 custom link buttons and reorder them however you like.',
      },
      {
        icon: Share2, title: 'Socials & WhatsApp', tier: 'Included',
        desc: 'Link every social profile and add a one-tap WhatsApp chat button to your card.',
        how: 'Drop in your handles and WhatsApp number; icons appear for people to tap.',
      },
      {
        icon: Award, title: 'Certifications & awards', tier: 'Included',
        desc: 'Build instant trust by showcasing your qualifications and accreditations.',
        how: 'List your certifications in a dedicated section that renders as neat badges.',
      },
      {
        icon: Sparkles, title: 'AI-written bio', tier: 'Included',
        desc: 'Let AI write a polished, professional bio for you from a few quick prompts.',
        how: 'Answer a couple of prompts and AI drafts your bio; edit it until it sounds like you.',
      },
    ],
  },
  {
    eyebrow: 'Capture & grow',
    color: '#a855f7',
    heading: 'Turn every tap into a lead',
    features: [
      {
        icon: Users, title: 'Lead capture, built-in CRM', tier: 'Included', visual: <ContactsMock />,
        desc: 'Visitors share their details through your card and every lead lands in your contacts: a pocket CRM that builds itself.',
        how: 'Switch on the capture form; every submission appears under Contacts and emails you instantly.',
      },
      {
        icon: CalendarDays, title: 'Book meetings from your card', tier: 'Included',
        desc: 'Visitors pick a date and time right on your card. You get the request by email and they land in your contacts.',
        how: 'Enable booking; requests arrive by email and save automatically to your Contacts.',
      },
      {
        icon: ClipboardList, title: 'Custom questionnaire', tier: 'Included',
        desc: 'Add your own short form, up to five questions, so leads tell you exactly what you need to know.',
        how: 'Switch it on and build your questions under Lead capture; answers save alongside each captured lead.',
      },
      {
        icon: Repeat, title: 'Reciprocal contact exchange', tier: 'Included',
        desc: 'After someone saves your details, prompt them to share theirs back. A two-way swap, not a one-way handout.',
        how: 'Turn it on and a share-your-details prompt appears right after someone saves your contact.',
      },
      {
        icon: ScanLine, title: 'Paper business card scanner', tier: 'Included',
        desc: 'Snap a photo of someone’s paper card and AI pulls out their details, ready to save to your contacts or phone.',
        how: 'Photograph a paper card; AI reads the name, email and number and pre-fills a new contact.',
      },
    ],
  },
  {
    eyebrow: 'Follow up & manage',
    color: '#25D366',
    heading: 'Close the loop after the tap',
    features: [
      {
        icon: MessageCircle, title: 'Follow up on WhatsApp', tier: 'Included', isNew: true, visual: <ChatMock />,
        desc: 'Every lead comes with a one-tap WhatsApp button, so you can reply while you are still fresh in their mind.',
        how: 'Open any lead and tap WhatsApp; it opens a chat to their number, no copying required.',
      },
      {
        icon: FileSpreadsheet, title: 'Export to Excel', tier: 'Included', isNew: true, visual: <SheetMock />,
        desc: 'Turn every lead into a clean, colour-branded spreadsheet: names, emails, companies, sources and answers.',
        how: 'Hit Export on your Contacts page to download a styled .xlsx, ready for your CRM or mailing list.',
      },
      {
        icon: CalendarClock, title: 'Weekly performance digest', tier: 'Included', isNew: true, visual: <DigestMock />,
        desc: 'Every Monday we email you how your card performed: views and new leads from the past 7 days.',
        how: 'Nothing to set up. If your card had activity that week, the summary lands in your inbox.',
      },
      {
        icon: Contact, title: 'Manage your contacts', tier: 'Included', isNew: true,
        desc: 'Edit, tidy and save any lead straight to your phone. Your Cardtly contacts stay organised and within reach.',
        how: 'Edit or delete any lead, or tap Save to phone to add them to your device in one step.',
      },
    ],
  },
  {
    eyebrow: 'Run a team',
    color: '#f59e0b',
    heading: 'Give forty people one brand without chasing anyone',
    features: [
      {
        icon: Building2, title: 'Departments, each with a head', tier: 'Team',
        desc: 'Split the company into Sales, Support, Joburg, whatever fits. Each department gets a head who invites their own people, sets their look and sees their numbers - without touching anyone else’s team.',
        how: 'Make a department, appoint a head by email, and they run it from their own dashboard.',
      },
      {
        icon: Lock, title: 'Lock exactly what you choose', tier: 'Team',
        desc: 'Company logo, company name, office number, website, address, social profiles, link buttons, gallery photos and card design. Lock any of them for the whole company, and a department head can tighten it further for their own team - never loosen it.',
        how: 'Departments, then Company rules. Tap anything that should stay the same on every card.',
      },
      {
        icon: UserPlus, title: 'Their details stay theirs', tier: 'Team',
        desc: 'Whatever you have not locked belongs to the person: their name, photo, job title, bio and mobile number. Nobody in admin retypes forty phone numbers, and a locked field is shown to them as locked rather than silently ignored when they save.',
        how: 'Each person claims their card by email and edits everything the company has left open.',
      },
      {
        icon: Palette, title: 'One brand, or one per team', tier: 'Team',
        desc: 'Set the company look once - logo, colours, template, links - and apply it to every card at once. A department can carry its own colours on top of that where it needs to.',
        how: 'Team Brand, then “Update brand from my card”, then apply it to everyone or card by card.',
      },
      {
        icon: BarChart2, title: 'Reporting per person', tier: 'Team',
        desc: 'Views, taps, link clicks and saved contacts for every rep, and each lead they capture in one shared list. You find out who is actually being opened instead of asking how it is going.',
        how: 'Team, then Analytics or Contacts, for the whole company or one department.',
      },
      {
        icon: Users, title: 'Per seat, change any time', tier: 'Team',
        desc: 'R97 per card a month. Add seats as you hire; a card you have not handed out yet sits ready with an invite against it, so a new starter is live on their first morning.',
        how: 'Add cards from the team dashboard and invite people whenever you are ready.',
      },
      {
        icon: Layers, title: 'A group, its companies, their departments', tier: 'Team',
        desc: 'One account can hold a whole group: the businesses under it, the departments inside those, and cards hanging off the departments. Each business carries its own branding, its own head and its own slice of the web address, so a card reads cardtly.com/card/roofing/thabo. A business head sees their own business and nothing belonging to another; the group sees all of them, on one invoice and one seat pool.',
        how: 'Departments, then New company. Click a company to see what is under it, and a department to see its cards.',
      },
      {
        icon: FileUp, title: 'Import your staff list', tier: 'Team',
        desc: 'Upload an Excel file or paste straight out of a spreadsheet and it becomes branded cards. A business unit column routes each person into the right department automatically, so a group onboards from one file rather than seven. Every row is shown with its outcome, and where it will land, before anything is created, and the number of invitations is stated before they go out.',
        how: 'Team Cards, then Import. Drop the file in, check the preview, then confirm.',
      },
      {
        icon: Search, title: 'A directory people can actually search', tier: 'Team',
        desc: 'Find anyone by name, position or business unit, and filter a company down to one department or one job title. Individual cards can be kept off the listing, by the person or by their manager.',
        how: 'Network, then open your company. Search, or tap a business unit or position to filter.',
      },
      {
        icon: ShieldCheck, title: 'Offboarding that actually takes a card down', tier: 'Team',
        desc: 'Removing someone stops their public card resolving straight away, so their name, photo and number are no longer served to anyone who taps their old NFC card. The card itself is kept, so you re-issue it to their replacement on the same link and the printed card keeps working.',
        how: 'Team Cards, then Remove access on their card. Invite somebody else to put it back online.',
      },
    ],
  },
  {
    eyebrow: 'Connect it to your systems',
    color: '#7c3aed',
    heading: 'Leads where your business already works',
    features: [
      {
        icon: Network, title: 'Send leads to your CRM', tier: 'Team',
        desc: 'Every lead your team captures is posted to an address you nominate, the moment it arrives. Signed so the receiving system can prove it came from Cardtly and was not altered on the way. A delivery that fails retries on a widening schedule and every attempt is logged with its response, so a connection that quietly stops working is visible rather than losing leads in silence.',
        how: 'Team Cards, Integrations, then Send leads to your CRM. Paste the address, send a test, and watch it arrive.',
      },
      {
        icon: KeyRound, title: 'Read your data with an API', tier: 'Team',
        desc: 'A read-only API over your leads, cards and company structure, for a nightly job into a warehouse, an intranet staff directory, or a dashboard counting cards across your businesses. Keys are issued and revoked by you, limited by rate and permission, and every call is logged against the key that made it. Keys are stored only as a hash, so nobody can recover one, including us.',
        how: 'Team Cards, Integrations, API access. Most teams never need this: if you only want leads in your CRM, use the option above instead.',
      },
      {
        icon: FileSpreadsheet, title: 'Everything out as Excel', tier: 'Included',
        desc: 'Contacts download as a formatted workbook, per person or across the whole team, with questionnaire answers flattened into columns. Analytics download as a seven-sheet workbook covering the summary, daily views, top links, how people arrived, devices, browsers and sources.',
        how: 'Export on the Contacts page, and Export on your analytics dashboard.',
      },
      {
        icon: Download, title: 'Download everything we hold', tier: 'Included',
        desc: 'One file with your profile, your cards, the contacts they captured, your orders and your billing history. No request to raise and nothing to wait for, which is what portability is supposed to mean.',
        how: 'Settings, Account, then Download my data.',
      },
      {
        icon: Flag, title: 'Report and block', tier: 'Included',
        desc: 'Anything wrong on a card in the directory can be reported in a couple of taps, and you can block a card so it never appears to you again. Reports reach a moderation queue with a 24-hour service level rather than an inbox.',
        how: 'The report link on any card in the Network directory.',
      },
    ],
  },
  {
    eyebrow: 'Insights & extras',
    color: '#f59e0b',
    heading: 'Know what works, look sharp everywhere',
    features: [
      {
        icon: BarChart2, title: 'Analytics dashboard', tier: 'Included', visual: <ChartMock />,
        desc: 'Track every view, click and save. Know exactly which leads engaged with your card and when.',
        how: 'Your dashboard charts views over time so you can see what is landing and what is not.',
      },
      {
        icon: Mail, title: 'Email signature generator', tier: 'Included',
        desc: 'Generate a branded email signature straight from your card in seconds.',
        how: 'Generate the signature, copy it, and paste it into Gmail, Outlook or Apple Mail.',
      },
      {
        icon: Monitor, title: 'Zoom & Teams backgrounds', tier: 'Included',
        desc: 'Branded virtual backgrounds with your name and QR code for video calls.',
        how: 'Download your background image and set it in Zoom or Teams; guests can scan your QR mid-call.',
      },
    ],
  },
]

const FAQS = [
  {
    q: 'Is Cardtly free?',
    a: 'Cardtly is R97 per card per month, or R970 a year, and every feature is included. No credit card is needed to create your card and set it up. Teams are R97 a seat from 2 to 20 seats, and Enterprise above that is billed by debit order.',
  },
  {
    q: 'What is a digital business card?',
    a: 'A digital business card is a shareable web page with your contact details, links and branding. People open it by tapping an NFC card, scanning a QR code or clicking a link, and save you to their phone in one tap. There is nothing to print or reprint.',
  },
  {
    q: 'Do I need an app to use it?',
    a: 'No. Your card opens in any web browser, and the person receiving it needs nothing installed. There is also an optional Android app that adds tap-to-share NFC and offline access.',
  },
  {
    q: 'Can I capture leads with my card?',
    a: 'Yes. Switch on the contact capture form and every visitor who shares their details lands in your Contacts, emails you instantly, and can be followed up on WhatsApp. It is a lightweight CRM built into your card.',
  },
  {
    q: 'Can I export my contacts to Excel?',
    a: 'Yes. One click on the Contacts page downloads a clean, colour-branded Excel spreadsheet of every lead, including names, emails, companies, sources and questionnaire answers, ready for your CRM or mailing list.',
  },
  {
    q: 'Does Cardtly work with NFC cards?',
    a: 'Yes. Order a Cardtly NFC card and tap it to any phone to open your profile instantly, with no app needed on either end. R150 puts your logo and colours on our layout; R200 is designed around your brand. Shipping is R100 for the whole order, anywhere in South Africa, in 5 to 7 business days.',
  },
  {
    q: 'Can I use Cardtly for my whole team?',
    a: 'Yes. Cardtly for Teams gives every member an on-brand card with locked company branding, member-managed details, and one admin dashboard showing every card’s views and leads. It is priced per seat.',
  },
  {
    q: 'What do I get for R97?',
    a: 'Every feature on this page, on one card. There are no tiers to choose between and nothing is held back for a higher plan. Your card keeps its URL, its design and every contact you capture for as long as you subscribe.',
  },
]

export default function FeaturesPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <div className="overflow-x-hidden" style={{ background: '#000', color: '#fff' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Navbar />

      {/* Hero. A real two-column grid, not a headline with cards absolutely
          positioned over the top of it. The absolute version clipped its upper
          card against the section edge and dropped the lower one on top of the
          tier legend, and both faults moved around with the viewport width. */}
      <section className="relative overflow-hidden px-6 lg:px-12 xl:px-16 pt-32 pb-16 lg:pt-40 lg:pb-20">
        <div className="blob-drift absolute -top-32 left-[10%] w-[700px] h-[560px] rounded-full blur-[140px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, rgba(0,212,255,0.10) 55%, transparent 72%)' }} />
        <div className="absolute -bottom-48 right-0 w-[560px] h-[560px] rounded-full blur-[130px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.14) 0%, transparent 72%)' }} />

        <div className="relative mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-12 xl:gap-16 items-center"
          style={{ maxWidth: 1500, zIndex: 2 }}>

          {/* Left: the pitch */}
          <div className="text-center lg:text-left">
            <p className="animate-fade-up text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#7c3aed' }}>Features</p>
            <h1 className="animate-fade-up font-black tracking-[-0.02em] leading-[1.06] mb-6"
              style={{ fontSize: 'clamp(2.5rem, 4.4vw, 4.25rem)' }}>
              Everything your<br />card <span style={gradText}>can do.</span>
            </h1>
            <p className="animate-fade-up-delayed text-lg xl:text-xl leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8"
              style={{ color: 'rgba(255,255,255,0.62)' }}>
              One card that shares in a tap, captures the lead, follows up for you and tells you what is working -
              for one person, or for a company of forty with the branding locked down.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
              <Link href="/signup"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:scale-[1.03]"
                style={{ background: grad, boxShadow: '0 10px 44px rgba(124,58,237,0.5)' }}>
                Sign up
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/pricing"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-medium transition hover:bg-white/10"
                style={{ border: '1px solid rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.82)' }}>
                See pricing
              </Link>
            </div>
            {/* The legend lives with the copy now, so no card can land on it. */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-sm"
              style={{ color: 'rgba(255,255,255,0.5)' }}>
              <span className="flex items-center gap-2"><TierPill tier="Included" /> in every card</span>
              <span className="flex items-center gap-2"><TierPill tier="Add-on" /> optional extra</span>
              <span className="flex items-center gap-2"><TierPill tier="Team" /> on the Teams plan</span>
            </div>
          </div>

          {/* Right: two real printed cards, inside their own cell */}
          <div className="hidden lg:flex justify-center">
            <div className="relative" style={{ width: 470, height: 330 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/nfc-samples/cardtly-front.jpg"
                alt="A printed Cardtly NFC business card"
                width={1200} height={767}
                className="absolute rounded-2xl"
                style={{ width: 270, left: 0, top: 12, transform: 'rotateZ(-11deg)',
                  border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 30px 70px rgba(0,0,0,0.8)' }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/nfc-samples/sicon-front.jpg"
                alt="A printed Cardtly NFC business card with full-bleed custom artwork"
                width={1200} height={767}
                className="absolute rounded-2xl"
                style={{ width: 300, right: 0, top: 118, transform: 'rotateZ(7deg)',
                  border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 34px 80px rgba(0,0,0,0.85)' }} />
            </div>
          </div>
        </div>
      </section>

      {/* Feature groups */}
      {GROUPS.map((group, gi) => {
        const featured = group.features.filter(f => f.visual)
        const compact = group.features.filter(f => !f.visual)
        return (
          <section key={group.eyebrow} className="py-14 px-6" style={gi % 2 === 1 ? { background: 'rgba(255,255,255,0.02)' } : undefined}>
            <div className="max-w-[1400px] mx-auto">
              <Reveal>
                <div className="mb-10">
                  <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: group.color }}>{group.eyebrow}</p>
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight max-w-2xl">{group.heading}</h2>
                </div>
              </Reveal>

              {/* Featured rows: text + visual, alternating sides */}
              <div className="space-y-8 mb-8">
                {featured.map((f, fi) => (
                  <Reveal key={f.title}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10 items-center">
                      <div className={fi % 2 === 1 ? 'md:order-2' : ''}>
                        <div className="flex items-center gap-3 mb-4 flex-wrap">
                          <IconBox Icon={f.icon} accent={group.color} big />
                          <div className="flex items-center gap-1.5">
                            {f.isNew && <NewBadge />}
                            <TierPill tier={f.tier} />
                          </div>
                        </div>
                        <h3 className="text-2xl font-black tracking-tight text-white mb-3">{f.title}</h3>
                        <p className="text-base leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>{f.desc}</p>
                        <HowLine how={f.how} accent={group.color} />
                      </div>
                      <div className={fi % 2 === 1 ? 'md:order-1' : ''}>
                        <MockPanel accent={group.color}>{f.visual}</MockPanel>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>

              {/* Compact cards for the rest */}
              {compact.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {compact.map((f, ci) => (
                    <Reveal key={f.title} delay={ci * 70} className="h-full">
                      <div className="h-full flex flex-col rounded-2xl p-6 lift-card hover:bg-white/5"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-center justify-between mb-4">
                          <IconBox Icon={f.icon} accent={group.color} />
                          <div className="flex items-center gap-1.5">
                            {f.isNew && <NewBadge />}
                            <TierPill tier={f.tier} />
                          </div>
                        </div>
                        <h3 className="font-bold text-white text-lg mb-2">{f.title}</h3>
                        <p className="text-sm leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>{f.desc}</p>
                        <div className="pt-3 mt-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                          <HowLine how={f.how} accent={group.color} />
                        </div>
                      </div>
                    </Reveal>
                  ))}
                </div>
              )}
            </div>
          </section>
        )
      })}

      {/* Teams callout */}
      <section className="py-14 px-6">
        <Reveal className="max-w-[1400px] mx-auto">
          <div className="rounded-3xl p-8 md:p-10 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(0,212,255,0.06))', border: '1px solid rgba(124,58,237,0.25)' }}>
            <div className="flex items-start gap-5 flex-wrap">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-white"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
                <Building2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-[260px]">
                <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2">Cardtly for teams</h2>
                <p className="text-base leading-relaxed mb-5 max-w-2xl" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Roll out one brand across the whole company, decide exactly which parts people may not change, and give each department a head who runs their own team. R97 per card a month.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6 max-w-xl">
                  {['Lock only what you choose', 'Departments with their own head', 'Their name, photo and title stay theirs', 'Reporting and leads per rep', 'One brand, or one per department', 'Add seats as you hire'].map(t => (
                    <div key={t} className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#a78bfa' }} />{t}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <Link href="/signup"
                    className="group inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:scale-[1.03]"
                    style={{ background: grad, boxShadow: '0 6px 26px rgba(124,58,237,0.4)' }}>
                    Set your team up free
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Link href="/contact" className="text-sm font-semibold inline-flex items-center gap-1.5 transition hover:opacity-80"
                    style={{ color: '#a78bfa' }}>
                    Or talk to us <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="py-16 px-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#00d4ff' }}>Questions</p>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                Frequently asked <span style={gradText}>questions.</span>
              </h2>
            </div>
          </Reveal>
          <div className="space-y-4">
            {FAQS.map(({ q, a }, i) => (
              <Reveal key={q} delay={i * 50}>
                <div className="p-6 rounded-2xl lift-card"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <h3 className="font-bold mb-2">{q}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{a}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6">
        <Reveal className="max-w-3xl mx-auto text-center">
          <div className="rounded-3xl p-12 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(124,58,237,0.15), rgba(236,72,153,0.1))', border: '1px solid rgba(124,58,237,0.25)' }}>
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.18) 0%, transparent 70%)' }} />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest mb-6"
                style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}>
                <Zap className="w-3 h-3" />
                Every feature, free to try
              </div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4 leading-tight">
                Ready to <span style={gradText}>get started?</span>
              </h2>
              <p className="text-lg mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Build your card in 2 minutes. Upgrade to Pro only when you need the extras.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/signup"
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:scale-[1.03]"
                  style={{ background: grad, boxShadow: '0 8px 40px rgba(124,58,237,0.5)' }}>
                  Sign up
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link href="/how-it-works"
                  className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-base font-medium transition hover:bg-white/10"
                  style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}>
                  How it works
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  )
}
