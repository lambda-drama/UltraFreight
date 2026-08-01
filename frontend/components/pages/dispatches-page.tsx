'use client'

import { useMemo, useState, useEffect } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  assignDispatchDriver,
  getDispatchDetail,
  getDispatches,
  getDrivers,
  getVehicles,
  updateDispatchTransportCustomer,
  type DispatchRow,
  type ItemStatus,
} from '@/services/transport'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Input,
  Label,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui/primitives'
import { useNavigation } from '@/contexts/navigation-context'
import { FilterToolbar, matchesDateRange, matchesText } from '@/components/layout/filter-toolbar'
import { ListExportActions } from '@/components/ui/list-export-actions'
import { ChevronDown, ChevronUp, Loader2, Printer, Search } from 'lucide-react'
import { formatDate, openPrintView } from '@/lib/utils'
import type { ListExportColumn } from '@/lib/list-export'

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'needs_action', label: 'Needs Action' },
  { value: 'open', label: 'Open' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'pending_invoicing', label: 'Pending Invoicing' },
  { value: 'completed', label: 'Completed' },
  { value: 'no_driver', label: 'No Driver' },
]

function statusVariant(status?: string) {
  if (status === 'Completed') return 'success'
  if (status === 'Pending Invoicing') return 'warning'
  if (status === 'Partially Delivered') return 'warning'
  if (status === 'In Transit') return 'warning'
  if (status === 'Open') return 'muted'
  return 'default'
}

