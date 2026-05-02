import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProspectAnalysisQueue } from '@/lib/queue'
import { v4 as uuidv4 } from 'uuid'

// UUID 検証
function isValidUUID(uuid: unknown): uuid is string {
  if (typeof uuid !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)
}

async function getTenantId() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError) {
      console.warn('[api/sales/prospects] auth.getUser error:', userError.message)
    }

    if (!user) {
      console.warn('[api/sales/prospects] no authenticated user')
      return null
    }

    if (!isValidUUID(user.id)) {
      console.error('[api/sales/prospects] invalid user.id format:', user.id)
      return null
    }

    const { data, error } = await (supabase as any)
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('[api/sales/prospects] failed to query users table:', error.message)
      return null
    }

    if (!data?.tenant_id) {
      console.error('[api/sales/prospects] user has no tenant_id:', user.id)
      return null
    }

    if (!isValidUUID(data.tenant_id)) {
      console.error('[api/sales/prospects] invalid tenant_id format:', data.tenant_id)
      return null
    }

    return data.tenant_id as string
  } catch (err) {
    console.error('[api/sales/prospects] exception in getTenantId:', err)
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
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('[api/sales/prospects] POST: auth failed', { userError: userError?.message })
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    if (!isValidUUID(user.id)) {
      console.error('[api/sales/prospects] POST: invalid user.id format:', user.id)
      return NextResponse.json({ error: 'invalid user format' }, { status: 401 })
    }

    const { data, error } = await (supabase as any)
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (error || !data?.tenant_id) {
      console.error('[api/sales/prospects] POST: tenant lookup failed', { error: error?.message })
      return NextResponse.json({ error: 'tenant information invalid' }, { status: 401 })
    }

    const tenantId = data.tenant_id as string
    const userId = user.id

    if (!isValidUUID(tenantId)) {
      console.error('[api/sales/prospects] POST: invalid tenant_id format:', tenantId)
      return NextResponse.json({ error: 'invalid tenant format' }, { status: 401 })
    }

    const jobId = uuidv4()
    const admin = createAdminClient()

    console.log('[api/sales/prospects] POST: attempting insert', {
      jobId: `${jobId.slice(0, 8)}...`,
      tenantId: `${tenantId.slice(0, 8)}...`,
      userId: `${userId.slice(0, 8)}...`,
      keywordCount: keywords.length,
    })

    const { error: insertError } = await (admin as any)
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
      console.error('[api/sales/prospects] POST: insert failed', {
        code: insertError.code,
        message: insertError.message,
      })
      return NextResponse.json(
        { error: `Failed to create job: ${insertError.message}` },
        { status: 500 },
      )
    }

    console.log('[api/sales/prospects] POST: insert succeeded', { jobId: `${jobId.slice(0, 8)}...` })

    console.log('[api/sales/prospects] POST: attempting to enqueue job', {
      jobId: `${jobId.slice(0, 8)}...`,
      queueName: 'prospect-analysis',
    })

    const jobResult = await getProspectAnalysisQueue().add('prospect-analysis', {
      tenantId,
      userId,
      keywords,
      jobId,
    })

    console.log('[api/sales/prospects] POST: job enqueued successfully', {
      jobId: `${jobId.slice(0, 8)}...`,
      bullmqJobId: jobResult.id,
    })

    return NextResponse.json({ jobId, status: 'queued' })
  } catch (error) {
    console.error('[api/sales/prospects] POST: exception', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    const tenantId = await getTenantId()
    if (!tenantId) {
      console.error('[api/sales/prospects] GET: failed to get tenant info')
      return NextResponse.json({ error: 'unauthorized or tenant information invalid' }, { status: 401 })
    }

    console.log('[api/sales/prospects] GET: querying prospects', {
      tenantId: `${tenantId.slice(0, 8)}...`,
    })

    const supabase = await createClient()
    const db = supabase as any

    const { data, error } = await db
      .from('prospects')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('fit_score', { ascending: false })

    if (error) {
      console.error('[api/sales/prospects] GET: query failed', {
        code: error.code,
        message: error.message,
      })
      throw error
    }

    console.log('[api/sales/prospects] GET: query succeeded', { count: data?.length || 0 })
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('[api/sales/prospects] GET: exception', {
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
