// =============================================================
// Smart TAYORU — 銀行CSVユニバーサルパーサー
// 主要銀行のCSVヘッダーを自動認識してパース
// =============================================================

export interface ParsedTransaction {
  date:        string   // YYYY-MM-DD
  description: string
  amount:      number
  direction:   'in' | 'out'
  balance:     number | null
  rawRow:      string
}

export interface ParseResult {
  bankName:     string
  transactions: ParsedTransaction[]
  errors:       string[]
}

// ─── 銀行別ヘッダー定義 ──────────────────────────────────
interface BankProfile {
  name:        string
  detectKey:   string          // ヘッダー行に含まれる識別キーワード
  dateCol:     string
  descCol:     string
  inCol:       string | null   // 入金列（nullなら amountColで判断）
  outCol:      string | null   // 出金列
  amountCol:   string | null   // 正負で判断する場合
  balanceCol:  string | null
  dateFormat:  'YYYY/MM/DD' | 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'YYYYMMDD'
  encoding:    'utf8' | 'sjis'
}

const BANK_PROFILES: BankProfile[] = [
  // GMOあおぞらネット銀行
  {
    name: 'GMOあおぞらネット銀行',
    detectKey: '取引日,摘要,出金金額,入金金額,残高',
    dateCol: '取引日', descCol: '摘要',
    inCol: '入金金額', outCol: '出金金額', amountCol: null, balanceCol: '残高',
    dateFormat: 'YYYY/MM/DD', encoding: 'utf8',
  },
  // 三菱UFJ銀行
  {
    name: '三菱UFJ銀行',
    detectKey: '年月日,摘要,お支払い金額,お預り金額,残高',
    dateCol: '年月日', descCol: '摘要',
    inCol: 'お預り金額', outCol: 'お支払い金額', amountCol: null, balanceCol: '残高',
    dateFormat: 'YYYY/MM/DD', encoding: 'sjis',
  },
  // 三井住友銀行
  {
    name: '三井住友銀行',
    detectKey: '日付,摘要,金額,残高',
    dateCol: '日付', descCol: '摘要',
    inCol: null, outCol: null, amountCol: '金額', balanceCol: '残高',
    dateFormat: 'YYYY/MM/DD', encoding: 'sjis',
  },
  // みずほ銀行
  {
    name: 'みずほ銀行',
    detectKey: '取引日付,摘要,支払金額,預入金額,残高',
    dateCol: '取引日付', descCol: '摘要',
    inCol: '預入金額', outCol: '支払金額', amountCol: null, balanceCol: '残高',
    dateFormat: 'YYYYMMDD', encoding: 'sjis',
  },
  // PayPay銀行
  {
    name: 'PayPay銀行',
    detectKey: '取引日,内容,出金,入金,残高',
    dateCol: '取引日', descCol: '内容',
    inCol: '入金', outCol: '出金', amountCol: null, balanceCol: '残高',
    dateFormat: 'YYYY/MM/DD', encoding: 'utf8',
  },
]

