'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { getConfirmationLogs, type ConfirmationLogRow } from '@/services/transport'
import { Badge, Card, CardContent, DataTable, PageHeader } from '@/components/ui/primitives'
import { FilterToolbar, matchesDateRange } from '@/components/layout/filter-toolbar'
import { ListExportActions } from '@/components/ui/list-export-actions'
import { formatDate } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import type { ListExportColumn } from '@/lib/list-export'

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'Open', label: 'Open' },
  { value: 'In Transit', label: 'In Transit' },
  { value: 'Pending Invoicing', label: 'Pending Invoicing' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Failed', label: 'Failed' },
]

function statusVariant(status?: string) {
  if (status === 'Completed') return 'success'
  if (status === 'Pending Invoicing') return 'warning'
  if (status === 'Partially Delivered') return 'warning'
  if (status === 'In Transit') return 'warning'
  if (status === 'Open') return 'muted'
  if (status === 'Failed') return 'default'
  return 'default'
}

function LogItems({ items }: { items: ConfirmationLogRow['items'] }) {
  if (!items?.length) return <span className="text-muted-foreground">—</span>
  return (
    <div className="space-y-1 text-xs">
      {items.map((item) => (
        <div key={item.item_code}>
          {item.item_name || item.item_code}: {item.qty_delivered}/{item.qty_ordered} {item.uom || ''}
        </div>
      ))}
    </div>
  )
}

export default function ConfirmationLogsPage() {
  const { data, isLoading } = useSWR('confirmation-logs', () => getConfirmationLogs())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const rows = useMemo(() => {
    return (data || []).filter((row) => {
      if (status && row.status !== status) return false
      if (!matchesDateRange(row.confirmation_time, fromDate, toDate)) return false
      return true
    })
  }, [data, status, fromDate, toDate])

  return (
    <div>
      <PageHeader
        title="Confirmation Logs"
        description="Track delivery status changes and driver completion records"
        action={
          <ListExportActions
            title="Confirmation Logs"
            columns={
              [
                { key: 'name', label: 'Log ID' },
                { key: 'delivery_note', label: 'Delivery Note' },
                { key: 'driver', label: 'Driver' },
                { key: 'status', label: 'Status' },
                { key: 'completion_type', label: 'Completion' },
                {
                  key: 'partial_reason',
                  label: 'Partial Reason',
                  value: (row) => String(row.partial_reason || ''),
                },
                {
                  key: 'confirmation_time',
                  label: 'Time',
                  value: (row) => formatDate(String(row.confirmation_time || '')),
                },
              ] satisfies ListExportColumn[]
            }
            rows={rows as unknown as Record<string, unknown>[]}
          />
        }
      />

      <FilterToolbar
        fields={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            value: status,
            onChange: setStatus,
            options: STATUS_OPTIONS,
          },
          {
            key: 'from',
            label: 'From date',
            type: 'date',
            value: fromDate,
            onChange: setFromDate,
          },
          {
            key: 'to',
            label: 'To date',
            type: 'date',
            value: toDate,
            onChange: setToDate,
          },
        ]}
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <DataTable
          rows={rows as unknown as Record<string, unknown>[]}
          columns={[
            { key: 'name', label: 'Log ID' },
            { key: 'delivery_note', label: 'Delivery Note' },
            { key: 'driver', label: 'Driver' },
            {
              key: 'status',
              label: 'Status',
              render: (row) => (
                <Badge variant={statusVariant(String(row.status || ''))}>{String(row.status || '—')}</Badge>
              ),
            },
            { key: 'completion_type', label: 'Completion' },
            {
              key: 'partial_reason',
              label: 'Partial Reason',
              render: (row) => String(row.partial_reason || '—'),
            },
            {
              key: 'items',
              label: 'Products Delivered',
              render: (row) => (
                <div>
                  <LogItems items={row.items as ConfirmationLogRow['items']} />
                  {(row.items as ConfirmationLogRow['items'])?.length ? (
                    <button
                      type="button"
                      className="mt-1 text-xs text-primary underline"
                      onClick={() => setExpanded(expanded === String(row.name) ? null : String(row.name))}
                    >
                      {expanded === String(row.name) ? 'Hide' : 'Details'}
                    </button>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'confirmation_time',
              label: 'Recorded At',
              render: (row) => formatDate(String(row.confirmation_time || '')),
            },
          ]}
          emptyText="No confirmation logs match these filters."
        />
      )}
      {expanded && rows.length ? (
        <Card className="mt-4">
          <CardContent className="py-4">
            {rows
              .filter((log) => log.name === expanded)
              .map((log) => (
                <div key={log.name}>
                  <div className="mb-2 font-medium">Item breakdown — {log.delivery_note}</div>
                  <LogItems items={log.items} />
                </div>
              ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
