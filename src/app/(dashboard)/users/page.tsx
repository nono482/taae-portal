'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { getUsers, deleteUserRecord, inviteUser, inviteUserByEmail, type UserRow } from '@/app/actions/users'

// ─── ロール設定 ───────────────────────────────────────────
const ROLE_CFG: Record<string, { label: string; cls: string }> = {
  admin:      { label: '管理者',   cls: 'bg-blue-50 text-blue-700'     },
  member:     { label: 'メンバー', cls: 'bg-slate-100 text-slate-600'  },
  accountant: { label: '経理担当', cls: 'bg-purple-50 text-purple-700' },
}

// アバター色をIDから決定論的に選択
const AVATAR_COLORS = [
  'bg-blue-600','bg-green-600','bg-purple-600',
  'bg-amber-600','bg-teal-600','bg-rose-600','bg-indigo-600',
]
function avatarColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function avatarInitial(name: string) {
  return name?.trim()[0] ?? '?'
}

// ─── 招待モーダル ─────────────────────────────────────────
const ROLE_OPTIONS = [
  { value: 'member',     label: 'メンバー（経費申請・閲覧）' },
  { value: 'accountant', label: '経理担当（経費承認・レポート）' },
  { value: 'admin',      label: '管理者（フルアクセス）' },
]

type InviteResult =
  | null
  | { type: 'email'; email: string }
  | { type: 'url';   email: string; url: string }

