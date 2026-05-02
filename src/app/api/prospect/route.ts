import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProspectAnalysisQueue } from '@/lib/queue'
import { v4 as uuidv4 } from 'uuid'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// UUID 検証
function isValidUUID(uuid: unknown): uuid is string {
  if (typeof uuid !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)
}

async function getTenantId(supabase: SupabaseServerClient) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.warn('[api/prospect] auth.getUser error:', userError.message)
    }
    
    if (!user) {
      console.warn('[api/prospect] no authenticated user')
      return null
    }

    if (!isValidUUID(user.id)) {
      console.error('[api/prospect] invalid user.id format:', user.id)
      return null
    }

    const { data, error } = await (supabase as any)
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('[api/prospect] failed to query users table:', error.message)
      return null
    }

    if (!data?.tenant_id) {
      console.error('[api/prospect] user has no tenant_id:', user.id)
      return null
    }

    if (!isValidUUID(data.tenant_id)) {
      console.error('[api/prospect] invalid tenant_id format:', data.tenant_id)
      return null
    }

    return { tenantId: data.tenant_id as string, userId: user.id }
  } catch (err) {
    console.error('[api/prospect] exception in getTenantId:', err)
    return null
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const keywords = Array.isArray(body?.keywords)
      ? body.keywords.filter(Boolean).map((keyword: unknown) => String(keyword).trim()).filter(Boolean)
      : []

    if (!keywords.length) {
      return NextResponse.json({ error: 'keywords is required and must be a non-empty array' }, { status: 400 })
    }

    const supabase = await createClient()
    const userInfo = await getTenantId(supabase)
    if (!userInfo) {
      console.error('[api/prospect] POST: failed to get tenant/user info')
      return NextResponse.json({ error: 'unauthorized or user information invalid' }, { status: 401 })
    }

    const { tenantId, userId } = userInfo
    const jobId = uuidv4()
    const admin = createAdminClient()

    console.log('[api/prospect] POST: attempting insert', {
      jobId,
      tenantId: `${tenantId.slice(0, 8)}...`,
      userId: `${userId.slice(0, 8)}...`,
      keywordCount: keywords.length,
    })

    const { error: insertError, data: insertData } = await (admin as any)
      .from('prospect_generation_jobs')
      .insert({
        id: jobId,
        tenant_id: tenantId,
        user_id: userId,
        keywords,
        status: 'pending',
      })
      .select()

    if (insertError) {
      console.error('[api/prospect] POST: insert failed', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
      })
      return NextResponse.json(
        { error: `Failed to create job: ${insertError.message}` },
        { status: 500 },
      )
    }

    console.log('[api/prospect] POST: insert succeeded', { jobId })

    await getProspectAnalysisQueue().add('prospect-analysis', {
      tenantId,
      userId,
      keywords,
      jobId,
    })

    console.log('[api/prospect] POST: job enqueued', { jobId })

    return NextResponse.json({ jobId, status: 'queued' })
  } catch (error) {
    console.error('[api/prospect] POST: exception', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
