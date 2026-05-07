import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as any

    const { data: order } = await admin
      .from('nfc_orders')
      .select('id, user_id, status')
      .eq('id', id)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (order.status !== 'pending_invoice') {
      return NextResponse.json({ error: 'Only pending orders can be cancelled' }, { status: 400 })
    }

    await admin.from('nfc_orders').delete().eq('id', id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('NFC order delete error:', error)
    return NextResponse.json({ error: 'Failed to cancel order' }, { status: 500 })
  }
}
