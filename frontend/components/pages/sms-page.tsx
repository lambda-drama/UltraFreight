'use client'

import useSWR from 'swr'
import { getSmsLogs, type SmsLogRow } from '@/services/transport'
import { Badge, DataTable, PageHeader } from '@/components/ui/primitives'
import { ListExportActions } from '@/components/ui/list-export-actions'
import { formatDate } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import type { ListExportColumn } from '@/lib/list-export'

function smsVariant(status?: string) {
  if (status === 'Sent') return 'success'
  if (status === 'Failed') return 'destructive'
  if (status === 'Skipped' || status === 'Disabled') return 'warning'
  return 'muted'
}

const EXPORT_COLUMNS: ListExportColumn[] = [
  { key: 'delivery_note', label: 'Delivery Note' },
  { key: 'event', label: 'Event' },
  { key: 'party', label: 'Party' },
  {
    key: 'recipient_label',
    label: 'Recipient',
    value: (row) => String(row.recipient_label || row.recipient || ''),
  },
  { key: 'recipient', label: 'Phone' },
  { key: 'status', label: 'Status' },
  { key: 'message', label: 'Message' },
  {
    key: 'sent_at',
    label: 'Sent At',
    value: (row) => formatDate(String(row.sent_at || row.creation || '')),
  },
]

export default function SmsPage() {
  const { data, isLoading } = useSWR('sms-logs', () => getSmsLogs())
  const rows = (data || []) as Record<string, unknown>[]

  return (
    <div>
      <PageHeader
        title="SMS Log"
        description="SMS notifications sent to transport company, driver, transport customer, and goods customer"
        action={<ListExportActions title="SMS Log" columns={EXPORT_COLUMNS} rows={rows} />}
      />
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <DataTable
          rows={rows}
          columns={[
            { key: 'delivery_note', label: 'Delivery Note' },
            { key: 'event', label: 'Event' },
            { key: 'party', label: 'Party' },
            {
              key: 'recipient_label',
              label: 'Recipient',
              render: (row) => String(row.recipient_label || row.recipient || '—'),
            },
            { key: 'recipient', label: 'Phone' },
            {
              key: 'status',
              label: 'Status',
              render: (row) => (
                <Badge variant={smsVariant(String(row.status || ''))}>{String(row.status || '—')}</Badge>
              ),
            },
            {
              key: 'message',
              label: 'Message',
              render: (row) => (
                <span className="block max-w-xs truncate text-xs" title={String(row.message || '')}>
                  {String(row.message || '—')}
                </span>
              ),
            },
            {
              key: 'sent_at',
              label: 'Sent At',
              render: (row) => formatDate(String(row.sent_at || row.creation || '')),
            },
          ]}
          emptyText="No SMS logs yet."
        />
      )}
    </div>
  )
}
