import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { ArrowUpRight } from 'lucide-react'

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'silent' | 'soft' | 'destructive'

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
>(function Button({ className, variant = 'default', ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 disabled:opacity-45 disabled:pointer-events-none',
        variant === 'default' &&
          'bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(26,77,122,0.25)] hover:brightness-105 active:scale-[0.98]',
        variant === 'outline' &&
          'border border-border bg-card text-foreground hover:bg-muted',
        variant === 'ghost' &&
          'text-foreground/80 hover:bg-muted hover:text-foreground',
        variant === 'silent' &&
          'gap-1 px-2 py-1 text-primary hover:text-primary/80',
        variant === 'soft' &&
          'bg-accent text-accent-foreground hover:bg-muted',
        variant === 'destructive' &&
          'bg-destructive/10 text-destructive hover:bg-destructive/15',
        className
      )}
      {...props}
    />
  )
})

export function TextLink({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/75',
        className
      )}
      {...props}
    >
      {children}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </button>
  )
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'flex h-10 w-full rounded-2xl border border-border bg-card px-4 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-secondary/50 focus:ring-2 focus:ring-ring/25',
        className
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-24 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none transition-shadow focus:border-secondary/50 focus:ring-2 focus:ring-ring/25',
        className
      )}
      {...props}
    />
  )
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'flex h-10 w-full rounded-full border border-border bg-card px-4 py-2 text-sm outline-none transition-shadow focus:border-secondary/50 focus:ring-2 focus:ring-ring/25',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function Modal({
  open,
  title,
  onClose,
  children,
  className,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  className?: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0b2d4d]/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl bg-card shadow-[0_24px_64px_rgba(11,45,77,0.18)]',
          className
        )}
      >
        <div className="flex shrink-0 items-center justify-between px-6 py-5">
          <h2 className="font-serif-display text-xl font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-6">{children}</div>
      </div>
    </div>
  )
}

export function SideDrawer({
  open,
  title,
  onClose,
  children,
  className,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  className?: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-[#0b2d4d]/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 flex h-full w-full max-w-xl flex-col bg-card shadow-[-12px_0_48px_rgba(11,45,77,0.18)]',
          className
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-5">
          <h2 className="font-serif-display text-xl font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-sm font-medium text-foreground/80', className)} {...props} />
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[1.25rem] bg-card shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25)]',
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-5', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('font-serif-display text-lg font-semibold tracking-tight text-foreground', className)}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 pb-6', className)} {...props} />
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'success' | 'warning' | 'muted' | 'destructive'
}) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        variant === 'default' && 'bg-accent text-accent-foreground ring-border',
        variant === 'success' && 'bg-success-soft text-success ring-success/20',
        variant === 'warning' && 'bg-warning-soft text-warning ring-warning/25',
        variant === 'muted' && 'bg-muted text-muted-foreground ring-border',
        variant === 'destructive' && 'bg-destructive/10 text-destructive ring-destructive/20',
        className
      )}
      {...props}
    />
  )
}

export function PageHeader({
  title: _title,
  description,
  action,
}: {
  title?: string
  description?: string
  action?: React.ReactNode
}) {
  // Title lives in the top navbar — avoid repeating it on the page.
  if (!description && !action) return null

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {description ? <p className="max-w-2xl text-sm text-muted-foreground">{description}</p> : <div />}
      {action}
    </div>
  )
}

export function DataTable({
  columns,
  rows,
  emptyText = 'No records found.',
  onRowClick,
}: {
  columns: { key: string; label: string; render?: (row: Record<string, unknown>) => React.ReactNode }[]
  rows: Record<string, unknown>[]
  emptyText?: string
  onRowClick?: (row: Record<string, unknown>) => void
}) {
  if (!rows.length) {
    return (
      <div className="rounded-[1.25rem] bg-muted/50 p-10 text-center text-sm text-muted-foreground ring-1 ring-border">
        {emptyText}
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-[1.25rem] bg-card shadow-[0_4px_24px_rgba(11,45,77,0.06)]">
      <table className="min-w-full text-sm">
        <thead className="text-left">
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th key={col.key} className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={String(row.name || idx)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-b border-border transition-colors last:border-0 hover:bg-muted/30',
                onRowClick && 'cursor-pointer'
              )}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-5 py-4 align-top text-foreground/90">
                  {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function FilterPill({
  active,
  children,
  onClick,
}: {
  active?: boolean
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-4 py-2 text-sm font-medium transition-all',
        active
          ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}
