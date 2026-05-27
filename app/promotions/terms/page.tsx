import type { Metadata } from 'next'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'

// ============================================================
// Cardtly Growth Promotions - Terms & Conditions
//
// This is a DRAFT scaffold drawn up to comply with Section 36 of
// the Consumer Protection Act 68 of 2008 and Regulation 11 of the
// Consumer Protection Act Regulations, 2011. It is intended as a
// starting point for a South African competition lawyer to review,
// adjust, and finalise before public launch.
//
// Placeholders [in square brackets] must be completed before
// publishing.
// ============================================================

export const metadata: Metadata = {
  title: 'Promotional Competition Terms & Conditions',
  description: 'Official rules of the Cardtly Growth Promotions, run under Section 36 of the South African Consumer Protection Act.',
}

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

const sectionStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-8 md:p-10 rounded-3xl mb-6" style={sectionStyle}>
      <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-5">{title}</h2>
      <div className="space-y-4 text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
        {children}
      </div>
    </div>
  )
}

export default function PromotionsTermsPage() {
  return (
    <div style={{ background: '#000', color: '#fff' }}>
      <Navbar />

      <section className="pt-32 pb-12 px-6 text-center relative overflow-hidden">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[120px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.12) 0%, rgba(124,58,237,0.08) 50%, transparent 70%)' }}
        />
        <div className="relative max-w-3xl mx-auto">
          <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#00d4ff' }}>Promotional Competition</p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6">
            Terms &amp; <span style={gradText}>Conditions</span>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Official rules of the Cardtly Growth Promotions. Run in accordance with Section 36 of the Consumer Protection Act 68 of 2008.
          </p>
          <p className="text-sm mt-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Last updated: [Insert publication date]
          </p>
        </div>
      </section>

      {/* Draft notice — remove before final publish */}
      <section className="px-6 max-w-3xl mx-auto mb-6">
        <div className="rounded-2xl p-4 text-sm" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}>
          <strong>DRAFT &mdash; PENDING LEGAL REVIEW.</strong> This document is a scaffold prepared for review by a South African competition lawyer. Items shown in square brackets [like this] are placeholders. Do not rely on this draft as the final, binding rules until a qualified attorney has signed it off and it has been republished without this notice.
        </div>
      </section>

      <section className="pb-24 px-6">
        <div className="max-w-3xl mx-auto">

          <Section title="1. The Promoter">
            <p>
              This promotional competition (the &quot;Promotion&quot;) is run by:
            </p>
            <p>
              <strong>[Promoter legal name, e.g. Yireh Business Solutions (Pty) Ltd]</strong><br />
              trading as &quot;Cardtly&quot;<br />
              Company registration number: <strong>[Insert registration number]</strong><br />
              Registered address: <strong>[Insert street address, city, province, postal code]</strong><br />
              Email: <a href="mailto:contest@cardtly.com" className="underline" style={{ color: '#00d4ff' }}>contest@cardtly.com</a><br />
              Website: <a href="https://cardtly.com" className="underline" style={{ color: '#00d4ff' }}>https://cardtly.com</a>
            </p>
            <p>
              The Promoter is responsible for running the Promotion in compliance with the Consumer Protection Act 68 of 2008 (&quot;the CPA&quot;) and Regulation 11 of the Consumer Protection Act Regulations, 2011.
            </p>
          </Section>

          <Section title="2. Definitions">
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>&quot;Entrant&quot;</strong> means any person who has lawfully entered the Promotion in accordance with these rules.</li>
              <li><strong>&quot;Entry&quot;</strong> means a single record of participation in the Promotion attributable to one Entrant.</li>
              <li><strong>&quot;Free Account&quot;</strong> means a Cardtly user account that has been created at cardtly.com and confirmed by email, without requiring any payment.</li>
              <li><strong>&quot;Founder Slot&quot;</strong> means one of the first 100 Free Accounts created on or after the Start Date.</li>
              <li><strong>&quot;Prize&quot;</strong> means any of the items described in clause 7.</li>
              <li><strong>&quot;Promotion Period&quot;</strong> means the period set out in clause 3.</li>
              <li><strong>&quot;Tier&quot;</strong> means one of the milestone-based prize categories described in clause 7.</li>
              <li><strong>&quot;Winner&quot;</strong> means an Entrant selected to receive a Prize in accordance with these rules.</li>
            </ul>
          </Section>

          <Section title="3. Promotion Period">
            <p>
              <strong>Start Date:</strong> [Insert public launch date, e.g. 00:01 SAST on DD Month YYYY]<br />
              <strong>End Date for Tier 1:</strong> When 100 Founder Slots have been claimed, or [Insert backstop date, e.g. 11 months after the Start Date], whichever occurs first.<br />
              <strong>End Date for Tier 2:</strong> When 1,000 Free Accounts have been created on Cardtly, or [Insert backstop date], whichever occurs first.
            </p>
            <p>
              The Promoter may close any Tier earlier if a milestone is reached, or extend the backstop dates by publishing a notice on cardtly.com/promotions at least 7 days before the affected date.
            </p>
            <p>
              No Entries will be accepted before the Start Date or after the relevant End Date. The clock used to determine these times is the server time recorded by the Promoter at the moment an account is created.
            </p>
          </Section>

          <Section title="4. Eligibility">
            <p>To enter, you must:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Be a natural person aged 18 years or older at the time of entry.</li>
              <li>Be a resident of the Republic of South Africa with a valid South African identity number or valid permit allowing residency.</li>
              <li>Have a valid email address that you can access.</li>
              <li>Not be a director, employee, contractor, agent, consultant, or immediate family member of the Promoter, Yireh Business Solutions, or any company in the same group, or any party directly involved in administering the Promotion.</li>
            </ul>
            <p>
              The Promoter may require any Entrant or Winner to verify their identity, age, and residency by producing a valid South African ID document or passport. The Promoter may disqualify any Entrant or Winner who cannot do so.
            </p>
            <p>
              One person may hold only one Cardtly Free Account for the purpose of this Promotion. Multiple accounts created by the same person, household, or device with the intent of gaining additional entries will be treated as fraudulent (see clause 11).
            </p>
          </Section>

          <Section title="5. How to enter">
            <p>There are two ways to enter:</p>
            <p>
              <strong>5.1 Standard entry &mdash; no purchase required.</strong> Create a Free Account at <a href="https://cardtly.com/signup" className="underline" style={{ color: '#00d4ff' }}>cardtly.com/signup</a> during the Promotion Period. Creating and using a Free Account costs nothing. No purchase is required to enter or to win.
            </p>
            <p>
              <strong>5.2 Alternative free entry route.</strong> If you do not wish to create a Cardtly Free Account, you may still enter the Promotion by sending an email to <a href="mailto:contest@cardtly.com" className="underline" style={{ color: '#00d4ff' }}>contest@cardtly.com</a> with:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>The subject line: <strong>&quot;Cardtly Promotion Entry&quot;</strong></li>
              <li>Your full name (as it appears on your ID)</li>
              <li>Your South African ID number</li>
              <li>Your physical address</li>
              <li>A contact telephone number</li>
              <li>The Tier you wish to be entered into (Tier 1 or Tier 2)</li>
            </ul>
            <p>
              The Promoter will acknowledge each valid email entry within 7 (seven) business days and will record it against the relevant Tier&apos;s entry pool. Email entries received outside the Promotion Period will not be considered.
            </p>
            <p>
              Entries submitted by either route count equally and have an equal chance of winning. The free email-alternative entry route exists in accordance with the &quot;no purchase necessary&quot; requirement of South African consumer law.
            </p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              <strong>No purchase necessary.</strong> No purchase, payment, or upgrade to a paid Cardtly Pro subscription is required to enter, to win, or to receive any Prize.
            </p>
          </Section>

          <Section title="6. Bonus entries (referrals)">
            <p>
              Each Entrant who has created a Free Account receives a unique referral link (e.g. <span className="font-mono text-sm">https://cardtly.com/?ref=XXXXXX</span>). When another person signs up for a Free Account using that link, the referring Entrant earns one (1) additional Entry into Tier 2 only, subject to the conditions below.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>The referred person must be a separate, eligible Entrant (clause 4).</li>
              <li>The referred person must confirm their email and remain an active Cardtly account holder.</li>
              <li>Self-referrals, automated sign-ups, fake accounts, and accounts created from the same device or household for the sole purpose of gaining bonus entries are not eligible and will be disqualified.</li>
              <li>Each Entrant may earn a maximum of 10 (ten) Entries in total across the standard entry and bonus referral entries combined. This cap exists to keep the Promotion fair and prevent any single person from dominating the draw.</li>
            </ul>
            <p>
              Bonus entries are credited automatically and visible to the Entrant in their Cardtly dashboard. Entrants using the email-alt route under clause 5.2 may request bonus entries for verified referrals by emailing <a href="mailto:contest@cardtly.com" className="underline" style={{ color: '#00d4ff' }}>contest@cardtly.com</a> with the referred person&apos;s name and confirmation date.
            </p>
          </Section>

          <Section title="7. The Prizes">
            <p>
              <strong>Tier 1 &mdash; First 100 Founders</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>The first 100 Entrants to create a Free Account (Founder Slots) each receive 3 (three) months of Cardtly Pro free of charge, granted automatically to their account upon signup. Approximate retail value: R[Insert ZAR value, e.g. 297] per founder.</li>
              <li>Of those 100 founders, 10 (ten) Winners will be randomly selected to receive an upgraded Prize of <strong>Cardtly Pro free for life</strong> on their personal Cardtly account. &quot;For life&quot; means for so long as the Promoter operates Cardtly as a going concern. Approximate retail value: R[Insert ZAR value] per lifetime account.</li>
              <li>The Tier 1 lifetime draw will be conducted within 14 (fourteen) days after the 100th Founder Slot has been claimed, or after the Tier 1 End Date, whichever occurs first.</li>
            </ul>
            <p>
              <strong>Tier 2 &mdash; The 1,000-account milestone</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>When Cardtly reaches 1,000 (one thousand) Free Accounts, 1 (one) Winner will be randomly selected to receive a custom-designed business website of up to 20 (twenty) pages, plus 1 (one) year of hosting on a shared web host of the Promoter&apos;s choice. The website will be designed and developed by Yireh Business Solutions (Pty) Ltd or a partner agency nominated by the Promoter.</li>
              <li>Approximate retail value: R[Insert ZAR value, e.g. 25,000].</li>
              <li>The Tier 2 draw will be conducted within 14 (fourteen) days after the 1,000th Free Account has been created.</li>
              <li>Reasonable timelines, design rounds, and client cooperation requirements for the website build will be agreed in writing between the Winner and the Promoter within 30 (thirty) days of notification. Domain name registration is not included unless agreed separately.</li>
            </ul>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
              <strong>Future promotion not currently active.</strong> The Promoter may, in the future, run additional promotional competitions with larger prizes such as cash awards or vehicles. Any such future promotion will be governed by its own published rules and is not part of the Promotion described in this document. No Entrant has any claim to any future promotion by virtue of having entered the Promotion described here.
            </p>
            <p>
              <strong>General Prize conditions:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Prizes are not transferable, not refundable, and not redeemable for cash, except where the Promoter, in its sole discretion, agrees in writing.</li>
              <li>The Promoter reserves the right to substitute any Prize with a Prize of equal or greater retail value if the original Prize becomes unavailable for reasons beyond its control.</li>
              <li>All taxes, levies, duties, and personal expenses associated with claiming or using a Prize (including, where applicable, income tax under the Income Tax Act 58 of 1962) are the responsibility of the Winner.</li>
              <li>Where a Prize value exceeds the threshold set out in Regulation 11(4) of the Consumer Protection Act Regulations, the Promoter will engage an independent person to verify the draw process.</li>
            </ul>
          </Section>

          <Section title="8. Winner selection process">
            <p>
              Winners are selected by a server-side random draw conducted by the Promoter. The draw is performed in software using a uniformly random shuffling algorithm against the full pool of eligible Entries recorded at the time of the draw. Each Entry has an equal mathematical probability of being selected relative to every other Entry. An Entrant with more Entries (through valid referrals) accordingly has proportionally higher odds.
            </p>
            <p>
              Entries originating from accounts later disqualified under clauses 4, 6, or 11 are removed from the pool before the draw. An Entrant cannot win the same Tier twice.
            </p>
            <p>
              A record of the draw &mdash; including the random seed (where applicable), the list of eligible Entries, and the resulting Winner list &mdash; will be retained by the Promoter for inspection.
            </p>
            <p>
              At the Promoter&apos;s discretion, draws of significant value may be recorded on video or live-streamed for transparency. The recording is published on cardtly.com or on the Promoter&apos;s social media channels.
            </p>
          </Section>

          <Section title="9. Winner notification and prize claim">
            <p>
              Winners will be notified by email to the address associated with their Cardtly account (or, for email-alt entries, the address from which they entered) within 7 (seven) business days of the draw.
            </p>
            <p>
              Each Winner must:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Reply to the notification email within 30 (thirty) days, confirming acceptance of the Prize.</li>
              <li>Provide a clear copy of their valid South African ID or passport.</li>
              <li>Provide proof of address dated within the last 3 (three) months (a utility bill, bank statement, or municipal account is acceptable).</li>
              <li>For Tier 2, agree in writing to the website design brief and timeline within the 30 day window described in clause 7.</li>
            </ul>
            <p>
              If a Winner cannot be contacted, does not respond within the 30 day period, fails the verification described above, or declines the Prize, the Promoter reserves the right to forfeit that Winner&apos;s entitlement and to draw a replacement Winner from the remaining eligible Entries.
            </p>
            <p>
              Winners may be required to take part in reasonable publicity relating to the Promotion (such as the inclusion of their first name and approximate location, or a photograph if voluntarily supplied, in announcements posted on cardtly.com and the Promoter&apos;s social media channels). The Promoter will not require a Winner to participate in publicity that they reasonably object to. A Winner&apos;s refusal to take part in publicity will not be used as a reason to forfeit their Prize.
            </p>
            <p>
              The names of Winners will be published on cardtly.com/promotions and may be made available on request by writing to <a href="mailto:contest@cardtly.com" className="underline" style={{ color: '#00d4ff' }}>contest@cardtly.com</a>.
            </p>
          </Section>

          <Section title="10. Free copy of these rules">
            <p>
              These Terms &amp; Conditions are available free of charge at <a href="https://cardtly.com/promotions/terms" className="underline" style={{ color: '#00d4ff' }}>cardtly.com/promotions/terms</a>.
            </p>
            <p>
              You may also request a copy by emailing <a href="mailto:contest@cardtly.com" className="underline" style={{ color: '#00d4ff' }}>contest@cardtly.com</a> and the Promoter will send the rules by return email at no cost to you.
            </p>
          </Section>

          <Section title="11. Disqualification, fraud and abuse">
            <p>
              The Promoter may, in its sole and reasonable discretion, disqualify an Entrant and forfeit any Prize where it has reasonable grounds to believe that the Entrant:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Has provided false, misleading, or incomplete information.</li>
              <li>Has created multiple accounts, or used automated or scripted means, to manipulate the entry pool.</li>
              <li>Has tampered or attempted to tamper with the entry process, the referral system, or any other part of the Promotion infrastructure.</li>
              <li>Has acted in breach of these Terms &amp; Conditions, the Cardtly Terms of Service, or any applicable law.</li>
              <li>Does not meet the eligibility requirements in clause 4.</li>
              <li>Cannot satisfy the verification requirements in clause 9.</li>
            </ul>
            <p>
              Where a Winner is disqualified after a Prize has been claimed, the Promoter reserves the right to recover the value of that Prize and to pursue any further remedies available at law.
            </p>
          </Section>

          <Section title="12. Personal information (POPIA)">
            <p>
              By entering the Promotion, you consent to the collection and processing of your personal information by the Promoter for the purposes of administering the Promotion, verifying eligibility, contacting Winners, delivering Prizes, and complying with record-keeping obligations under South African law.
            </p>
            <p>
              Personal information collected for the Promotion may include: your name, email address, telephone number, physical address, South African ID number (Winners only), and proof of address (Winners only).
            </p>
            <p>
              The Promoter processes your personal information in accordance with the Protection of Personal Information Act 4 of 2013 (&quot;POPIA&quot;) and the Cardtly <a href="/privacy" className="underline" style={{ color: '#00d4ff' }}>Privacy Policy</a>. Your information will be retained for as long as required to administer the Promotion and to comply with the record-keeping period set out in clause 14, after which it will be deleted or anonymised unless you have separately consented to retention for other purposes (such as marketing).
            </p>
            <p>
              You have the right to access, correct, or request deletion of your personal information at any time by writing to <a href="mailto:contest@cardtly.com" className="underline" style={{ color: '#00d4ff' }}>contest@cardtly.com</a>. Requesting deletion of information that is necessary to administer the Promotion (for example, a Winner&apos;s verification documents) before the Promotion concludes will result in disqualification.
            </p>
            <p>
              The Promoter will not sell your personal information. Personal information will only be disclosed to third parties where strictly necessary to administer the Promotion (for example, a payment processor or hosting partner used to deliver a Prize) or where required by law.
            </p>
          </Section>

          <Section title="13. Social media disclaimer">
            <p>
              The Promotion is in no way sponsored, endorsed, administered by, or associated with Meta Platforms Inc. (the operator of Facebook and Instagram), X Corp. (the operator of X/Twitter), LinkedIn Corporation, WhatsApp LLC, or any other social media platform.
            </p>
            <p>
              References to the Promotion on social media, including any posts that link to the Promotion or use the hashtag <strong>#Cardtly</strong>, do not earn any additional Entry in this Promotion. Following or interacting with the Promoter on social media is not a condition of entry.
            </p>
            <p>
              You are responsible for complying with the terms of service of any social media platform that you use to share or refer the Promotion.
            </p>
          </Section>

          <Section title="14. Record-keeping">
            <p>
              The Promoter will retain the following records for a minimum of 3 (three) years from the date of the final draw under each Tier:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>The full pool of eligible Entries at the time of each draw.</li>
              <li>The selection method used and the Winner list for each draw.</li>
              <li>Correspondence with Winners regarding prize claims.</li>
              <li>Copies of these Terms &amp; Conditions as in force at the time of the draw.</li>
            </ul>
            <p>
              The National Consumer Commission, the Promoter&apos;s independent auditor (where appointed), or a court of competent jurisdiction may inspect these records on reasonable written notice.
            </p>
          </Section>

          <Section title="15. Limitation of liability">
            <p>
              To the maximum extent permitted by law, neither the Promoter, Yireh Business Solutions (Pty) Ltd, nor any of their directors, employees, agents, or contractors will be liable for any direct, indirect, incidental, special, consequential, or punitive loss or damage suffered by any Entrant or Winner arising from or in connection with:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Their participation in the Promotion.</li>
              <li>Their use of, or inability to use, a Prize.</li>
              <li>Any technical failure, error, delay, or interruption in the Promotion website, infrastructure, or communications systems.</li>
              <li>Any act, omission, or fault of any third party (including hosting providers, internet service providers, courier services, or social media platforms).</li>
            </ul>
            <p>
              Nothing in these terms limits or excludes liability for fraud, gross negligence, wilful misconduct, or any liability that cannot lawfully be limited or excluded under South African law, including the CPA.
            </p>
            <p>
              Each Entrant indemnifies and holds the Promoter harmless against any claim, loss, or expense (including reasonable legal costs) arising from that Entrant&apos;s breach of these Terms &amp; Conditions or from any false or misleading information provided by them.
            </p>
          </Section>

          <Section title="16. Force majeure">
            <p>
              The Promoter will not be liable for any failure or delay in performing its obligations under the Promotion where that failure or delay is caused by events beyond its reasonable control, including but not limited to natural disasters, fire, flood, pandemic, civil unrest, government action, terrorism, war, strike, internet outage, electricity outage (including load shedding), or failure of any third-party service provider.
            </p>
          </Section>

          <Section title="17. Right to amend or cancel">
            <p>
              The Promoter reserves the right at any time to amend these Terms &amp; Conditions, suspend the Promotion, or cancel the Promotion in whole or in part, where it considers it necessary to do so (including to comply with a legal or regulatory requirement, to address a technical failure, or to prevent fraud).
            </p>
            <p>
              Material amendments will be published on <a href="https://cardtly.com/promotions/terms" className="underline" style={{ color: '#00d4ff' }}>cardtly.com/promotions/terms</a> and notified to existing Entrants by email at least 7 (seven) days before the change takes effect, unless the change is required by law to take effect sooner.
            </p>
            <p>
              In the event of cancellation, the Promoter will, to the extent reasonably practicable, honour any Prize already validly won and accepted.
            </p>
          </Section>

          <Section title="18. Severability">
            <p>
              If any provision of these Terms &amp; Conditions is found by a court of competent jurisdiction to be invalid, illegal, or unenforceable, that provision will be severed from these terms to the minimum extent required and the remaining provisions will continue in full force and effect.
            </p>
          </Section>

          <Section title="19. Governing law and disputes">
            <p>
              These Terms &amp; Conditions are governed by and interpreted in accordance with the laws of the Republic of South Africa.
            </p>
            <p>
              Any dispute arising out of or in connection with the Promotion will, in the first instance, be addressed by direct correspondence between the Entrant and the Promoter at <a href="mailto:contest@cardtly.com" className="underline" style={{ color: '#00d4ff' }}>contest@cardtly.com</a>. An Entrant may also lodge a complaint with the National Consumer Commission or with a recognised consumer ombud at any time.
            </p>
            <p>
              If the dispute cannot be resolved by correspondence, it will be subject to the exclusive jurisdiction of the appropriate court within the Republic of South Africa.
            </p>
          </Section>

          <Section title="20. Contact">
            <p>
              For any questions about the Promotion, to enter via the email-alt route, or to request a copy of these rules, contact:
            </p>
            <p>
              <strong>[Promoter legal name]</strong> trading as Cardtly<br />
              <strong>[Insert street address]</strong><br />
              <strong>[Insert city, province, postal code]</strong><br />
              Email: <a href="mailto:contest@cardtly.com" className="underline" style={{ color: '#00d4ff' }}>contest@cardtly.com</a><br />
              Web: <a href="https://cardtly.com/promotions" className="underline" style={{ color: '#00d4ff' }}>cardtly.com/promotions</a>
            </p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Cardtly is a trading name of [Promoter legal name]. Cardtly is not a registered lottery operator. The Promotion is run as a promotional competition under Section 36 of the Consumer Protection Act 68 of 2008, with no purchase necessary and a free alternative entry route as described in clause 5.2.
            </p>
          </Section>

        </div>
      </section>

      <Footer />
    </div>
  )
}
