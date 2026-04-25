// インボイス制度経過措置に基づく仕入税額控除計算エンジン
// 根拠法令: 消費税法附則第52条・第53条（令和5年度税制改正）

export type InvoiceStatus =
  | 'registered'      // 適格請求書発行事業者（全額控除）
  | 'transitional_80' // 経過措置 80%控除（〜2026/9/30）
  | 'transitional_50' // 経過措置 50%控除（〜2029/9/30）
  | 'exempt'          // 控除不可（免税事業者・未登録）

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  registered:      '適格事業者（全額控除）',
  transitional_80: '免税事業者（80%控除対象）',
  transitional_50: '免税事業者（50%控除対象）',
  exempt:          '免税事業者（控除不可）',
}

export const INVOICE_STATUS_COLOR: Record<InvoiceStatus, string> = {
  registered:      'bg-green-50 text-green-700 border-green-200',
  transitional_80: 'bg-amber-50 text-amber-700 border-amber-200',
  transitional_50: 'bg-orange-50 text-orange-700 border-orange-200',
  exempt:          'bg-red-50 text-red-700 border-red-200',
}

// 経過措置の期限（翌日 = 以降は次のフェーズ）
const CUTOFF_80 = new Date('2026-10-01') // 2026/9/30 23:59まで80%
const CUTOFF_50 = new Date('2029-10-01') // 2029/9/30 23:59まで50%

export function getInvoiceStatus(isRegistered: boolean, date: Date = new Date()): InvoiceStatus {
  if (isRegistered) return 'registered'
  if (date < CUTOFF_80) return 'transitional_80'
  if (date < CUTOFF_50) return 'transitional_50'
  return 'exempt'
}

export function getDeductibleRate(status: InvoiceStatus): number {
  if (status === 'registered')      return 1.0
  if (status === 'transitional_80') return 0.8
  if (status === 'transitional_50') return 0.5
  return 0.0
}

export type TaxCalculation = {
  amountExcludingTax: number  // 税抜金額
  consumptionTax: number      // 消費税額
  deductibleTax: number       // 控除可能な仕入税額
  nonDeductibleTax: number    // 控除不可税額（費用計上分）
  amountIncludingTax: number  // 税込合計
  deductibleRate: number      // 控除率
  status: InvoiceStatus
  isMinorException: boolean   // 少額特例（税込1万円未満）
}

/**
 * インボイス制度経過措置を考慮した仕入税額控除計算
 *
 * @param amountIncludingTax  税込金額（仕入・経費の支払金額）
 * @param taxRate             消費税率（デフォルト 0.1 = 10%）
 * @param isInvoiceRegistered 支払先がインボイス登録事業者か
 * @param date                判定基準日（デフォルト: 今日）
 */
export function calculateDeductibleTax(params: {
  amountIncludingTax: number
  taxRate?: number
  isInvoiceRegistered: boolean
  date?: Date
}): TaxCalculation {
  const { amountIncludingTax, taxRate = 0.1, isInvoiceRegistered, date = new Date() } = params

  // 内税計算
  const consumptionTax    = Math.floor(amountIncludingTax * taxRate / (1 + taxRate))
  const amountExcludingTax = amountIncludingTax - consumptionTax

  const status = getInvoiceStatus(isInvoiceRegistered, date)

  // 少額特例：税込1万円未満 → 登録有無に関わらず全額控除
  if (amountIncludingTax < 10_000) {
    return {
      amountExcludingTax,
      consumptionTax,
      deductibleTax: consumptionTax,
      nonDeductibleTax: 0,
      amountIncludingTax,
      deductibleRate: 1.0,
      status,
      isMinorException: true,
    }
  }

  const deductibleRate    = getDeductibleRate(status)
  const deductibleTax     = Math.floor(consumptionTax * deductibleRate)
  const nonDeductibleTax  = consumptionTax - deductibleTax

  return {
    amountExcludingTax,
    consumptionTax,
    deductibleTax,
    nonDeductibleTax,
    amountIncludingTax,
    deductibleRate,
    status,
    isMinorException: false,
  }
}

// ─── 会計ソフト別 税区分コード ────────────────────────────────

export type ExportFormat = 'mf' | 'freee' | 'yayoi'

/**
 * 経過措置フェーズに応じた税区分コードを返す
 * 少額特例の場合は登録済みと同じコードを使用
 */
export function getInvoiceTaxCode(
  format: ExportFormat,
  baseTaxType: string | null | undefined,
  status: InvoiceStatus,
  isMinorException: boolean,
): string {
  // 軽減税率・非課税は経過措置対象外
  if (baseTaxType === 'taxed_8') {
    if (format === 'yayoi') return '課税仕入（8%）'
    if (format === 'freee') return '課税仕入れ8%（軽減）'
    return '課税仕入8%（軽減）'
  }
  if (baseTaxType === 'exempt') {
    if (format === 'yayoi') return '非課税'
    return '非課税仕入'
  }

  // 少額特例 or 登録済み → 通常の課税仕入コード
  if (isMinorException || status === 'registered') {
    if (format === 'yayoi') return '課税仕入（10%）'
    if (format === 'freee') return '課税仕入れ10%'
    return '課税仕入(10%)'
  }

  // 経過措置フェーズ別コード
  if (status === 'transitional_80') {
    if (format === 'yayoi') return '課税仕入（経80%）'
    if (format === 'freee') return '課税仕入れ(経80%)10%'
    return '課税仕入(80%)(10%)'
  }
  if (status === 'transitional_50') {
    if (format === 'yayoi') return '課税仕入（経50%）'
    if (format === 'freee') return '課税仕入れ(経50%)10%'
    return '課税仕入(50%)(10%)'
  }

  // exempt（控除不可）
  if (format === 'yayoi') return '対象外'
  return '対象外'
}
