'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

type Format = 'mf' | 'freee' | 'yayoi'
type DataType = 'expenses' | 'payroll' | 'bank' | 'pl'

interface ExportJob {
  id: string
  label: string
  format: Format
  data_type: DataType
  period: string
  record_count: number
  created_at: string
  status: 'done' | 'processing'
  file_name: string
}

const FORMAT_INFO: Record<Format, { name: string; color: string; border: string; tag: string }> = {
  mf:     { name: 'マネーフォワード',  color: 'text-blue-700',   border: 'border-blue-200',   tag: 'bg-blue-50 text-blue-700'    },
  freee:  { name: 'freee会計',         color: 'text-green-700',  border: 'border-green-200',  tag: 'bg-green-50 text-green-700'  },
  yayoi:  { name: '弥生会計',          color: 'text-orange-700', border: 'border-orange-200', tag: 'bg-orange-50 text-orange-700' },
}

const DATA_TYPE_INFO: Record<DataType, string> = {
  expenses: '経費データ',
  payroll:  '給与データ',
  bank:     '銀行取引データ',
  pl:       '損益データ',
}

const HISTORY: ExportJob[] = [
  { id: 'e1', label: '4月 経費データ',       format: 'mf',    data_type: 'expenses', period: '2026年4月', record_count: 24, created_at: '2026-04-13 09:30', status: 'done',       file_name: '20260413_expenses_mf.csv'        },
  { id: 'e2', label: '4月 給与データ',       format: 'freee', data_type: 'payroll',  period: '2026年4月', record_count: 5,  created_at: '2026-04-12 18:00', status: 'done',       file_name: '20260412_payroll_freee.csv'       },
  { id: 'e3', label: '3月 銀行取引データ',   format: 'yayoi', data_type: 'bank',     period: '2026年3月', record_count: 48, created_at: '2026-04-01 10:15', status: 'done',       file_name: '20260401_bank_yayoi.csv'         },
  { id: 'e4', label: '3月 経費データ',       format: 'mf',    data_type: 'expenses', period: '2026年3月', record_count: 31, created_at: '2026-03-31 17:42', status: 'done',       file_name: '20260331_expenses_mf.csv'        },
]

