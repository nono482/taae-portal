import { ProfitChart } from '@/components/dashboard/ProfitChart'
import { CashFlowChart } from '@/components/dashboard/CashFlowChart'
import { getDashboardData, type DashboardSchedule, type DashboardNotification } from '@/app/actions/dashboard'
import { cn } from '@/lib/utils'

type BadgeVariant  = 'up' | 'down' | 'warn' | 'alert' | 'neutral'
type StatusVariant = 'pending' | 'approved' | 'sent' | 'processing' | 'overdue' | 'soon' | 'ok'

// ─── フォーマットヘルパー ──────────────────────────────────
function fmt(n: number) {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}
function fmtK(n: number) {
  return `${Math.round(n / 1000).toLocaleString('ja-JP')}`
}

function daysUntil(dateStr: string): { label: string; variant: StatusVariant } {
  const due   = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  if (diff < 0)  return { label: `${Math.abs(diff)}日超過`, variant: 'overdue' }
  if (diff === 0) return { label: '今日期限',               variant: 'overdue' }
  if (diff <= 7) return { label: `${diff}日後`,             variant: 'soon'    }
  return           { label: `${diff}日後`,                  variant: 'ok'      }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 1)   return 'たった今'
  if (min < 60)  return `${min}分前`
  const hr = Math.floor(min / 60)
  if (hr  < 24)  return `${hr}時間前`
  const day = Math.floor(hr / 24)
  if (day < 7)   return `${day}日前`
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

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

const PRIORITY_DOT: Record<string, string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-400',
  low:    'bg-slate-300',
}

const CATEGORY_DOT: Record<string, string> = {
  expense: 'bg-amber-400',
  tax:     'bg-red-500',
  payroll: 'bg-blue-500',
  bank:    'bg-green-500',
  system:  'bg-slate-400',
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
          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      )}
      <div className={cn('mt-3.5 h-[3px] rounded-full', dividerColor)} />
    </div>
  )
}

// ─── ステータスチップ ─────────────────────────────────────
function StatusChip({ variant, label }: { variant: StatusVariant; label: string }) {
  const cls: Record<StatusVariant, string> = {
    pending:    'bg-amber-50 text-amber-700',
    approved:   'bg-green-50 text-green-700',
    sent:       'bg-blue-50 text-blue-700',
    processing: 'bg-amber-50 text-amber-700',
    overdue:    'bg-red-50 text-red-600',
    soon:       'bg-amber-50 text-amber-700',
    ok:         'bg-slate-100 text-slate-500',
  }
  const dot: Record<StatusVariant, string> = {
    pending:    'bg-amber-500', approved:   'bg-green-500', sent:    'bg-blue-500',
    processing: 'bg-amber-500', overdue:    'bg-red-500',   soon:    'bg-amber-500',
    ok:         'bg-slate-400',
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full', cls[variant])}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dot[variant])} />
      {label}
    </span>
  )
}

