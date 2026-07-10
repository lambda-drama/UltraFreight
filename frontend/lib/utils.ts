import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

export function formatMoney(value?: number | null, currency?: string | null) {
  if (value == null) return '—'
  const code = (currency || '').trim()
  const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
  if (!code) return formatted
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(value)
  } catch {
    return `${formatted} ${code}`
  }
}

/** Open ERPNext/Frappe print view for a document in a new tab. */
export function openPrintView(doctype: string, name: string) {
  if (!doctype || !name) return
  const params = new URLSearchParams({
    doctype,
    name,
    trigger_print: '1',
  })
  window.open(`/printview?${params.toString()}`, '_blank', 'noopener,noreferrer')
}
