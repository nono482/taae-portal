'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  getExportPreview, exportExpensesCSV, exportBankTransactionsCSV,
  type ExportFormat, type ExportStatus,
} from '@/app/actions/export'

type DataType = 'expenses' | 'bank'

const FORMAT_INFO: Record<ExportFormat, {
  name: string; color: string; border: string; tag: string; desc: string
}> = {
  mf:    { name: 'マネーフォワード', color: 'text-blue-700',   border: 'border-blue-300',   tag: 'bg-blue-50 text-blue-700',    desc: '仕訳インポート形式（借方/貸方/税区分対応）' },
  freee: { name: 'freee会計',        color: 'text-green-700',  border: 'border-green-300',  tag: 'bg-green-50 text-green-700',  desc: '取引インポート形式（借方/貸方/税区分対応）' },
  yayoi: { name: '弥生会計',         color: 'text-orange-700', border: 'border-orange-300', tag: 'bg-orange-50 text-orange-700', desc: '仕訳日記帳インポート形式' },
}

const DATA_TYPE_INFO: Record<DataType, { label: string; sub: string }> = {
  expenses: { label: '経費データ',     sub: 'expenses テーブルから抽出（勘定科目・税区分付き）' },
  bank:     { label: '銀行取引データ', sub: 'bank_transactions テーブルから抽出' },
}

const STATUS_OPTIONS: { value: ExportStatus; label: string; sub: string }[] = [
  { value: 'approved', label: '承認済みのみ',   sub: '会計確定済み経費のみを出力（推奨）' },
  { value: 'all',      label: 'すべてのステータス', sub: '未承認・却下を含むすべての経費を出力' },
]

function formatYen(n: number) {
  return `¥${n.toLocaleString('ja-JP')}`
}

