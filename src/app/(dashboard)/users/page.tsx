'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

// ─── 型 ──────────────────────────────────────────────────
type UserRole   = 'admin' | 'member' | 'accountant'
type UserStatus = 'active' | 'invited' | 'inactive'

interface AppUser {
  id: string
  display_name: string
  email: string
  role: UserRole
  status: UserStatus
  avatar_initial: string
  avatar_color: string
  joined_at: string
  last_login?: string
  department?: string
}

// ─── モックデータ ─────────────────────────────────────────
const MOCK_USERS: AppUser[] = [
  {
    id: 'u1',
    display_name: '上村 Kami',
    email: 'kamimura.nono@gmail.com',
    role: 'admin',
    status: 'active',
    avatar_initial: '上',
    avatar_color: 'bg-blue-600',
    joined_at: '2025-04-01',
    last_login: '2026-04-13 08:32',
    department: '経営',
  },
  {
    id: 'u2',
    display_name: '田中 太郎',
    email: 'tanaka@nono-llc.jp',
    role: 'member',
    status: 'active',
    avatar_initial: '田',
    avatar_color: 'bg-green-600',
    joined_at: '2025-06-15',
    last_login: '2026-04-13 09:15',
    department: '営業',
  },
  {
    id: 'u3',
    display_name: '鈴木 花子',
    email: 'suzuki@nono-llc.jp',
    role: 'member',
    status: 'active',
    avatar_initial: '鈴',
    avatar_color: 'bg-purple-600',
    joined_at: '2025-09-01',
    last_login: '2026-04-12 17:44',
    department: 'バックオフィス',
  },
  {
    id: 'u4',
    display_name: '佐藤 健一',
    email: 'sato@nono-llc.jp',
    role: 'member',
    status: 'active',
    avatar_initial: '佐',
    avatar_color: 'bg-amber-600',
    joined_at: '2025-11-01',
    last_login: '2026-04-11 10:02',
    department: '開発',
  },
  {
    id: 'u5',
    display_name: '高橋 美咲',
    email: 'takahashi@nono-llc.jp',
    role: 'accountant',
    status: 'active',
    avatar_initial: '高',
    avatar_color: 'bg-teal-600',
    joined_at: '2026-01-10',
    last_login: '2026-04-10 14:22',
    department: '経理',
  },
  {
    id: 'u6',
    display_name: '中村 拓也',
    email: 'nakamura@nono-llc.jp',
    role: 'member',
    status: 'invited',
    avatar_initial: '中',
    avatar_color: 'bg-slate-500',
    joined_at: '2026-04-12',
    department: '営業',
  },
]

// ─── ロール設定 ───────────────────────────────────────────
const ROLE_CFG: Record<UserRole, { label: string; cls: string; desc: string }> = {
  admin:     { label: '管理者', cls: 'bg-blue-50 text-blue-700',   desc: '全機能へのフルアクセス' },
  member:    { label: 'メンバー', cls: 'bg-slate-100 text-slate-600', desc: '経費申請・閲覧のみ' },
  accountant:{ label: '経理担当', cls: 'bg-purple-50 text-purple-700', desc: '経費承認・レポート・エクスポート' },
}

const STATUS_CFG: Record<UserStatus, { label: string; dot: string; cls: string }> = {
  active:   { label: 'アクティブ', dot: 'bg-green-500', cls: 'text-green-700' },
  invited:  { label: '招待中',     dot: 'bg-amber-400', cls: 'text-amber-700' },
  inactive: { label: '無効',       dot: 'bg-slate-300', cls: 'text-slate-500' },
}

