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

/** Open print view using Transport Settings default format + letter head. */
export async function openPrintView(doctype: string, name: string) {
  if (!doctype || !name) return
  try {
    const { getPortalPrintDefaults } = await import('@/services/transport')
    const defaults = await getPortalPrintDefaults(doctype)
    openPrintViewWithFormat(doctype, name, {
      print_format: defaults.print_format || 'Standard',
      letterhead: defaults.letter_head || undefined,
      no_letterhead: !defaults.letter_head,
      trigger_print: true,
    })
  } catch {
    openPrintViewWithFormat(doctype, name, { trigger_print: true })
  }
}

/** Open ERPNext/Frappe print view for a document in a new tab. */
export function openPrintViewWithFormat(
  doctype: string,
  name: string,
  options?: {
    print_format?: string
    letterhead?: string
    no_letterhead?: boolean
    trigger_print?: boolean
  }
) {
  if (!doctype || !name) return
  const params = new URLSearchParams({
    doctype,
    name,
  })
  if (options?.print_format) params.set('format', options.print_format)
  if (options?.letterhead) params.set('letterhead', options.letterhead)
  if (options?.no_letterhead) params.set('no_letterhead', '1')
  if (options?.trigger_print) params.set('trigger_print', '1')
  window.open(`/printview?${params.toString()}`, '_blank', 'noopener,noreferrer')
}
