'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { getMonthlyReportData, type MonthlyData, type ExpenseBreakdown } from '@/app/actions/reports'

// ─── 型 ──────────────────────────────────────────────────
type Period = '6month' | '3month' | '1month'

interface ReportState {
  monthly:   MonthlyData[]
  breakdown: ExpenseBreakdown[]
  totals:    { income: number; expense: number; profit: number; avgProfit: number }
}

// ─── ユーティリティ ───────────────────────────────────────
function fmt(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000)    return `${(n / 1000).toFixed(0)}K`
  return String(n)
}
function yen(n: number) {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}
function diff(a: number, b: number) {
  if (b === 0) return null
  const pct = ((a - b) / b * 100).toFixed(1)
  return Number(pct) >= 0 ? `+${pct}%` : `${pct}%`
}

// ─── スケルトン ───────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-slate-100', className)} />
}

// ─── PAGE ────────────────────────────────────────────────
export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('6month')
  const [report, setReport] = useState<ReportState | null>(null)
  const [loading, setLoading] = useState(true)

  const months = period === '1month' ? 1 : period === '3month' ? 3 : 6

  useEffect(() => {
    setLoading(true)
    getMonthlyReportData(months).then(result => {
      setReport(result)
      setLoading(false)
    })
  }, [months])

  // チャート用データへ変換
  const plData   = (report?.monthly ?? []).map(m => ({
    month:   m.label,
    revenue: m.income,
    expense: m.expense,
    profit:  m.profit,
  }))
  const cashData = (report?.monthly ?? []).map(m => ({
    month: m.label,
    in:    m.income,
    out:   m.expense,
  }))
  const breakdown = report?.breakdown ?? []

  // KPI 算出
  const monthly        = report?.monthly ?? []
  const latestRevenue  = monthly[monthly.length - 1]?.income   ?? 0
  const prevRevenue    = monthly[monthly.length - 2]?.income   ?? 0
  const latestProfit   = monthly[monthly.length - 1]?.profit   ?? 0
  const avgProfit      = report?.totals.avgProfit ?? 0
  const profitMargin   = latestRevenue > 0 ? (latestProfit / latestRevenue * 100).toFixed(1) : '0'
  const expenseRatio   = latestRevenue > 0 ? (100 - Number(profitMargin)).toFixed(1) : '0'
  const revDiff        = diff(latestRevenue, prevRevenue)

  return (
    <div>
      {/* Topbar */}
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center justify-between sticky top-0 z-40">
        <h1 className="text-[16px] font-bold text-[#1a2332]">財務レポート</h1>
        <div className="flex items-center gap-3">
          <div className="flex border border-[#e2e6ec] rounded-lg overflow-hidden text-[12px] font-semibold">
            {([['6month', '直近6ヶ月'], ['3month', '直近3ヶ月'], ['1month', '今月']] as [Period, string][]).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setPeriod(k)}
                className={cn(
                  'px-3 py-1.5 transition-colors border-r border-[#e2e6ec] last:border-0',
                  period === k ? 'bg-[#1e3a5f] text-white' : 'bg-white text-[#5a6a7e] hover:bg-slate-50'
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-8">
        {/* KPI */}
        <div className="grid grid-cols-4 gap-4 mb-7">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border border-[#e2e6ec] border-l-4 rounded-lg p-4 shadow-sm border-l-slate-200">
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))
          ) : (
            [
              {
                label: '今月の売上',
                val: yen(latestRevenue),
                sub: revDiff ? `前月比 ${revDiff}` : `直近${months}ヶ月`,
                badge: revDiff ?? '—',
                up: revDiff ? Number(revDiff) >= 0 : null,
                border: 'border-l-blue-600',
              },
              {
                label: '今月の純利益',
                val: yen(latestProfit),
                sub: `利益率 ${profitMargin}%`,
                badge: `¥${Math.round(latestProfit).toLocaleString()}`,
                up: latestProfit >= 0,
                border: 'border-l-green-500',
              },
              {
                label: '平均月次利益',
                val: yen(avgProfit),
                sub: `直近${months}ヶ月`,
                badge: '安定推移',
                up: null,
                border: 'border-l-indigo-500',
              },
              {
                label: '今月の経費率',
                val: `${expenseRatio}%`,
                sub: '目標 50%未満',
                badge: Number(expenseRatio) < 50 ? '目標達成' : '目標超過',
                up: Number(expenseRatio) < 50,
                border: 'border-l-amber-400',
              },
            ].map((c, i) => (
              <div key={i} className={cn(
                'bg-white border border-[#e2e6ec] border-l-4 rounded-lg p-4 shadow-sm',
                c.border
              )}>
                <div className="text-[11px] font-semibold text-[#8f9db0] uppercase tracking-wide mb-1">{c.label}</div>
                <div className="text-[20px] font-bold text-[#1a2332]">{c.val}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-[#8f9db0]">{c.sub}</span>
                  <span className={cn(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                    c.up === true  ? 'bg-green-50 text-green-700' :
                    c.up === false ? 'bg-red-50 text-red-600' :
                                     'bg-slate-100 text-slate-500'
                  )}>{c.badge}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-[1fr_320px] gap-5 mb-5">
          {/* 損益推移 */}
          <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e2e6ec]">
              <div>
                <div className="text-[13px] font-bold text-[#1a2332]">損益推移</div>
                <div className="text-[11px] text-[#8f9db0] mt-0.5">売上・経費・利益（月次）</div>
              </div>
              <div className="flex gap-4 text-[11px] text-[#5a6a7e] font-medium">
                <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-blue-200 inline-block border border-blue-400" />売上</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-red-100 inline-block border border-red-300" />経費</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-green-600 inline-block rounded" />利益</span>
              </div>
            </div>
            <div className="px-2 pt-4 pb-3">
              {loading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={plData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f3f6" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8f9db0' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#8f9db0' }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={((v: any) => [`¥${Number(v).toLocaleString()}`, '']) as any}
                      contentStyle={{ fontSize: 12, border: '1px solid #e2e6ec', borderRadius: 6 }}
                      labelStyle={{ fontWeight: 600, color: '#1a2332' }}
                    />
                    <Bar dataKey="revenue" name="売上" fill="#bfdbfe" radius={[2, 2, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="expense" name="経費" fill="#fecaca" radius={[2, 2, 0, 0]} maxBarSize={32} />
                    <Line type="monotone" dataKey="profit" name="利益" stroke="#16a34a" strokeWidth={2} dot={{ r: 3, fill: '#16a34a' }} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* 経費内訳 */}
          <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#e2e6ec]">
              <div className="text-[13px] font-bold text-[#1a2332]">経費内訳（対象期間）</div>
              <div className="text-[11px] text-[#8f9db0] mt-0.5">勘定科目別（承認済み経費）</div>
            </div>
            <div className="flex flex-col items-center pt-3 pb-1">
              {loading ? (
                <div className="py-4 w-full px-4 space-y-2">
                  <Skeleton className="h-[150px] w-full" />
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
                </div>
              ) : breakdown.length === 0 ? (
                <div className="py-10 text-[12px] text-[#8f9db0] text-center">
                  承認済み経費データがありません
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie
                        data={breakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={2}
                        dataKey="amount"
                        nameKey="category"
                      >
                        {breakdown.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={((v: any) => [`¥${Number(v).toLocaleString()}`, '']) as any}
                        contentStyle={{ fontSize: 11, border: '1px solid #e2e6ec', borderRadius: 6 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-full px-4 pb-3 space-y-1.5">
                    {breakdown.map(e => (
                      <div key={e.category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
                          <span className="text-[11px] text-[#5a6a7e] truncate max-w-[110px]">{e.category}</span>
                        </div>
                        <span className="text-[11px] font-semibold text-[#1a2332] font-mono">¥{e.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* キャッシュフロー */}
        <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden mb-5">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e2e6ec]">
            <div>
              <div className="text-[13px] font-bold text-[#1a2332]">キャッシュフロー推移</div>
              <div className="text-[11px] text-[#8f9db0] mt-0.5">入金 vs 出金（銀行取引データ）</div>
            </div>
            <div className="flex gap-4 text-[11px] text-[#5a6a7e] font-medium">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-600 inline-block rounded" />入金</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-red-400 inline-block rounded" />出金</span>
            </div>
          </div>
          <div className="px-2 pt-4 pb-3">
            {loading ? (
              <Skeleton className="h-[160px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={cashData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f3f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8f9db0' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#8f9db0' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={((v: any) => [`¥${Number(v).toLocaleString()}`, '']) as any}
                    contentStyle={{ fontSize: 12, border: '1px solid #e2e6ec', borderRadius: 6 }}
                    labelStyle={{ fontWeight: 600, color: '#1a2332' }}
                  />
                  <Line type="monotone" dataKey="in"  name="入金" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="out" name="出金" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 月次損益サマリーテーブル */}
        <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#e2e6ec]">
            <div className="text-[13px] font-bold text-[#1a2332]">月次損益サマリー</div>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: months }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-[#e2e6ec]">
                  {['月', '売上（入金）', '経費（出金）', '利益', '利益率'].map(h => (
                    <th key={h} className={cn(
                      'px-5 py-2.5 text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.5px]',
                      h === '月' ? 'text-left' : 'text-right'
                    )}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...monthly].reverse().map((row, i) => {
                  const margin = row.income > 0 ? (row.profit / row.income * 100).toFixed(1) : '0'
                  return (
                    <tr key={row.month} className={cn('border-b border-[#e2e6ec] last:border-0', i === 0 && 'bg-blue-50')}>
                      <td className="px-5 py-3 text-[13px] font-semibold text-[#1a2332]">
                        {row.label}
                        {i === 0 && <span className="ml-1 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">今月</span>}
                      </td>
                      <td className="px-5 py-3 text-right text-[13px] font-semibold text-[#1a2332] font-mono">¥{row.income.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right text-[13px] text-red-500 font-mono">▲¥{row.expense.toLocaleString()}</td>
                      <td className={cn('px-5 py-3 text-right text-[13px] font-bold font-mono', row.profit >= 0 ? 'text-green-700' : 'text-red-600')}>
                        {row.profit >= 0 ? '¥' : '▲¥'}{Math.abs(row.profit).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right text-[13px] text-[#5a6a7e]">{margin}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
