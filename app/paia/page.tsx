import type { Metadata } from 'next'
import LegalPage, { Section, B, A, Table, Contents } from '@/components/marketing/LegalPage'
import { COMPANY } from '@/lib/company'

export const metadata: Metadata = {
  title: 'PAIA Manual: Requesting Records From Us',
  description:
    'The PAIA manual of Cardtly (Pty) Ltd: the records we hold, how to request one, fees and timelines, grounds for refusal, and how we process personal information.',
  alternates: { canonical: '/paia' },
}

// THE MANUAL SECTION 51 OF PAIA REQUIRES of every private body. The small
// business exemption lapsed on 31 December 2021, so there is no size below
// which it is optional. Written 2026-10-22 to the order of the Information
// Regulator's template, with a request procedure added.
//
// Section 10 restates the privacy policy (purposes, data subjects, recipients,
// cross-border transfer, security) in the form PAIA s51(1)(c) asks for. It must
// say nothing the policy does not: scripts/check-privacy-disclosures requires
// every provider named in privacy section 7 to be named here too. When the
// policy changes, change this.
//
// Fees are referred to, not quoted. The amounts are set in Annexure B of the
// PAIA Regulations and change, sources disagree about the current request fee,
// and this page is reachable inside the iOS app, where a rand figure trips the
// price guard. The Regulator's address was taken from its own contact page on
// 2026-10-22: it moved to Woodmead, and many sites still give Braamfontein.

const CONTENTS: [string, string][] = [
  ['about', 'About this manual'],
  ['contact', 'Contact details'],
  ['guide', 'The Regulator’s guide to PAIA'],
  ['open', 'Records available without a request'],
  ['law', 'Records kept under other laws'],
  ['records', 'The records we hold'],
  ['request', 'How to request a record'],
  ['refuse', 'When a request can be refused'],
  ['remedies', 'If you disagree with our decision'],
  ['personal', 'How we process personal information'],
  ['availability', 'Where this manual is available'],
  ['updates', 'Updates to this manual'],
]

const mail = `mailto:${COMPANY.email}`

