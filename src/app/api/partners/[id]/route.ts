import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const adb = createAdminClient()
    const { data: u, error: userErr } = await adb.from('users').select('tenant_id').eq('id', user.id).single<{ tenant_id: string }>()
    if (userErr || !u?.tenant_id) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const tenantId = u.tenant_id
    const tenantNameRes = await adb.from('tenants').select('name').eq('id', tenantId).single<{ name: string }>()
    const tenantName = tenantNameRes.data?.name ?? null

    const [partnerRes, ordersRes, docsRes] = await Promise.all([
      adb.from('partners').select('*').eq('id', id).eq('tenant_id', tenantId).single<any>(),
      adb.from('work_orders')
        .select('id, partner_id, title, description, order_date, delivery_date, amount, status, notes, created_at')
        .eq('tenant_id', tenantId)
        .eq('partner_id', id)
        .order('order_date', { ascending: false }) as any,
      adb.from('documents')
        .select('id, partner_id, work_order_id, doc_type, doc_number, issue_date, title, amount, description, status, created_at')
        .eq('tenant_id', tenantId)
        .eq('partner_id', id)
        .order('created_at', { ascending: false }) as any,
    ])

    if (partnerRes.error || !partnerRes.data) {
      return NextResponse.json({ error: 'partner_not_found' }, { status: 404 })
    }

    return NextResponse.json({
      partner: partnerRes.data,
      tenantName,
      workOrders: (ordersRes.data ?? []),
      documents: (docsRes.data ?? []),
    })
  } catch (error) {
    console.error('[api/partners/[id]] error:', error)
    return NextResponse.json({ error: 'failed_to_load' }, { status: 500 })
  }
}
