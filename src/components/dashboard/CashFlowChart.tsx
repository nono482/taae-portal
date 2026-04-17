'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

const data = [
  { month: '11月', income: 3400, expense: 2100 },
  { month: '12月', income: 3800, expense: 2300 },
  { month: '1月',  income: 3600, expense: 2400 },
  { month: '2月',  income: 3900, expense: 2200 },
  { month: '3月',  income: 4100, expense: 2450 },
  { month: '4月',  income: 4200, expense: 2353 },
]

export function CashFlowChart() {
  return (
    <ResponsiveContainer width="100%" height={110}>
      <BarChart data={data} barSize={10} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 0" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip
          formatter={(v, name) => [
            `¥${Number(v).toLocaleString()}千`,
            name === 'income' ? '入金' : '出金',
          ]}
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e6ec' }}
        />
        <Bar dataKey="income"  fill="#2563eb" radius={[3, 3, 0, 0]} />
        <Bar dataKey="expense" fill="#e2e8f0" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