function ItemStatusTable({ items }: { items: ItemStatus[] }) {
  if (!items?.length) return null
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-xs">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2">Product</th>
            <th className="px-3 py-2">Ordered</th>
            <th className="px-3 py-2">Delivered</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.item_code} className="border-t border-border">
              <td className="px-3 py-2">{item.item_name || item.item_code}</td>
              <td className="px-3 py-2">{item.qty_ordered}</td>
              <td className="px-3 py-2">{item.qty_delivered ?? '—'}</td>
              <td className="px-3 py-2">
                <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DispatchesPage() {
  const { viewParams } = useNavigation()
  const [filter, setFilter] = useState('needs_action')
  const [search, setSearch] = useState('')
  const [customer, setCustomer] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    const paramFilter = viewParams.get('filter')
    if (paramFilter) setFilter(paramFilter)
  }, [viewParams])
  const swrKey = useMemo(() => ['dispatches', filter, search], [filter, search])
  const { data, isLoading, mutate } = useSWR(swrKey, () => getDispatches({ filter: filter || 'all', search }))
  const { data: drivers } = useSWR('active-drivers-list', () => getDrivers(false))
  const { data: vehicles } = useSWR('vehicles-list', getVehicles)

  const filteredRows = useMemo(() => {
    return (data || []).filter((row) => {
      if (!matchesText(row.customer_name || row.transport_customer_name || '', customer)) return false
      if (!matchesDateRange(row.posting_date || '', fromDate, toDate)) return false
      return true
    })
  }, [data, customer, fromDate, toDate])

  const [expanded, setExpanded] = useState<string | null>(null)
  const [detailCache, setDetailCache] = useState<Record<string, Record<string, unknown>>>({})
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)

  const [editRow, setEditRow] = useState<DispatchRow | null>(null)
  const [driverModal, setDriverModal] = useState<DispatchRow | null>(null)
  const [selectedDriver, setSelectedDriver] = useState('')
  const [selectedVehicle, setSelectedVehicle] = useState('')
  const [editForm, setEditForm] = useState({
    transport_customer_name: '',
    transport_phone: '',
    transport_email: '',
    transport_address: '',
  })
  const [saving, setSaving] = useState(false)

  async function toggleExpand(row: DispatchRow) {
    if (expanded === row.name) {
      setExpanded(null)
      return
    }
    setExpanded(row.name)
    if (!detailCache[row.name]) {
      setLoadingDetail(row.name)
      try {
        const detail = await getDispatchDetail(row.name)
        setDetailCache((prev) => ({ ...prev, [row.name]: detail }))
      } finally {
        setLoadingDetail(null)
      }
    }
  }

  function openEditCustomer(row: DispatchRow) {
    setEditRow(row)
    setEditForm({
      transport_customer_name: row.transport_customer_name || '',
      transport_phone: row.transport_phone || '',
      transport_email: row.transport_email || '',
      transport_address: row.transport_address || '',
    })
  }

  function openAssignDriver(row: DispatchRow) {
    setDriverModal(row)
    setSelectedDriver(row.driver || '')
    setSelectedVehicle(row.vehicle_no || '')
  }

  function onDriverSelect(driverName: string) {
    setSelectedDriver(driverName)
    const match = (drivers || []).find((d) => d.name === driverName)
    const preferred = (match?.vehicle_number || '').trim()
    if (!preferred) return
    const vehicleMatch = (vehicles || []).find(
      (v) => v.name === preferred || v.license_plate === preferred
    )
    if (vehicleMatch) setSelectedVehicle(vehicleMatch.name)
  }

  async function saveCustomer(e: React.FormEvent) {
    e.preventDefault()
    if (!editRow) return
    setSaving(true)
    try {
      await updateDispatchTransportCustomer(editRow.name, editForm)
      toast.success('Delivery details updated')
      setEditRow(null)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  async function saveDriver(e: React.FormEvent) {
    e.preventDefault()
    if (!driverModal || !selectedDriver) return
    if (!selectedVehicle) {
      toast.error('Select a truck')
      return
    }
    setSaving(true)
    try {
      await assignDispatchDriver(driverModal.name, selectedDriver, selectedVehicle)
      toast.success('Driver and truck assigned')
      setDriverModal(null)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Assign failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Delivery Orders"
        description="Filter orders needing action, assign drivers, and track product delivery status"
        action={
          <ListExportActions
            title="Delivery Orders"
            columns={
              [
                { key: 'name', label: 'Delivery Note' },
                {
                  key: 'customer',
                  label: 'Customer',
                  value: (row) =>
                    String(row.transport_customer_name || row.customer_name || row.customer || ''),
                },
                { key: 'driver', label: 'Driver' },
                { key: 'vehicle_no', label: 'Truck' },
                { key: 'delivery_status', label: 'Status' },
                {
                  key: 'posting_date',
                  label: 'Date',
                  value: (row) => formatDate(String(row.posting_date || '')),
                },
                { key: 'sms_status', label: 'SMS Status' },
              ] satisfies ListExportColumn[]
            }
            rows={filteredRows as unknown as Record<string, unknown>[]}
          />
        }
      />

      <FilterToolbar
        fields={[
          {
            key: 'status',
            label: 'Delivery status',
            type: 'select',
            value: filter === 'all' ? '' : filter,
            onChange: (value) => setFilter(value || 'all'),
            options: STATUS_FILTERS,
          },
          {
            key: 'customer',
            label: 'Customer',
            type: 'text',
            value: customer,
            onChange: setCustomer,
            placeholder: 'Search customer…',
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

      <div className="mb-6 relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search delivery note, customer, driver..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-11"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-3">
          {filteredRows.map((row) => {
            const isOpen = expanded === row.name
            const detail = detailCache[row.name]
            const itemStatus = (row.item_status || detail?.item_status || []) as ItemStatus[]
            const isEditable = row.delivery_status === 'Open'

            return (
              <Card key={row.name}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 py-4">
                  <div>
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      {row.name}
                      {row.needs_action ? <Badge variant="warning">Needs Action</Badge> : null}
                      {!row.transport_order_submitted && row.delivery_status === 'Open' ? (
                        <Badge variant="warning">Draft Transport Order</Badge>
                      ) : null}
                    </CardTitle>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {row.transport_customer_name || row.customer_name} · Driver:{' '}
                      {row.driver || 'Not assigned'}
                      {row.vehicle_no ? ` · Truck: ${row.vehicle_no}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(String(row.delivery_status || ''))}>
                      {String(row.delivery_status || 'Open')}
                    </Badge>
                    {row.sms_status ? (
                      <Badge variant={row.sms_status === 'Sent' ? 'success' : row.sms_status === 'Failed' ? 'destructive' : 'muted'}>
                        SMS: {row.sms_status}
                      </Badge>
                    ) : null}
                    <Button
                      variant="outline"
                      className="h-9 w-9 p-0"
                      title="Print delivery note"
                      aria-label="Print delivery note"
                      onClick={() => openPrintView('Delivery Note', row.name)}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={() => toggleExpand(row)}>
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardHeader>

                {isOpen ? (
                  <CardContent className="border-t border-[rgba(11,45,77,0.06)] pt-4">
                    <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
                      <div>Transport SO: {row.transport_sales_order || '—'}</div>
                      <div>OTP expires: {formatDate(String(row.otp_expires_at || ''))}</div>
                      <div className="sm:col-span-2">Address: {row.transport_address || '—'}</div>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => openPrintView('Delivery Note', row.name)}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                      </Button>
                      {row.transport_sales_order ? (
                        <Button
                          variant="outline"
                          onClick={() => openPrintView('Sales Order', row.transport_sales_order!)}
                        >
                          <Printer className="mr-2 h-4 w-4" />
                          Print Transport Order
                        </Button>
                      ) : null}
                      {isEditable ? (
                        <>
                          <Button variant="outline" onClick={() => openAssignDriver(row)}>Assign Driver</Button>
                          <Button variant="outline" onClick={() => openEditCustomer(row)}>Edit Delivery Details</Button>
                        </>
                      ) : null}
                    </div>

                    <div className="mb-2 text-sm font-medium">Product Status</div>
                    {loadingDetail === row.name ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ItemStatusTable items={itemStatus} />
                    )}

                    {detail?.confirmation_logs ? (
                      <div className="mt-4">
                        <div className="mb-2 text-sm font-medium">Status History</div>
                        <DataTable
                          rows={(detail.confirmation_logs as Record<string, unknown>[]) || []}
                          columns={[
                            {
                              key: 'status',
                              label: 'Status',
                              render: (r) => <Badge variant={statusVariant(String(r.status))}>{String(r.status)}</Badge>,
                            },
                            { key: 'completion_type', label: 'Type' },
                            {
                              key: 'confirmation_time',
                              label: 'Time',
                              render: (r) => formatDate(String(r.confirmation_time || '')),
                            },
                          ]}
                          emptyText="No logs yet."
                        />
                      </div>
                    ) : null}

                    {detail?.sms_logs?.length ? (
                      <div className="mt-4">
                        <div className="mb-2 text-sm font-medium">SMS Notifications</div>
                        <DataTable
                          rows={(detail.sms_logs as Record<string, unknown>[]) || []}
                          columns={[
                            { key: 'event', label: 'Event' },
                            { key: 'party', label: 'Party' },
                            {
                              key: 'recipient_label',
                              label: 'Recipient',
                              render: (r) => String(r.recipient_label || r.recipient || '—'),
                            },
                            {
                              key: 'status',
                              label: 'Status',
                              render: (r) => (
                                <Badge variant={String(r.status) === 'Sent' ? 'success' : String(r.status) === 'Failed' ? 'destructive' : 'muted'}>
                                  {String(r.status)}
                                </Badge>
                              ),
                            },
                            {
                              key: 'message',
                              label: 'Message',
                              render: (r) => (
                                <span className="block max-w-xs truncate text-xs" title={String(r.message || '')}>
                                  {String(r.message || '—')}
                                </span>
                              ),
                            },
                          ]}
                          emptyText="No SMS logs yet."
                        />
                      </div>
                    ) : null}
                  </CardContent>
                ) : null}
              </Card>
            )
          })}
          {!filteredRows.length ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No delivery orders match these filters.
            </div>
          ) : null}
        </div>
      )}

      <Modal open={!!editRow} title="Edit Delivery Details" onClose={() => setEditRow(null)}>
        <form onSubmit={saveCustomer} className="space-y-4">
          <div>
            <Label>Transport Customer Name</Label>
            <Input
              value={editForm.transport_customer_name}
              onChange={(e) => setEditForm({ ...editForm, transport_customer_name: e.target.value })}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={editForm.transport_phone}
              onChange={(e) => setEditForm({ ...editForm, transport_phone: e.target.value })}
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              value={editForm.transport_email}
              onChange={(e) => setEditForm({ ...editForm, transport_email: e.target.value })}
            />
          </div>
          <div>
            <Label>Delivery Address</Label>
            <Textarea
              value={editForm.transport_address}
              onChange={(e) => setEditForm({ ...editForm, transport_address: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!driverModal} title="Assign Driver" onClose={() => setDriverModal(null)}>
        <form onSubmit={saveDriver} className="space-y-4">
          <div>
            <Label>Driver</Label>
            <Select value={selectedDriver} onChange={(e) => onDriverSelect(e.target.value)} required>
              <option value="">Select driver</option>
              {(drivers || []).map((d) => (
                <option key={d.name} value={d.name}>{d.full_name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Truck</Label>
            <Select value={selectedVehicle} onChange={(e) => setSelectedVehicle(e.target.value)} required>
              <option value="">Select truck</option>
              {(vehicles || []).map((v) => (
                <option key={v.name} value={v.name}>
                  {v.license_plate || v.name}
                  {v.make || v.model ? ` · ${[v.make, v.model].filter(Boolean).join(' ')}` : ''}
                </option>
              ))}
            </Select>
            {!(vehicles || []).length ? (
              <p className="mt-1 text-xs text-muted-foreground">
                No vehicles found. Add trucks under Vehicle in ERPNext.
              </p>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDriverModal(null)}>Cancel</Button>
            <Button type="submit" disabled={saving || !selectedVehicle}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assign'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
