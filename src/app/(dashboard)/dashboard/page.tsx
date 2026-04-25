import { ProfitChart } from '@/components/dashboard/ProfitChart'
import { CashFlowChart } from '@/components/dashboard/CashFlowChart'
import { getDashboardData } from '@/app/actions/dashboard'
import { cn } from '@/lib/utils'

type BadgeVariant  = 'up' | 'down' | 'warn' | 'alert' | 'neutral'
type StatusVariant = 'pending' | 'approved' | 'sent' | 'processing' | 'overdue' | 'soon' | 'ok'

function fmt(n: number) {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}
function fmtK(n: number) {
  return `${Math.round(n / 1000).toLocaleString('ja-JP')}`
}

// ─── KPI カード ───────────────────────────────────────────
function KpiCard({
  label, value, unit, sub, badge, badgeVariant, progress, dividerColor,
}: {
  label: string; value: string; unit?: string; sub: string
  badge: string; badgeVariant: BadgeVariant; progress?: number; dividerColor: string
}) {
  const badgeClass: Record<BadgeVariant, string> = {
    up:      'bg-green-50 text-green-700',
    down:    'bg-red-50 text-red-600',
    warn:    'bg-amber-50 text-amber-700',
    alert:   'bg-red-50 text-red-600',
    neutral: 'bg-slate-100 text-slate-500',
  }
  return (
    <div className="bg-white border border-[#e2e6ec] rounded-lg p-5 shadow-sm">
      <div className="text-[11px] font-semibold text-[#8f9db0] mb-2 tracking-wide">{label}</div>
      <div className="text-[26px] font-bold text-[#1a2332] leading-none tracking-tight">
        {value}{unit && <span className="text-[14px] font-semibold ml-0.5">{unit}</span>}
      </div>
      <div className="flex items-center justify-between mt-2.5">
        <span className="text-[11px] text-[#8f9db0]">{sub}</span>
        <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', badgeClass[badgeVariant])}>
          {badge}
        </span>
      </div>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 bg-[#e9ecef] rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className={cn('mt-3.5 h-[3px] rounded-full', dividerColor)} />
    </div>
  )
}

// ─── ステータスチップ ─────────────────────────────────────
function StatusChip({ variant, label }: { variant: StatusVariant; label: string }) {
  const cls: Record<StatusVariant, string> = {
    pending:   'bg-amber-50 text-amber-700',
    approved:  'bg-green-50 text-green-700',
    sent:      'bg-blue-50 text-blue-700',
    processing:'bg-amber-50 text-amber-700',
    overdue:   'bg-red-50 text-red-600',
    soon:      'bg-amber-50 text-amber-700',
    ok:        'bg-slate-100 text-slate-500',
  }
  const dotCls: Record<StatusVariant, string> = {
    pending:   'bg-amber-500', approved: 'bg-green-500', sent:      'bg-blue-500',
    processing:'bg-amber-500', overdue:  'bg-red-500',   soon:      'bg-amber-500', ok: 'bg-slate-400',
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full', cls[variant])}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotCls[variant])} />
      {label}
    </span>
  )
}

// ─── 静的フォールバックデータ ─────────────────────────────
const FALLBACK_EXPENSES = [
  { id:'1', vendor_name:'セブンイレブン 新宿駅前店', category:{name:'消耗品費'}, expense_date:'2026-04-12', source:'LINE',  amount:1280,  status:'pending'  },
  { id:'2', vendor_name:'JR東日本 Suica',            category:{name:'交通費'},   expense_date:'2026-04-12', source:'LINE',  amount:980,   status:'pending'  },
  { id:'3', vendor_name:'Starbucks Coffee 渋谷店',   category:{name:'会議費'},   expense_date:'2026-04-11', source:'Slack', amount:3440,  status:'approved' },
  { id:'4', vendor_name:'東横イン 大阪梅田',          category:{name:'旅費交通費'},expense_date:'2026-04-10', source:'Slack', amount:8600,  status:'pending'  },
  { id:'5', vendor_name:'接待費 · YAZAWA 渋谷',      category:{name:'交際費'},   expense_date:'2026-04-09', source:'LINE',  amount:42000, status:'pending'  },
]
const FALLBACK_TAXES = [
  { name:'源泉所得税',       due:'2026年4月10日', amount:'¥48,200',    variant:'overdue' as StatusVariant, days:'期限超過' },
  { name:'消費税（中間申告）', due:'2026年4月30日', amount:'¥320,000', variant:'soon'    as StatusVariant, days:'17日後'   },
  { name:'法人税（確定申告）', due:'2026年7月31日', amount:'¥1,200,000',variant:'ok'     as StatusVariant, days:'109日後'  },
]

function expenseStatusVariant(s: string): StatusVariant {
  if (s === 'approved') return 'approved'
  if (s === 'rejected') return 'overdue'
  return 'pending'
}
function expenseStatusLabel(s: string) {
  if (s === 'approved') return '承認済'
  if (s === 'rejected') return '却下'
  return '未承認'
}

// ─── PAGE (Server Component) ──────────────────────────────
export default async function DashboardPage() {
  let dashData: Awaited<ReturnType<typeof getDashboardData>> | null = null
  try {
    dashData = await getDashboardData()
  } catch {
    dashData = null
  }

  const hasReal      = dashData?.hasRealData ?? false
  const isPrivileged = dashData?.isPrivileged ?? true  // デモ時は管理者表示
  const role         = dashData?.role ?? 'admin'

  // KPI値
  const netProfit    = hasReal ? dashData!.kpi.netProfit    : 1847000
  const cashBalance  = hasReal ? dashData!.kpi.cashBalance  : 8320000
  const totalIncome  = hasReal ? dashData!.kpi.totalIncome  : 4200000
  const pendingCount = hasReal ? dashData!.kpi.pendingExpenseCount  : 7
  const pendingAmt   = hasReal ? dashData!.kpi.pendingExpenseAmount : 124800
  const monthlyTotal = hasReal ? dashData!.kpi.monthlyTotal : 56800
  const approvedCnt  = hasReal ? dashData!.kpi.approvedCount  : 3
  const approvedAmt  = hasReal ? dashData!.kpi.approvedAmount : 14260
  const payroll      = dashData?.payrollStatus ?? { total: 5, sent: 3, pending: 2 }
  const expenses     = (hasReal && dashData!.recentExpenses.length > 0)
    ? dashData!.recentExpenses
    : FALLBACK_EXPENSES

  const now = new Date()
  const dateLabel = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`

  return (
    <div>
      {/* Topbar */}
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center justify-between sticky top-0 z-40">
        <h1 className="text-[16px] font-bold text-[#1a2332]">ダッシュボード</h1>
        <div className="flex items-center gap-4">
          <span className="text-[12px] text-[#8f9db0]">{dateLabel}</span>
          {!hasReal && (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              デモデータ表示中
            </span>
          )}
        </div>
      </div>

      <div className="p-8">
        {/* ── 管理者 / 経理担当者ビュー ─────────────────────────── */}
        {isPrivileged ? (
          <>
            {/* Alert */}
            <div className="mb-6 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between text-[13px] text-yellow-800">
              <span><strong className="font-bold">源泉所得税（4月分）の納付期限が過ぎています。</strong> 48,200円 — 期限: 4月10日</span>
              <span className="text-blue-600 font-semibold cursor-pointer hover:underline text-[12px] ml-4 whitespace-nowrap">今すぐ確認する</span>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-3 mb-7 flex-wrap">
              <a href="/expenses" className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#16304f] text-white text-[13px] font-semibold rounded-lg transition-colors shadow-sm">
                経費を一括承認（{pendingCount}件）
              </a>
              <a href="/expenses/new" className="px-4 py-2 bg-white border border-[#e2e6ec] hover:bg-slate-50 text-[#1a2332] text-[13px] font-semibold rounded-lg transition-colors shadow-sm">
                経費を申請
              </a>
              <a href="/banking" className="px-4 py-2 bg-white border border-[#e2e6ec] hover:bg-slate-50 text-[#1a2332] text-[13px] font-semibold rounded-lg transition-colors shadow-sm">
                銀行CSVを取込む
              </a>
              <a href="/payroll" className="px-4 py-2 bg-white border border-[#e2e6ec] hover:bg-slate-50 text-[#1a2332] text-[13px] font-semibold rounded-lg transition-colors shadow-sm">
                給与明細を送信
              </a>
            </div>

            {/* KPI */}
            <div className="text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.8px] mb-3">経営サマリー — {now.getFullYear()}年{now.getMonth() + 1}月</div>
            <div className="grid grid-cols-4 gap-4 mb-7">
              <KpiCard label="今月の純利益（概算）" value={fmtK(netProfit)}   unit="千円" sub="先月比"                 badge="+12.4%" badgeVariant="up"    dividerColor="bg-blue-600"  />
              <KpiCard label="現預金残高"            value={fmtK(cashBalance)} unit="千円" sub="GMOあおぞら連携"       badge="+3.1%"  badgeVariant="up"    dividerColor="bg-green-500" />
              <KpiCard label="今月の売上"            value={fmtK(totalIncome)} unit="千円" sub={`目標 5,000千円`}      badge="目標未達" badgeVariant="warn" progress={Math.min(100, Math.round(totalIncome/5000000*100))} dividerColor="bg-amber-500" />
              <KpiCard label="未承認経費"            value={String(pendingCount)} unit="件" sub={`合計 ${fmt(pendingAmt)}`} badge="要対応" badgeVariant="alert" dividerColor="bg-red-500"  />
            </div>

            {/* Main content */}
            <div className="text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.8px] mb-3">明細・分析</div>
            <div className="grid grid-cols-[1fr_360px] gap-5">
              <div className="flex flex-col gap-5">
                <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e2e6ec]">
                    <div>
                      <div className="text-[13px] font-bold text-[#1a2332]">売上 / 経費 / 利益の推移</div>
                      <div className="text-[11px] text-[#8f9db0] mt-0.5">直近6ヶ月</div>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-[#5a6a7e] font-medium">
                      <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-blue-600 rounded"/>売上</span>
                      <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-px bg-slate-400 rounded border border-dashed border-slate-400"/>経費</span>
                      <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-green-600 rounded"/>利益</span>
                    </div>
                  </div>
                  <div className="px-5 pt-4 pb-3"><ProfitChart /></div>
                </div>

                {/* 未承認経費テーブル */}
                <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e2e6ec]">
                    <div>
                      <div className="text-[13px] font-bold text-[#1a2332]">
                        未承認経費一覧
                        <span className="ml-2 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{pendingCount}件</span>
                      </div>
                      <div className="text-[11px] text-[#8f9db0] mt-0.5">承認待ちの申請</div>
                    </div>
                    <a href="/expenses" className="text-[12px] font-semibold text-blue-600 px-3 py-1.5 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                      一括承認モードへ
                    </a>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50">
                        {['支払先','勘定科目','申請者','日付','金額','状態'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.5px] border-b border-[#e2e6ec] whitespace-nowrap last:text-center">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-8 text-center text-[13px] text-[#8f9db0]">
                            未承認の経費申請はありません
                          </td>
                        </tr>
                      ) : expenses.map((e: any, i: number) => (
                        <tr key={e.id ?? i} className="hover:bg-slate-50 border-b border-[#e2e6ec] last:border-0">
                          <td className="px-4 py-2.5 text-[13px] font-semibold text-[#1a2332]">{e.vendor_name}</td>
                          <td className="px-4 py-2.5 text-[13px] text-[#5a6a7e]">{e.category?.name ?? '—'}</td>
                          <td className="px-4 py-2.5 text-[12px] text-[#8f9db0]">{e.submitter?.display_name ?? '—'}</td>
                          <td className="px-4 py-2.5 text-[12px] text-[#8f9db0] whitespace-nowrap">
                            {String(e.expense_date).slice(5).replace('-', '/')}
                          </td>
                          <td className="px-4 py-2.5 text-[13px] font-semibold text-red-600 text-right font-mono">¥{Number(e.amount).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-center">
                            <StatusChip
                              variant={expenseStatusVariant(e.status)}
                              label={expenseStatusLabel(e.status)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* RIGHT */}
              <div className="flex flex-col gap-5">
                <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#e2e6ec]">
                    <div className="text-[13px] font-bold text-[#1a2332]">納税スケジュール</div>
                    <div className="text-[11px] text-[#8f9db0] mt-0.5">今後の税務イベント</div>
                  </div>
                  {FALLBACK_TAXES.map((t, i) => (
                    <div key={i} className="flex items-center px-5 py-3.5 border-b border-[#e2e6ec] last:border-0">
                      <div className="flex-1">
                        <div className="text-[13px] font-semibold text-[#1a2332]">{t.name}</div>
                        <div className="text-[11px] text-[#8f9db0] mt-0.5">納付期限: {t.due}</div>
                      </div>
                      <div className="text-right">
                        <div className={cn('text-[14px] font-bold',
                          t.variant==='overdue' ? 'text-red-600' : t.variant==='soon' ? 'text-amber-600' : 'text-[#1a2332]'
                        )}>{t.amount}</div>
                        <StatusChip variant={t.variant} label={t.days} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e2e6ec]">
                    <div>
                      <div className="text-[13px] font-bold text-[#1a2332]">キャッシュフロー</div>
                      <div className="text-[11px] text-[#8f9db0] mt-0.5">入金 vs 出金（月次）</div>
                    </div>
                    <div className="flex gap-3 text-[11px] text-[#5a6a7e] font-medium">
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block"/>入金</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-200 inline-block border border-slate-300"/>出金</span>
                    </div>
                  </div>
                  <div className="px-5 pt-4"><CashFlowChart /></div>
                  <div className="grid grid-cols-2 gap-3 px-5 py-4">
                    <div className="bg-slate-50 border border-[#e2e6ec] rounded-lg p-3 text-center">
                      <div className="text-[10px] font-bold text-[#8f9db0] uppercase tracking-wide mb-1">今月入金</div>
                      <div className="text-[17px] font-bold text-blue-600">{fmtK(totalIncome || 4200000)}千円</div>
                    </div>
                    <div className="bg-slate-50 border border-[#e2e6ec] rounded-lg p-3 text-center">
                      <div className="text-[10px] font-bold text-[#8f9db0] uppercase tracking-wide mb-1">今月出金</div>
                      <div className="text-[17px] font-bold text-red-500">{fmtK(dashData?.kpi.totalExpense || 2353000)}千円</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e2e6ec]">
                    <div>
                      <div className="text-[13px] font-bold text-[#1a2332]">給与管理 — {now.getFullYear()}年{now.getMonth() + 1}月</div>
                      <div className="text-[11px] text-[#8f9db0] mt-0.5">給与締め処理状況</div>
                    </div>
                    <a href="/payroll" className="text-[12px] font-semibold text-blue-600 px-3 py-1.5 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                      明細を送信
                    </a>
                  </div>
                  <div className="grid grid-cols-3 border-b border-[#e2e6ec]">
                    {[
                      { val: String(payroll.total),   label: '従業員数', color: '' },
                      { val: String(payroll.sent),    label: '送信済',   color: 'text-green-600' },
                      { val: String(payroll.pending), label: '処理待ち', color: 'text-amber-600' },
                    ].map(s => (
                      <div key={s.label} className="py-3 text-center border-r border-[#e2e6ec] last:border-0">
                        <div className={cn('text-[22px] font-bold', s.color || 'text-[#1a2332]')}>{s.val}</div>
                        <div className="text-[11px] text-[#8f9db0] mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="px-5 py-3 text-center">
                    <a href="/payroll" className="text-[12px] font-semibold text-blue-600 hover:underline">
                      給与明細の詳細を確認する →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* ── メンバービュー ─────────────────────────────────── */
          <>
            {/* Quick Actions */}
            <div className="flex gap-3 mb-7 flex-wrap">
              <a href="/expenses/new" className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#16304f] text-white text-[13px] font-semibold rounded-lg transition-colors shadow-sm">
                + 経費を申請する
              </a>
              <a href="/expenses" className="px-4 py-2 bg-white border border-[#e2e6ec] hover:bg-slate-50 text-[#1a2332] text-[13px] font-semibold rounded-lg transition-colors shadow-sm">
                申請履歴を見る
              </a>
            </div>

            {/* KPI */}
            <div className="text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.8px] mb-3">今月の申請状況 — {now.getFullYear()}年{now.getMonth() + 1}月</div>
            <div className="grid grid-cols-3 gap-4 mb-7">
              <KpiCard
                label="今月の申請合計"
                value={fmt(monthlyTotal || 56800)}
                sub={`${expenses.length}件の申請`}
                badge={expenses.length > 0 ? '申請あり' : '申請なし'}
                badgeVariant={expenses.length > 0 ? 'up' : 'neutral'}
                dividerColor="bg-blue-600"
              />
              <KpiCard
                label="未承認"
                value={String(pendingCount)}
                unit="件"
                sub={pendingCount > 0 ? `合計 ${fmt(pendingAmt)}` : '承認待ちなし'}
                badge={pendingCount > 0 ? '確認待ち' : '問題なし'}
                badgeVariant={pendingCount > 0 ? 'warn' : 'up'}
                dividerColor="bg-amber-500"
              />
              <KpiCard
                label="今月の承認済み"
                value={String(approvedCnt)}
                unit="件"
                sub={`合計 ${fmt(approvedAmt)}`}
                badge="承認済"
                badgeVariant="up"
                dividerColor="bg-green-500"
              />
            </div>

            {/* 自分の申請テーブル */}
            <div className="text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.8px] mb-3">申請履歴</div>
            <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e2e6ec]">
                <div>
                  <div className="text-[13px] font-bold text-[#1a2332]">今月の経費申請</div>
                  <div className="text-[11px] text-[#8f9db0] mt-0.5">直近5件</div>
                </div>
                <a href="/expenses/new" className="text-[12px] font-semibold text-blue-600 px-3 py-1.5 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                  + 新規申請
                </a>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    {['支払先','勘定科目','日付','金額','状態'].map(h => (
                      <th key={h} className="px-5 py-2.5 text-left text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.5px] border-b border-[#e2e6ec] whitespace-nowrap last:text-center">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center">
                        <div className="text-[13px] text-[#8f9db0] mb-3">今月の申請はまだありません</div>
                        <a href="/expenses/new" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-blue-600 px-4 py-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                          + 経費を申請する
                        </a>
                      </td>
                    </tr>
                  ) : expenses.map((e: any, i: number) => (
                    <tr key={e.id ?? i} className="hover:bg-slate-50 border-b border-[#e2e6ec] last:border-0">
                      <td className="px-5 py-2.5 text-[13px] font-semibold text-[#1a2332]">{e.vendor_name}</td>
                      <td className="px-5 py-2.5 text-[13px] text-[#5a6a7e]">{e.category?.name ?? '—'}</td>
                      <td className="px-5 py-2.5 text-[12px] text-[#8f9db0] whitespace-nowrap">
                        {String(e.expense_date).slice(5).replace('-', '/')}
                      </td>
                      <td className="px-5 py-2.5 text-[13px] font-semibold text-[#1a2332] text-right font-mono">¥{Number(e.amount).toLocaleString()}</td>
                      <td className="px-5 py-2.5 text-center">
                        <StatusChip
                          variant={expenseStatusVariant(e.status)}
                          label={expenseStatusLabel(e.status)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {expenses.length > 0 && (
                <div className="px-5 py-3 border-t border-[#e2e6ec] text-center">
                  <a href="/expenses" className="text-[12px] font-semibold text-blue-600 hover:underline">
                    すべての申請履歴を見る →
                  </a>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