/** 日付文字列を YYYY-MM-DD に正規化 */
function normalizeDate(raw: string, fmt: BankProfile['dateFormat']): string {
  const clean = raw.trim().replace(/"/g, '')
  if (fmt === 'YYYYMMDD') {
    return `${clean.slice(0,4)}-${clean.slice(4,6)}-${clean.slice(6,8)}`
  }
  if (fmt === 'YYYY/MM/DD') {
    return clean.replace(/\//g, '-')
  }
  return clean
}

/** 金額文字列を数値に変換（カンマ除去） */
function parseAmount(raw: string): number {
  if (!raw || raw.trim() === '' || raw.trim() === '-') return 0
  return parseInt(raw.replace(/[",\s]/g, ''), 10) || 0
}

/** CSVテキストをパース */
export function parseCSV(text: string): ParseResult {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) {
    return { bankName: '不明', transactions: [], errors: ['データが空です'] }
  }

  // ヘッダー行の検出
  let headerLineIndex = -1
  let profile: BankProfile | null = null

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    for (const p of BANK_PROFILES) {
      if (lines[i].includes(p.detectKey.split(',')[0]) &&
          lines[i].includes(p.detectKey.split(',')[1])) {
        profile = p
        headerLineIndex = i
        break
      }
    }
    if (profile) break
  }

  // 未対応銀行でも汎用パース
  if (!profile) {
    profile = detectGenericFormat(lines[0])
    headerLineIndex = 0
  }

  const headers = lines[headerLineIndex]
    .split(',')
    .map(h => h.replace(/"/g, '').trim())

  const colIdx = (name: string | null) =>
    name ? headers.indexOf(name) : -1

  const dateIdx    = colIdx(profile.dateCol)
  const descIdx    = colIdx(profile.descCol)
  const inIdx      = colIdx(profile.inCol)
  const outIdx     = colIdx(profile.outCol)
  const amountIdx  = colIdx(profile.amountCol)
  const balanceIdx = colIdx(profile.balanceCol)

  const transactions: ParsedTransaction[] = []
  const errors: string[] = []

  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const row = lines[i]
    if (!row || row.startsWith('//') || row.startsWith('#')) continue

    const cols = splitCSVRow(row)
    if (cols.length < 2) continue

    try {
      const rawDate = dateIdx >= 0 ? cols[dateIdx] : ''
      const description = descIdx >= 0 ? cols[descIdx]?.replace(/"/g, '').trim() : ''

      let amount = 0
      let direction: 'in' | 'out' = 'out'

      if (amountIdx >= 0) {
        // 正負で判断
        const raw = parseAmount(cols[amountIdx])
        amount = Math.abs(raw)
        direction = raw >= 0 ? 'in' : 'out'
      } else {
        // 入金/出金 別列
        const inAmt  = inIdx  >= 0 ? parseAmount(cols[inIdx])  : 0
        const outAmt = outIdx >= 0 ? parseAmount(cols[outIdx]) : 0
        if (inAmt > 0) { amount = inAmt; direction = 'in' }
        else           { amount = outAmt; direction = 'out' }
      }

      if (amount === 0) continue

      const balance = balanceIdx >= 0 ? parseAmount(cols[balanceIdx]) : null

      transactions.push({
        date:        normalizeDate(rawDate, profile.dateFormat),
        description: description || '（摘要なし）',
        amount,
        direction,
        balance,
        rawRow: row,
      })
    } catch {
      errors.push(`行${i+1}のパースに失敗`)
    }
  }

  return {
    bankName: profile.name,
    transactions,
    errors,
  }
}

/** CSVの1行を正しく分割（クォート内カンマ対応） */
function splitCSVRow(row: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of row) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

/** 未知銀行の汎用フォーマット検出 */
function detectGenericFormat(headerLine: string): BankProfile {
  return {
    name: '汎用フォーマット',
    detectKey: '',
    dateCol: headerLine.split(',')[0]?.replace(/"/g, '').trim() || '日付',
    descCol: headerLine.split(',')[1]?.replace(/"/g, '').trim() || '摘要',
    inCol: null, outCol: null, amountCol: '金額', balanceCol: null,
    dateFormat: 'YYYY/MM/DD', encoding: 'utf8',
  }
}

/** サンプルCSVデータ（GMOあおぞら形式） */
export const SAMPLE_CSV_GMO = `取引日,摘要,出金金額,入金金額,残高
2026/04/01,前月繰越,,,8100000
2026/04/02,振込　株式会社サンプル,,500000,8600000
2026/04/05,カード決済　AWS,12540,,8587460
2026/04/07,振込　フリーランス田中,,220000,8807460
2026/04/10,源泉所得税　税務署,48200,,8759260
2026/04/12,カード決済　Apple Japan,3280,,8755980
2026/04/14,振込　合同会社テスト,,1200000,9955980
2026/04/15,給与振込,1450000,,8505980
2026/04/20,カード決済　AWS,12540,,8493440
2026/04/25,振込　株式会社クラウド,,800000,9293440
2026/04/28,カード決済　Figma,2160,,9291280
`
