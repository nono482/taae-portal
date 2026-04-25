'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import { getMonthlyReportData, type MonthlyData, type ExpenseBreakdown } from '@/app/actions/reports'

type Period = '6month' | '3month' | '1month'

interface ReportState {
  monthly:   MonthlyData[]
  breakdown: ExpenseBreakdown[]
  totals:    { income: number; expense: number; profit: number; avgProfit: number }
  hasData:   boolean
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}
function yen(n: number) { return `¥${Math.round(n).toLocaleString('ja-JP')}` }
function pctDiff(a: number, b: number): string | null {
  if (b === 0) return null
  const p = ((a - b) / b * 100).toFixed(1)
  return Number(p) >= 0 ? `+${p}%` : `${p}%`
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-slate-100', className)} />
}

// ─── 空状態 ────────────────────────────────────────────────
function EmptyState({ months }: { months: number }) {
  return (
    <div className="py-24 text-center">
      <div className="text-[48px] mb-4">📊</div>
      <div className="text-[16px] font-bold text-[#1a2332] mb-2">対象データがありません</div>
      <div className="text-[13px] text-[#8f9db0] max-w-md mx-auto leading-relaxed">
        直近{months}ヶ月の経費データまたは銀行取引データが登録されていません。
        経費を申請するか、銀行取引データを取り込むとグラフが表示されます。
      </div>
    </div>
  )
}

