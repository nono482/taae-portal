// =============================================================
// Smart TAYORU — 給与計算エンジン（2026年度対応）
// =============================================================

// ─── 2026年度 社会保険料率（東京都）────────────────────────
const RATES = {
  // 健康保険（東京都 協会けんぽ 2026年度）本人負担率
  healthInsEmployee:   0.0500,   // 10.00% の折半
  // 厚生年金 本人負担率
  pensionEmployee:     0.09150,  // 18.30% の折半
  // 雇用保険 労働者負担率
  employmentIns:       0.006,    // 0.6%
  // 介護保険（40歳以上）本人負担率 ※簡易計算のため別途必要に応じて追加
  nursingCareIns:      0.00975,
} as const

// ─── 標準報酬月額 等級表（2026年度 厚生年金）──────────────
// [等級, 下限, 上限, 標準報酬月額]
const PENSION_GRADES: [number, number, number, number][] = [
  [1,      0,   93000,   88000],
  [2,  93000,  101000,   98000],
  [3, 101000,  107000,  104000],
  [4, 107000,  114000,  110000],
  [5, 114000,  122000,  118000],
  [6, 122000,  130000,  126000],
  [7, 130000,  138000,  134000],
  [8, 138000,  146000,  142000],
  [9, 146000,  155000,  150000],
  [10, 155000, 165000,  160000],
  [11, 165000, 175000,  170000],
  [12, 175000, 185000,  180000],
  [13, 185000, 195000,  190000],
  [14, 195000, 210000,  200000],
  [15, 210000, 230000,  220000],
  [16, 230000, 250000,  240000],
  [17, 250000, 270000,  260000],
  [18, 270000, 290000,  280000],
  [19, 290000, 310000,  300000],
  [20, 310000, 330000,  320000],
  [21, 330000, 350000,  340000],
  [22, 350000, 370000,  360000],
  [23, 370000, 395000,  380000],
  [24, 395000, 425000,  410000],
  [25, 425000, 455000,  440000],
  [26, 455000, 485000,  470000],
  [27, 485000, 515000,  500000],
  [28, 515000, 545000,  530000],
  [29, 545000, 575000,  560000],
  [30, 575000, 605000,  590000],
  [31, 605000, 635000,  620000],
  [32, 635000,      Infinity, 650000],
]

// ─── 健康保険 標準報酬月額 等級表（東京都 協会けんぽ）──────
const HEALTH_GRADES: [number, number, number][] = [
  [63000,   58000,   73000],
  [73000,   68000,   83000],
  [83000,   78000,   93000],
  [93000,   88000,  101000],
  [101000,  98000,  107000],
  [107000, 104000,  114000],
  [114000, 110000,  122000],
  [122000, 118000,  130000],
  [130000, 126000,  138000],
  [138000, 134000,  146000],
  [146000, 142000,  155000],
  [155000, 150000,  165000],
  [165000, 160000,  175000],
  [175000, 170000,  185000],
  [185000, 180000,  195000],
  [195000, 190000,  210000],
  [210000, 200000,  230000],
  [230000, 220000,  250000],
  [250000, 240000,  270000],
  [270000, 260000,  290000],
  [290000, 280000,  310000],
  [310000, 300000,  330000],
  [330000, 320000,  350000],
  [350000, 340000,  370000],
  [370000, 360000,  395000],
  [395000, 380000,  425000],
  [425000, 410000,  455000],
  [455000, 440000,  485000],
  [485000, 470000,  515000],
  [515000, 500000,  545000],
  [545000, 530000,  575000],
  [575000, 560000,  605000],
  [605000, 590000,  635000],
  [635000, 620000,  Infinity],
]

/** 標準報酬月額を求める */
function getStandardRemuneration(salary: number, table: typeof PENSION_GRADES): number {
  for (const [, lower, upper, standard] of table) {
    if (salary >= lower && salary < upper) return standard
  }
  return table[table.length - 1][3]
}