export default function ExportPage() {
  const [selectedFormat, setSelectedFormat]  = useState<Format>('mf')
  const [selectedData, setSelectedData]      = useState<DataType>('expenses')
  const [selectedPeriod, setSelectedPeriod]  = useState('2026-04')
  const [isExporting, setIsExporting]        = useState(false)
  const [exportDone, setExportDone]          = useState(false)
  const [history, setHistory]                = useState<ExportJob[]>(HISTORY)

  function handleExport() {
    setIsExporting(true)
    setExportDone(false)
    setTimeout(() => {
      setIsExporting(false)
      setExportDone(true)
      const newJob: ExportJob = {
        id: `e${Date.now()}`,
        label: `${selectedPeriod.replace('-','年').replace(/(\d{2})$/,'$1月')} ${DATA_TYPE_INFO[selectedData]}`,
        format: selectedFormat,
        data_type: selectedData,
        period: selectedPeriod.replace('-','年') + '月',
        record_count: Math.floor(Math.random() * 30) + 5,
        created_at: new Date().toLocaleString('ja-JP').slice(0,16).replace('/','-').replace('/','-'),
        status: 'done',
        file_name: `${selectedPeriod.replace('-','')}_${selectedData}_${selectedFormat}.csv`,
      }
      setHistory(prev => [newJob, ...prev])
    }, 1500)
  }

  return (
    <div>
      {/* Topbar */}
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center sticky top-0 z-40">
        <h1 className="text-[16px] font-bold text-[#1a2332]">会計エクスポート</h1>
      </div>

      <div className="p-8 max-w-4xl">
        {/* 新規エクスポート */}
        <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden mb-7">
          <div className="px-6 py-4 border-b border-[#e2e6ec]">
            <div className="text-[14px] font-bold text-[#1a2332]">新規エクスポート</div>
            <div className="text-[12px] text-[#8f9db0] mt-0.5">外部会計ソフト用のCSVを生成します</div>
          </div>
          <div className="px-6 py-5 space-y-6">
            {/* 出力先 */}
            <div>
              <div className="text-[12px] font-bold text-[#5a6a7e] mb-3">出力先会計ソフト</div>
              <div className="grid grid-cols-3 gap-3">
                {(Object.entries(FORMAT_INFO) as [Format, typeof FORMAT_INFO[Format]][]).map(([key, info]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedFormat(key)}
                    className={cn(
                      'border-2 rounded-lg p-4 text-left transition-all',
                      selectedFormat === key
                        ? `${info.border} bg-slate-50`
                        : 'border-[#e2e6ec] hover:border-slate-300'
                    )}
                  >
                    <div className={cn('text-[14px] font-bold', info.color)}>{info.name}</div>
                    <div className="text-[11px] text-[#8f9db0] mt-1">
                      {key === 'mf' ? '仕訳インポート形式' : key === 'freee' ? '取引インポート形式' : 'CSV取込形式'}
                    </div>
                    {selectedFormat === key && (
                      <div className={cn('mt-2 text-[10px] font-bold px-2 py-0.5 rounded inline-block', info.tag)}>選択中</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* データ種別 */}
            <div>
              <div className="text-[12px] font-bold text-[#5a6a7e] mb-3">出力データ種別</div>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(DATA_TYPE_INFO) as [DataType, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedData(key)}
                    className={cn(
                      'px-4 py-2 text-[13px] font-semibold rounded-lg border transition-colors',
                      selectedData === key
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-[#e2e6ec] text-[#5a6a7e] hover:bg-slate-50'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 期間 */}
            <div>
              <div className="text-[12px] font-bold text-[#5a6a7e] mb-3">対象期間</div>
              <input
                type="month"
                value={selectedPeriod}
                onChange={e => setSelectedPeriod(e.target.value)}
                className="border border-[#e2e6ec] rounded-lg px-3 py-2 text-[13px] text-[#1a2332] focus:outline-none focus:border-blue-400"
              />
            </div>

            {/* 実行ボタン */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleExport}
                disabled={isExporting}
                className={cn(
                  'px-6 py-2.5 text-[13px] font-bold rounded-lg transition-all shadow-sm',
                  isExporting
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-[#1e3a5f] hover:bg-[#16304f] text-white'
                )}
              >
                {isExporting ? '生成中...' : 'CSVを生成してダウンロード'}
              </button>
              {exportDone && (
                <span className="text-[13px] font-semibold text-green-600">
                  ✓ ダウンロード完了
                </span>
              )}
            </div>

            {/* 注意事項 */}
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-[12px] text-amber-700">
              <strong className="font-bold">注意：</strong>
              エクスポートされたCSVファイルは会計ソフトの仕様に合わせてフォーマットされています。
              インポート前に会計担当者によるデータ確認を推奨します。
            </div>
          </div>
        </div>

        {/* エクスポート履歴 */}
        <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e2e6ec]">
            <div className="text-[14px] font-bold text-[#1a2332]">エクスポート履歴</div>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-[#e2e6ec]">
                {['内容','出力先','対象期間','件数','生成日時','ファイル名','操作'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.4px] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map(job => (
                <tr key={job.id} className="border-b border-[#e2e6ec] last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-[13px] font-semibold text-[#1a2332]">{job.label}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded', FORMAT_INFO[job.format].tag)}>
                      {FORMAT_INFO[job.format].name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[#5a6a7e]">{job.period}</td>
                  <td className="px-4 py-3 text-[13px] text-[#5a6a7e] font-mono">{job.record_count}件</td>
                  <td className="px-4 py-3 text-[12px] text-[#8f9db0] whitespace-nowrap">{job.created_at}</td>
                  <td className="px-4 py-3 text-[11px] text-[#8f9db0] font-mono">{job.file_name}</td>
                  <td className="px-4 py-3">
                    <button className="text-[11px] font-semibold text-blue-600 hover:underline">
                      再ダウンロード
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