export default function PaiaPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="PAIA"
      accent="Manual"
      intro="How to request a record from Cardtly under the Promotion of Access to Information Act, and how we process personal information."
      updated="22 October 2026"
    >
      <Contents items={CONTENTS} />

      <Section id="about" title="1. About this manual">
        <p>
          This is the manual of {COMPANY.name} under section 51 of the Promotion of Access to Information Act 2 of 2000 (PAIA). PAIA gives everyone the right to request a record held by a private body where the record is needed to exercise or protect a right, subject to the grounds for refusal in the Act.
        </p>
        <p>
          It sets out the records we hold, how to ask for one, what it can cost, how long a decision takes, and when we may refuse. As the Protection of Personal Information Act 4 of 2013 (POPIA) requires, it also describes how we process personal information.
        </p>
        <p>
          <B>Only want your own information?</B> You do not need this procedure. Signed-in users can download everything we hold about their account in{' '}
          <A href="/dashboard/settings">Dashboard, Settings</A>, under Account. Otherwise email our Information Officer at <A href={mail}>{COMPANY.email}</A>. That is a request under POPIA section 23, and no PAIA request fee applies to it.
        </p>
        <p>In this manual:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li><B>PAIA</B> is the Promotion of Access to Information Act 2 of 2000, and the <B>PAIA Regulations</B> are the regulations made under it in 2021.</li>
          <li><B>POPIA</B> is the Protection of Personal Information Act 4 of 2013.</li>
          <li><B>The Regulator</B> is the Information Regulator (South Africa).</li>
          <li><B>Cardtly</B>, <B>we</B> and <B>us</B> mean {COMPANY.name}.</li>
        </ul>
      </Section>

      <Section id="contact" title="2. Contact details">
        <p>Send requests and questions about this manual to the Information Officer.</p>
        <Table
          rows={[
            [<B key="n">Private body</B>, COMPANY.name],
            [<B key="r">Registration number</B>, COMPANY.regNumber],
            [<B key="h">Head of the private body and Information Officer</B>, COMPANY.informationOfficer],
            [<B key="d">Deputy Information Officer</B>, 'None appointed'],
            [<B key="e">Email</B>, <A key="ea" href={mail}>{COMPANY.email}</A>],
            [<B key="t">Telephone</B>, COMPANY.phone],
            [<B key="a">Physical address</B>, COMPANY.address],
            [<B key="w">Website</B>, COMPANY.website],
          ]}
        />
      </Section>

      <Section id="guide" title="3. The Regulator’s guide to PAIA">
        <p>
          As section 10 of PAIA requires, the Regulator publishes a guide explaining how to use the Act: what rights it gives, how to make a request, and what to do if a request is refused. It is available from the Regulator&apos;s website. We will email you a copy on request, and a copy can be inspected at our office by arrangement.
        </p>
        <p><B>The Information Regulator (South Africa)</B></p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Woodmead North Office Park, 54 Maxwell Drive, Woodmead, Johannesburg, 2191</li>
          <li>Telephone 010 023 5200, toll free 0800 017 160</li>
          <li>Email <A href="mailto:enquiries@inforegulator.org.za">enquiries@inforegulator.org.za</A></li>
          <li>Website <A href="https://inforegulator.org.za">inforegulator.org.za</A></li>
        </ul>
      </Section>

      <Section id="open" title="4. Records available without a request">
        <p>These are published on our website, and anyone may read them without making a request under PAIA:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>our <A href="/privacy">Privacy Policy</A>;</li>
          <li>our <A href="/terms">Terms of Service</A>, including the <A href="/terms#data-protection">POPIA operator agreement</A>;</li>
          <li>this manual, and our <A href="/trust">Trust Centre</A>;</li>
          <li>the <A href="/delete-account">instructions for deleting an account</A>;</li>
          <li>product information and articles on cardtly.com; and</li>
          <li>digital business cards, which their owners publish and which anyone with a card&apos;s link can see.</li>
        </ul>
      </Section>

      <Section id="law" title="5. Records kept under other laws">
        <p>
          We keep records that the following laws require, where they apply to us. Records held under them are available as those laws, and PAIA, allow. The list is not complete.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Basic Conditions of Employment Act 75 of 1997</li>
          <li>Companies Act 71 of 2008</li>
          <li>Compensation for Occupational Injuries and Diseases Act 130 of 1993</li>
          <li>Consumer Protection Act 68 of 2008</li>
          <li>Electronic Communications and Transactions Act 25 of 2002</li>
          <li>Income Tax Act 58 of 1962</li>
          <li>Labour Relations Act 66 of 1995</li>
          <li>Promotion of Access to Information Act 2 of 2000</li>
          <li>Protection of Personal Information Act 4 of 2013</li>
          <li>Tax Administration Act 28 of 2011</li>
          <li>Unemployment Insurance Act 63 of 2001</li>
        </ul>
      </Section>

      <Section id="records" title="6. The records we hold">
        <p>Listing a category here does not mean every record in it will be released. Each request is decided under sections 7 and 8 of this manual.</p>
        <Table
          head={['Subject', 'Records']}
          rows={[
            ['Company and governance', 'Incorporation documents and memorandum of incorporation, share register, resolutions of directors and shareholders, filings with the Companies and Intellectual Property Commission'],
            ['Finance and tax', 'Accounting records, financial statements, tax returns and correspondence with the South African Revenue Service, bank statements, and our invoices, quotes, receipts and purchase orders'],
            ['Customers and accounts', 'Account and profile records, digital cards and their content, team and organisation records, subscriptions and billing history, physical card orders and delivery details, accepted quotes and their signatures, and support and sales correspondence'],
            ['Information captured through customers’ cards', 'Contacts, leads, meeting requests and questionnaire answers captured through a customer’s card, and records of card views and taps. We hold these as the customer’s operator: see section 7'],
            ['Sales partners', 'Reseller applications and accounts, and the records and activity of our sales representatives'],
            ['Suppliers and service providers', 'Agreements and terms with the providers that run our service, and their invoices'],
            ['People who work for us', 'Employment and contractor agreements, and the payment, tax and other records employment laws require'],
            ['Technology and security', 'Source code and its change history, system configuration, logs of administrative actions and of every change to a subscription, and database backups'],
            ['Marketing', 'Website content, and entries and winners’ records for any promotion we run'],
            ['Legal', 'Agreements, current and earlier versions of our policies and terms, and correspondence with authorities'],
          ]}
        />
      </Section>

      <Section id="request" title="7. How to request a record">
        <ol className="list-decimal pl-6 space-y-3">
          <li>
            <B>Complete Form 2, Request for Access to Record</B>, prescribed under regulation 7 of the PAIA Regulations. It is available from the Regulator&apos;s website, and we will email you a copy on request.
          </li>
          <li>
            <B>Send it to our Information Officer</B> at <A href={mail}>{COMPANY.email}</A>.
          </li>
          <li>
            <B>Include</B> enough detail for us to identify the record, the form of access you want (for example a copy, or inspecting it), and the right you want to exercise or protect, with why the record is needed for it, as section 53 of PAIA requires. Attach proof of your identity and, if you are asking for someone else, proof that you may act for them.
          </li>
        </ol>
        <p>
          <B>Fees.</B> If you are asking for your own personal information, no request fee is payable. Anyone else pays the request fee prescribed in Annexure B of the PAIA Regulations before we process the request. Access fees for reproducing a record, and for the time it takes to search for and prepare it, may then apply to any requester, and a deposit may be asked for where the work will take longer than the Regulations allow without one. We tell you in writing what is payable, and why, before you pay anything.
        </p>
        <p>
          <B>How long it takes.</B> We decide within 30 days of receiving a complete request, as section 56 requires, and tell you the decision. We may extend that once, by up to 30 more days, where section 57 allows, for example when the request covers many records, and we tell you why. If we do not decide in time, PAIA treats the request as refused, and you may use the remedies in section 9.
        </p>
        <p>
          <B>Records about someone else.</B> If a record contains a third party&apos;s personal or commercial information, sections 71 to 73 require us to tell them, give them the chance to respond, and consider what they say before deciding. This can add time.
        </p>
        <p>
          <B>Information captured through a customer&apos;s card.</B> For contacts and leads captured through a card, the customer who owns the card is the responsible party and Cardtly is its operator. We will usually refer a request for that information to the customer and help them respond, as our <A href="/privacy">Privacy Policy</A> describes.
        </p>
      </Section>

      <Section id="refuse" title="8. When a request can be refused">
        <p>Chapter 4 of Part 3 of PAIA sets out the grounds on which a private body must or may refuse access. In summary, we may refuse a record, or part of one, where releasing it would:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>unreasonably disclose personal information about another person (section 63);</li>
          <li>disclose a third party&apos;s trade secrets, or financial, commercial, scientific or technical information likely to harm their commercial or financial interests (section 64);</li>
          <li>breach a duty of confidence owed to a third party (section 65);</li>
          <li>endanger someone&apos;s life or physical safety, or the security of a building, system or property (section 66);</li>
          <li>disclose a record privileged from production in legal proceedings (section 67);</li>
          <li>disclose our own trade secrets, or financial, commercial, scientific or technical information likely to harm our commercial or financial interests, or information whose release would put us at a disadvantage in negotiations or competition (section 68); or</li>
          <li>disclose research by us or a third party where that would seriously disadvantage the researcher or the subject (section 69).</li>
        </ul>
        <p>
          Even then, section 70 requires us to release the record where it would reveal evidence of a substantial breach of the law, or an imminent and serious risk to public safety or the environment, and the public interest in releasing it clearly outweighs the harm. Where only part of a record may be refused, we release the rest (section 59). A refusal is given in writing, with our reasons.
        </p>
      </Section>

      <Section id="remedies" title="9. If you disagree with our decision">
        <p>
          A private body has no internal appeal under PAIA. If we refuse your request, do not decide in time, or you disagree with a fee or an extension, you may, within 180 days of our decision:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><B>complain to the Regulator</B>, on its Form 5, through its website or at the contact details in section 3; or</li>
          <li><B>apply to a court</B> for relief, as section 78 of PAIA allows.</li>
        </ul>
        <p>A third party who disagrees with our decision to release a record about them has the same options.</p>
      </Section>

      <Section id="personal" title="10. How we process personal information">
        <p>
          This section gives what PAIA section 51 asks of a manual. Our <A href="/privacy">Privacy Policy</A> sets out in full how we handle information about the people who use Cardtly and the people their cards reach.
        </p>

        <p><B>Why we process it.</B></p>
        <ul className="list-disc pl-6 space-y-2">
          <li>to create accounts and publish the digital cards our customers make;</li>
          <li>to store, as our customers&apos; operator, the contacts and requests their cards capture, and run their team accounts;</li>
          <li>to take payment, invoice organisations and manage subscriptions;</li>
          <li>to make, and deliver, physical NFC cards that customers order;</li>
          <li>to review reseller applications and run reseller accounts;</li>
          <li>to send service emails, and provide support;</li>
          <li>to keep the service secure and prevent fraud and abuse;</li>
          <li>to improve the product from patterns across many accounts;</li>
          <li>to run the AI bio writer and paper card scanning, each time someone chooses to use them; and</li>
          <li>to keep the records the law requires.</li>
        </ul>

        <p><B>Whose information, and what.</B></p>
        <Table
          head={['People', 'Information']}
          rows={[
            ['Account holders', 'Name, email address, password stored only as a one-way hash, how they sign in, the approximate city, region and country they signed up from, subscription and billing records'],
            ['People on cards, including team staff', 'What is on the card: name, job title, company, phone and WhatsApp numbers, email, address, website, bio, photographs, logos, links and social profiles'],
            ['People who view a card', 'That a card was opened or tapped, which link or button was used, device type, browser and operating system, and the referring site. No IP address is stored'],
            ['People who share details through a card', 'What they submit, typically name, email, phone number, company and message, and meeting requests and questionnaire answers'],
            ['Organisations’ billing contacts and signatories', 'Contact details, invoices and quotes. For an accepted quote or a signed purchase order, the signer’s name and email address, the time, and the IP address and browser used, and on a purchase order their job title and drawn signature'],
            ['Buyers of physical cards', 'Name, delivery address and phone number'],
            ['Reseller applicants and resellers', 'Business name, registration and VAT numbers, address, contact person, email and phone'],
            ['Our sales representatives', 'Contact details, and the sales activity they record'],
            ['People whose paper business card is scanned', 'The photograph of the card, and the details on it'],
          ]}
        />

        <p><B>Who receives it.</B> The service providers named in section 7 of our Privacy Policy, each receiving only what it needs: Supabase, Vercel, Paystack, Resend, OpenAI, ipapi.co, Google, Apple and Microsoft. On a team account, the organisation&apos;s own administrators. A reseller sees the names, seats and admin email address of the client teams it creates. Authorities, where the law requires it.</p>

        <p>
          <B>Transfers outside South Africa.</B> Our database and uploaded files are hosted by Supabase in its West Europe region, in the European Union, and our other providers may process what they receive in other countries, including the United States. We rely on POPIA section 72: the recipients are bound by laws giving protection substantially similar to POPIA&apos;s, and the transfers are needed to provide the service.
        </p>

        <p><B>How it is protected.</B></p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Row-level security in the database refuses one customer&apos;s records to anyone else, whatever the website asks for.</li>
          <li>HTTPS only in transit, enforced so browsers will not try an insecure connection. Our database, files and backups are encrypted at rest by our hosting provider.</li>
          <li>Passwords are stored only as one-way hashes, and sign-in attempts are rate limited.</li>
          <li>Administrative actions by Cardtly staff, and every change to a subscription, are logged with who made them and when.</li>
          <li>Payment card details are handled only by Paystack. We never see or store a card number.</li>
          <li>If a breach affects personal information, we notify the Regulator and the people affected as soon as reasonably possible, as POPIA section 22 requires.</li>
        </ul>
      </Section>

      <Section id="availability" title="11. Where this manual is available">
        <p>
          This manual is published at cardtly.com/paia. We will email a copy free of charge on request, and a copy can be inspected at our office during business hours by arrangement.
        </p>
      </Section>

      <Section id="updates" title="12. Updates to this manual">
        <p>
          We update this manual when the records we hold, or the way we process personal information, change. The date at the top shows the last update.
        </p>
        <p>
          Issued by {COMPANY.informationOfficer}, Information Officer, for {COMPANY.name}.
        </p>
      </Section>
    </LegalPage>
  )
}
