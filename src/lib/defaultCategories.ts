// テナント作成時に自動挿入するデフォルト勘定科目
export const DEFAULT_CATEGORIES = [
  { name: '旅費交通費',   account_code: '660', tax_type: 'taxed_10' },
  { name: '通信費',       account_code: '641', tax_type: 'taxed_10' },
  { name: '会議費',       account_code: '651', tax_type: 'taxed_10' },
  { name: '交際費',       account_code: '652', tax_type: 'taxed_10' },
  { name: '消耗品費',     account_code: '710', tax_type: 'taxed_10' },
  { name: '広告宣伝費',   account_code: '614', tax_type: 'taxed_10' },
  { name: '水道光熱費',   account_code: '631', tax_type: 'taxed_10' },
  { name: '地代家賃',     account_code: '621', tax_type: 'exempt'   },
  { name: '損害保険料',   account_code: '750', tax_type: 'exempt'   },
  { name: '支払手数料',   account_code: '771', tax_type: 'taxed_10' },
  { name: '新聞図書費',   account_code: '740', tax_type: 'taxed_10' },
  { name: '研修費',       account_code: '742', tax_type: 'taxed_10' },
  { name: '福利厚生費',   account_code: '644', tax_type: 'taxed_10' },
  { name: '外注費',       account_code: '590', tax_type: 'taxed_10' },
] as const
