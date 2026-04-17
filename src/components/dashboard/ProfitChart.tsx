'use client'

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

const data = [
  { month: '11月', sales: 3400, expenses: 2100, profit: 1300 },
  { month: '12月', sales: 3800, expenses: 2300, profit: 1500 },
  { month: '1月',  sales: 3600, expenses: 2400, profit: 1200 },
  { month: '2月',  sales: 3900, expenses: 2200, profit: 1700 },
  { month: '3月',  sales: 4100, expenses: 2450, profit: 1650 },
  { month: '4月',  sales: 4200, expenses: 2353, profit: 1847 },
]

function formatYen(v: number) {
  return `${(v / 1000).toFixed(0)}千円`
}

export function ProfitChart() {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 0" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatYen}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          formatter={(value, name) => {
            const labels: Record<string, string> = { sales: '売上', expenses: '経費', profit: '利益' }
            return [`¥${Number(value).toLocaleString()}千`, labels[String(name)] ?? String(name)]
          }}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e6ec' }}
        />
        <Area
          type="monotone"
          dataKey="sales"
          stroke="#2563eb"
          strokeWidth={2}
          fill="#eff4ff"
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="expenses"
          stroke="#94a3b8"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="profit"
          stroke="#16a34a"
          strokeWidth={2}
          fill="#f0fdf4"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
