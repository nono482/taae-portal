'use client'

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getTenantSettings, updateTenantSettings, getCurrentUser, updateProfile } from '@/app/actions/settings'

type Tab = 'profile' | 'company' | 'notifications' | 'integrations' | 'plan'

interface CompanySettings {
  name:           string
  legal_name:     string
  tax_id:         string
  fiscal_month:   number
  address:        string
  phone:          string
  invoice_prefix: string
}

interface NotifSettings {
  expense_submitted: boolean
  expense_approved:  boolean
  payroll_reminder:  boolean
  tax_due_reminder:  boolean
  bank_sync:         boolean
  weekly_report:     boolean
  email_digest:      'none' | 'daily' | 'weekly'
}

const INIT_COMPANY: CompanySettings = {
  name: '', legal_name: '', tax_id: '', fiscal_month: 4, address: '', phone: '', invoice_prefix: 'INV',
}
const INIT_NOTIF: NotifSettings = {
  expense_submitted: true, expense_approved: true, payroll_reminder: true,
  tax_due_reminder: true, bank_sync: false, weekly_report: true, email_digest: 'daily',
}

const INTEGRATIONS = [
  { id: 'line',    name: 'LINE WORKS',               desc: 'LINEから経費レシートを送信・OCR自動解析',   status: 'connected'    as const, detail: '接続中: nono-llc ワークスペース', color: 'bg-green-500'  },
  { id: 'slack',   name: 'Slack',                    desc: 'Slackから経費申請・通知の受信',            status: 'connected'    as const, detail: '接続中: #経費申請 チャンネル',   color: 'bg-purple-500' },
  { id: 'gmo',     name: 'GMOあおぞらネット銀行',     desc: '銀行取引データの自動取込',                status: 'connected'    as const, detail: '最終同期: 2026-04-13 08:00',    color: 'bg-blue-500'   },
  { id: 'freee',   name: 'freee会計',                desc: '仕訳データのエクスポート連携',             status: 'disconnected' as const, detail: '未接続',                        color: 'bg-slate-300'  },
  { id: 'mfcloud', name: 'マネーフォワード クラウド', desc: '仕訳・請求書データの自動同期',             status: 'disconnected' as const, detail: '未接続',                        color: 'bg-slate-300'  },
]

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
        checked ? 'bg-blue-600' : 'bg-slate-200'
      )}
    >
      <span className={cn(
        'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200',
        checked ? 'translate-x-4' : 'translate-x-0'
      )} />
    </button>
  )
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <div className="text-[14px] font-bold text-[#1a2332]">{title}</div>
      {sub && <div className="text-[12px] text-[#8f9db0] mt-0.5">{sub}</div>}
    </div>
  )
}

