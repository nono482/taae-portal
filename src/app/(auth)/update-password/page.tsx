'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updatePassword } from '@/app/actions/auth'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [ready,    setReady]    = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      // ① implicit flow: /auth/callback の HTML が #access_token=xxx を転送してきた場合
      //    createBrowserClient は detectSessionInUrl: false のためハッシュを自動処理しない。
      //    明示的に setSession() を呼ぶ必要がある。
      const hash = window.location.hash.slice(1)
      if (hash) {
        const params       = new URLSearchParams(hash)
        const accessToken  = params.get('access_token')
        const refreshToken = params.get('refresh_token') ?? ''

        if (accessToken) {
          console.log('[update-password] implicit flow: setSession 試行')
          const { data, error: sessErr } = await supabase.auth.setSession({
            access_token:  accessToken,
            refresh_token: refreshToken,
          })
          if (data.session) {
            // セキュリティのためハッシュを URL から除去
            window.history.replaceState(null, '', window.location.pathname)
            setReady(true)
            return
          }
          console.error('[update-password] setSession 失敗:', sessErr?.message)
          window.location.href = '/login'
          return
        }
      }

      // ② PKCE / cookie フロー: /auth/callback がセッションを Cookie にセット済み
      console.log('[update-password] cookie セッション確認')
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setReady(true)
      } else {
        console.log('[update-password] セッションなし → /login')
        window.location.href = '/login'
      }
    }

    init()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('パスワードは8文字以上で設定してください')
      return
    }
    if (password !== confirm) {
      setError('パスワードが一致しません')
      return
    }

    setLoading(true)
    const result = await updatePassword(password)
    setLoading(false)

    if (result.error) {
      setError(`エラー: ${result.error}`)
    } else {
      window.location.href = '/dashboard'
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse mx-auto" />
          <p className="text-sm text-[#8f9db0]">認証を確認しています…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg bg-[#1e3a5f] flex items-center justify-center text-white font-bold text-lg">
              S
            </div>
            <span className="text-xl font-bold text-[#1a2332]">Smart TAYORU</span>
          </div>
          <p className="text-sm text-[#8f9db0]">NONO合同会社 · 経営管理システム</p>
        </div>

        <div className="bg-white border border-[#e2e6ec] rounded-xl shadow-sm p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-[#1a2332] leading-tight">招待を受け付けました</h1>
              <p className="text-[12px] text-[#8f9db0]">パスワードを設定してください</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#5a6a7e] mb-1.5">
                新しいパスワード <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
                minLength={8}
                placeholder="8文字以上"
                className="w-full px-3 py-2.5 border border-[#e2e6ec] rounded-lg text-sm text-[#1a2332] placeholder:text-[#c0c8d8] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5a6a7e] mb-1.5">
                パスワード（確認） <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="もう一度入力"
                className="w-full px-3 py-2.5 border border-[#e2e6ec] rounded-lg text-sm text-[#1a2332] placeholder:text-[#c0c8d8] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#1e3a5f] hover:bg-[#16304f] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? '設定中…' : 'パスワードを設定してログイン'}
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
