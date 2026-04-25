'use client'

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getMembers, createMember, updateMember, type Member } from '@/app/actions/members'

const TAX_TABLES = [
  { value: 'A', label: '甲欄（主たる給与）' },
  { value: 'B', label: '乙欄（従たる給与）' },
]

function formatYen(n: number) { return `¥${n.toLocaleString('ja-JP')}` }

function formatDate(s: string | null) {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${y}年${parseInt(m)}月${parseInt(d)}日`
}

function Avatar({ name, active }: { name: string; active: boolean }) {
  return (
    <div className={cn(
      'w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold flex-shrink-0',
      active ? 'bg-[#1e3a5f] text-white' : 'bg-slate-200 text-slate-500'
    )}>
      {name.slice(0, 1)}
    </div>
  )
}

// ─── 編集モーダル ─────────────────────────────────────────
function MemberModal({
  member, onClose, onSaved,
}: {
  member: Member | null
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = !member
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name:           member?.name           ?? '',
    name_kana:      member?.name_kana      ?? '',
    department:     member?.department     ?? '',
    position_title: member?.position_title ?? '',
    email:          member?.email          ?? '',
    phone:          member?.phone          ?? '',
    hire_date:      member?.hire_date      ?? '',
    base_salary:    String(member?.base_salary ?? 0),
    dependents:     String(member?.dependents  ?? 0),
    tax_table:      member?.tax_table      ?? 'A',
    is_active:      member?.is_active      ?? true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function set(k: string, v: string | boolean) { setForm(p => ({ ...p, [k]: v })) }

  function validate() {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = '氏名を入力してください'
    if (form.base_salary && isNaN(Number(form.base_salary))) errs.base_salary = '数値を入力してください'
    return errs
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})

    const data = {
      name:           form.name.trim(),
      name_kana:      form.name_kana      || undefined,
      department:     form.department     || undefined,
      position_title: form.position_title || undefined,
      email:          form.email          || undefined,
      phone:          form.phone          || undefined,
      hire_date:      form.hire_date      || undefined,
      base_salary:    Number(form.base_salary) || 0,
      dependents:     Number(form.dependents)  || 0,
      tax_table:      form.tax_table,
      is_active:      form.is_active,
    }

    startTransition(async () => {
      const res = isNew
        ? await createMember(data)
        : await updateMember(member!.id, data)
      if (res.error) { toast.error(res.error); return }
      toast.success(isNew ? '従業員を追加しました' : '情報を更新しました')
      onSaved()
      onClose()
    })
  }

  const field = (key: string, label: string, placeholder = '', type = 'text') => (
    <div>
      <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">{label}</label>
      <input
        type={type}
        value={form[key as keyof typeof form] as string}
        onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full px-3 py-2 border rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100',
          errors[key] ? 'border-red-400' : 'border-[#e2e6ec]'
        )}
      />
      {errors[key] && <p className="text-[11px] text-red-600 mt-1">{errors[key]}</p>}
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e6ec] sticky top-0 bg-white">
          <div className="text-[15px] font-bold text-[#1a2332]">
            {isNew ? '従業員を追加' : `${member.name} を編集`}
          </div>
          <button onClick={onClose} className="text-[#8f9db0] hover:text-[#1a2332] text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {field('name',       '氏名 *',    '例: 上村 太郎')}
            {field('name_kana',  '氏名（かな）', '例: うえむら たろう')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('department',     '部署',   '例: 開発部')}
            {field('position_title', '役職',   '例: エンジニア')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('email', 'メールアドレス', 'email@example.com', 'email')}
            {field('phone', '電話番号',       '090-0000-0000')}
          </div>
          {field('hire_date', '入社日', '', 'date')}

          <div className="border-t border-[#e2e6ec] pt-4">
            <div className="text-[11px] font-bold text-[#5a6a7e] uppercase tracking-wide mb-3">給与情報</div>
            <div className="grid grid-cols-2 gap-3">
              {field('base_salary', '基本給（月額・円）', '300000')}
              {field('dependents',  '扶養家族数',          '0')}
            </div>
            <div className="mt-3">
              <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">税額表区分</label>
              <select
                value={form.tax_table}
                onChange={e => set('tax_table', e.target.value)}
                className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] bg-white focus:outline-none focus:border-blue-400"
              >
                {TAX_TABLES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {!isNew && (
            <div className="flex items-center justify-between py-3 border-t border-[#e2e6ec]">
              <div>
                <div className="text-[13px] font-semibold text-[#1a2332]">在籍ステータス</div>
                <div className="text-[11px] text-[#8f9db0]">無効にすると給与計算から除外されます</div>
              </div>
              <button
                type="button"
                onClick={() => set('is_active', !form.is_active)}
                className={cn(
                  'relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors',
                  form.is_active ? 'bg-blue-600' : 'bg-slate-200'
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform',
                  form.is_active ? 'translate-x-4' : 'translate-x-0'
                )} />
              </button>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-[13px] font-semibold text-[#5a6a7e] border border-[#e2e6ec] bg-white hover:bg-slate-50 rounded-lg transition-colors">
              キャンセル
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] disabled:opacity-50 rounded-lg transition-colors">
              {isPending ? '保存中…' : isNew ? '追加する' : '保存する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── PAGE ────────────────────────────────────────────────
export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Member | null | 'new'>(null)

  async function load() {
    setLoading(true)
    const { data } = await getMembers()
    setMembers(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const active   = members.filter(m => m.is_active)
  const inactive = members.filter(m => !m.is_active)

  return (
    <div>
      {editing !== null && (
        <MemberModal
          member={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}

      {/* Topbar */}
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <h1 className="text-[16px] font-bold text-[#1a2332]">従業員管理</h1>
          {!loading && (
            <span className="text-[11px] font-semibold bg-slate-100 text-[#5a6a7e] px-2 py-0.5 rounded-full">
              在籍 {active.length}名
            </span>
          )}
        </div>
        <button
          onClick={() => setEditing('new')}
          className="px-4 py-2 text-[13px] font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] rounded-lg transition-colors"
        >
          ＋ 従業員を追加
        </button>
      </div>

      <div className="p-8 max-w-5xl">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-white border border-[#e2e6ec] rounded-lg h-20" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="py-24 text-center">
            <div className="text-[40px] mb-3">👥</div>
            <div className="text-[15px] font-bold text-[#1a2332] mb-1">従業員が登録されていません</div>
            <div className="text-[13px] text-[#8f9db0] mb-5">従業員を追加すると給与計算に反映されます</div>
            <button
              onClick={() => setEditing('new')}
              className="text-[13px] font-semibold text-blue-600 hover:underline"
            >
              ＋ 最初の従業員を追加
            </button>
          </div>
        ) : (
          <>
            {/* 在籍中 */}
            <div className="mb-8">
              <div className="text-[11px] font-bold text-[#5a6a7e] uppercase tracking-widest mb-3">
                在籍中 — {active.length}名
              </div>
              <div className="space-y-2">
                {active.map(m => (
                  <div key={m.id} className="bg-white border border-[#e2e6ec] rounded-lg px-5 py-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
                    <Avatar name={m.name} active={m.is_active} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[14px] font-bold text-[#1a2332]">{m.name}</span>
                        {m.name_kana && (
                          <span className="text-[11px] text-[#8f9db0]">{m.name_kana}</span>
                        )}
                        {m.position_title && (
                          <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                            {m.position_title}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#5a6a7e]">
                        {m.department && <span>{m.department}</span>}
                        {m.email && <span>{m.email}</span>}
                        {m.hire_date && <span>入社 {formatDate(m.hire_date)}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[13px] font-bold text-[#1a2332] font-mono">{formatYen(m.base_salary)}<span className="text-[10px] text-[#8f9db0] font-normal ml-1">/月</span></div>
                      <div className="text-[10px] text-[#8f9db0] mt-0.5">扶養 {m.dependents}名 / {m.tax_table}欄</div>
                    </div>
                    <button
                      onClick={() => setEditing(m)}
                      className="flex-shrink-0 text-[12px] font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      編集
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 退職者 */}
            {inactive.length > 0 && (
              <div>
                <div className="text-[11px] font-bold text-[#5a6a7e] uppercase tracking-widest mb-3">
                  退職・無効 — {inactive.length}名
                </div>
                <div className="space-y-2">
                  {inactive.map(m => (
                    <div key={m.id} className="bg-white border border-[#e2e6ec] rounded-lg px-5 py-4 opacity-60 flex items-center gap-4">
                      <Avatar name={m.name} active={false} />
                      <div className="flex-1">
                        <div className="text-[14px] font-semibold text-[#5a6a7e] line-through">{m.name}</div>
                        {m.department && <div className="text-[12px] text-[#8f9db0]">{m.department}</div>}
                      </div>
                      <button
                        onClick={() => setEditing(m)}
                        className="text-[12px] font-semibold text-[#8f9db0] border border-[#e2e6ec] px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        編集
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
