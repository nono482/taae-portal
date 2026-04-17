'use client'

import { useState, useCallback, useEffect, useTransition } from 'react'
import { parseCSV, SAMPLE_CSV_GMO, type ParsedTransaction } from '@/lib/csvParser'
import { getBankTransactions, saveBankTransactions } from '@/app/actions/banking'
import { cn } from '@/lib/utils'

function formatYen(n: number) { return `¥${n.toLocaleString('ja-JP')}` }

interface DbTransaction {
  id: string; transaction_date: string; description: string
  amount: number; direction: string; balance_after: number | null
}

export default function BankingPage() {
  const [dragging, setDragging]     = useState(false)
  const [parsed, setParsed]         = useState<ReturnType<typeof parseCSV> | null>(null)
  const [fileName, setFileName]     = useState('')
  const [filterDir, setFilterDir]   = useState<'all'|'in'|'out'>('all')
  const [dbTx, setDbTx]             = useState<DbTransaction[]>([])
  const [dbFilter, setDbFilter]     = useState<'all'|'in'|'out'>('all')
  const [loadingDb, setLoadingDb]   = useState(true)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getBankTransactions(6).then(r => { setDbTx(r.data as DbTransaction[]); setLoadingDb(false) })
  }, [])

  function processText(text: string, name: string) {
    setParsed(parseCSV(text))
    setFileName(name)
    setImportResult(null)
    setFilterDir('all')
  }
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = e => processText(e.target?.result as string, file.name)
    reader.readAsText(file, 'utf-8')
  }, [])
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]; if (file) handleFile(file)
  }, [handleFile])
  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) handleFile(file)
  }

  function handleImport() {
    if (!parsed) return
    const lastTx = parsed.transactions.find(t => t.balance !== null && t.balance !== undefined)
    startTransition(async () => {
      const res = await saveBankTransactions(
        parsed.transactions as ParsedTransaction[],
        parsed.bankName,
        lastTx?.balance ?? undefined,
      )
      if ('error' in res) { alert(`インポートエラー: ${res.error}`); return }
      setImportResult({ imported: res.imported!, skipped: res.skipped! })
      const updated = await getBankTransactions(6)
      setDbTx(updated.data as DbTransaction[])
    })
  }

  const filtered     = parsed ? (filterDir === 'all' ? parsed.transactions : parsed.transactions.filter(t => t.direction === filterDir)) : []
  const filteredDb   = dbFilter === 'all' ? dbTx : dbTx.filter(t => t.direction === dbFilter)
  const totalIn      = parsed?.transactions.filter(t => t.direction === 'in').reduce((s, t) => s + t.amount, 0) ?? 0
  const totalOut     = parsed?.transactions.filter(t => t.direction === 'out').reduce((s, t) => s + t.amount, 0) ?? 0
  const dbTotalIn    = dbTx.filter(t => t.direction === 'in').reduce((s, t) => s + t.amount, 0)
  const dbTotalOut   = dbTx.filter(t => t.direction === 'out').reduce((s, t) => s + t.amount, 0)

  return (
    <div>
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center justify-between sticky top-0 z-40">
        <h1 className="text-[16px] font-bold text-[#1a2332]">銀行・入出金</h1>
        {parsed && !importResult && (
          <button onClick={handleImport} disabled={isPending}
            className="px-4 py-2 text-[13px] font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] disabled:opacity-50 rounded-lg transition-colors">
            {isPending ? 'インポート中…' : `${parsed.transactions.length}件をDBに保存`}
          </button>
        )}
        {importResult && (
          <span className="text-[13px] font-semibold text-green-700 bg-green-50 border border-green-200 px-4 py-2 rounded-lg">
            インポート完了 — 新規 {importResult.imported}件 / 重複スキップ {importResult.skipped}件
          </span>
        )}
      </div>

      <div className="p-8">
        {!parsed ? (
          <>
            {/* DB残高サマリー */}
            {!loadingDb && dbTx.length > 0 && (
              <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                  { label: '取引件数', val: `${dbTx.length}件`, sub: '過去6ヶ月', color: 'text-[#1a2332]', border: 'border-l-blue-600' },
                  { label: '入金合計', val: formatYen(dbTotalIn),  sub: `${dbTx.filter(t=>t.direction==='in').length}件`,  color: 'text-green-600', border: 'border-l-green-500' },
                  { label: '出金合計', val: formatYen(dbTotalOut), sub: `${dbTx.filter(t=>t.direction==='out').length}件`, color: 'text-red-500',   border: 'border-l-red-400'   },
                ].map(c => (
                  <div key={c.label} className={cn('bg-white border border-[#e2e6ec] border-l-4 rounded-lg p-4 shadow-sm', c.border)}>
                    <div className="text-[11px] font-semibold text-[#8f9db0] uppercase tracking-wide mb-1">{c.label}</div>
                    <div className={cn('text-[20px] font-bold', c.color)}>{c.val}</div>
                    <div className="text-[11px] text-[#8f9db0] mt-1">{c.sub}</div>
                  </div>
                ))}
              </div>
            )}

            {/* アップロードエリア */}
            <div className="max-w-2xl mx-auto mb-8">
              <div className="text-center mb-6">
                <div className="text-[15px] font-bold text-[#1a2332] mb-1">銀行CSVをインポート</div>
                <div className="text-[13px] text-[#8f9db0]">GMOあおぞら・三菱UFJ・三井住友・みずほ・PayPay銀行に対応</div>
              </div>
              <div onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={onDrop}
                className={cn('border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer',
                  dragging ? 'border-blue-400 bg-blue-50' : 'border-[#cdd3dc] bg-white hover:border-blue-300 hover:bg-slate-50')}
                onClick={() => document.getElementById('csv-input')?.click()}>
                <input id="csv-input" type="file" accept=".csv,.txt" className="hidden" onChange={onFileInput} />
                <div className="text-[32px] mb-3">📂</div>
                <div className="text-[14px] font-semibold text-[#1a2332] mb-1">CSVファイルをドロップ、またはクリックして選択</div>
                <div className="text-[12px] text-[#8f9db0]">.csv / .txt ファイルに対応</div>
              </div>
              <div className="mt-4 text-center">
                <button onClick={() => processText(SAMPLE_CSV_GMO, 'sample_gmo_aozora.csv')}
                  className="text-[13px] font-semibold text-blue-600 hover:underline">
                  サンプルデータ（GMOあおぞら）で試す
                </button>
              </div>
            </div>

            {/* 取引履歴テーブル */}
            {!loadingDb && dbTx.length > 0 && (
              <>
                <div className="flex items-center gap-1 mb-4 border-b border-[#e2e6ec]">
                  {(['all','in','out'] as const).map(f => {
                    const labels = { all:'すべて', in:'入金のみ', out:'出金のみ' }
                    const counts = { all:dbTx.length, in:dbTx.filter(t=>t.direction==='in').length, out:dbTx.filter(t=>t.direction==='out').length }
                    return (
                      <button key={f} onClick={() => setDbFilter(f)}
                        className={cn('px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors -mb-px',
                          dbFilter === f ? 'border-blue-600 text-blue-600' : 'border-transparent text-[#5a6a7e] hover:text-[#1a2332]')}>
                        {labels[f]}
                        <span className={cn('ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                          dbFilter === f ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-[#8f9db0]')}>{counts[f]}</span>
                      </button>
                    )
                  })}
                </div>
                <TxTable transactions={filteredDb.map(t => ({ date: t.transaction_date, description: t.description, amount: t.amount, direction: t.direction as 'in'|'out', balance: t.balance_after ?? null }))} />
              </>
            )}
            {!loadingDb && dbTx.length === 0 && (
              <div className="text-center py-8 text-[13px] text-[#8f9db0]">取引データがありません。CSVをインポートしてください。</div>
            )}
          </>
        ) : (
          <>
            {/* インポートプレビュー */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: '銀行名',   val: parsed.bankName,                           sub: fileName,                    color: 'text-[#1a2332]', border: 'border-l-blue-600'  },
                { label: '取引件数', val: `${parsed.transactions.length}件`,          sub: `エラー ${parsed.errors.length}件`, color: 'text-blue-600',  border: 'border-l-blue-600'  },
                { label: '入金合計', val: formatYen(totalIn),                         sub: `${parsed.transactions.filter(t=>t.direction==='in').length}件`,  color: 'text-green-600', border: 'border-l-green-500' },
                { label: '出金合計', val: formatYen(totalOut),                        sub: `${parsed.transactions.filter(t=>t.direction==='out').length}件`, color: 'text-red-500',   border: 'border-l-red-400'   },
              ].map(c => (
                <div key={c.label} className={cn('bg-white border border-[#e2e6ec] border-l-4 rounded-lg p-4 shadow-sm', c.border)}>
                  <div className="text-[11px] font-semibold text-[#8f9db0] uppercase tracking-wide mb-1">{c.label}</div>
                  <div className={cn('text-[20px] font-bold', c.color)}>{c.val}</div>
                  <div className="text-[11px] text-[#8f9db0] mt-1">{c.sub}</div>
                </div>
              ))}
            </div>
            {parsed.errors.length > 0 && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700">
                {parsed.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1 border-b border-[#e2e6ec]">
                {(['all','in','out'] as const).map(f => {
                  const labels = { all:'すべて', in:'入金のみ', out:'出金のみ' }
                  const counts = { all:parsed.transactions.length, in:parsed.transactions.filter(t=>t.direction==='in').length, out:parsed.transactions.filter(t=>t.direction==='out').length }
                  return (
                    <button key={f} onClick={() => setFilterDir(f)}
                      className={cn('px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors -mb-px',
                        filterDir === f ? 'border-blue-600 text-blue-600' : 'border-transparent text-[#5a6a7e] hover:text-[#1a2332]')}>
                      {labels[f]}
                      <span className={cn('ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                        filterDir === f ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-[#8f9db0]')}>{counts[f]}</span>
                    </button>
                  )
                })}
              </div>
              <button onClick={() => { setParsed(null); setFileName(''); setImportResult(null) }}
                className="text-[12px] font-semibold text-[#5a6a7e] hover:text-[#1a2332] border border-[#e2e6ec] px-3 py-1.5 rounded-lg hover:bg-slate-50">
                別のファイルを選択
              </button>
            </div>
            <TxTable transactions={filtered} />
          </>
        )}
      </div>
    </div>
  )
}