// ─── 源泉所得税 甲欄 速算表（2026年度）─────────────────────
// [課税所得下限, 課税所得上限, 税率, 控除額]
// 社会保険控除後の課税所得（月額）に適用
// 扶養人数0人の場合の基本テーブル
const WITHHOLDING_TABLE_A_0: [number, number, number, number][] = [
  [0,      88000,   0,      0],
  [88000,  89000,   0,    130],
  [89000,  90000,   0,    180],
  [90000,  91000,   0,    230],
  [91000,  92000,   0,    290],
  [92000,  93000,   0,    340],
  [93000,  94000,   0,    390],
  [94000,  95000,   0,    440],
  [95000,  96000,   0,    490],
  [96000,  97000,   0,    540],
  [97000,  98000,   0,    590],
  [98000,  99000,   0,    640],
  [99000, 101000,   0,    720],
  [101000,103000,   0,    830],
  [103000,105000,   0,    950],
  [105000,107000,   0,   1030],
  [107000,109000,   0,   1160],
  [109000,111000,   0,   1280],
  [111000,113000,   0,   1400],
  [113000,115000,   0,   1530],
  [115000,117000,   0,   1650],
  [117000,119000,   0,   1800],
  [119000,121000,   0,   1920],
  [121000,123000,   0,   2040],
  [123000,125000,   0,   2160],
  [125000,127000,   0,   2280],
  [127000,129000,   0,   2400],
  [129000,131000,   0,   2520],
  [131000,133000,   0,   2650],
  [133000,135000,   0,   2770],
  [135000,137000,   0,   2890],
  [137000,139000,   0,   3010],
  [139000,141000,   0,   3130],
  [141000,143000,   0,   3250],
  [143000,149000,   0,   3590],
  [149000,153000,   0,   3900],
  [153000,157000,   0.03, 0],
  [157000,160000,   0.03, 0],
  [160000,167000,   0.03, 0],
  [167000,175000,   0.05, 0],
  [175000,183000,   0.05, 0],
  [183000,191000,   0.05, 0],
  [191000,201000,   0.05, 0],
  [201000,227000,   0.10, 0],
  [227000,295000,   0.10, 0],
  [295000,349000,   0.10, 0],
  [349000,400000,   0.20, 0],
  [400000,Infinity, 0.20, 0],
]

/**
 * 源泉所得税を計算する（簡易甲欄）
 * @param taxableIncome 社会保険控除後の課税対象月収
 * @param dependents    扶養人数
 */
function calcIncomeTax(taxableIncome: number, dependents: number): number {
  // 扶養控除：1人につき基礎控除38,000円/月相当を減算（簡易）
  const adjustedIncome = taxableIncome - dependents * 38000
  if (adjustedIncome <= 0) return 0

  for (const [lower, upper, rate, deduction] of WITHHOLDING_TABLE_A_0) {
    if (adjustedIncome >= lower && adjustedIncome < upper) {
      if (rate === 0) return deduction
      return Math.floor(adjustedIncome * rate - deduction)
    }
  }
  // 超過分
  return Math.floor(adjustedIncome * 0.2023)
}

// ─── メイン計算関数 ───────────────────────────────────────

export interface PayrollInput {
  baseSalary:    number   // 基本給
  allowances:    number   // 各種手当合計
  dependents:    number   // 扶養人数
  taxTable:      'A' | 'B' // 甲欄/乙欄
  age:           number   // 年齢（介護保険適用判定）
  residenceTax:  number   // 住民税（前年度確定分を手動入力）
}

export interface PayrollResult {
  grossPay:       number  // 総支給額
  healthIns:      number  // 健康保険料（本人負担）
  nursingIns:     number  // 介護保険料（40歳以上）
  pensionIns:     number  // 厚生年金保険料（本人負担）
  employmentIns:  number  // 雇用保険料（本人負担）
  incomeTax:      number  // 源泉所得税
  residenceTax:   number  // 住民税
  totalDeductions:number  // 控除合計
  netPay:         number  // 差引支給額
  breakdown: {
    standardHealthRemuneration: number   // 健康保険 標準報酬月額
    standardPensionRemuneration: number  // 厚生年金 標準報酬月額
    taxableIncome: number                // 課税対象月収（社保控除後）
  }
}

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const { baseSalary, allowances, dependents, age, residenceTax } = input
  const grossPay = baseSalary + allowances

  // 標準報酬月額
  const stdHealthRem  = getStandardRemuneration(grossPay, HEALTH_GRADES.map((h, i) => [i+1, h[1], h[2], h[0]] as [number,number,number,number]))
  const stdPensionRem = getStandardRemuneration(grossPay, PENSION_GRADES)

  // 社会保険料（円未満切り捨て）
  const healthIns    = Math.floor(stdHealthRem  * RATES.healthInsEmployee)
  const nursingIns   = age >= 40 ? Math.floor(stdHealthRem * RATES.nursingCareIns) : 0
  const pensionIns   = Math.floor(stdPensionRem * RATES.pensionEmployee)
  const employmentIns = Math.floor(grossPay      * RATES.employmentIns)

  const socialInsTotal = healthIns + nursingIns + pensionIns + employmentIns

  // 課税対象所得（社会保険控除後）
  const taxableIncome = grossPay - socialInsTotal

  // 源泉所得税
  const incomeTax = calcIncomeTax(taxableIncome, dependents)

  // 控除合計・差引支給
  const totalDeductions = socialInsTotal + incomeTax + residenceTax
  const netPay = grossPay - totalDeductions

  return {
    grossPay,
    healthIns,
    nursingIns,
    pensionIns,
    employmentIns,
    incomeTax,
    residenceTax,
    totalDeductions,
    netPay,
    breakdown: {
      standardHealthRemuneration:  stdHealthRem,
      standardPensionRemuneration: stdPensionRem,
      taxableIncome,
    },
  }
}

/** 金額を日本円形式でフォーマット */
export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}
