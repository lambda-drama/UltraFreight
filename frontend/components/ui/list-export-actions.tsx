'use client'

import { FileSpreadsheet, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/primitives'
import {
  downloadListingExcel,
  printListingReport,
  type ListExportColumn,
} from '@/lib/list-export'

export function ListExportActions({
  title,
  columns,
  rows,
  subtitle,
  disabled,
}: {
  title: string
  columns: ListExportColumn[]
  rows: Record<string, unknown>[]
  subtitle?: string
  disabled?: boolean
}) {
  const empty = !rows.length

  function handlePrint() {
    if (empty) {
      toast.error('Nothing to export as PDF')
      return
    }
    try {
      printListingReport(title, columns, rows, subtitle)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create PDF')
    }
  }

  function handleExcel() {
    if (empty) {
      toast.error('Nothing to export')
      return
    }
    try {
      downloadListingExcel(title, columns, rows)
      toast.success('Excel file downloaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not export Excel')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" onClick={handlePrint} disabled={disabled || empty}>
        <Printer className="mr-2 h-4 w-4" />
        PDF
      </Button>
      <Button type="button" variant="outline" onClick={handleExcel} disabled={disabled || empty}>
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        Excel
      </Button>
    </div>
  )
}
