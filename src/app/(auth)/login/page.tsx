'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Supabase未設定時はデモモードで直接ダッシュボードへ
    if (!isSupabaseConfigured) {
      window.location.href = '/dashboard'
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      // 401: APIキーが無効（service_role キーを使っている場合など）
      if (error.status === 401 || error.message.toLowerCase().includes('api key') || error.message.toLowerCase().includes('invalid key')) {
        setError('APIキーが無効です（401）。.env.local の NEXT_PUBLIC_SUPABASE_ANON_KEY に「anon（public）」キーを設定してください。service_role キーは使用できません。')
      } else if (error.message.includes('Invalid login credentials')) {
        setError('メールアドレスまたはパスワードが正しくありません。')
      } else if (error.message.includes('Email not confirmed')) {
        setError('メールアドレスの確認が完了していません。受信メールをご確認ください。')
      } else {
        setError(`ログインエラー: ${error.message}`)
      }
      setLoading(false)
      return
    }

    // セッションCookieが確実に反映されるようフルリロードでリダイレクト
    window.location.href = '/dashboard'
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

          {!isSupabaseConfigured && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <strong className="font-bold">デモモード</strong> — Supabase未設定のため、任意のメールアドレス・パスワードでログインできます。
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-600 text-[#5a6a7e] mb-1.5">
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
          </form>
        </div>

        <p className="text-center text-xs text-[#8f9db0] mt-6">
          Smart TAYORU — Powered by NONO合同会社
        </p>
      </div>
    </div>
  )
}
