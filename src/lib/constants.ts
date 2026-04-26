// Work Order Status constants
export const WORK_ORDER_STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  ordered:     { label: '発注済',   cls: 'bg-blue-50 text-blue-700',    dot: 'bg-blue-500'   },
  in_progress: { label: '進行中',   cls: 'bg-amber-50 text-amber-700',  dot: 'bg-amber-500'  },
  completed:   { label: '完了',     cls: 'bg-green-50 text-green-700',  dot: 'bg-green-500'  },
  cancelled:   { label: 'キャンセル', cls: 'bg-slate-50 text-slate-500', dot: 'bg-slate-400'  },
}
