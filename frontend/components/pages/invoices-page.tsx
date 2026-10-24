'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  createTransportPayment,
  getPaymentModes,
  getTransportInvoices,
} from '@/services/transport'
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu'
import { Badge, Button, DataTable, Input, Label, Modal, PageHeader, Select } from '@/components/ui/primitives'
import { FilterToolbar, matchesDateRange, matchesText } from '@/components/layout/filter-toolbar'
import { ListExportActions } from '@/components/ui/list-export-actions'
import { formatMoney, openPrintView } from '@/lib/utils'
import { Banknote, Loader2, Printer } from 'lucide-react'
import type { ListExportColumn } from '@/lib/list-export'

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

function statusVariant(status?: string) {
  if (status === 'Paid') return 'success'
  if (status === 'Cancelled' || status === 'Return') return 'destructive'
  if (status === 'Unpaid' || status === 'Overdue') return 'warning'
  return 'muted'
}

type InvoiceRow = {
  name: string
  customer?: string
  customer_name?: string
  posting_date?: string
  grand_total?: number
  outstanding_amount?: number
  status?: string
  docstatus?: number
  currency?: string
}

export default function InvoicesPage() {
  const { data, isLoading, mutate } = useSWR('transport-invoices', getTransportInvoices)
  const { data: paymentModes } = useSWR('payment-modes', getPaymentModes)
  const [customer, setCustomer] = useState('')
  const [status, setStatus] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceRow | null>(null)
  const [modeOfPayment, setModeOfPayment] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [paying, setPaying] = useState(false)

  const rows = useMemo(() => {
    return (data || []).filter((row) => {
      if (!matchesText(String(row.customer_name || row.customer || ''), customer)) return false
      if (status && String(row.status || '') !== status) return false
      if (!matchesDateRange(String(row.posting_date || ''), fromDate, toDate)) return false
      return true
    }) as InvoiceRow[]
  }, [data, customer, status, fromDate, toDate])

  function openPayment(row: InvoiceRow) {
    const outstanding = Number(row.outstanding_amount || 0)
    if (Number(row.docstatus) !== 1 || outstanding <= 0) {
      toast.error('This invoice has no outstanding amount')
      return
    }
    setPaymentInvoice(row)
    setPaidAmount(String(outstanding))
    setModeOfPayment(paymentModes?.[0]?.name || '')
  }

  async function confirmPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!paymentInvoice) return
    if (!modeOfPayment) {
      toast.error('Choose a payment method')
      return
    }
    const amount = Number(paidAmount)
    const outstanding = Number(paymentInvoice.outstanding_amount || 0)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid paid amount')
      return
    }
    if (amount > outstanding) {
      toast.error('Paid amount cannot exceed outstanding')
      return
    }

    setPaying(true)
    try {
      const result = await createTransportPayment(paymentInvoice.name, {
        mode_of_payment: modeOfPayment,
        paid_amount: amount,
      })
      toast.success(`Payment ${result.payment_entry} created`)
      setPaymentInvoice(null)
      setModeOfPayment('')
      setPaidAmount('')
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create payment')
    } finally {
      setPaying(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Transport Invoices"
        description="Sales invoices created from transport orders"
        action={
          <ListExportActions
            title="Transport Invoices"
            columns={
              [
                { key: 'name', label: 'Invoice' },
                {
                  key: 'customer_name',
                  label: 'Customer',
                  value: (row) => String(row.customer_name || row.customer || ''),
                },
                {
                  key: 'posting_date',
                  label: 'Date',
                  value: (row) => String(row.posting_date || ''),
                },
                { key: 'status', label: 'Status' },
                {
                  key: 'grand_total',
                  label: 'Grand Total',
                  value: (row) => formatMoney(Number(row.grand_total || 0), String(row.currency || '')),
                },
                {
                  key: 'outstanding_amount',
                  label: 'Outstanding',
                  value: (row) =>
                    formatMoney(Number(row.outstanding_amount || 0), String(row.currency || '')),
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
          rows={rows as unknown as Record<string, unknown>[]}
          emptyText="No invoices match these filters."
          columns={[
            { key: 'name', label: 'Invoice' },
            { key: 'customer_name', label: 'Customer' },
            { key: 'posting_date', label: 'Date' },
            {
              key: 'grand_total',
              label: 'Total',
              render: (row) => formatMoney(Number(row.grand_total || 0), String(row.currency || '')),
            },
            {
              key: 'outstanding_amount',
              label: 'Outstanding',
              render: (row) => formatMoney(Number(row.outstanding_amount || 0), String(row.currency || '')),
            },
            {
              key: 'status',
              label: 'Status',
              render: (row) => (
                <Badge variant={statusVariant(String(row.status || ''))}>
                  {String(row.status || 'Submitted')}
                </Badge>
              ),
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => {
                const invoice = row as unknown as InvoiceRow
                const outstanding = Number(invoice.outstanding_amount || 0)
                const canPay = Number(invoice.docstatus) === 1 && outstanding > 0
                const menuItems: ActionMenuItem[] = [
                  {
                    key: 'payment',
                    label: 'Payment',
                    icon: <Banknote className="h-4 w-4" />,
                    disabled: !canPay || paying,
                    onClick: () => openPayment(invoice),
                  },
                ]

                return (
                  <div className="flex items-center justify-end gap-1.5">
                    <ActionMenu items={menuItems} label={`Actions for ${invoice.name}`} />
                    <Button
                      variant="outline"
                      className="h-9 w-9 p-0"
                      title="Print invoice"
                      aria-label="Print invoice"
                      onClick={() => openPrintView('Sales Invoice', invoice.name)}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  </div>
                )
              },
            },
          ]}
        />
      )}

      <Modal
        open={!!paymentInvoice}
        title="Record Payment"
        onClose={() => !paying && setPaymentInvoice(null)}
      >
        {paymentInvoice ? (
          <form onSubmit={confirmPayment} className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-2">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Invoice</span>
                <span className="font-medium">{paymentInvoice.name}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium text-right">
                  {paymentInvoice.customer_name || paymentInvoice.customer}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Outstanding</span>
                <span className="font-medium">
                  {formatMoney(
                    Number(paymentInvoice.outstanding_amount || 0),
                    paymentInvoice.currency
                  )}
                </span>
              </div>
            </div>

            <div>
              <Label>Payment method</Label>
              <Select
                value={modeOfPayment}
                onChange={(e) => setModeOfPayment(e.target.value)}
                required
                disabled={paying}
              >
                <option value="">Select method</option>
                {(paymentModes || []).map((mode) => (
                  <option key={mode.name} value={mode.name}>
                    {mode.name}
                    {mode.type ? ` · ${mode.type}` : ''}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label>Amount paying</Label>
              <Input
                type="number"
                min="0.01"
                step="any"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                required
                disabled={paying}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Defaults to outstanding. You can pay a partial amount.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={paying}
                onClick={() => setPaymentInvoice(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={paying || !modeOfPayment}>
                {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Payment'}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  )
}
