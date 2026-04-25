'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getCtx() {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { db, user: null, tenantId: null }
  const { data: u } = await db.from('users').select('tenant_id').eq('id', user.id).single()
  return { db, user, tenantId: u?.tenant_id ?? null }
}

export type DocType = 'purchase_order' | 'invoice'

export type Document = {
  id: string
  partner_id: string | null
  work_order_id: string | null
  doc_type: DocType
  doc_number: string
  issue_date: string
  title: string
  amount: number
  description: string | null
  status: string
  created_at: string
  partner?: { company_name: string } | null
}

// ─── 書類一覧 ─────────────────────────────────────────────
export async function getDocuments(partnerId?: string) {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { data: [] }

  let q = db
    .from('documents')
    .select('*, partner:partners(company_name)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (partnerId) q = q.eq('partner_id', partnerId)

  const { data } = await q
  return { data: (data ?? []) as Document[] }
}

// ─── 書類番号生成 ─────────────────────────────────────────
async function genDocNumber(db: any, tenantId: string, docType: DocType): Promise<string> {
  const prefix = docType === 'purchase_order' ? 'PO' : 'INV'
  const today  = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  const { data } = await db
    .from('documents')
    .select('doc_number')
    .eq('tenant_id', tenantId)
    .eq('doc_type', docType)
    .like('doc_number', `${prefix}-${today}-%`)
    .order('doc_number', { ascending: false })
    .limit(1)

  const last = data?.[0]?.doc_number as string | undefined
  const seq  = last ? parseInt(last.split('-')[2] ?? '0') + 1 : 1
  return `${prefix}-${today}-${String(seq).padStart(3, '0')}`
}

// ─── 書類発行（DBに保存）─────────────────────────────────
export async function createDocument(input: {
  partner_id: string
  work_order_id?: string | null
  doc_type: DocType
  title: string
  amount: number
  description?: string
  issue_date?: string
}) {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { error: '未認証', docNumber: null }

  const docNumber = await genDocNumber(db, tenantId, input.doc_type)
  const issueDate = input.issue_date ?? new Date().toISOString().slice(0, 10)

  const { error } = await db.from('documents').insert({
    tenant_id:     tenantId,
    partner_id:    input.partner_id,
    work_order_id: input.work_order_id ?? null,
    doc_type:      input.doc_type,
    doc_number:    docNumber,
    issue_date:    issueDate,
    title:         input.title,
    amount:        input.amount,
    description:   input.description ?? null,
    status:        'issued',
  })

  if (error) return { error: error.message, docNumber: null }
  revalidatePath(`/partners/${input.partner_id}`)
  return { success: true, docNumber }
}

// ─── 書類削除 ─────────────────────────────────────────────
export async function deleteDocument(id: string, partnerId: string) {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { error: '未認証' }

  const { error } = await db
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  revalidatePath(`/partners/${partnerId}`)
  return { success: true }
}
