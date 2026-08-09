import { APP_TITLE } from '@/lib/branding'

export type ListExportColumn = {
  key: string
  label: string
  /** Plain value for print / Excel (skip action columns). */
  value?: (row: Record<string, unknown>) => string | number | null | undefined
}

function escapeCsv(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function getExportCellValue(
  row: Record<string, unknown>,
  column: ListExportColumn
): string {
  if (column.value) {
    const raw = column.value(row)
    if (raw == null || raw === '') return ''
    return String(raw)
  }
  const raw = row[column.key]
  if (raw == null || raw === '') return ''
  if (typeof raw === 'object') return JSON.stringify(raw)
  return String(raw)
}

function buildTableMatrix(columns: ListExportColumn[], rows: Record<string, unknown>[]) {
  const headers = columns.map((c) => c.label)
  const body = rows.map((row) => columns.map((col) => getExportCellValue(row, col)))
  return { headers, body }
}

function safeFilename(title: string) {
  const stamp = new Date().toISOString().slice(0, 10)
  const safe = title.replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  return `${safe || 'export'}_${stamp}`
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  // Keep blob URL alive briefly so the download can start
  window.setTimeout(() => {
    anchor.remove()
    URL.revokeObjectURL(url)
  }, 1500)
}

/** Download listing as Excel-friendly CSV (.xls opens in Excel). */
export function downloadListingExcel(
  title: string,
  columns: ListExportColumn[],
  rows: Record<string, unknown>[]
) {
  if (!columns.length) {
    throw new Error('No columns to export')
  }
  const { headers, body } = buildTableMatrix(columns, rows)
  const lines = [
    headers.map(escapeCsv).join(','),
    ...body.map((line) => line.map((cell) => escapeCsv(cell)).join(',')),
  ]
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  })
  triggerBlobDownload(blob, `${safeFilename(title)}.xls`)
}

function buildPrintHtml(
  title: string,
  columns: ListExportColumn[],
  rows: Record<string, unknown>[],
  subtitle?: string
) {
  const { headers, body } = buildTableMatrix(columns, rows)
  const printedAt = new Date().toLocaleString()
  const headerCells = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
  const bodyRows = body
    .map(
      (line) =>
        `<tr>${line.map((cell) => `<td>${escapeHtml(cell || '—')}</td>`).join('')}</tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 16mm; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; margin: 0; padding: 24px; }
    .brand { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    tr:nth-child(even) td { background: #f8fafc; }
    .empty { padding: 24px; text-align: center; color: #64748b; border: 1px dashed #cbd5e1; }
  </style>
</head>
<body>
  <div class="brand">${escapeHtml(APP_TITLE)}</div>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${escapeHtml(subtitle || '')}${subtitle ? ' · ' : ''}Printed ${escapeHtml(printedAt)} · ${rows.length} row${rows.length === 1 ? '' : 's'}</div>
  ${
    rows.length
      ? `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`
      : `<div class="empty">No records to print.</div>`
  }
</body>
</html>`
}

/**
 * Print listing via a hidden iframe (no blank tab / popup).
 * Works inside Frappe portal pages where window.open('', ...) is empty.
 */
export function printListingReport(
  title: string,
  columns: ListExportColumn[],
  rows: Record<string, unknown>[],
  subtitle?: string
) {
  if (!columns.length) {
    throw new Error('No columns to print')
  }

  const html = buildPrintHtml(title, columns, rows, subtitle)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.setAttribute('title', 'Print preview')
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;'
  document.body.appendChild(iframe)

  const win = iframe.contentWindow
  const doc = win?.document
  if (!win || !doc) {
    iframe.remove()
    throw new Error('Could not prepare print view')
  }

  doc.open()
  doc.write(html)
  doc.close()

  const cleanup = () => {
    try {
      iframe.remove()
    } catch {
      /* ignore */
    }
  }

  const runPrint = () => {
    try {
      win.focus()
      win.print()
    } catch {
      cleanup()
      throw new Error('Print dialog could not be opened')
    }
  }

  win.addEventListener('afterprint', cleanup)
  // Fallback cleanup if afterprint never fires
  window.setTimeout(cleanup, 120_000)

  // Give the iframe a tick to layout content before printing
  window.setTimeout(runPrint, 300)
}
