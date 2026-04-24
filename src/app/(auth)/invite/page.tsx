'use client'

import { useState, useEffect } from 'react'

export default function InviteLandingPage() {
  const [actionLink, setActionLink] = useState<string | null>(null)
  const [invalid,    setInvalid]    = useState(false)

  useEffect(() => {
    // ハッシュフラグメントは HTTP リクエストに含まれないためボットに読まれない
    const hash = window.location.hash.slice(1)
    if (!hash) { setInvalid(true); return }

    try {
      // base64url → 元の Supabase action_link
      const decoded = Buffer.from(hash, 'base64').toString('utf-8')
      if (decoded.startsWith('https://') && decoded.includes('/auth/v1/verify')) {
        setActionLink(decoded)
      } else {
        setInvalid(true)
      }
    } catch {
      setInvalid(true)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center">
      <div className="w-full max-w-md">

        {/* ロゴ */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg bg-[#1e3a5f] flex items-center justify-center text-white font-bold text-lg">
              S
            </div>
            <span className="text-xl font-bold text-[#1a2332]">Smart TAYORU</span>
          </div>
          <p className="text-sm text-[#8f9db0]">NONO合同会社 · 経営管理システム</p>
        </div>

        <div className="bg-white border border-[#e2e6ec] rounded-xl shadow-sm p-8 text-center">

          {/* ロード中（JSがhashを解析する前） */}
          {!actionLink && !invalid && (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 animate-pulse mx-auto" />
              <p className="text-sm text-[#8f9db0]">招待リンクを確認しています…</p>
            </div>
          )}

          {/* 不正なリンク */}
          {invalid && (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-[15px] font-bold text-[#1a2332]">リンクが無効です</p>
                <p className="text-sm text-[#8f9db0] mt-1">
                  招待リンクが不正か、すでに期限切れです。<br />管理者に再招待を依頼してください。
                </p>
              </div>
              <a
                href="/login"
                className="inline-block mt-2 text-sm text-[#1e3a5f] underline underline-offset-2"
              >
                ログイン画面へ
              </a>
            </div>
          )}

          {/* 有効なリンク → ボタンクリックで遷移 */}
          {actionLink && (
            <div className="space-y-5">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-[16px] font-bold text-[#1a2332]">招待が届いています</p>
                <p className="text-sm text-[#8f9db0] mt-1">
                  Smart TAYORU へようこそ。<br />
                  下のボタンをクリックして招待を承認してください。
                </p>
              </div>
              <button
                onClick={() => { window.location.href = actionLink }}
                className="w-full py-3 bg-[#1e3a5f] hover:bg-[#16304f] text-white text-sm font-semibold rounded-lg transition-colors"
              >
                招待を承認する
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-[#8f9db0] mt-6">
          Smart TAYORU — Powered by NONO合同会社
        </p>
      </div>
    </div>
  )
}