// ─── カスタム Tooltip ─────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-lg p-3 text-[12px]">
      <div className="font-bold text-[#1a2332] mb-1.5">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[#5a6a7e]">{p.name}:</span>
          <span className="font-semibold text-[#1a2332]">¥{Number(p.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

// ─── PAGE ────────────────────────────────────────────────
export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('6month')
  const [report, setReport] = useState<ReportState | null>(null)
  const [loading, setLoading] = useState(true)

  const months = period === '1month' ? 1 : period === '3month' ? 3 : 6

  useEffect(() => {
    setLoading(true)
    setReport(null)
    getMonthlyReportData(months).then(result => {
      setReport(result)
      setLoading(false)
    })
  }, [months])

  // チャートデータ
  const plData   = (report?.monthly ?? []).map(m => ({
    month:   m.label,
    expense: m.expense,
    income:  m.income,
    profit:  m.profit,
  }))
  const breakdown = report?.breakdown ?? []
  const monthly   = report?.monthly ?? []
  const hasData   = report?.hasData ?? false

  // KPI
  const latestExpense = monthly[monthly.length - 1]?.expense  ?? 0
  const prevExpense   = monthly[monthly.length - 2]?.expense  ?? 0
  const latestIncome  = monthly[monthly.length - 1]?.income   ?? 0
  const latestProfit  = monthly[monthly.length - 1]?.profit   ?? 0
  const avgProfit     = report?.totals.avgProfit ?? 0
  const totalExpense  = report?.totals.expense ?? 0
  const profitMargin  = latestIncome > 0 ? (latestProfit / latestIncome * 100).toFixed(1) : null
  const expDiff       = pctDiff(latestExpense, prevExpense)

  return (
    <div>
      {/* Topbar */}
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center justify-between sticky top-0 z-40">
        <h1 className="text-[16px] font-bold text-[#1a2332]">財務レポート</h1>
        <div className="flex items-center gap-3">
          <div className="text-[11px] text-[#8f9db0]">データソース: expenses テーブル（リアルタイム集計）</div>
          <div className="flex border border-[#e2e6ec] rounded-lg overflow-hidden text-[12px] font-semibold">
            {([['6month','直近6ヶ月'],['3month','直近3ヶ月'],['1month','今月']] as [Period, string][]).map(([k, l]) => (
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
        {/* データなし */}
        {!loading && !hasData && <EmptyState months={months} />}

        {/* KPI */}
        {(loading || hasData) && (
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
                  label: '今月の経費合計',
                  val: yen(latestExpense),
                  sub: expDiff ? `前月比 ${expDiff}` : '前月データなし',
                  badge: expDiff ?? '—',
                  up: expDiff ? Number(expDiff) <= 0 : null,
                  border: 'border-l-red-400',
                },
                {
                  label: '期間合計経費',
                  val: yen(totalExpense),
                  sub: `直近${months}ヶ月`,
                  badge: `${monthly.length}ヶ月分`,
                  up: null,
                  border: 'border-l-amber-400',
                },
                {
                  label: '月平均利益',
                  val: yen(Math.abs(avgProfit)),
                  sub: latestIncome > 0 ? `銀行データあり` : '銀行データなし',
                  badge: avgProfit >= 0 ? '黒字' : '赤字',
                  up: avgProfit >= 0,
                  border: 'border-l-green-500',
                },
                {
                  label: '今月の利益率',
                  val: profitMargin ? `${profitMargin}%` : '—',
                  sub: profitMargin ? `（売上 ${yen(latestIncome)}）` : '銀行入金データなし',
                  badge: profitMargin ? (Number(profitMargin) >= 0 ? '黒字' : '赤字') : '—',
                  up: profitMargin ? Number(profitMargin) >= 0 : null,
                  border: 'border-l-blue-600',
                },
              ].map((c, i) => (
                <div key={i} className={cn('bg-white border border-[#e2e6ec] border-l-4 rounded-lg p-4 shadow-sm', c.border)}>
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
        )}

        {hasData && (
          <>
            {/* 月次経費推移 + カテゴリ内訳 */}
            <div className="grid grid-cols-[1fr_300px] gap-5 mb-5">
              {/* 経費推移バーチャート */}
              <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e2e6ec]">
                  <div>
                    <div className="text-[13px] font-bold text-[#1a2332]">月次経費推移</div>
                    <div className="text-[11px] text-[#8f9db0] mt-0.5">
                      expenses テーブルの全申請経費（月別集計）
                    </div>
                  </div>
                  <div className="flex gap-4 text-[11px] text-[#5a6a7e] font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-2 rounded-sm bg-red-200 inline-block border border-red-400" />経費
                    </span>
                    {monthly.some(m => m.income > 0) && (
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-2 rounded-sm bg-blue-200 inline-block border border-blue-400" />入金
                      </span>
                    )}
                  </div>
                </div>
                <div className="px-2 pt-4 pb-3">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={plData} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f3f6" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8f9db0' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#8f9db0' }} axisLine={false} tickLine={false} width={44} />
                      <Tooltip content={<CustomTooltip />} />
                      {monthly.some(m => m.income > 0) && (
                        <Bar dataKey="income" name="入金（銀行）" fill="#bfdbfe" radius={[2, 2, 0, 0]} maxBarSize={28} />
                      )}
                      <Bar dataKey="expense" name="経費" fill="#fca5a5" radius={[2, 2, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* カテゴリ別円グラフ */}
              <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#e2e6ec]">
                  <div className="text-[13px] font-bold text-[#1a2332]">カテゴリ別内訳</div>
                  <div className="text-[11px] text-[#8f9db0] mt-0.5">承認済み経費（勘定科目別）</div>
                </div>
                {breakdown.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="text-[12px] text-[#8f9db0]">承認済み経費データがありません</div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center pt-2 pb-2">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={breakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={42}
                          outerRadius={68}
                          paddingAngle={2}
                          dataKey="amount"
                          nameKey="category"
                        >
                          {breakdown.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: any) => [`¥${Number(v).toLocaleString()}`, '']}
                          contentStyle={{ fontSize: 11, border: '1px solid #e2e6ec', borderRadius: 6 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="w-full px-4 pb-3 space-y-1.5">
                      {breakdown.map(e => (
                        <div key={e.category} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
                            <span className="text-[11px] text-[#5a6a7e] truncate max-w-[100px]">{e.category}</span>
                            <span className="text-[10px] text-[#8f9db0]">{e.pct}%</span>
                          </div>
                          <span className="text-[11px] font-semibold text-[#1a2332] font-mono">
                            ¥{e.amount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 利益推移ラインチャート（銀行データがある場合のみ） */}
            {monthly.some(m => m.income > 0) && (
              <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden mb-5">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e2e6ec]">
                  <div>
                    <div className="text-[13px] font-bold text-[#1a2332]">損益推移</div>
                    <div className="text-[11px] text-[#8f9db0] mt-0.5">入金（銀行） vs 経費（申請）vs 純利益</div>
                  </div>
                  <div className="flex gap-4 text-[11px] text-[#5a6a7e] font-medium">
                    <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-blue-500 inline-block rounded" />入金</span>
                    <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-red-400 inline-block rounded" />経費</span>
                    <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-green-600 inline-block rounded" />利益</span>
                  </div>
                </div>
                <div className="px-2 pt-4 pb-3">
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={plData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f3f6" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8f9db0' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#8f9db0' }} axisLine={false} tickLine={false} width={44} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="income"  name="入金（銀行）" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="expense" name="経費"         stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 3" />
                      <Line type="monotone" dataKey="profit"  name="純利益"       stroke="#16a34a" strokeWidth={2.5} dot={{ r: 4, fill: '#16a34a' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 月次サマリーテーブル */}
            <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e2e6ec]">
                <div className="text-[13px] font-bold text-[#1a2332]">月次経費サマリー</div>
                <div className="text-[11px] text-[#8f9db0]">全ステータス合計（承認済み含む）</div>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#e2e6ec]">
                    {['月', '経費合計', '承認済み', '未承認', '件数', ...(monthly.some(m => m.income > 0) ? ['入金（銀行）', '利益'] : [])].map(h => (
                      <th key={h} className={cn(
                        'px-5 py-2.5 text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.5px]',
                        h === '月' ? 'text-left' : 'text-right'
                      )}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...monthly].reverse().map((row, i) => {
                    const isLatest = i === 0
                    return (
                      <tr key={row.month} className={cn(
                        'border-b border-[#e2e6ec] last:border-0 transition-colors',
                        isLatest ? 'bg-blue-50' : 'hover:bg-slate-50'
                      )}>
                        <td className="px-5 py-3 text-[13px] font-semibold text-[#1a2332]">
                          {row.label}
                          {isLatest && (
                            <span className="ml-1.5 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">今月</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right text-[13px] font-bold text-red-600 font-mono">
                          ¥{row.expense.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right text-[12px] text-green-700 font-mono">
                          {/* 承認済みはbreakdownから逆算 */}
                          —
                        </td>
                        <td className="px-5 py-3 text-right text-[12px] text-amber-600 font-mono">—</td>
                        <td className="px-5 py-3 text-right text-[12px] text-[#8f9db0]">—</td>
                        {monthly.some(m => m.income > 0) && (
                          <>
                            <td className="px-5 py-3 text-right text-[13px] text-blue-600 font-mono">
                              ¥{row.income.toLocaleString()}
                            </td>
                            <td className={cn(
                              'px-5 py-3 text-right text-[13px] font-bold font-mono',
                              row.profit >= 0 ? 'text-green-700' : 'text-red-600'
                            )}>
                              {row.profit >= 0 ? '' : '▲'}¥{Math.abs(row.profit).toLocaleString()}
                            </td>
                          </>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
