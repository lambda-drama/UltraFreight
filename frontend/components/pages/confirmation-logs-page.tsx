'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { getConfirmationLogs, type ConfirmationLogRow } from '@/services/transport'
import { Badge, Card, CardContent, DataTable, PageHeader } from '@/components/ui/primitives'
import { formatDate } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

function statusVariant(status?: string) {
  if (status === 'Completed') return 'success'
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

  return (
    <div>
      <PageHeader
        title="Confirmation Logs"
        description="Track delivery status changes and driver completion records"
      />
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <DataTable
          rows={(data || []) as Record<string, unknown>[]}
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
          emptyText="No confirmation logs yet."
        />
      )}
      {expanded && data ? (
        <Card className="mt-4">
          <CardContent className="py-4">
            {(data as ConfirmationLogRow[])
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
