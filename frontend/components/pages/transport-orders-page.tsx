'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  assignDispatchDriver,
  createTransportInvoice,
  getDrivers,
  getTransportOrders,
  regenerateTransportOtp,
  submitTransportOrder,
  updateTransportOrder,
  uploadAttachedFile,
  type TransportOrderRow,
} from '@/services/transport'
import { Badge, Button, DataTable, Input, Label, Modal, PageHeader, Select, Textarea } from '@/components/ui/primitives'
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu'
import { FilterToolbar, matchesText } from '@/components/layout/filter-toolbar'
import { formatMoney, openPrintView } from '@/lib/utils'
import { CheckCircle2, FilePlus2, KeyRound, Loader2, Pencil, Printer } from 'lucide-react'

function statusBadge(status?: string) {
  if (status === 'Completed') return 'success'
  if (status === 'Pending Invoicing') return 'warning'
  if (status === 'In Transit') return 'warning'
  if (status === 'Open') return 'muted'
  return 'default'
}

const DELIVERY_STATUS_OPTIONS = [
  { value: '', label: 'All delivery statuses' },
  { value: 'Open', label: 'Open' },
  { value: 'In Transit', label: 'In Transit' },
  { value: 'Pending Invoicing', label: 'Pending Invoicing' },
  { value: 'Completed', label: 'Completed' },
]

const ORDER_STATUS_OPTIONS = [
  { value: '', label: 'All orders' },
  { value: '0', label: 'Draft' },
  { value: '1', label: 'Submitted' },
]