function InviteModal({
  onClose,
  onInvited,
}: {
  onClose:   () => void
  onInvited: (msg: string) => void
}) {
  const [email,       setEmail]       = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role,        setRole]        = useState('member')
  const [loading,     setLoading]     = useState<'email' | 'url' | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [result,      setResult]      = useState<InviteResult>(null)
  const [copied,      setCopied]      = useState(false)

  function validate() {
    if (!email.trim() || !email.includes('@')) {
      setError('正しいメールアドレスを入力してください')
      return false
    }
    setError(null)
    return true
  }

  async function handleSendEmail() {
    if (!validate()) return
    setLoading('email')
    const res = await inviteUserByEmail(email, displayName, role)
    setLoading(null)
    if (res.error) { setError(res.error); return }
    onInvited(`${email} に招待メールを送信しました`)
    setResult({ type: 'email', email })
  }

  async function handleGenerateUrl() {
    if (!validate()) return
    setLoading('url')
    const res = await inviteUser(email, displayName, role)
    setLoading(null)
    if (res.error) { setError(res.error); return }
    onInvited(`${email} の招待URLを生成しました`)
    setResult({ type: 'url', email, url: res.inviteUrl! })
  }

  async function handleCopy(url: string) {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── メール送信済み画面 ──────────────────────────────────
  if (result?.type === 'email') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="px-6 pt-6 pb-4 border-b border-[#e2e6ec]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="text-[15px] font-bold text-[#1a2332]">招待メールを送信しました</div>
                <div className="text-[12px] text-[#8f9db0] mt-0.5">{result.email}</div>
              </div>
            </div>
          </div>
          <div className="px-6 py-5 space-y-3">
            <p className="text-[13px] text-[#5a6a7e] leading-relaxed">
              招待メールが送信されました。ユーザーにメールを確認するよう伝えてください。
            </p>
            <button onClick={onClose} className="w-full py-2.5 bg-[#1e3a5f] hover:bg-[#16304f] text-white text-[13px] font-semibold rounded-lg transition-colors">
              閉じる
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── URL生成済み画面 ─────────────────────────────────────
  if (result?.type === 'url') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="px-6 pt-6 pb-4 border-b border-[#e2e6ec]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="text-[15px] font-bold text-[#1a2332]">招待URLを生成しました</div>
                <div className="text-[12px] text-[#8f9db0] mt-0.5">{result.email}</div>
              </div>
            </div>
          </div>
          <div className="px-6 py-5 space-y-3">
            <div className="text-[12px] font-semibold text-[#5a6a7e]">招待URL（1回のみ有効）</div>
            <div className="bg-slate-50 border border-[#e2e6ec] rounded-lg px-3 py-2.5 text-[11px] text-[#5a6a7e] break-all leading-relaxed font-mono select-all">
              {result.url}
            </div>
            <button
              onClick={() => handleCopy(result.url)}
              className={cn(
                'w-full py-2.5 text-[13px] font-semibold rounded-lg transition-colors',
                copied ? 'bg-green-600 text-white' : 'bg-[#1e3a5f] hover:bg-[#16304f] text-white',
              )}
            >
              {copied ? 'コピーしました ✓' : 'URLをコピー'}
            </button>
            <button onClick={onClose} className="w-full py-2.5 border border-[#e2e6ec] text-[13px] font-semibold text-[#5a6a7e] rounded-lg hover:bg-slate-50 transition-colors">
              閉じる
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── フォーム画面 ────────────────────────────────────────
  const busy = loading !== null
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="px-6 pt-6 pb-4 border-b border-[#e2e6ec]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[15px] font-bold text-[#1a2332]">メンバーを招待</div>
              <div className="text-[12px] text-[#8f9db0] mt-0.5">メール送信またはURLを生成して招待できます</div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-[#8f9db0] hover:bg-slate-100 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* フォーム */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#5a6a7e] mb-1.5">
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@company.com"
              className="w-full border border-[#e2e6ec] rounded-lg px-3 py-2.5 text-[13px] text-[#1a2332] placeholder-[#8f9db0] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#5a6a7e] mb-1.5">
              表示名 <span className="text-[11px] font-normal text-[#8f9db0]">（省略可・未入力はメール@前を使用）</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="山田 太郎"
              className="w-full border border-[#e2e6ec] rounded-lg px-3 py-2.5 text-[13px] text-[#1a2332] placeholder-[#8f9db0] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#5a6a7e] mb-1.5">権限</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full border border-[#e2e6ec] rounded-lg px-3 py-2.5 text-[13px] text-[#1a2332] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 bg-white"
            >
              {ROLE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-[12px] text-red-700">
              {error}
            </div>
          )}

          {/* 二系統ボタン */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleSendEmail}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1e3a5f] hover:bg-[#16304f] disabled:opacity-50 text-white text-[13px] font-semibold rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {loading === 'email' ? '送信中…' : '招待メールを送信'}
            </button>
            <button
              type="button"
              onClick={handleGenerateUrl}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[#1e3a5f] hover:bg-slate-50 disabled:opacity-50 text-[#1e3a5f] text-[13px] font-semibold rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {loading === 'url' ? '生成中…' : '招待URLを生成'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="w-full px-4 py-2.5 border border-[#e2e6ec] text-[13px] font-semibold text-[#5a6a7e] rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 削除確認モーダル ─────────────────────────────────────
function DeleteConfirmModal({
  user,
  onCancel,
  onConfirm,
  deleting,
}: {
  user:      UserRow
  onCancel:  () => void
  onConfirm: () => void
  deleting:  boolean
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <div className="text-[15px] font-bold text-[#1a2332]">ユーザーを削除しますか？</div>
              <div className="text-[12px] text-[#8f9db0] mt-0.5">この操作は取り消せません</div>
            </div>
          </div>

          {/* 対象ユーザー表示 */}
          <div className="bg-slate-50 border border-[#e2e6ec] rounded-lg px-4 py-3 flex items-center gap-3 mb-4">
            <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0', avatarColor(user.id))}>
              {avatarInitial(user.display_name)}
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[#1a2332]">{user.display_name}</div>
              <div className="text-[11px] text-[#8f9db0]">{user.email}</div>
            </div>
          </div>

          <p className="text-[13px] text-[#5a6a7e] leading-relaxed">
            このユーザーのアプリへのアクセス権が失われます。<br />
            <span className="text-[11px] text-[#8f9db0]">
              ※ Supabase Authのアカウント自体を削除する場合は、Supabaseダッシュボードの
              「Authentication → Users」から手動で削除してください。
            </span>
          </p>
        </div>

        {/* フッターボタン */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 border border-[#e2e6ec] text-[13px] font-semibold text-[#5a6a7e] rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-[13px] font-semibold rounded-lg transition-colors"
          >
            {deleting ? '削除中…' : '削除する'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PAGE ────────────────────────────────────────────────
export default function UsersPage() {
  const [users, setUsers]           = useState<UserRow[]>([])
  const [myId, setMyId]             = useState<string | null>(null)
  const [myRole, setMyRole]         = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [deleting, setDeleting]     = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const isAdmin = myRole === 'admin'

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── データ読み込み ──────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const result = await getUsers()
    setUsers(result.data)
    setMyId(result.myId)
    setMyRole(result.myRole)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── 削除実行 ────────────────────────────────────────────
  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteUserRecord(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)

    if (result.error) {
      showToast(`削除失敗: ${result.error}`, 'error')
    } else {
      showToast(`${deleteTarget.display_name} さんを削除しました`)
      await load()
    }
  }

  const filtered = users.filter(u =>
    u.display_name.includes(search) ||
    u.email.includes(search)
  )

  const activeCount = users.filter(u => u.is_active).length
  const adminCount  = users.filter(u => u.role === 'admin').length

  return (
    <div>
      {/* Topbar */}
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center justify-between sticky top-0 z-40">
        <h1 className="text-[16px] font-bold text-[#1a2332]">ユーザー管理</h1>
        {isAdmin && (
          <button
            onClick={() => setShowInvite(true)}
            className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#16304f] text-white text-[13px] font-semibold rounded-lg transition-colors shadow-sm"
          >
            + メンバーを招待
          </button>
        )}
      </div>

      <div className="p-8">
        {/* KPI */}
        <div className="grid grid-cols-3 gap-4 mb-7">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white border border-[#e2e6ec] rounded-lg p-5 shadow-sm animate-pulse">
                <div className="h-3 w-20 bg-slate-100 rounded mb-3" />
                <div className="h-7 w-10 bg-slate-100 rounded" />
              </div>
            ))
          ) : (
            [
              { label: '総ユーザー数', value: String(users.length), sub: `うち管理者 ${adminCount}名`, color: 'bg-blue-600' },
              { label: 'アクティブ',   value: String(activeCount),  sub: 'is_active = true',          color: 'bg-green-500' },
              { label: '無効',         value: String(users.length - activeCount), sub: 'アクセス停止中', color: 'bg-slate-300' },
            ].map(k => (
              <div key={k.label} className="bg-white border border-[#e2e6ec] rounded-lg p-5 shadow-sm">
                <div className="text-[11px] font-semibold text-[#8f9db0] mb-2 tracking-wide">{k.label}</div>
                <div className="text-[28px] font-bold text-[#1a2332] leading-none">{k.value}</div>
                <div className="text-[11px] text-[#8f9db0] mt-1.5">{k.sub}</div>
                <div className={cn('mt-3.5 h-[3px] rounded-full', k.color)} />
              </div>
            ))
          )}
        </div>

        {/* 権限なし警告 */}
        {!loading && !isAdmin && (
          <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-lg text-[12px] text-amber-800">
            参照のみ可能です。ユーザーの削除・招待は管理者権限が必要です。
          </div>
        )}

        {/* 検索 */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="名前・メールで検索…"
            className="w-64 border border-[#e2e6ec] rounded-lg px-3 py-2 text-[13px] text-[#1a2332] placeholder-[#8f9db0] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
          />
        </div>

        {/* ユーザーテーブル */}
        <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-[#e2e6ec]">
                {['ユーザー', '権限', 'ステータス', '登録日', '操作'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.5px] whitespace-nowrap last:text-right">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#e2e6ec] animate-pulse">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex-shrink-0" />
                        <div className="space-y-1.5">
                          <div className="h-3 w-28 bg-slate-100 rounded" />
                          <div className="h-2.5 w-36 bg-slate-100 rounded" />
                        </div>
                      </div>
                    </td>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-5 py-4"><div className="h-3 w-16 bg-slate-100 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-[13px] text-[#8f9db0]">
                    {users.length === 0 ? 'ユーザーが登録されていません' : '検索結果がありません'}
                  </td>
                </tr>
              ) : (
                filtered.map(u => {
                  const isMe    = u.id === myId
                  const roleCfg = ROLE_CFG[u.role] ?? { label: u.role, cls: 'bg-slate-100 text-slate-600' }

                  return (
                    <tr
                      key={u.id}
                      className={cn(
                        'border-b border-[#e2e6ec] last:border-0 transition-colors hover:bg-slate-50',
                        !u.is_active && 'opacity-50'
                      )}
                    >
                      {/* ユーザー */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0', avatarColor(u.id))}>
                            {avatarInitial(u.display_name)}
                          </div>
                          <div>
                            <div className="text-[13px] font-semibold text-[#1a2332] flex items-center gap-1.5">
                              {u.display_name}
                              {isMe && (
                                <span className="text-[10px] text-white bg-[#1e3a5f] px-1.5 py-0.5 rounded leading-none">あなた</span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#8f9db0]">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* 権限 */}
                      <td className="px-5 py-3.5">
                        <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full', roleCfg.cls)}>
                          {roleCfg.label}
                        </span>
                      </td>

                      {/* ステータス */}
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
                          <span className={cn('w-1.5 h-1.5 rounded-full', u.is_active ? 'bg-green-500' : 'bg-slate-300')} />
                          <span className={u.is_active ? 'text-green-700' : 'text-slate-500'}>
                            {u.is_active ? 'アクティブ' : '無効'}
                          </span>
                        </span>
                      </td>

                      {/* 登録日 */}
                      <td className="px-5 py-3.5 text-[12px] text-[#8f9db0]">
                        {u.created_at.slice(0, 10)}
                      </td>

                      {/* 操作 */}
                      <td className="px-5 py-3.5 text-right">
                        {isMe ? (
                          <span className="text-[11px] text-[#8f9db0]">—</span>
                        ) : isAdmin ? (
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="inline-flex items-center gap-1 text-[12px] font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            {/* ゴミ箱アイコン */}
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                            削除
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#8f9db0]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 権限説明 */}
        <div className="mt-6 bg-white border border-[#e2e6ec] rounded-lg shadow-sm p-5">
          <div className="text-[12px] font-bold text-[#5a6a7e] mb-3 uppercase tracking-wide">権限レベルについて</div>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(ROLE_CFG).map(([key, cfg]) => (
              <div key={key} className="flex items-start gap-2.5">
                <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0', cfg.cls)}>{cfg.label}</span>
                <span className="text-[12px] text-[#5a6a7e]">
                  {key === 'admin' && '全機能へのフルアクセス・ユーザー管理'}
                  {key === 'member' && '経費申請・閲覧のみ'}
                  {key === 'accountant' && '経費承認・レポート・エクスポート'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 招待モーダル */}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={msg => { showToast(msg); load() }}
        />
      )}

      {/* 削除確認モーダル */}
      {deleteTarget && (
        <DeleteConfirmModal
          user={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          deleting={deleting}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 text-white text-[13px] font-semibold px-5 py-3 rounded-lg shadow-lg z-50',
          toast.type === 'error' ? 'bg-red-600' : 'bg-[#1a2332]'
        )}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
