'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { getTransportInvoices } from '@/services/transport'
import { Badge, Button, DataTable, PageHeader } from '@/components/ui/primitives'
import { FilterToolbar, matchesDateRange, matchesText } from '@/components/layout/filter-toolbar'
import { formatMoney, openPrintView } from '@/lib/utils'
import { Loader2, Printer } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Unpaid', label: 'Unpaid' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Overdue', label: 'Overdue' },
  { value: 'Cancelled', label: 'Cancelled' },
  { value: 'Return', label: 'Return' },
  { value: 'Credit Note Issued', label: 'Credit Note Issued' },
  { value: 'Submitted', label: 'Submitted' },
]

export default function InvoicesPage() {
  const { data, isLoading } = useSWR('transport-invoices', getTransportInvoices)
  const [customer, setCustomer] = useState('')
  const [status, setStatus] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const rows = useMemo(() => {
    return (data || []).filter((row) => {
      if (!matchesText(String(row.customer_name || row.customer || ''), customer)) return false
      if (status && String(row.status || '') !== status) return false
      if (!matchesDateRange(String(row.posting_date || ''), fromDate, toDate)) return false
      return true
    })
  }, [data, customer, status, fromDate, toDate])

  return (
    <div>
      <PageHeader title="Transport Invoices" description="Sales invoices created from transport orders" />

      <FilterToolbar
        fields={[
          {
            key: 'customer',
            label: 'Customer',
            type: 'text',
            value: customer,
            onChange: setCustomer,
            placeholder: 'Search customer…',
          },
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
          rows={rows as Record<string, unknown>[]}
          emptyText="No invoices match these filters."
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
