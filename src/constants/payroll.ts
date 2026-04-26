export type PaymentType = 'salary' | 'bonus' | 'special'

export const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  salary:  '給与',
  bonus:   '賞与',
  special: '臨時支給',
}