// ─── 招待モーダル ─────────────────────────────────────────
function InviteModal({ onClose, onInvite }: { onClose: () => void; onInvite: (email: string, role: UserRole, name: string) => void }) {
  const [email, setEmail]   = useState('')
  const [name,  setName]    = useState('')
  const [role,  setRole]    = useState<UserRole>('member')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !name.trim()) return
    onInvite(email.trim(), role, name.trim())
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-[480px] p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-[16px] font-bold text-[#1a2332] mb-5">メンバーを招待</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#5a6a7e] mb-1.5">氏名</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="山田 太郎"
              className="w-full border border-[#e2e6ec] rounded-lg px-3 py-2 text-[13px] text-[#1a2332] placeholder-[#8f9db0] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
              required
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#5a6a7e] mb-1.5">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="yamada@example.com"
              className="w-full border border-[#e2e6ec] rounded-lg px-3 py-2 text-[13px] text-[#1a2332] placeholder-[#8f9db0] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
              required
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#5a6a7e] mb-2">権限</label>
            <div className="space-y-2">
              {(Object.entries(ROLE_CFG) as [UserRole, typeof ROLE_CFG[UserRole]][]).map(([key, cfg]) => (
                <label key={key} className={cn(
                  'flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer transition-colors',
                  role === key ? 'border-blue-400 bg-blue-50' : 'border-[#e2e6ec] hover:bg-slate-50'
                )}>
                  <input
                    type="radio"
                    name="role"
                    value={key}
                    checked={role === key}
                    onChange={() => setRole(key)}
                    className="accent-blue-600"
                  />
                  <div>
                    <div className="text-[13px] font-semibold text-[#1a2332]">{cfg.label}</div>
                    <div className="text-[11px] text-[#8f9db0]">{cfg.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-[#e2e6ec] text-[13px] font-semibold text-[#5a6a7e] rounded-lg hover:bg-slate-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-[#1e3a5f] text-white text-[13px] font-semibold rounded-lg hover:bg-[#16304f] transition-colors"
            >
              招待メールを送信
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── PAGE ────────────────────────────────────────────────
export default function UsersPage() {
  const [users, setUsers]         = useState(MOCK_USERS)
  const [showInvite, setShowInvite] = useState(false)
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [search, setSearch]       = useState('')
  const [toast, setToast]         = useState<string | null>(null)

  const filtered = users.filter(u =>
    u.display_name.includes(search) || u.email.includes(search) || (u.department ?? '').includes(search)
  )

  const activeCount   = users.filter(u => u.status === 'active').length
  const invitedCount  = users.filter(u => u.status === 'invited').length
  const adminCount    = users.filter(u => u.role === 'admin').length

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function handleInvite(email: string, role: UserRole, name: string) {
    const initials = name[0] ?? '?'
    const colors   = ['bg-blue-600','bg-green-600','bg-purple-600','bg-amber-600','bg-teal-600','bg-rose-600']
    const newUser: AppUser = {
      id: `u${Date.now()}`,
      display_name: name,
      email,
      role,
      status: 'invited',
      avatar_initial: initials,
      avatar_color: colors[Math.floor(Math.random() * colors.length)],
      joined_at: new Date().toISOString().split('T')[0],
    }
    setUsers(prev => [...prev, newUser])
    showToast(`${name} さんに招待メールを送信しました`)
  }

  function handleRoleChange(userId: string, newRole: UserRole) {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    setEditingRole(null)
    showToast('権限を変更しました')
  }

  function handleDeactivate(userId: string) {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'inactive' as UserStatus } : u))
    showToast('ユーザーを無効化しました')
  }

  function handleResendInvite(userId: string) {
    const u = users.find(u => u.id === userId)
    if (u) showToast(`${u.display_name} さんに招待メールを再送しました`)
  }

  return (
    <div>
      {/* Topbar */}
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center justify-between sticky top-0 z-40">
        <h1 className="text-[16px] font-bold text-[#1a2332]">ユーザー管理</h1>
        <button
          onClick={() => setShowInvite(true)}
          className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#16304f] text-white text-[13px] font-semibold rounded-lg transition-colors shadow-sm"
        >
          + メンバーを招待
        </button>
      </div>

      <div className="p-8">
        {/* KPI */}
        <div className="grid grid-cols-3 gap-4 mb-7">
          {[
            { label: '総ユーザー数', value: String(users.filter(u => u.status !== 'inactive').length), sub: `うち管理者 ${adminCount}名`, color: 'bg-blue-600' },
            { label: 'アクティブ',   value: String(activeCount),  sub: '今月ログイン済', color: 'bg-green-500' },
            { label: '招待中',       value: String(invitedCount), sub: '承諾待ち',         color: 'bg-amber-500' },
          ].map(k => (
            <div key={k.label} className="bg-white border border-[#e2e6ec] rounded-lg p-5 shadow-sm">
              <div className="text-[11px] font-semibold text-[#8f9db0] mb-2 tracking-wide">{k.label}</div>
              <div className="text-[28px] font-bold text-[#1a2332] leading-none">{k.value}</div>
              <div className="text-[11px] text-[#8f9db0] mt-1.5">{k.sub}</div>
              <div className={cn('mt-3.5 h-[3px] rounded-full', k.color)} />
            </div>
          ))}
        </div>

        {/* 検索 */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="名前・メール・部署で検索…"
            className="w-64 border border-[#e2e6ec] rounded-lg px-3 py-2 text-[13px] text-[#1a2332] placeholder-[#8f9db0] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
          />
        </div>

        {/* ユーザーテーブル */}
        <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-[#e2e6ec]">
                {['ユーザー', '部署', '権限', 'ステータス', '最終ログイン', '操作'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.5px] whitespace-nowrap last:text-right">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className={cn('border-b border-[#e2e6ec] last:border-0', u.status === 'inactive' && 'opacity-50')}>
                  {/* ユーザー */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0', u.avatar_color)}>
                        {u.avatar_initial}
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-[#1a2332] flex items-center gap-2">
                          {u.display_name}
                          {u.id === 'u1' && <span className="text-[10px] text-white bg-[#1e3a5f] px-1.5 py-0.5 rounded">あなた</span>}
                        </div>
                        <div className="text-[11px] text-[#8f9db0]">{u.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* 部署 */}
                  <td className="px-5 py-3.5 text-[13px] text-[#5a6a7e]">{u.department ?? '—'}</td>

                  {/* 権限 */}
                  <td className="px-5 py-3.5">
                    {editingRole === u.id ? (
                      <select
                        defaultValue={u.role}
                        onChange={e => handleRoleChange(u.id, e.target.value as UserRole)}
                        onBlur={() => setEditingRole(null)}
                        autoFocus
                        className="border border-blue-400 rounded px-2 py-1 text-[12px] text-[#1a2332] focus:outline-none"
                      >
                        {(Object.entries(ROLE_CFG) as [UserRole, typeof ROLE_CFG[UserRole]][]).map(([key, cfg]) => (
                          <option key={key} value={key}>{cfg.label}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => u.id !== 'u1' && setEditingRole(u.id)}
                        className={cn(
                          'text-[11px] font-semibold px-2.5 py-1 rounded-full',
                          ROLE_CFG[u.role].cls,
                          u.id !== 'u1' && 'hover:opacity-80 cursor-pointer'
                        )}
                        title={u.id !== 'u1' ? 'クリックして変更' : undefined}
                      >
                        {ROLE_CFG[u.role].label}
                      </button>
                    )}
                  </td>

                  {/* ステータス */}
                  <td className="px-5 py-3.5">
                    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold')}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_CFG[u.status].dot)} />
                      <span className={STATUS_CFG[u.status].cls}>{STATUS_CFG[u.status].label}</span>
                    </span>
                  </td>

                  {/* 最終ログイン */}
                  <td className="px-5 py-3.5 text-[12px] text-[#8f9db0]">
                    {u.last_login ?? (u.status === 'invited' ? '未ログイン' : '—')}
                  </td>

                  {/* 操作 */}
                  <td className="px-5 py-3.5 text-right">
                    {u.id === 'u1' ? (
                      <span className="text-[11px] text-[#8f9db0]">—</span>
                    ) : u.status === 'invited' ? (
                      <button
                        onClick={() => handleResendInvite(u.id)}
                        className="text-[12px] font-semibold text-blue-600 hover:underline"
                      >
                        再送する
                      </button>
                    ) : u.status === 'active' ? (
                      <button
                        onClick={() => handleDeactivate(u.id)}
                        className="text-[12px] font-semibold text-red-500 hover:underline"
                      >
                        無効化
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#8f9db0]">無効</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 権限説明 */}
        <div className="mt-6 bg-white border border-[#e2e6ec] rounded-lg shadow-sm p-5">
          <div className="text-[12px] font-bold text-[#5a6a7e] mb-3 uppercase tracking-wide">権限レベルについて</div>
          <div className="grid grid-cols-3 gap-4">
            {(Object.entries(ROLE_CFG) as [UserRole, typeof ROLE_CFG[UserRole]][]).map(([key, cfg]) => (
              <div key={key} className="flex items-start gap-2.5">
                <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0', cfg.cls)}>{cfg.label}</span>
                <span className="text-[12px] text-[#5a6a7e]">{cfg.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 招待モーダル */}
      {showInvite && (
        <InviteModal onClose={() => setShowInvite(false)} onInvite={handleInvite} />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1a2332] text-white text-[13px] font-semibold px-5 py-3 rounded-lg shadow-lg z-50 transition-all">
          {toast}
        </div>
      )}
    </div>
  )
}