function TxTable({ transactions }: { transactions: Array<{ date: string; description: string; amount: number; direction: 'in'|'out'; balance: number | null }> }) {
  return (
    <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50 border-b border-[#e2e6ec]">
            {['取引日','摘要','区分','金額','残高'].map(h => (
              <th key={h} className="px-5 py-2.5 text-left text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.5px]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx, i) => (
            <tr key={i} className="border-b border-[#e2e6ec] last:border-0 hover:bg-slate-50 transition-colors">
              <td className="px-5 py-3 text-[13px] text-[#5a6a7e] whitespace-nowrap font-mono">{tx.date}</td>
              <td className="px-5 py-3 text-[13px] font-semibold text-[#1a2332]">{tx.description}</td>
              <td className="px-5 py-3">
                <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full',
                  tx.direction === 'in' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', tx.direction === 'in' ? 'bg-green-500' : 'bg-red-500')} />
                  {tx.direction === 'in' ? '入金' : '出金'}
                </span>
              </td>
              <td className={cn('px-5 py-3 text-[14px] font-bold font-mono text-right',
                tx.direction === 'in' ? 'text-green-700' : 'text-red-600')}>
                {tx.direction === 'in' ? '+' : '−'}¥{tx.amount.toLocaleString()}
              </td>
              <td className="px-5 py-3 text-[13px] text-[#5a6a7e] font-mono text-right">
                {tx.balance !== null ? `¥${tx.balance.toLocaleString()}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {transactions.length === 0 && (
        <div className="py-12 text-center text-[13px] text-[#8f9db0]">該当する取引データがありません</div>
      )}
    </div>
  )
}
