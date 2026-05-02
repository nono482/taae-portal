import { Queue, Worker } from 'bullmq'
import IORedis, { type RedisOptions } from 'ioredis'

export interface ProspectAnalysisJobData {
  tenantId: string
  userId: string
  keywords: string[]
  jobId: string
}

function buildRedisOptions(redisUrl: string): RedisOptions {
  return {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    connectTimeout: 10000,
    commandTimeout: 30000,
    tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
  }
}

function createConnection(): IORedis {
  const REDIS_URL = (process.env.REDIS_URL ?? '').trim()
  if (!REDIS_URL) {
    throw new Error('REDIS_URL is not set')
  }
  return new IORedis(REDIS_URL, buildRedisOptions(REDIS_URL))
}

let _sharedConnection: IORedis | null = null

function getSharedConnection(): IORedis {
  if (!_sharedConnection) {
    _sharedConnection = createConnection()
  }
  return _sharedConnection
}

// ─── Lazy queue instances ─────────────────────────────────
let _prospectAnalysisQueue: Queue<ProspectAnalysisJobData> | null = null
let _emailSendQueue: Queue | null = null

export function getProspectAnalysisQueue(): Queue<ProspectAnalysisJobData> {
  if (!_prospectAnalysisQueue) {
    _prospectAnalysisQueue = new Queue<ProspectAnalysisJobData>(
      'prospect-analysis',
      { connection: getSharedConnection() },
    )
  }
  return _prospectAnalysisQueue
}

export function getEmailSendQueue(): Queue {
  if (!_emailSendQueue) {
    _emailSendQueue = new Queue('email-send', { connection: getSharedConnection() })
  }
  return _emailSendQueue
}

// ─── Worker factory ───────────────────────────────────────
export function createWorker(
  name: 'prospect-analysis' | 'email-send',
  processor: (job: any) => Promise<void>,
): Worker {
  return new Worker(name, async (job) => processor(job), {
    connection: createConnection(),
  })
}

// ─── Utilities ────────────────────────────────────────────
export async function testRedisConnection(): Promise<boolean> {
  try {
    await getSharedConnection().ping()
    return true
  } catch {
    return false
  }
}

export function getConnection(): IORedis {
  return getSharedConnection()
}

export function getConnectionInfo() {
  const conn = getSharedConnection()
  return {
    type: conn.constructor.name,
    status: conn.status,
    isReady: conn.status === 'ready',
  }
}