// ─── 通知ウィジェット ─────────────────────────────────────
function NotificationsWidget({ notifications }: { notifications: DashboardNotification[] }) {
  const unreadCount = notifications.filter(n => !n.is_read).length
  return (
    <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e2e6ec]">
        <div className="flex items-center gap-2">
          <div className="text-[13px] font-bold text-[#1a2332]">最新通知</div>
          {unreadCount > 0 && (
            <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full leading-none">
              {unreadCount}
            </span>
          )}
        </div>
        <a href="/notifications" className="text-[12px] font-semibold text-blue-600 hover:underline">
          すべて見る →
        </a>
      </div>

      {notifications.length === 0 ? (
        <div className="px-5 py-6 text-center text-[13px] text-[#8f9db0]">通知はありません</div>
      ) : (
        <div>
          {notifications.map(n => (
            <a
              key={n.id}
              href={n.action_href ?? '/notifications'}
              className={cn(
                'flex items-start gap-3 px-5 py-3 border-b border-[#e2e6ec] last:border-0 hover:bg-slate-50 transition-colors',
                !n.is_read && 'bg-blue-50/30'
              )}
            >
              <span className={cn(
                'w-2 h-2 rounded-full mt-1 flex-shrink-0',
                PRIORITY_DOT[n.priority] ?? 'bg-slate-300'
              )} />
              <div className="flex-1 min-w-0">
                <div className={cn(
                  'text-[12px] font-semibold truncate',
                  !n.is_read ? 'text-[#1a2332]' : 'text-[#5a6a7e]'
                )}>
                  {n.title}
                </div>
                <div className="text-[11px] text-[#8f9db0] mt-0.5">{relativeTime(n.created_at)}</div>
              </div>
              {!n.is_read && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 税務スケジュールウィジェット ─────────────────────────
function SchedulesWidget({ schedules }: { schedules: DashboardSchedule[] }) {
  return (
    <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#e2e6ec]">
        <div className="text-[13px] font-bold text-[#1a2332]">納税・支払スケジュール</div>
        <div className="text-[11px] text-[#8f9db0] mt-0.5">未完了のイベント</div>
      </div>

      {schedules.length === 0 ? (
        <div className="px-5 py-6 text-center text-[13px] text-[#8f9db0]">
          スケジュールは登録されていません
        </div>
      ) : (
        schedules.map(s => {
          const { label, variant } = daysUntil(s.due_date)
          return (
            <div key={s.id} className="flex items-center px-5 py-3.5 border-b border-[#e2e6ec] last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#1a2332] truncate">{s.title}</div>
                <div className="text-[11px] text-[#8f9db0] mt-0.5">
                  期限: {s.due_date.replace(/-/g, '/')}
                </div>
              </div>
              <div className="text-right ml-3 flex-shrink-0">
                {s.amount != null && (
                  <div className={cn('text-[13px] font-bold mb-0.5',
                    variant === 'overdue' ? 'text-red-600'
                      : variant === 'soon' ? 'text-amber-600'
                      : 'text-[#1a2332]'
                  )}>
                    {fmt(s.amount)}
                  </div>
                )}
                <StatusChip variant={variant} label={label} />
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ─── PAGE (Server Component) ──────────────────────────────
export default async function DashboardPage() {
  const dashData = await getDashboardData().catch(() => null)

  if (!dashData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f6f9]">
        <div className="text-center space-y-2">
          <div className="text-[15px] font-bold text-[#1a2332]">データを取得できませんでした</div>
          <div className="text-[13px] text-[#8f9db0]">ページを再読み込みしてください</div>
          <a href="/dashboard" className="inline-block mt-3 text-[13px] font-semibold text-blue-600 hover:underline">
            再読み込み
          </a>
        </div>
      </div>
    )
  }

  const {
    isPrivileged, role,
    kpi, recentExpenses, payrollStatus,
    notifications, financialSchedules,
  } = dashData

  const now = new Date()
  const dateLabel = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
  const monthLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`

  // 期限超過スケジュール（アラート表示用）
  const today = now.toISOString().slice(0, 10)
  const overdueSchedules = financialSchedules.filter(s => s.due_date < today)

  return (
    <div>
      {/* Topbar */}
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center justify-between sticky top-0 z-40">
        <h1 className="text-[16px] font-bold text-[#1a2332]">ダッシュボード</h1>
        <span className="text-[12px] text-[#8f9db0]">{dateLabel}</span>
      </div>

      <div className="p-8">
        {/* ── 管理者 / 経理担当者ビュー ─────────────────────────── */}
        {isPrivileged ? (
          <>
            {/* 期限超過アラート（実データのみ） */}
            {overdueSchedules.length > 0 && (
              <div className="mb-6 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between text-[13px] text-yellow-800">
                <span>
                  <strong className="font-bold">{overdueSchedules[0].title}の納付期限が過ぎています。</strong>
                  {overdueSchedules[0].amount != null && ` ${fmt(overdueSchedules[0].amount)} — `}
                  期限: {overdueSchedules[0].due_date.replace(/-/g, '/')}
                  {overdueSchedules.length > 1 && ` 他${overdueSchedules.length - 1}件`}
                </span>
                <a href="/reports" className="text-blue-600 font-semibold hover:underline text-[12px] ml-4 whitespace-nowrap">
                  今すぐ確認する
                </a>
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex gap-3 mb-7 flex-wrap">
              <a href="/expenses" className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#16304f] text-white text-[13px] font-semibold rounded-lg transition-colors shadow-sm">
                経費を一括承認（{kpi.pendingExpenseCount}件）
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
            <div className="text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.8px] mb-3">
              経営サマリー — {monthLabel}
            </div>
            <div className="grid grid-cols-4 gap-4 mb-7">
              <KpiCard
                label="今月の純利益（概算）"
                value={fmtK(kpi.netProfit)}
                unit="千円"
                sub={kpi.netProfit === 0 ? '銀行連携で自動集計' : '入金 − 出金'}
                badge={kpi.netProfit >= 0 ? '黒字' : '赤字'}
                badgeVariant={kpi.netProfit >= 0 ? 'up' : 'alert'}
                dividerColor="bg-blue-600"
              />
              <KpiCard
                label="現預金残高"
                value={fmtK(kpi.cashBalance)}
                unit="千円"
                sub={kpi.cashBalance === 0 ? '銀行口座を登録してください' : '口座残高合計'}
                badge={kpi.cashBalance > 0 ? '正常' : '未連携'}
                badgeVariant={kpi.cashBalance > 0 ? 'up' : 'neutral'}
                dividerColor="bg-green-500"
              />
              <KpiCard
                label="今月の売上"
                value={fmtK(kpi.totalIncome)}
                unit="千円"
                sub="入金取引合計"
                badge={kpi.totalIncome > 0 ? '集計済' : '取引なし'}
                badgeVariant={kpi.totalIncome > 0 ? 'up' : 'neutral'}
                dividerColor="bg-amber-500"
              />
              <KpiCard
                label="未承認経費"
                value={String(kpi.pendingExpenseCount)}
                unit="件"
                sub={kpi.pendingExpenseCount > 0 ? `合計 ${fmt(kpi.pendingExpenseAmount)}` : '承認待ちなし'}
                badge={kpi.pendingExpenseCount > 0 ? '要対応' : '問題なし'}
                badgeVariant={kpi.pendingExpenseCount > 0 ? 'alert' : 'up'}
                dividerColor="bg-red-500"
              />
            </div>

            {/* Main 2-col */}
            <div className="text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.8px] mb-3">明細・分析</div>
            <div className="grid grid-cols-[1fr_360px] gap-5">

              {/* LEFT */}
              <div className="flex flex-col gap-5">
                {/* Profit chart */}
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
                        {kpi.pendingExpenseCount > 0 && (
                          <span className="ml-2 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                            {kpi.pendingExpenseCount}件
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#8f9db0] mt-0.5">{monthLabel}の承認待ち</div>
                    </div>
                    <a href="/expenses" className="text-[12px] font-semibold text-blue-600 px-3 py-1.5 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                      一括承認モードへ
                    </a>
                  </div>

                  {recentExpenses.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="text-[13px] font-semibold text-[#1a2332] mb-1">承認待ちの経費はありません</div>
                      <div className="text-[12px] text-[#8f9db0]">今月の申請はすべて処理済みです</div>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50">
                          {['支払先', '勘定科目', '申請者', '日付', '金額', '状態'].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.5px] border-b border-[#e2e6ec] whitespace-nowrap last:text-center">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recentExpenses.map((e, i) => (
                          <tr key={e.id ?? i} className="hover:bg-slate-50 border-b border-[#e2e6ec] last:border-0">
                            <td className="px-4 py-2.5 text-[13px] font-semibold text-[#1a2332] max-w-[160px] truncate">{e.vendor_name}</td>
                            <td className="px-4 py-2.5 text-[12px] text-[#5a6a7e]">{e.category?.name ?? '—'}</td>
                            <td className="px-4 py-2.5 text-[12px] text-[#8f9db0]">{e.submitter?.display_name ?? '—'}</td>
                            <td className="px-4 py-2.5 text-[12px] text-[#8f9db0] whitespace-nowrap">
                              {e.expense_date.slice(5).replace('-', '/')}
                            </td>
                            <td className="px-4 py-2.5 text-[13px] font-semibold text-red-600 text-right font-mono whitespace-nowrap">
                              {fmt(e.amount)}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <StatusChip variant={expenseStatusVariant(e.status)} label={expenseStatusLabel(e.status)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* RIGHT */}
              <div className="flex flex-col gap-5">
                {/* 最新通知 */}
                <NotificationsWidget notifications={notifications} />

                {/* 納税スケジュール */}
                <SchedulesWidget schedules={financialSchedules} />

                {/* キャッシュフロー */}
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
                      <div className="text-[17px] font-bold text-blue-600">{fmtK(kpi.totalIncome)}千円</div>
                    </div>
                    <div className="bg-slate-50 border border-[#e2e6ec] rounded-lg p-3 text-center">
                      <div className="text-[10px] font-bold text-[#8f9db0] uppercase tracking-wide mb-1">今月出金</div>
                      <div className="text-[17px] font-bold text-red-500">{fmtK(kpi.totalExpense)}千円</div>
                    </div>
                  </div>
                </div>

                {/* 給与管理 */}
                <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e2e6ec]">
                    <div>
                      <div className="text-[13px] font-bold text-[#1a2332]">給与管理 — {monthLabel}</div>
                      <div className="text-[11px] text-[#8f9db0] mt-0.5">給与締め処理状況</div>
                    </div>
                    <a href="/payroll" className="text-[12px] font-semibold text-blue-600 px-3 py-1.5 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                      明細を送信
                    </a>
                  </div>
                  {payrollStatus.total === 0 ? (
                    <div className="px-5 py-5 text-center text-[13px] text-[#8f9db0]">従業員が登録されていません</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 border-b border-[#e2e6ec]">
                        {[
                          { val: String(payrollStatus.total),   label: '従業員数', color: '' },
                          { val: String(payrollStatus.sent),    label: '送信済',   color: 'text-green-600' },
                          { val: String(payrollStatus.pending), label: '処理待ち', color: 'text-amber-600' },
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
                    </>
                  )}
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
            <div className="text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.8px] mb-3">
              今月の申請状況 — {monthLabel}
            </div>
            <div className="grid grid-cols-3 gap-4 mb-7">
              <KpiCard
                label="今月の申請合計"
                value={fmt(kpi.monthlyTotal)}
                sub={`${recentExpenses.length + (kpi.pendingExpenseCount > recentExpenses.length ? kpi.pendingExpenseCount - recentExpenses.length : 0)}件の申請`}
                badge={kpi.monthlyTotal > 0 ? '申請あり' : '申請なし'}
                badgeVariant={kpi.monthlyTotal > 0 ? 'up' : 'neutral'}
                dividerColor="bg-blue-600"
              />
              <KpiCard
                label="承認待ち"
                value={String(kpi.pendingExpenseCount)}
                unit="件"
                sub={kpi.pendingExpenseCount > 0 ? `合計 ${fmt(kpi.pendingExpenseAmount)}` : '承認待ちなし'}
                badge={kpi.pendingExpenseCount > 0 ? '確認待ち' : '問題なし'}
                badgeVariant={kpi.pendingExpenseCount > 0 ? 'warn' : 'up'}
                dividerColor="bg-amber-500"
              />
              <KpiCard
                label="今月の承認済み"
                value={String(kpi.approvedCount)}
                unit="件"
                sub={kpi.approvedCount > 0 ? `合計 ${fmt(kpi.approvedAmount)}` : '承認済みなし'}
                badge={kpi.approvedCount > 0 ? '承認済' : 'なし'}
                badgeVariant={kpi.approvedCount > 0 ? 'up' : 'neutral'}
                dividerColor="bg-green-500"
              />
            </div>

            {/* 自分の申請テーブル */}
            <div className="grid grid-cols-[1fr_360px] gap-5">
              <div className="flex flex-col gap-5">
                <div className="text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.8px]">申請履歴</div>
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

                  {recentExpenses.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                      <div className="text-[13px] text-[#8f9db0] mb-3">今月の申請はまだありません</div>
                      <a href="/expenses/new" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-blue-600 px-4 py-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                        + 経費を申請する
                      </a>
                    </div>
                  ) : (
                    <>
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50">
                            {['支払先', '勘定科目', '日付', '金額', '状態'].map(h => (
                              <th key={h} className="px-5 py-2.5 text-left text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.5px] border-b border-[#e2e6ec] whitespace-nowrap last:text-center">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {recentExpenses.map((e, i) => (
                            <tr key={e.id ?? i} className="hover:bg-slate-50 border-b border-[#e2e6ec] last:border-0">
                              <td className="px-5 py-2.5 text-[13px] font-semibold text-[#1a2332] max-w-[180px] truncate">{e.vendor_name}</td>
                              <td className="px-5 py-2.5 text-[12px] text-[#5a6a7e]">{e.category?.name ?? '—'}</td>
                              <td className="px-5 py-2.5 text-[12px] text-[#8f9db0] whitespace-nowrap">
                                {e.expense_date.slice(5).replace('-', '/')}
                              </td>
                              <td className="px-5 py-2.5 text-[13px] font-semibold text-[#1a2332] text-right font-mono whitespace-nowrap">
                                {fmt(e.amount)}
                              </td>
                              <td className="px-5 py-2.5 text-center">
                                <StatusChip variant={expenseStatusVariant(e.status)} label={expenseStatusLabel(e.status)} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="px-5 py-3 border-t border-[#e2e6ec] text-center">
                        <a href="/expenses" className="text-[12px] font-semibold text-blue-600 hover:underline">
                          すべての申請履歴を見る →
                        </a>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Member右カラム: 通知 */}
              <div className="flex flex-col gap-5 mt-5">
                <NotificationsWidget notifications={notifications} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
