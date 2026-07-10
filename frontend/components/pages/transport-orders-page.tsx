'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  assignDispatchDriver,
  getDrivers,
  getTransportOrders,
  submitTransportOrder,
  updateTransportOrder,
  type TransportOrderRow,
} from '@/services/transport'
import { Badge, Button, DataTable, Input, Label, Modal, PageHeader, Select } from '@/components/ui/primitives'
import { formatMoney } from '@/lib/utils'
import { CheckCircle2, Loader2, Pencil } from 'lucide-react'

export default function TransportOrdersPage() {
  const [docstatusFilter, setDocstatusFilter] = useState('')
  const { data, isLoading, mutate } = useSWR(['transport-orders', docstatusFilter], () =>
    getTransportOrders(docstatusFilter)
  )
  const { data: drivers } = useSWR('drivers-active', () => getDrivers(false))
  const [editing, setEditing] = useState<TransportOrderRow | null>(null)
  const [qty, setQty] = useState('1')
  const [rate, setRate] = useState('0')
  const [driver, setDriver] = useState('')
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState<string | null>(null)
  const [approveOrder, setApproveOrder] = useState<TransportOrderRow | null>(null)

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
      await updateTransportOrder(editing.name, Number(qty), Number(rate))
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

  return (
    <div>
      <PageHeader
        title="Transport Orders"
        description="Review draft orders, assign a driver, adjust the charge, then approve to dispatch"
        action={
          <Select value={docstatusFilter} onChange={(e) => setDocstatusFilter(e.target.value)} className="w-40">
            <option value="">All Orders</option>
            <option value="0">Draft</option>
            <option value="1">Submitted</option>
          </Select>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <DataTable
          rows={(data || []) as Record<string, unknown>[]}
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
              render: (row) => <Badge>{String(row.delivery_status || '—')}</Badge>,
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
                const order = row as TransportOrderRow
                const hasDriver = Boolean(order.driver)
                return (
                  <div className="flex flex-wrap items-center gap-2">
                    {Number(row.docstatus) === 0 ? (
                      <>
                        <Button
                          variant="outline"
                          className="h-9 w-9 p-0"
                          title="Edit order & assign driver"
                          aria-label="Edit order and assign driver"
                          onClick={() => openEdit(order)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => openApprove(order)}
                          disabled={approving === order.name || !hasDriver}
                          title={hasDriver ? 'Approve order' : 'Assign a driver to approve'}
                        >
                          {approving === order.name ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Approve
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Approved and dispatched</span>
                    )}
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
                  Transport invoice is created and submitted
                </li>
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
    </div>
  )
}
