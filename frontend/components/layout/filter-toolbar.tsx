'use client'

import { useState } from 'react'
import { ListFilter, X } from 'lucide-react'
import { Button, Input, Label, Select } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

export type FilterField =
  | {
      key: string
      label: string
      type: 'select'
      value: string
      onChange: (value: string) => void
      options: { value: string; label: string }[]
    }
  | {
      key: string
      label: string
      type: 'text' | 'date'
      value: string
      onChange: (value: string) => void
      placeholder?: string
    }

export function FilterToolbar({
  fields,
  className,
  defaultOpen = false,
}: {
  fields: FilterField[]
  className?: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const activeCount = fields.filter((field) => Boolean(field.value)).length

  function clearAll() {
    for (const field of fields) field.onChange('')
  }

  return (
    <div className={cn('mb-6', className)}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className={cn('gap-2', open && 'bg-muted')}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Hide filters' : 'Show filters'}
        >
          <ListFilter className="h-4 w-4" />
          Filters
          {activeCount > 0 ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-[11px] font-semibold text-secondary-foreground">
              {activeCount}
            </span>
          ) : null}
        </Button>
        {activeCount > 0 ? (
          <Button type="button" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={clearAll}>
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-3 grid gap-3 rounded-2xl border border-border bg-card/80 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {fields.map((field) => (
            <div key={field.key}>
              <Label>{field.label}</Label>
              {field.type === 'select' ? (
                <Select value={field.value} onChange={(e) => field.onChange(e.target.value)}>
                  {field.options.map((opt) => (
                    <option key={opt.value || 'all'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  type={field.type}
                  value={field.value}
                  placeholder={field.placeholder}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function matchesDateRange(value: string | null | undefined, from: string, to: string) {
  if (!from && !to) return true
  if (!value) return false
  const day = String(value).slice(0, 10)
  if (from && day < from) return false
  if (to && day > to) return false
  return true
}

export function matchesText(haystack: string | null | undefined, needle: string) {
  if (!needle.trim()) return true
  return String(haystack || '')
    .toLowerCase()
    .includes(needle.trim().toLowerCase())
}