function downloadCSV(csv: string, filename: string) {
  // UTF-8 BOM付きで出力（日本語会計ソフトのExcel対応）
  const bom = '﻿'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ExportPage() {
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [format, setFormat]         = useState<ExportFormat>('mf')
  const [dataType, setDataType]     = useState<DataType>('expenses')
  const [period, setPeriod]         = useState(defaultMonth)
  const [status, setStatus]         = useState<ExportStatus>('approved')
  const [preview, setPreview]       = useState<{ count: number; totalAmount: number } | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [isPending, startTransition] = useTransition()

  // 期間・ステータス変更のたびにプレビュー更新
  const refreshPreview = useCallback(() => {
    if (!period) return
    setLoadingPreview(true)
    setPreview(null)
    getExportPreview(period, dataType === 'bank' ? 'all' : status).then(p => {
      setPreview(p)
      setLoadingPreview(false)
    })
  }, [period, status, dataType])

  useEffect(() => {
    refreshPreview()
  }, [refreshPreview])

  function handleExport() {
    if (!period) { toast.error('対象期間を選択してください'); return }
    if (preview?.count === 0) { toast.error('対象データが0件です'); return }

    startTransition(async () => {
      try {
        let result: { csv: string; filename: string; count: number }

        if (dataType === 'bank') {
          result = await exportBankTransactionsCSV(period, format)
        } else {
          result = await exportExpensesCSV(period, status, format)
        }

        if (!result.csv) {
          toast.error('対象データがありません')
          return
        }

        downloadCSV(result.csv, result.filename)
        toast.success(`${result.count}件をエクスポートしました — ${result.filename}`)
      } catch (e) {
        toast.error('エクスポート中にエラーが発生しました')
        console.error(e)
      }
    })
  }

  const isExporting = isPending

  return (
    <div>
      {/* Topbar */}
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center sticky top-0 z-40">
        <h1 className="text-[16px] font-bold text-[#1a2332]">会計エクスポート</h1>
      </div>

      <div className="p-8 max-w-3xl">
        {/* エクスポート設定カード */}
        <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-[#e2e6ec]">
            <div className="text-[14px] font-bold text-[#1a2332]">CSVエクスポート設定</div>
            <div className="text-[12px] text-[#8f9db0] mt-0.5">
              SupabaseのデータをリアルタイムでCSV変換してダウンロードします
            </div>
          </div>

          <div className="px-6 py-5 space-y-7">
            {/* ─ 出力先会計ソフト */}
            <div>
              <div className="text-[12px] font-bold text-[#5a6a7e] uppercase tracking-wide mb-3">
                出力先会計ソフト
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(Object.entries(FORMAT_INFO) as [ExportFormat, typeof FORMAT_INFO[ExportFormat]][]).map(([key, info]) => (
                  <button
                    key={key}
                    onClick={() => setFormat(key)}
                    className={cn(
                      'border-2 rounded-lg p-4 text-left transition-all',
                      format === key
                        ? `${info.border} bg-slate-50 shadow-sm`
                        : 'border-[#e2e6ec] hover:border-slate-300'
                    )}
                  >
                    <div className={cn('text-[14px] font-bold mb-1', info.color)}>{info.name}</div>
                    <div className="text-[11px] text-[#8f9db0] leading-relaxed">{info.desc}</div>
                    {format === key && (
                      <div className={cn('mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block', info.tag)}>
                        選択中
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ─ データ種別 */}
            <div>
              <div className="text-[12px] font-bold text-[#5a6a7e] uppercase tracking-wide mb-3">
                出力データ種別
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(Object.entries(DATA_TYPE_INFO) as [DataType, typeof DATA_TYPE_INFO[DataType]][]).map(([key, info]) => (
                  <button
                    key={key}
                    onClick={() => setDataType(key)}
                    className={cn(
                      'border-2 rounded-lg p-4 text-left transition-all',
                      dataType === key
                        ? 'border-[#1e3a5f] bg-slate-50 shadow-sm'
                        : 'border-[#e2e6ec] hover:border-slate-300'
                    )}
                  >
                    <div className={cn('text-[13px] font-bold mb-1', dataType === key ? 'text-[#1e3a5f]' : 'text-[#1a2332]')}>
                      {info.label}
                    </div>
                    <div className="text-[11px] text-[#8f9db0]">{info.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* ─ 対象期間 */}
            <div>
              <div className="text-[12px] font-bold text-[#5a6a7e] uppercase tracking-wide mb-3">
                対象期間
              </div>
              <input
                type="month"
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="border border-[#e2e6ec] rounded-lg px-3 py-2 text-[13px] text-[#1a2332] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
              />
              <span className="ml-3 text-[12px] text-[#8f9db0]">
                {period.replace('-', '年')}月分
              </span>
            </div>

            {/* ─ ステータスフィルタ（経費データのみ） */}
            {dataType === 'expenses' && (
              <div>
                <div className="text-[12px] font-bold text-[#5a6a7e] uppercase tracking-wide mb-3">
                  ステータスフィルタ
                </div>
                <div className="space-y-2">
                  {STATUS_OPTIONS.map(opt => (
                    <label
                      key={opt.value}
                      className={cn(
                        'flex items-start gap-3 border rounded-lg px-4 py-3 cursor-pointer transition-colors',
                        status === opt.value
                          ? 'border-[#1e3a5f] bg-slate-50'
                          : 'border-[#e2e6ec] hover:bg-slate-50'
                      )}
                    >
                      <input
                        type="radio"
                        name="status"
                        value={opt.value}
                        checked={status === opt.value}
                        onChange={() => setStatus(opt.value)}
                        className="mt-0.5 accent-[#1e3a5f]"
                      />
                      <div>
                        <div className="text-[13px] font-semibold text-[#1a2332]">{opt.label}</div>
                        <div className="text-[11px] text-[#8f9db0] mt-0.5">{opt.sub}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ─ プレビュー */}
            <div className={cn(
              'rounded-lg border px-5 py-4',
              preview?.count === 0
                ? 'border-amber-200 bg-amber-50'
                : 'border-[#e2e6ec] bg-slate-50'
            )}>
              <div className="text-[11px] font-bold text-[#5a6a7e] uppercase tracking-wide mb-2">
                出力プレビュー
              </div>
              {loadingPreview ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[13px] text-[#8f9db0]">集計中…</span>
                </div>
              ) : preview ? (
                <div className="flex items-baseline gap-6">
                  <div>
                    <span className="text-[24px] font-bold text-[#1a2332]">{preview.count}</span>
                    <span className="text-[13px] text-[#5a6a7e] ml-1">件</span>
                  </div>
                  {preview.count > 0 && (
                    <div>
                      <span className="text-[16px] font-bold text-[#1a2332]">
                        {formatYen(preview.totalAmount)}
                      </span>
                      <span className="text-[12px] text-[#8f9db0] ml-1">合計</span>
                    </div>
                  )}
                  {preview.count === 0 && (
                    <span className="text-[13px] text-amber-700 font-semibold">
                      対象データがありません
                    </span>
                  )}
                </div>
              ) : null}
            </div>

            {/* ─ 実行ボタン */}
            <div className="flex items-center gap-4 pt-1">
              <button
                onClick={handleExport}
                disabled={isExporting || preview?.count === 0 || loadingPreview}
                className={cn(
                  'px-6 py-3 text-[14px] font-bold rounded-lg transition-all shadow-sm flex items-center gap-2',
                  isExporting || preview?.count === 0 || loadingPreview
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-[#1e3a5f] hover:bg-[#16304f] text-white'
                )}
              >
                {isExporting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin inline-block" />
                    生成中…
                  </>
                ) : (
                  <>
                    ↓ CSVをダウンロード
                  </>
                )}
              </button>
              <span className="text-[12px] text-[#8f9db0]">
                UTF-8 BOM付き / {FORMAT_INFO[format].name}形式
              </span>
            </div>
          </div>
        </div>

        {/* 出力項目の説明 */}
        <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-[#e2e6ec]">
            <div className="text-[14px] font-bold text-[#1a2332]">出力フォーマット仕様</div>
          </div>
          <div className="px-6 py-4 space-y-4">
            {([
              {
                format: 'mf' as const,
                fields: ['取引日', '借方勘定科目（カテゴリ）', '借方税区分', '借方金額（税込）', '借方税額', '貸方（未払金）', '摘要（支払先）', 'メモ', '作成日時'],
              },
              {
                format: 'freee' as const,
                fields: ['取引日', '借方勘定科目（カテゴリ）', '借方税区分', '借方金額(税込)', '借方税額', '貸方（未払金）', '摘要（支払先）', '備考（メモ）'],
              },
              {
                format: 'yayoi' as const,
                fields: ['伝票No.', '取引日付', '借方勘定科目（カテゴリ）', '借方税区分', '借方金額', '借方消費税額', '貸方（未払金）', '摘要（支払先）'],
              },
            ]).map(item => (
              <div key={item.format}
                className={cn(
                  'rounded-lg p-4',
                  format === item.format ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 border border-[#e2e6ec]'
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', FORMAT_INFO[item.format].tag)}>
                    {FORMAT_INFO[item.format].name}
                  </span>
                  {format === item.format && (
                    <span className="text-[10px] text-blue-600 font-bold">現在選択中</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {item.fields.map((f, i) => (
                    <span key={i} className="text-[11px] text-[#5a6a7e]">
                      {i > 0 && <span className="text-[#c0c8d8] mr-1">·</span>}
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 注意事項 */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4 text-[12px] text-amber-800 space-y-1.5">
          <div className="font-bold text-[13px]">エクスポート前の確認事項</div>
          <ul className="space-y-1 list-disc list-inside text-amber-700">
            <li>出力CSVはUTF-8 BOM付きです。弥生会計でShift-JISが必要な場合はExcelで変換してください。</li>
            <li>貸方勘定科目は「未払金」で固定出力されます。実態に合わせて変更してください。</li>
            <li>税区分はカテゴリのtax_type設定に基づきます。未設定カテゴリは「課税仕入10%」です。</li>
            <li>インポート前に会計担当者によるデータ確認を推奨します。</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