export default function SettingsPage() {
  const [tab, setTab]                   = useState<Tab>('profile')
  const [company, setCompany]           = useState<CompanySettings>(INIT_COMPANY)
  const [notif, setNotif]               = useState<NotifSettings>(INIT_NOTIF)
  const [integrations, setIntegrations] = useState(INTEGRATIONS)
  const [loadingInit, setLoadingInit]   = useState(true)

  // プロフィール
  const [displayName, setDisplayName]   = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profileRole, setProfileRole]   = useState('')
  const [profileError, setProfileError] = useState('')
  const [profilePending, startProfileTransition] = useTransition()

  // 会社設定
  const [companySaving, setCompanySaving] = useState(false)

  useEffect(() => {
    Promise.all([getTenantSettings(), getCurrentUser()]).then(([tenantRes, userRes]) => {
      if (tenantRes.data) {
        setCompany(prev => ({
          ...prev,
          name:           tenantRes.data.name          ?? '',
          invoice_prefix: tenantRes.data.invoice_number ?? 'INV',
          fiscal_month:   tenantRes.data.fiscal_month  ?? 4,
        }))
      }
      if (userRes.data) {
        setDisplayName(userRes.data.display_name ?? '')
        setProfileEmail(userRes.data.email ?? '')
        setProfileRole(userRes.data.role ?? 'member')
      }
      setLoadingInit(false)
    })
  }, [])

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileError('')
    if (!displayName.trim()) { setProfileError('表示名を入力してください'); return }

    startProfileTransition(async () => {
      const res = await updateProfile({ display_name: displayName })
      if (res.error) { setProfileError(res.error); toast.error(res.error) }
      else toast.success('プロフィールを更新しました')
    })
  }

  async function handleSaveCompany(e: React.FormEvent) {
    e.preventDefault()
    setCompanySaving(true)
    const result = await updateTenantSettings({
      name:           company.name,
      invoice_number: company.invoice_prefix,
      fiscal_month:   company.fiscal_month,
    })
    setCompanySaving(false)
    if (result.error) toast.error(`エラー: ${result.error}`)
    else toast.success('会社情報を保存しました')
  }

  function handleSaveNotif() {
    toast.success('通知設定を保存しました')
  }

  function toggleIntegration(id: string) {
    setIntegrations(prev => prev.map(ig => {
      if (ig.id !== id) return ig
      if (ig.status === 'connected') {
        toast.success(`${ig.name} との連携を解除しました`)
        return { ...ig, status: 'disconnected' as const, detail: '未接続', color: 'bg-slate-300' }
      } else {
        toast.info(`${ig.name} との連携設定を開始します（デモ）`)
        return ig
      }
    }))
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'profile',       label: 'プロフィール' },
    { key: 'company',       label: '会社情報' },
    { key: 'notifications', label: '通知設定' },
    { key: 'integrations',  label: '外部連携' },
    { key: 'plan',          label: 'プラン・請求' },
  ]

  const ROLE_LABEL: Record<string, string> = {
    admin: '管理者', accountant: '経理担当', member: 'メンバー',
  }

  return (
    <div>
      {/* Topbar */}
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center sticky top-0 z-40">
        <h1 className="text-[16px] font-bold text-[#1a2332]">基本設定</h1>
      </div>

      <div className="flex">
        {/* サイドタブ */}
        <div className="w-[200px] flex-shrink-0 border-r border-[#e2e6ec] min-h-screen pt-6 bg-white">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'w-full text-left px-6 py-2.5 text-[13px] font-medium transition-colors border-r-[3px]',
                tab === t.key
                  ? 'bg-blue-50 text-blue-700 border-blue-600 font-semibold'
                  : 'text-[#5a6a7e] border-transparent hover:bg-slate-50 hover:text-[#1a2332]'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* コンテンツ */}
        <div className="flex-1 p-8 max-w-2xl">

          {/* ── プロフィール ────────────────────────────── */}
          {tab === 'profile' && (
            <form onSubmit={handleSaveProfile} noValidate className="space-y-6">
              <SectionHeader title="プロフィール" sub="あなたの表示名と役割を管理します" />

              {loadingInit ? (
                <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm p-6 space-y-4 animate-pulse">
                  {[0,1,2].map(i => (
                    <div key={i}>
                      <div className="h-3 w-20 bg-slate-100 rounded mb-2" />
                      <div className="h-9 w-full bg-slate-100 rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm p-6 space-y-4">
                  {/* アバター */}
                  <div className="flex items-center gap-4 pb-4 border-b border-[#e2e6ec]">
                    <div className="w-14 h-14 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white text-[20px] font-bold">
                      {displayName.slice(0, 1) || '?'}
                    </div>
                    <div>
                      <div className="text-[14px] font-bold text-[#1a2332]">{displayName || '—'}</div>
                      <div className="text-[12px] text-[#8f9db0]">{ROLE_LABEL[profileRole] ?? profileRole}</div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-[#5a6a7e] mb-1.5">
                      表示名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="例: 上村 Kami"
                      className={cn(
                        'w-full border rounded-lg px-3 py-2 text-[13px] text-[#1a2332] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200',
                        profileError ? 'border-red-400' : 'border-[#e2e6ec]'
                      )}
                    />
                    {profileError && <p className="text-[11px] text-red-600 mt-1">{profileError}</p>}
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-[#5a6a7e] mb-1.5">メールアドレス</label>
                    <input
                      type="email"
                      value={profileEmail}
                      readOnly
                      className="w-full border border-[#e2e6ec] rounded-lg px-3 py-2 text-[13px] text-[#8f9db0] bg-slate-50 cursor-not-allowed"
                    />
                    <p className="text-[11px] text-[#8f9db0] mt-1">メールアドレスはSupabase Authで管理されています</p>
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-[#5a6a7e] mb-1.5">ロール</label>
                    <div className="border border-[#e2e6ec] rounded-lg px-3 py-2 text-[13px] text-[#8f9db0] bg-slate-50">
                      {ROLE_LABEL[profileRole] ?? profileRole}
                      <span className="ml-2 text-[10px]">（管理者が変更できます）</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={profilePending || loadingInit}
                  className="px-5 py-2.5 bg-[#1e3a5f] hover:bg-[#16304f] disabled:opacity-50 text-white text-[13px] font-semibold rounded-lg transition-colors shadow-sm"
                >
                  {profilePending ? '保存中…' : '変更を保存'}
                </button>
              </div>
            </form>
          )}

          {/* ── 会社情報 ───────────────────────────────── */}
          {tab === 'company' && (
            <form onSubmit={handleSaveCompany} className="space-y-6">
              <SectionHeader title="会社情報" sub="請求書・帳票に使用される情報です" />

              {loadingInit ? (
                <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm p-6 space-y-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-3 w-24 bg-slate-100 rounded mb-2" />
                      <div className="h-9 w-full bg-slate-100 rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm p-6 space-y-4">
                  {([
                    { key: 'name'           as const, label: '会社名（表示名）',        placeholder: 'NONO合同会社',     required: true  },
                    { key: 'legal_name'     as const, label: '正式名称（法人格含む）',   placeholder: 'NONO合同会社',     required: false },
                    { key: 'tax_id'         as const, label: 'インボイス登録番号',       placeholder: 'T1234567890123',  required: false },
                    { key: 'address'        as const, label: '住所',                    placeholder: '東京都渋谷区…',    required: false },
                    { key: 'phone'          as const, label: '電話番号',                placeholder: '03-0000-0000',     required: false },
                    { key: 'invoice_prefix' as const, label: '請求書番号プレフィックス', placeholder: 'INV',              required: false },
                  ] as { key: keyof CompanySettings; label: string; placeholder: string; required: boolean }[]).map(f => (
                    <div key={f.key}>
                      <label className="block text-[12px] font-semibold text-[#5a6a7e] mb-1.5">
                        {f.label}
                        {f.required && <span className="text-red-500 ml-1">*</span>}
                        {(f.key === 'legal_name' || f.key === 'tax_id' || f.key === 'address' || f.key === 'phone') && (
                          <span className="ml-2 text-[10px] text-[#8f9db0] font-normal">（ローカル保存）</span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={company[f.key] as string}
                        onChange={e => setCompany(prev => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full border border-[#e2e6ec] rounded-lg px-3 py-2 text-[13px] text-[#1a2332] placeholder-[#8f9db0] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                      />
                    </div>
                  ))}

                  <div>
                    <label className="block text-[12px] font-semibold text-[#5a6a7e] mb-1.5">事業年度開始月</label>
                    <select
                      value={company.fiscal_month}
                      onChange={e => setCompany(prev => ({ ...prev, fiscal_month: Number(e.target.value) }))}
                      className="border border-[#e2e6ec] rounded-lg px-3 py-2 text-[13px] text-[#1a2332] focus:outline-none focus:border-blue-400"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>{m}月</option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-1 text-[11px] text-[#8f9db0]">
                    ※ 会社名・請求書プレフィックス・事業年度はクラウドに保存されます
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={companySaving || loadingInit}
                  className="px-5 py-2.5 bg-[#1e3a5f] hover:bg-[#16304f] disabled:opacity-50 text-white text-[13px] font-semibold rounded-lg transition-colors shadow-sm"
                >
                  {companySaving ? '保存中…' : '変更を保存'}
                </button>
              </div>
            </form>
          )}

          {/* ── 通知設定 ───────────────────────────────── */}
          {tab === 'notifications' && (
            <div className="space-y-6">
              <SectionHeader title="通知設定" sub="受け取る通知の種類を管理します" />

              <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
                {([
                  { key: 'expense_submitted' as const, label: '経費申請が届いたとき',      sub: '従業員が経費を申請するたびに通知'          },
                  { key: 'expense_approved'  as const, label: '経費が承認・却下されたとき', sub: '申請した経費のステータスが変わると通知'    },
                  { key: 'payroll_reminder'  as const, label: '給与処理のリマインダー',     sub: '支給日の3日前に通知'                      },
                  { key: 'tax_due_reminder'  as const, label: '納税期限のリマインダー',     sub: '期限の14日前・7日前・当日に通知'          },
                  { key: 'bank_sync'         as const, label: '銀行データ取込完了',         sub: '自動取込が完了したとき'                    },
                  { key: 'weekly_report'     as const, label: '週次サマリーレポート',        sub: '毎週月曜朝9時に先週の収支を送信'          },
                ]).map((item, i, arr) => (
                  <div
                    key={item.key}
                    className={cn('flex items-center justify-between px-5 py-4', i < arr.length - 1 && 'border-b border-[#e2e6ec]')}
                  >
                    <div>
                      <div className="text-[13px] font-semibold text-[#1a2332]">{item.label}</div>
                      <div className="text-[11px] text-[#8f9db0] mt-0.5">{item.sub}</div>
                    </div>
                    <Toggle checked={notif[item.key]} onChange={v => setNotif(prev => ({ ...prev, [item.key]: v }))} />
                  </div>
                ))}
              </div>

              <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm p-5">
                <div className="text-[13px] font-semibold text-[#1a2332] mb-3">メールダイジェスト</div>
                <div className="space-y-2">
                  {([
                    ['none',   '送信しない'],
                    ['daily',  '毎日送信（朝8時）'],
                    ['weekly', '毎週送信（月曜朝9時）'],
                  ] as const).map(([val, label]) => (
                    <label key={val} className={cn(
                      'flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer transition-colors',
                      notif.email_digest === val ? 'border-blue-400 bg-blue-50' : 'border-[#e2e6ec] hover:bg-slate-50'
                    )}>
                      <input
                        type="radio"
                        name="email_digest"
                        value={val}
                        checked={notif.email_digest === val}
                        onChange={() => setNotif(prev => ({ ...prev, email_digest: val }))}
                        className="accent-blue-600"
                      />
                      <span className="text-[13px] font-medium text-[#1a2332]">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveNotif}
                  className="px-5 py-2.5 bg-[#1e3a5f] hover:bg-[#16304f] text-white text-[13px] font-semibold rounded-lg transition-colors shadow-sm"
                >
                  変更を保存
                </button>
              </div>
            </div>
          )}

          {/* ── 外部連携 ───────────────────────────────── */}
          {tab === 'integrations' && (
            <div className="space-y-6">
              <SectionHeader title="外部連携" sub="連携サービスを管理します" />
              <div className="space-y-3">
                {integrations.map(ig => (
                  <div key={ig.id} className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm p-5 flex items-center gap-4">
                    <div className={cn('w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-[14px] font-bold', ig.color)}>
                      {ig.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold text-[#1a2332]">{ig.name}</div>
                      <div className="text-[12px] text-[#8f9db0]">{ig.desc}</div>
                      <div className={cn('text-[11px] mt-1 font-semibold', ig.status === 'connected' ? 'text-green-600' : 'text-[#8f9db0]')}>
                        {ig.detail}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleIntegration(ig.id)}
                      className={cn(
                        'flex-shrink-0 px-4 py-2 text-[12px] font-semibold rounded-lg transition-colors',
                        ig.status === 'connected'
                          ? 'border border-red-200 text-red-600 hover:bg-red-50'
                          : 'border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100'
                      )}
                    >
                      {ig.status === 'connected' ? '連携解除' : '連携する'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── プラン・請求 ───────────────────────────── */}
          {tab === 'plan' && (
            <div className="space-y-6">
              <SectionHeader title="プラン・請求" sub="現在のプランと請求情報を確認できます" />

              <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[11px] font-bold text-[#8f9db0] uppercase tracking-wide mb-1">現在のプラン</div>
                    <div className="text-[22px] font-bold text-[#1a2332]">Starter</div>
                  </div>
                  <span className="text-[11px] font-bold bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full">現在利用中</span>
                </div>
                <div className="text-[13px] text-[#5a6a7e] mb-4">¥9,800 / 月（税込） · 次回請求日: 2026年5月1日</div>
                <div className="border-t border-[#e2e6ec] pt-4 space-y-2">
                  {[
                    ['ユーザー数', '最大10名'],
                    ['経費申請', '無制限'],
                    ['銀行連携', '1口座'],
                    ['サポート', 'メール（平日）'],
                    ['データ保存期間', '1年間'],
                  ].map(([key, val]) => (
                    <div key={key} className="flex justify-between text-[13px]">
                      <span className="text-[#8f9db0]">{key}</span>
                      <span className="font-semibold text-[#1a2332]">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#1e3a5f] to-[#0f2540] text-white rounded-lg p-6">
                <div className="text-[16px] font-bold mb-1">Pro プランにアップグレード</div>
                <div className="text-[13px] text-white/70 mb-4">¥24,800/月 · ユーザー無制限 · 銀行口座5件 · 優先サポート</div>
                <div className="grid grid-cols-2 gap-2 mb-5">
                  {['無制限ユーザー', 'freee / MFクラウド連携', '銀行口座 5件', 'Slack・LINE完全自動化', 'AIカテゴリ自動分類', 'データ保存 5年間'].map(f => (
                    <div key={f} className="flex items-center gap-2 text-[12px] text-white/80">
                      <span className="text-green-400 font-bold">✓</span> {f}
                    </div>
                  ))}
                </div>
                <button className="w-full py-2.5 bg-white text-[#1e3a5f] text-[13px] font-bold rounded-lg hover:bg-blue-50 transition-colors">
                  Proにアップグレードする
                </button>
              </div>

              <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#e2e6ec]">
                  <div className="text-[13px] font-bold text-[#1a2332]">請求履歴</div>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50">
                      {['日付', 'プラン', '金額', 'ステータス', ''].map(h => (
                        <th key={h} className="px-5 py-2.5 text-left text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.5px] border-b border-[#e2e6ec]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { date: '2026-04-01', plan: 'Starter', amount: '¥9,800', status: '支払済' },
                      { date: '2026-03-01', plan: 'Starter', amount: '¥9,800', status: '支払済' },
                      { date: '2026-02-01', plan: 'Starter', amount: '¥9,800', status: '支払済' },
                    ].map((r, i) => (
                      <tr key={i} className="border-b border-[#e2e6ec] last:border-0">
                        <td className="px-5 py-3 text-[13px] text-[#5a6a7e]">{r.date}</td>
                        <td className="px-5 py-3 text-[13px] text-[#1a2332]">{r.plan}</td>
                        <td className="px-5 py-3 text-[13px] font-semibold text-[#1a2332]">{r.amount}</td>
                        <td className="px-5 py-3">
                          <span className="text-[11px] font-semibold bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{r.status}</span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button className="text-[12px] font-semibold text-blue-600 hover:underline">PDF</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
