'use client'

import useSWR from 'swr'
import { getTransportInvoices } from '@/services/transport'
import { Badge, Button, DataTable, PageHeader } from '@/components/ui/primitives'
import { formatMoney, openPrintView } from '@/lib/utils'
import { Loader2, Printer } from 'lucide-react'

export default function InvoicesPage() {
  const { data, isLoading } = useSWR('transport-invoices', getTransportInvoices)

  return (
    <div>
      <PageHeader title="Transport Invoices" description="Sales invoices created from transport orders" />
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <DataTable
          rows={(data || []) as Record<string, unknown>[]}
          columns={[
            { key: 'name', label: 'Invoice' },
            { key: 'customer_name', label: 'Customer' },
            { key: 'posting_date', label: 'Date' },
            { key: 'grand_total', label: 'Total', render: (row) => formatMoney(Number(row.grand_total || 0), String(row.currency || '')) },
            {
              key: 'status',
              label: 'Status',
              render: (row) => <Badge variant="success">{String(row.status || 'Submitted')}</Badge>,
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <Button
                  variant="outline"
                  className="h-9 w-9 p-0"
                  title="Print invoice"
                  aria-label="Print invoice"
                  onClick={() => openPrintView('Sales Invoice', String(row.name))}
                >
                  <Printer className="h-4 w-4" />
                </Button>
              ),
            },
          ]}
        />
      )}
    </div>
  )
}
