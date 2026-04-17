'use client'

import { useState } from 'react'
import { createClient, isSupabaseConfigured, getConfigDiagnostics } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  // 設定診断（画面表示用）
  const diag = getConfigDiagnostics()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // ── Supabase 未設定 → デモモード ───────────────────────
    if (!isSupabaseConfigured) {
      console.warn('[Smart TAYORU] デモモードでログイン（Supabase未設定）')
      window.location.href = '/dashboard'
      return
    }

    // ── 通常ログイン ────────────────────────────────────────
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        // 401: APIキーが無効
        if (
          authError.status === 401 ||
          authError.message.toLowerCase().includes('api key') ||
          authError.message.toLowerCase().includes('invalid key')
        ) {
          setError(
            'APIキーが無効です（401）。\n' +
            'Vercel の環境変数 NEXT_PUBLIC_SUPABASE_ANON_KEY に「anon（public）」キーを設定し、再デプロイしてください。\n' +
            '※ service_role キーは使用できません。'
          )
        } else if (authError.message.includes('Invalid login credentials')) {
          setError('メールアドレスまたはパスワードが正しくありません。')
        } else if (authError.message.includes('Email not confirmed')) {
          setError('メールアドレスの確認が完了していません。受信メールをご確認ください。')
        } else {
          setError(`ログインエラー: ${authError.message}`)
        }
        setLoading(false)
        return
      }

      // ログイン成功 → フルリロードでセッション Cookie を確定
      window.location.href = '/dashboard'

    } catch (err: unknown) {
      // ── fetch レベルの例外（Invalid URL / ネットワーク断など）──
      setLoading(false)

      const message = err instanceof Error ? err.message : String(err)

      if (
        message.includes('Invalid value') ||
        message.includes('Failed to fetch') ||
        message.includes('fetch') ||
        message.includes('NetworkError')
      ) {
        // 環境変数が実際に読み込まれているか診断情報を付加して表示
        const urlPreview  = process.env.NEXT_PUBLIC_SUPABASE_URL
          ? `"${process.env.NEXT_PUBLIC_SUPABASE_URL.slice(0, 40)}..."`
          : '（未設定 / 空文字）'
        const keyPreview  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          ? `"${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.slice(0, 10)}..."（${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length}文字）`
          : '（未設定 / 空文字）'

        setError(
          `通信エラー: ${message}\n\n` +
          `【環境変数の読み込み状態】\n` +
          `NEXT_PUBLIC_SUPABASE_URL  = ${urlPreview}\n` +
          `NEXT_PUBLIC_SUPABASE_ANON_KEY = ${keyPreview}\n\n` +
          `Vercel の Environment Variables を確認し、再デプロイしてください。`
        )
        // コンソールにも詳細を出力
        console.error('[Smart TAYORU] fetch エラー詳細:', {
          message,
          NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
            ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.slice(0, 10)}... (${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length}文字)`
            : undefined,
        })
      } else {
        setError(`予期しないエラーが発生しました: ${message}`)
        console.error('[Smart TAYORU] ログイン予期しないエラー:', err)
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg bg-[#1e3a5f] flex items-center justify-center text-white font-bold text-lg">
              S
            </div>
            <span className="text-xl font-bold text-[#1a2332]">Smart TAYORU</span>
          </div>
          <p className="text-sm text-[#8f9db0]">NONO合同会社 · 経営管理システム</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#e2e6ec] rounded-xl shadow-sm p-8">
          <h1 className="text-lg font-bold text-[#1a2332] mb-1">ログイン</h1>
          <p className="text-sm text-[#8f9db0] mb-6">アカウント情報を入力してください</p>

          {/* デモモードバナー */}
          {!isSupabaseConfigured && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 space-y-1">
              <div className="font-bold">デモモード（Supabase未接続）</div>
              {diag.reason && (
                <div className="text-xs text-amber-700">原因: {diag.reason}</div>
              )}
              {diag.hint && (
                <div className="text-xs text-amber-600">対処: {diag.hint}</div>
              )}
              <div className="text-xs mt-1">任意のメールアドレス・パスワードでログインできます。</div>
            </div>
          )}

          {/* エラー表示 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 whitespace-pre-wrap break-all">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#5a6a7e] mb-1.5">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-[#e2e6ec] rounded-lg text-sm text-[#1a2332] placeholder:text-[#c0c8d8] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 transition-colors"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5a6a7e] mb-1.5">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-[#e2e6ec] rounded-lg text-sm text-[#1a2332] placeholder:text-[#c0c8d8] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#1e3a5f] hover:bg-[#16304f] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>

            {/* ── 環境変数チェック（デバッグ用・確認後削除） ── */}
            <div className="mt-3 p-2 bg-slate-100 rounded text-[10px] text-slate-500 font-mono break-all space-y-0.5">
              <div className="font-bold text-slate-600">【環境変数チェック】</div>
              <div>
                SUPABASE_URL:{' '}
                {process.env.NEXT_PUBLIC_SUPABASE_URL
                  ? <span className="text-green-700">✓ {process.env.NEXT_PUBLIC_SUPABASE_URL}</span>
                  : <span className="text-red-600">✗ 未設定（undefined / 空）</span>
                }
              </div>
              <div>
                SUPABASE_KEY:{' '}
                {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                  ? <span className="text-green-700">✓ 設定済み（{process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length}文字）</span>
                  : <span className="text-red-600">✗ 未設定（undefined / 空）</span>
                }
              </div>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-[#8f9db0] mt-6">
          Smart TAYORU — Powered by NONO合同会社
        </p>
      </div>
    </div>
  )
}
