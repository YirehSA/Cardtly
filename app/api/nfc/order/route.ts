import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const ADMIN_EMAIL = 'info@yireh.co.za'
const FROM_EMAIL = 'noreply@cardtly.com'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const {
      color, nameOnCard, titleOnCard,
      address, city, province, postalCode,
      quantity = 1, card_id, card_slug,
    } = await request.json()

    if (!nameOnCard || !address || !city || !province || !postalCode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as any

    // Save order to database
    const { data: order, error } = await admin.from('nfc_orders').insert({
      user_id: user.id,
      card_id: card_id || null,
      color,
      name_on_card: nameOnCard,
      title_on_card: titleOnCard || null,
      shipping_address: address,
      shipping_city: city,
      shipping_province: province,
      shipping_postal_code: postalCode,
      quantity,
      amount: 0, // Invoice based
      status: 'pending_invoice',
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const cardUrl = card_slug ? `https://cardtly.com/card/${card_slug}` : 'Not set'
    const orderDate = new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })

    // Email to admin (you)
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `New NFC Card Order — ${nameOnCard}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          <div style="background: linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">New NFC Card Order</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0;">${orderDate}</p>
          </div>
          <div style="background: #f8f8f8; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e5e5e5; border-top: none;">
            
            <h2 style="font-size: 16px; margin: 0 0 16px;">Customer</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 6px 0; color: #666;">Email</td><td style="padding: 6px 0; font-weight: 600;">${user.email}</td></tr>
            </table>

            <h2 style="font-size: 16px; margin: 24px 0 16px;">Card Details</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 6px 0; color: #666;">Name on card</td><td style="padding: 6px 0; font-weight: 600;">${nameOnCard}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Job title</td><td style="padding: 6px 0; font-weight: 600;">${titleOnCard || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Colour</td><td style="padding: 6px 0; font-weight: 600; text-transform: capitalize;">${color}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Quantity</td><td style="padding: 6px 0; font-weight: 600;">${quantity} card${quantity !== 1 ? 's' : ''}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Digital card URL</td><td style="padding: 6px 0; font-weight: 600;"><a href="${cardUrl}">${cardUrl}</a></td></tr>
            </table>

            <h2 style="font-size: 16px; margin: 24px 0 16px;">Shipping Address</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 6px 0; color: #666;">Street</td><td style="padding: 6px 0; font-weight: 600;">${address}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">City</td><td style="padding: 6px 0; font-weight: 600;">${city}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Province</td><td style="padding: 6px 0; font-weight: 600;">${province}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Postal code</td><td style="padding: 6px 0; font-weight: 600;">${postalCode}</td></tr>
            </table>

            <div style="margin-top: 24px; padding: 16px; background: #fff3cd; border-radius: 8px; border: 1px solid #ffc107;">
              <p style="margin: 0; font-size: 14px; font-weight: 600;">Action required: Send invoice to ${user.email}</p>
            </div>
          </div>
        </div>
      `,
    })

    // Confirmation email to customer
    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email!,
      subject: 'Your Cardtly NFC Card Order',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          <div style="background: linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">Order Received!</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0;">Thank you for your Cardtly NFC card order</p>
          </div>
          <div style="background: #f8f8f8; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e5e5e5; border-top: none;">
            
            <p style="font-size: 15px;">Hi ${nameOnCard},</p>
            <p style="font-size: 14px; color: #444;">We have received your NFC card order. We will send you an invoice at <strong>${user.email}</strong> shortly. Once payment is confirmed, your card will be produced and shipped within 5–7 business days.</p>

            <h2 style="font-size: 16px; margin: 24px 0 16px;">Order Summary</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 6px 0; color: #666;">Name on card</td><td style="padding: 6px 0; font-weight: 600;">${nameOnCard}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Job title</td><td style="padding: 6px 0; font-weight: 600;">${titleOnCard || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Colour</td><td style="padding: 6px 0; font-weight: 600; text-transform: capitalize;">${color}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Quantity</td><td style="padding: 6px 0; font-weight: 600;">${quantity} card${quantity !== 1 ? 's' : ''}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Deliver to</td><td style="padding: 6px 0; font-weight: 600;">${address}, ${city}, ${province}</td></tr>
            </table>

            <div style="margin-top: 24px; padding: 16px; background: #e8f5e9; border-radius: 8px; border: 1px solid #4caf50;">
              <p style="margin: 0; font-size: 14px;">Questions? Reply to this email or contact us at <a href="mailto:info@yireh.co.za">info@yireh.co.za</a></p>
            </div>

            <p style="font-size: 12px; color: #999; margin-top: 24px; text-align: center;">Cardtly · Digital Business Cards · cardtly.com</p>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ success: true, order_id: order.id })
  } catch (error) {
    console.error('NFC order error:', error)
    return NextResponse.json({ error: 'Failed to place order' }, { status: 500 })
  }
}
