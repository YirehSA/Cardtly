import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { resolveCardOwner } from '@/lib/card-owner'
import { waBridgeLink } from '@/lib/wa-bridge'
import { FROM_EMAIL } from '@/lib/email'
import { parseIsoDate, parseHHMM, cleanTimeZone, isPastDate, formatBookingDate, formatBookingTime } from '@/lib/booking-format'
import { ownerBookingEmail, requesterBookingEmail, type BookingDetails } from '@/lib/booking-email'

// Public endpoint: a visitor on someone's card submits a meeting
// request. We store it in the bookings table, fire an email to the
// card owner via Resend, and add the visitor to the owner's
// contacts list so they don't have to enter the info twice if they
// also want to follow up. Works for personal and team cards; for
// team cards the contact is stored under team_card_id so the team
// admin sees it in Team Contacts.

const resend = new Resend(process.env.RESEND_API_KEY)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com').replace(/\/$/, '')

export async function POST(request: Request) {
  let body: {
    card_id?: string
    requester_name?: string
    requester_email?: string
    requester_phone?: string
    preferred_date?: string
    preferred_time?: string
    time_zone?: string
    notes?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { card_id, requester_name, requester_email, requester_phone, notes } = body

  if (!card_id || !requester_name?.trim() || !requester_email?.trim() || !body.preferred_date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!EMAIL_RE.test(requester_email.trim())) {
    return NextResponse.json({ error: 'Please check your email address.' }, { status: 400 })
  }

  // The date and time are checked here, not trusted from the form: they are
  // written into two emails and the owner's contacts.
  if (!parseIsoDate(body.preferred_date)) {
    return NextResponse.json({ error: 'Please choose a date.' }, { status: 400 })
  }
  if (isPastDate(body.preferred_date)) {
    return NextResponse.json({ error: 'That date has already passed. Please choose another.' }, { status: 400 })
  }
  const preferred_date = body.preferred_date.trim()
  const rawTime = String(body.preferred_time ?? '').trim()
  const preferred_time = rawTime ? parseHHMM(rawTime) : null
  if (rawTime && !preferred_time) {
    return NextResponse.json({ error: 'Please choose a time, or leave it as any time.' }, { status: 400 })
  }
  const timeZone = cleanTimeZone(body.time_zone)

  const whenDate = formatBookingDate(preferred_date)
  const whenTime = formatBookingTime(preferred_time, timeZone)

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // Resolve the owner + correct storage column. card_id here may be a
  // personal card id or a team card id - the resolver detects which.
  const owner = await resolveCardOwner(admin, card_id)
  if (!owner.found) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  }
  const cardName = owner.cardName

  // Store the booking request. Falls through silently if the
  // bookings table does not exist yet so the email still sends.
  try {
    await admin.from('bookings').insert({
      card_id,
      requester_name: requester_name.trim(),
      requester_email: requester_email.trim(),
      requester_phone: requester_phone?.trim() || null,
      preferred_date,
      preferred_time,
      notes: notes?.trim() || null,
      status: 'pending',
    })
  } catch {
    // table missing or RLS - non-fatal
  }

  // Also add to contacts so the owner (and, for team cards, the team
  // admin) sees the request in the dashboard. Stored under the correct
  // column so team-card bookings show in Team Contacts. We log any
  // failure loudly rather than swallowing it - this is a required
  // surface, not best-effort. Migration 013 guarantees the schema
  // (nullable card_id + team_card_id) this insert depends on.
  const { error: contactErr } = await admin.from('contacts').insert({
    card_id: owner.personalCardId,
    team_card_id: owner.teamCardId,
    name: requester_name.trim(),
    email: requester_email.trim(),
    phone: requester_phone?.trim() || null,
    message: `Meeting request for ${whenDate}, ${preferred_time ? whenTime : 'any time'}.${notes?.trim() ? '\n\nWhat it is about: ' + notes.trim() : ''}`,
    source: 'booking',
  })
  if (contactErr) {
    console.error('bookings: failed to store contact', contactErr)
  }

  // Both emails come from lib/booking-email, so a check can render them and
  // confirm every detail the visitor gave reaches the owner.
  const first = requester_name.trim().split(/\s+/)[0]
  const details: BookingDetails = {
    requesterName: requester_name.trim(),
    requesterEmail: requester_email.trim(),
    requesterPhone: requester_phone?.trim() || null,
    date: preferred_date,
    time: preferred_time,
    timeZone,
    notes: notes?.trim() || null,
    cardName,
    cardTitle: owner.cardTitle,
    cardCompany: owner.cardCompany,
    cardUrl: owner.cardSlug ? `${APP_URL}/card/${owner.cardSlug}` : null,
    isTeam: owner.isTeam,
    sentAt: new Date(),
    // Through cardtly.com/wa, which opens the WhatsApp app: a wa.me link in an
    // email opened WhatsApp's web page in the mail app's browser instead.
    whatsappUrl: waBridgeLink(requester_phone, `Hi ${first}, thanks for your meeting request on my Cardtly card for ${formatBookingDate(preferred_date)}${preferred_time ? ` at ${preferred_time}` : ''}.`),
  }

  // Notify the card owner via Resend (their card email + account email)
  if (process.env.RESEND_API_KEY && owner.ownerEmails.length > 0) {
    try {
      const mail = ownerBookingEmail(details)
      await resend.emails.send({
        from: FROM_EMAIL,
        to: owner.ownerEmails,
        replyTo: details.requesterEmail,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      })
    } catch {
      // Email send failed - the request is still saved and visible in contacts
    }
  }

  // And tell the person who asked.
  //
  // They filled in a form on a stranger's card and got a thank-you panel that
  // vanished on refresh - no record, no address to chase, and no way to tell a
  // request that arrived from one that was swallowed. The commonest reason a
  // lead goes cold is the person quietly assuming nothing happened.
  if (process.env.RESEND_API_KEY) {
    try {
      const mail = requesterBookingEmail(details)
      await resend.emails.send({
        from: FROM_EMAIL,
        to: details.requesterEmail,
        // So a reply reaches the person they asked to meet, not our inbox.
        ...(owner.ownerEmails.length > 0 ? { replyTo: owner.ownerEmails[0] } : {}),
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      })
    } catch {
      // Their request is saved and the owner has been told; failing to send the
      // receipt is not a reason to report the whole thing as failed.
    }
  }

  return NextResponse.json({ success: true })
}
