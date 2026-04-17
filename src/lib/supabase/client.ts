import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
const SUPABASE_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()

// ─── 起動時デバッグログ（確認後に削除予定） ─────────────────
console.log(
  '[TAYORU DEBUG] env check\n',
  'URL  :', SUPABASE_URL  ? `"${SUPABASE_URL}"` : '⚠️ EMPTY / UNDEFINED',
  '\n',
  'KEY  :', SUPABASE_KEY  ? `"${SUPABASE_KEY.slice(0, 5)}${'*'.repeat(10)}"（${SUPABASE_KEY.length}文字）` : '⚠️ EMPTY / UNDEFINED',
)

// ─── 設定診断（画面表示用） ───────────────────────────────
export interface ConfigDiagnostics {
  ok:     boolean
  reason: string | null   // ok=false のとき原因メッセージ
  hint:   string | null   // 修正方法のヒント
}

export function getConfigDiagnostics(): ConfigDiagnostics {
  if (!SUPABASE_URL) {
    return {
      ok:     false,
      reason: 'NEXT_PUBLIC_SUPABASE_URL が未設定（空文字）です',
      hint:   'Vercel → Settings → Environment Variables に NEXT_PUBLIC_SUPABASE_URL を追加し、再デプロイしてください',
    }
  }
  if (!SUPABASE_URL.startsWith('https://')) {
    return {
      ok:     false,
      reason: `NEXT_PUBLIC_SUPABASE_URL の形式が不正です: "${SUPABASE_URL.slice(0, 40)}"`,
      hint:   '値は https://xxxx.supabase.co の形式にしてください',
    }
  }
  if (!SUPABASE_URL.includes('.supabase.co')) {
    return {
      ok:     false,
      reason: `NEXT_PUBLIC_SUPABASE_URL に .supabase.co が含まれていません: "${SUPABASE_URL.slice(0, 40)}"`,
      hint:   'Supabase ダッシュボード → Project Settings → API → Project URL をコピーしてください',
    }
  }
  if (!SUPABASE_KEY) {
    return {
      ok:     false,
      reason: 'NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定（空文字）です',
      hint:   'Vercel → Settings → Environment Variables に NEXT_PUBLIC_SUPABASE_ANON_KEY を追加し、再デプロイしてください',
    }
  }
  if (!SUPABASE_KEY.startsWith('eyJ')) {
    return {
      ok:     false,
      reason: `NEXT_PUBLIC_SUPABASE_ANON_KEY が JWT 形式（eyJ...）で始まっていません`,
      hint:   'Supabase ダッシュボード → Project Settings → API → anon (public) キーを使用してください。service_role キーは使用不可です',
    }
  }
  if (SUPABASE_KEY.length < 100) {
    return {
      ok:     false,
      reason: `NEXT_PUBLIC_SUPABASE_ANON_KEY が短すぎます（${SUPABASE_KEY.length}文字）。正しい anon key は通常 200 文字以上です`,
      hint:   'Supabase ダッシュボード → Project Settings → API → anon (public) キーを再確認してください',
    }
  }
  return { ok: true, reason: null, hint: null }
}

/** Supabase が正しく設定されているか */
export const isSupabaseConfigured = getConfigDiagnostics().ok

// ─── クライアント生成 ─────────────────────────────────────
export function createClient() {
  const diag = getConfigDiagnostics()

  if (!diag.ok) {
    // 開発・デバッグ用に console にも出力
    console.error(
      '[Smart TAYORU] Supabase 設定エラー\n',
      `原因: ${diag.reason}\n`,
      `対処: ${diag.hint}`,
    )

    // ダミークライアントを返す（fetch は失敗するが、デモモードのフォールバックで表示継続）
    // ※ anon key は createBrowserClient の内部バリデーションを通過する最低限の形式を使用
    return createBrowserClient<Database>(
      'https://placeholder.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder_do_not_use',
    )
  }

  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_KEY)
}
