'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { getEmailLogs, type EmailLogRow } from '@/services/transport'
import { Badge, DataTable, PageHeader, SideDrawer } from '@/components/ui/primitives'
import { ListExportActions } from '@/components/ui/list-export-actions'
import { formatDate } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import type { ListExportColumn } from '@/lib/list-export'

function emailVariant(status?: string) {
  if (status === 'Sent') return 'success'
  if (status === 'Failed') return 'destructive'
  if (status === 'Skipped' || status === 'Disabled') return 'warning'
  return 'muted'
}

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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
  { key: 'recipient', label: 'Email' },
  { key: 'subject', label: 'Subject' },
  { key: 'status', label: 'Status' },
  {
    key: 'sent_at',
    label: 'Sent At',
    value: (row) => formatDate(String(row.sent_at || row.creation || '')),
  },
]

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 border-b border-border py-3 last:border-0">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground/90 break-words">{value || '—'}</div>
    </div>
  )
}

export default function EmailPage() {
  const { data, isLoading } = useSWR('email-logs', () => getEmailLogs())
  const rows = (data || []) as unknown as Record<string, unknown>[]
  const [selected, setSelected] = useState<EmailLogRow | null>(null)

  return (
    <div>
      <PageHeader
        title="Email Log"
        description="Email notifications sent to transport company, final customer, goods customer, and original company. Click a row to view the full message."
        action={<ListExportActions title="Email Log" columns={EXPORT_COLUMNS} rows={rows} />}
      />
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <DataTable
          rows={rows}
          onRowClick={(row) => setSelected(row as unknown as EmailLogRow)}
          columns={[
            { key: 'delivery_note', label: 'Delivery Note' },
            { key: 'event', label: 'Event' },
            { key: 'party', label: 'Party' },
            {
              key: 'recipient_label',
              label: 'Recipient',
              render: (row) => String(row.recipient_label || row.recipient || '—'),
            },
            { key: 'recipient', label: 'Email' },
            {
              key: 'subject',
              label: 'Subject',
              render: (row) => {
                const subject = String(row.subject || '—')
                const preview = stripHtml(String(row.message || ''))
                return (
                  <span
                    className="block max-w-xs truncate text-xs text-primary underline-offset-2 hover:underline"
                    title={preview || subject}
                  >
                    {subject}
                  </span>
                )
              },
            },
            {
              key: 'status',
              label: 'Status',
              render: (row) => (
                <Badge variant={emailVariant(String(row.status || ''))}>{String(row.status || '—')}</Badge>
              ),
            },
            {
              key: 'sent_at',
              label: 'Sent At',
              render: (row) => formatDate(String(row.sent_at || row.creation || '')),
            },
          ]}
          emptyText="No email logs yet."
        />
      )}

      <SideDrawer
        open={!!selected}
        title="Email Details"
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="space-y-1">
            <DetailRow
              label="Status"
              value={<Badge variant={emailVariant(selected.status)}>{selected.status || '—'}</Badge>}
            />
            <DetailRow label="Event" value={selected.event} />
            <DetailRow label="Party" value={selected.party} />
            <DetailRow label="Delivery Note" value={selected.delivery_note} />
            <DetailRow
              label="To"
              value={
                <div>
                  <div>{selected.recipient_label || '—'}</div>
                  <div className="text-xs text-muted-foreground">{selected.recipient || '—'}</div>
                </div>
              }
            />
            <DetailRow label="Subject" value={selected.subject || '—'} />
            <DetailRow
              label="Sent At"
              value={formatDate(String(selected.sent_at || selected.creation || ''))}
            />
            {selected.error ? <DetailRow label="Note" value={selected.error} /> : null}

            <div className="pt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Message
              </div>
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <div
                  className="prose prose-sm max-w-none text-foreground [&_a]:text-primary [&_p]:mb-2 [&_p]:last:mb-0"
                  dangerouslySetInnerHTML={{ __html: selected.message || '<p>—</p>' }}
                />
              </div>
            </div>
          </div>
        ) : null}
      </SideDrawer>
    </div>
  )
}
