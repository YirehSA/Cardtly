import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { FROM_EMAIL } from '@/lib/email'

const resend = new Resend(process.env.RESEND_API_KEY)
const ADMIN_EMAIL = 'info@yireh.co.za'

function buildOrderRow(line: any): string {
  const name = line.nameOnCard || ''
  const title = line.titleOnCard ? ' — ' + line.titleOnCard : ''
  const color = (line.color || 'black').charAt(0).toUpperCase() + (line.color || 'black').slice(1)
  const qty = String(line.quantity || 1)
  return '<tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;">' + name + title + '</td><td style="padding:8px 0;text-align:center;">' + color + '</td><td style="padding:8px 0;text-align:right;">' + qty + '</td></tr>'
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { address, city, province, postal_code, postalCode, color, nameOnCard, titleOnCard, quantity = 1, card_id, card_slug, cards: multiCards } = body

    const shippingPostal = postal_code || postalCode

    if (!address || !city || !province || !shippingPostal) {
      return NextResponse.json({ error: 'Missing required shipping fields' }, { status: 400 })
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as any

    const orderLines = multiCards || [{ color, nameOnCard, titleOnCard, quantity, card_id, card_slug }]
    const totalCards = orderLines.reduce((sum: number, l: any) => sum + (l.quantity || 1), 0)
    const orderDate = new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })

    for (const line of orderLines) {
      if (!line.nameOnCard) continue
      await admin.from('nfc_orders').insert({
        user_id: user.id,
        card_id: line.card_id || null,
        color: line.color || 'black',
        name_on_card: line.nameOnCard,
        title_on_card: line.titleOnCard || null,
        shipping_address: address,
        shipping_city: city,
        shipping_province: province,
        shipping_postal_code: shippingPostal,
        quantity: line.quantity || 1,
        card_slug: line.card_slug || null,
        amount: 0,
        status: 'pending_invoice',
      })
    }

    const tableHeader = '<table style="width:100%;border-collapse:collapse;font-size:14px;"><thead><tr style="border-bottom:2px solid #ddd;"><th style="padding:8px 0;text-align:left;">Name</th><th style="padding:8px 0;text-align:center;">Colour</th><th style="padding:8px 0;text-align:right;">Qty</th></tr></thead><tbody>'
    const orderRows = orderLines.map(buildOrderRow).join('')
    const orderTable = tableHeader + orderRows + '</tbody></table>'
    const shipTo = address + ', ' + city + ', ' + province + ' ' + shippingPostal
    const cardCount = String(totalCards) + ' card' + (totalCards !== 1 ? 's' : '')

    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: 'New NFC Order — ' + user.email + ' (' + cardCount + ')',
      html: '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#00d4ff,#7c3aed,#ec4899);padding:24px;border-radius:12px 12px 0 0;"><h1 style="color:white;margin:0;">New NFC Card Order</h1><p style="color:rgba(255,255,255,0.8);margin:4px 0 0;">' + orderDate + '</p></div><div style="background:#f8f8f8;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e5e5;border-top:none;"><p><strong>Customer:</strong> ' + user.email + '</p>' + orderTable + '<p style="margin-top:16px;"><strong>Ship to:</strong> ' + shipTo + '</p><div style="margin-top:20px;padding:16px;background:#fff3cd;border:1px solid #ffc107;border-radius:8px;"><strong>Send invoice to ' + user.email + '</strong></div></div></div>',
    })

    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email!,
      subject: 'Your Cardtly NFC Order (' + cardCount + ')',
      html: '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#00d4ff,#7c3aed,#ec4899);padding:24px;border-radius:12px 12px 0 0;"><h1 style="color:white;margin:0;">Order Received!</h1></div><div style="background:#f8f8f8;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e5e5;border-top:none;"><p>We received your order for <strong>' + cardCount + '</strong>. We will send an invoice shortly.</p>' + orderTable + '<p style="margin-top:16px;"><strong>Deliver to:</strong> ' + shipTo + '</p><p style="font-size:12px;color:#999;margin-top:24px;text-align:center;">Cardtly · cardtly.com</p></div></div>',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('NFC order error:', error)
    return NextResponse.json({ error: 'Failed to place order' }, { status: 500 })
  }
}
