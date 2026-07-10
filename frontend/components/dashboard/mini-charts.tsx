'use client'

import { formatMoney } from '@/lib/utils'

export function CustomerInvoiceBars({
  rows,
  currency,
}: {
  rows: { customer: string; invoice_count: number; total_amount: number }[]
  currency?: string
}) {
  if (!rows.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No invoiced transport customers yet.</p>
  }

  const max = Math.max(...rows.map((row) => row.total_amount), 1)

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.customer}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-foreground/90">{row.customer}</span>
            <span className="shrink-0 text-muted-foreground">
              {row.invoice_count} inv · {formatMoney(row.total_amount, currency)}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/80 transition-all"
              style={{ width: `${Math.max((row.total_amount / max) * 100, 4)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function MonthlyInvoiceChart({
  rows,
  currency,
}: {
  rows: { month: string; label: string; amount: number; count: number }[]
  currency?: string
}) {
  if (!rows.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No invoice trend data yet.</p>
  }

  const max = Math.max(...rows.map((row) => row.amount), 1)

  return (
    <div className="flex h-44 items-end justify-between gap-2 pt-4">
      {rows.map((row) => (
        <div key={row.month} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-32 w-full items-end justify-center">
            <div
              className="w-full max-w-10 rounded-t-xl bg-primary/75 transition-all"
              style={{ height: `${Math.max((row.amount / max) * 100, row.amount > 0 ? 8 : 2)}%` }}
              title={`${row.label}: ${formatMoney(row.amount, currency)} (${row.count})`}
            />
          </div>
          <div className="text-center">
            <div className="text-xs font-medium text-foreground/80">{row.label}</div>
            <div className="text-[10px] text-muted-foreground">{row.count} inv</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function DonutSummary({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[]
  centerLabel: string
  centerValue: string
}) {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0) || 1
  let offset = 0
  const radius = 42
  const circumference = 2 * Math.PI * radius

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(11,45,77,0.08)" strokeWidth="10" />
          {segments.map((seg) => {
            const length = (seg.value / total) * circumference
            const dasharray = `${length} ${circumference - length}`
            const el = (
              <circle
                key={seg.label}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth="10"
                strokeDasharray={dasharray}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              />
            )
            offset += length
            return el
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="font-serif-display text-lg font-semibold">{centerValue}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{centerLabel}</div>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: seg.color }} />
            <span className="text-muted-foreground">{seg.label}</span>
            <span className="font-medium">{Math.round((seg.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