export default function TransportOrdersPage() {
  const [docstatusFilter, setDocstatusFilter] = useState('')
  const [customer, setCustomer] = useState('')
  const [deliveryStatus, setDeliveryStatus] = useState('')
  const { data, isLoading, mutate } = useSWR(['transport-orders', docstatusFilter], () =>
    getTransportOrders(docstatusFilter)
  )
  const { data: drivers } = useSWR('drivers-active', () => getDrivers(false))
  const [editing, setEditing] = useState<TransportOrderRow | null>(null)
  const [qty, setQty] = useState('1')
  const [rate, setRate] = useState('0')
  const [driver, setDriver] = useState('')
  const [lastCustomerInvoice, setLastCustomerInvoice] = useState('')
  const [lastCustomerInvoiceDate, setLastCustomerInvoiceDate] = useState('')
  const [lastCustomerDn, setLastCustomerDn] = useState('')
  const [lastCustomerDnDate, setLastCustomerDnDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState<string | null>(null)
  const [invoicing, setInvoicing] = useState<string | null>(null)
  const [regeneratingOtp, setRegeneratingOtp] = useState<string | null>(null)
  const [approveOrder, setApproveOrder] = useState<TransportOrderRow | null>(null)
  const [invoiceOrder, setInvoiceOrder] = useState<TransportOrderRow | null>(null)
  const [invoiceNote, setInvoiceNote] = useState('')
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)

  const rows = useMemo(() => {
    return (data || []).filter((order) => {
      if (!matchesText(order.customer_name || '', customer)) return false
      if (deliveryStatus && order.delivery_status !== deliveryStatus) return false
      return true
    })
  }, [data, customer, deliveryStatus])

  function driverLabel(name?: string) {
    if (!name) return 'Not assigned'
    const match = (drivers || []).find((d) => d.name === name)
    return match?.full_name || name
  }

  function openEdit(order: TransportOrderRow) {
    const item = order.items?.[0]
    setEditing(order)
    setQty(String(item?.qty ?? 1))
    setRate(String(item?.rate ?? 0))
    setDriver(order.driver || '')
    setLastCustomerInvoice(order.custom_last_customer_invoice || '')
    setLastCustomerInvoiceDate(order.custom_last_customer_invoice_date || '')
    setLastCustomerDn(order.custom_last_customer_delivery_note || '')
    setLastCustomerDnDate(order.custom_last_customer_delivery_note_date || '')
  }

  function openApprove(order: TransportOrderRow) {
    if (!order.driver) {
      toast.error('Choose a driver before approving — use the pen icon to edit the order.')
      openEdit(order)
      return
    }
    setApproveOrder(order)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    try {
      await updateTransportOrder(editing.name, {
        qty: Number(qty),
        rate: Number(rate),
        custom_last_customer_invoice: lastCustomerInvoice,
        custom_last_customer_invoice_date: lastCustomerInvoiceDate,
        custom_last_customer_delivery_note: lastCustomerDn,
        custom_last_customer_delivery_note_date: lastCustomerDnDate,
      })
      const dn = editing.custom_delivery_note_to_be_transported
      if (dn && driver) {
        await assignDispatchDriver(dn, driver)
      }
      toast.success('Order updated')
      setEditing(null)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  async function confirmApprove() {
    if (!approveOrder?.driver) {
      toast.error('Choose a driver before approving.')
      return
    }
    setApproving(approveOrder.name)
    try {
      await submitTransportOrder(approveOrder.name)
      toast.success('Order approved — OTP generated and delivery is In Transit')
      setApproveOrder(null)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not approve order')
    } finally {
      setApproving(null)
    }
  }

  async function handleRegenerateOtp(order: TransportOrderRow) {
    if (!order.driver) {
      toast.error('Assign a driver before regenerating the OTP')
      return
    }
    setRegeneratingOtp(order.name)
    try {
      const result = await regenerateTransportOtp(order.name)
      toast.success(`New OTP: ${result.otp}`)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not regenerate OTP')
    } finally {
      setRegeneratingOtp(null)
    }
  }

  function openCreateInvoice(order: TransportOrderRow) {
    setInvoiceOrder(order)
    setInvoiceNote(order.custom_note || '')
    setInvoiceFile(null)
  }

  async function handleCreateInvoice() {
    if (!invoiceOrder) return
    setInvoicing(invoiceOrder.name)
    try {
      let fileUrl = invoiceOrder.custom_final_customer_feedback_document || ''
      if (invoiceFile) {
        fileUrl = await uploadAttachedFile(
          invoiceFile,
          'Sales Order',
          invoiceOrder.name,
          'custom_final_customer_feedback_document'
        )
      }
      const result = await createTransportInvoice(invoiceOrder.name, {
        custom_note: invoiceNote,
        custom_final_customer_feedback_document: fileUrl || undefined,
      })
      toast.success(`Invoice ${result.sales_invoice} created — delivery Completed`)
      setInvoiceOrder(null)
      setInvoiceNote('')
      setInvoiceFile(null)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create invoice')
    } finally {
      setInvoicing(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Transport Orders"
        description="Assign driver and customer invoice refs, approve to dispatch, then create the transport invoice after delivery"
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
            key: 'delivery_status',
            label: 'Delivery status',
            type: 'select',
            value: deliveryStatus,
            onChange: setDeliveryStatus,
            options: DELIVERY_STATUS_OPTIONS,
          },
          {
            key: 'docstatus',
            label: 'Order status',
            type: 'select',
            value: docstatusFilter,
            onChange: setDocstatusFilter,
            options: ORDER_STATUS_OPTIONS,
          },
        ]}
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <DataTable
          rows={rows as unknown as Record<string, unknown>[]}
          emptyText="No transport orders match these filters."
          columns={[
            { key: 'name', label: 'Sales Order' },
            { key: 'custom_delivery_note_to_be_transported', label: 'Delivery Note' },
            { key: 'customer_name', label: 'Customer' },
            {
              key: 'docstatus',
              label: 'Order Status',
              render: (row) => (
                <Badge variant={Number(row.docstatus) === 1 ? 'success' : 'warning'}>
                  {Number(row.docstatus) === 1 ? 'Submitted' : 'Draft'}
                </Badge>
              ),
            },
            {
              key: 'delivery_status',
              label: 'Delivery Status',
              render: (row) => (
                <Badge variant={statusBadge(String(row.delivery_status || ''))}>
                  {String(row.delivery_status || '—')}
                </Badge>
              ),
            },
            {
              key: 'driver',
              label: 'Driver',
              render: (row) => String(row.driver || 'Not assigned'),
            },
            { key: 'grand_total', label: 'Total', render: (row) => formatMoney(Number(row.grand_total || 0), String(row.currency || '')) },
            {
              key: 'items',
              label: 'Charge',
              render: (row) => {
                const items = (row.items as TransportOrderRow['items']) || []
                return items.map((item) => `${item.item_code} · qty ${item.qty} @ ${item.rate}`).join(', ') || '—'
              },
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => {
                const order = row as unknown as TransportOrderRow
                const hasDriver = Boolean(order.driver)
                const isDraft = Number(order.docstatus) === 0
                const isSubmitted = Number(order.docstatus) === 1
                const pendingInvoice = order.delivery_status === 'Pending Invoicing'
                const completed = order.delivery_status === 'Completed' || Boolean(order.transport_sales_invoice)
                const canRegenerateOtp =
                  isSubmitted &&
                  hasDriver &&
                  order.delivery_status !== 'Pending Invoicing' &&
                  order.delivery_status !== 'Completed'
                const needsOtp = Boolean(order.otp_missing || order.otp_expired)
                const busy =
                  approving === order.name ||
                  invoicing === order.name ||
                  regeneratingOtp === order.name

                const menuItems: ActionMenuItem[] = []

                if (isDraft) {
                  menuItems.push({
                    key: 'edit',
                    label: 'Edit & assign driver',
                    icon: <Pencil className="h-4 w-4" />,
                    onClick: () => openEdit(order),
                  })
                  menuItems.push({
                    key: 'approve',
                    label: hasDriver ? 'Approve order' : 'Assign driver to approve',
                    icon:
                      approving === order.name ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      ),
                    disabled: !hasDriver || approving === order.name,
                    onClick: () => openApprove(order),
                  })
                }

                if (isSubmitted && pendingInvoice) {
                  menuItems.push({
                    key: 'invoice',
                    label: invoicing === order.name ? 'Creating invoice…' : 'Create invoice',
                    icon:
                      invoicing === order.name ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FilePlus2 className="h-4 w-4" />
                      ),
                    disabled: invoicing === order.name,
                    onClick: () => openCreateInvoice(order),
                  })
                }

                if (order.transport_sales_invoice) {
                  menuItems.push({
                    key: 'print-invoice',
                    label: 'Print transport invoice',
                    icon: <Printer className="h-4 w-4" />,
                    onClick: () => openPrintView('Sales Invoice', order.transport_sales_invoice!),
                  })
                }

                if (canRegenerateOtp) {
                  menuItems.push({
                    key: 'regenerate-otp',
                    label:
                      regeneratingOtp === order.name
                        ? 'Regenerating OTP…'
                        : needsOtp
                          ? order.otp_missing
                            ? 'Generate OTP'
                            : 'Regenerate expired OTP'
                          : 'Regenerate OTP',
                    icon:
                      regeneratingOtp === order.name ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <KeyRound className="h-4 w-4" />
                      ),
                    disabled: regeneratingOtp === order.name,
                    onClick: () => handleRegenerateOtp(order),
                  })
                }

                if (!menuItems.length && completed) {
                  menuItems.push({
                    key: 'done',
                    label: 'Delivery completed',
                    icon: <CheckCircle2 className="h-4 w-4" />,
                    disabled: true,
                    onClick: () => {},
                  })
                }

                return (
                  <div className="flex items-center justify-end gap-1.5">
                    <ActionMenu items={menuItems} label={`Actions for ${order.name}`} />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 w-9 p-0"
                      title="Print transport order"
                      aria-label="Print transport order"
                      disabled={busy}
                      onClick={() => openPrintView('Sales Order', order.name)}
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

      <Modal open={!!editing} title={editing?.name || 'Transport Order'} onClose={() => setEditing(null)}>
        <form onSubmit={handleSave} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Delivery Note: {editing?.custom_delivery_note_to_be_transported}
          </p>
          <div>
            <Label>Driver</Label>
            <Select value={driver} onChange={(e) => setDriver(e.target.value)} required>
              <option value="">Select driver</option>
              {(drivers || []).map((d) => (
                <option key={d.name} value={d.name}>
                  {d.full_name} {d.vehicle_number ? `· ${d.vehicle_number}` : ''}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Quantity</Label>
            <Input type="number" min="0.001" step="any" value={qty} onChange={(e) => setQty(e.target.value)} required />
          </div>
          <div>
            <Label>Rate / Amount per unit</Label>
            <Input type="number" min="0" step="any" value={rate} onChange={(e) => setRate(e.target.value)} required />
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
            Estimated total: {formatMoney(Number(qty || 0) * Number(rate || 0), editing?.currency)}
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-3 text-sm font-medium">Customer & company references</p>
            <div className="space-y-3">
              <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Main Company Invoice</span>
                  <span className="font-medium text-right">
                    {editing?.custom_main_company_invoice || 'Not created yet'}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Invoice Date</span>
                  <span className="font-medium">
                    {editing?.custom_main_company_invoice_date || '—'}
                  </span>
                </div>
              </div>
              <div>
                <Label>Transport Customer Invoice</Label>
                <Input
                  value={lastCustomerInvoice}
                  onChange={(e) => setLastCustomerInvoice(e.target.value)}
                  placeholder="External invoice number"
                />
              </div>
              <div>
                <Label>Transport Customer Invoice Date</Label>
                <Input
                  type="date"
                  value={lastCustomerInvoiceDate}
                  onChange={(e) => setLastCustomerInvoiceDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Transport Customer Delivery Note</Label>
                <Input
                  value={lastCustomerDn}
                  onChange={(e) => setLastCustomerDn(e.target.value)}
                  placeholder="External delivery note number"
                />
              </div>
              <div>
                <Label>Transport Customer Delivery Note Date</Label>
                <Input
                  type="date"
                  value={lastCustomerDnDate}
                  onChange={(e) => setLastCustomerDnDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!approveOrder} title="Approve Order" onClose={() => !approving && setApproveOrder(null)}>
        {approveOrder ? (
          <div className="space-y-5">
            <div className="flex items-start gap-4 rounded-2xl bg-secondary/10 p-4 ring-1 ring-secondary/20">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-foreground">Approve this transport order?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Dispatch will begin for {approveOrder.custom_delivery_note_to_be_transported}.
                </p>
              </div>
            </div>

            <div className="grid gap-2 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Transport order</span>
                <span className="font-medium">{approveOrder.name}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Delivery note</span>
                <span className="font-medium">{approveOrder.custom_delivery_note_to_be_transported}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Driver</span>
                <span className="font-medium">{driverLabel(approveOrder.driver)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Transport charge</span>
                <span className="font-medium">{formatMoney(Number(approveOrder.grand_total || 0), approveOrder.currency)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">What happens next</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                  OTP is generated for driver confirmation
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                  Driver and customer are notified by SMS
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                  Delivery status moves to <span className="font-medium text-foreground">In Transit</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                  Transport invoice is created later after delivery confirmation
                </li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setApproveOrder(null)} disabled={!!approving}>
                Cancel
              </Button>
              <Button type="button" onClick={confirmApprove} disabled={!!approving || !approveOrder.driver}>
                {approving === approveOrder.name ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!invoiceOrder}
        title="Create Transport Invoice"
        onClose={() => {
          if (invoicing) return
          setInvoiceOrder(null)
          setInvoiceNote('')
          setInvoiceFile(null)
        }}
      >
        {invoiceOrder ? (
          <div className="space-y-5">
            <div className="flex items-start gap-4 rounded-2xl bg-secondary/10 p-4 ring-1 ring-secondary/20">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
                <FilePlus2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-foreground">Create transport sales invoice?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  This will invoice {invoiceOrder.name} and set delivery to Completed.
                </p>
              </div>
            </div>
            <div className="grid gap-2 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Transport order</span>
                <span className="font-medium">{invoiceOrder.name}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Delivery note</span>
                <span className="font-medium">{invoiceOrder.custom_delivery_note_to_be_transported}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Charge</span>
                <span className="font-medium">{formatMoney(Number(invoiceOrder.grand_total || 0), invoiceOrder.currency)}</span>
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-sm font-medium">Customer feedback</p>
              <div>
                <Label>Transport Customer Feedback Document</Label>
                <Input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                  disabled={!!invoicing}
                />
                {invoiceFile ? (
                  <p className="mt-1 text-xs text-muted-foreground">Selected: {invoiceFile.name}</p>
                ) : invoiceOrder.custom_final_customer_feedback_document ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Existing: {invoiceOrder.custom_final_customer_feedback_document}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Optional — attach signed POD or feedback</p>
                )}
              </div>
              <div>
                <Label>Note</Label>
                <Textarea
                  value={invoiceNote}
                  onChange={(e) => setInvoiceNote(e.target.value)}
                  placeholder="Customer feedback or delivery notes…"
                  rows={3}
                  disabled={!!invoicing}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setInvoiceOrder(null)
                  setInvoiceNote('')
                  setInvoiceFile(null)
                }}
                disabled={!!invoicing}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleCreateInvoice} disabled={!!invoicing}>
                {invoicing === invoiceOrder.name ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <FilePlus2 className="mr-2 h-4 w-4" />
                    Create Invoice
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
