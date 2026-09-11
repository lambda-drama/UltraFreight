'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  assignDispatchDriver,
  cancelTransportOrder,
  createBillingCustomer,
  createPortalTransportCustomer,
  createStandaloneTransportOrder,
  createTransportInvoice,
  getDrivers,
  getTransportOrderDefaults,
  getTransportOrders,
  getVehicles,
  markTransportOrderDelivered,
  regenerateTransportOtp,
  rescheduleTransportOrder,
  searchAddressZones,
  searchBillingCustomers,
  searchLinkableDeliveryNotes,
  searchTransportCustomers,
  submitTransportOrder,
  updateTransportOrder,
  uploadAttachedFile,
  type BillingCustomerOption,
  type LinkableDeliveryNoteOption,
  type MasterAddressZoneRow,
  type MasterZoneRow,
  type TransportCustomerOption,
  type TransportOrderRow,
} from '@/services/transport'
import { Badge, Button, DataTable, Input, Label, Modal, PageHeader, Select, Textarea } from '@/components/ui/primitives'
import { SearchCombobox } from '@/components/ui/search-combobox'
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu'
import { FilterToolbar, matchesText } from '@/components/layout/filter-toolbar'
import { ListExportActions } from '@/components/ui/list-export-actions'
import { formatMoney, openPrintView } from '@/lib/utils'
import type { ListExportColumn } from '@/lib/list-export'
import { useAuth } from '@/contexts/auth-context'
import { Ban, CalendarClock, CheckCircle2, FilePlus2, KeyRound, Loader2, PackageCheck, Pencil, Plus, Printer, Trash2 } from 'lucide-react'

const MANAGER_DELIVERY_ROLES = ['Sales Manager', 'System Manager', 'Administrator', 'Manager']

type QuickZoneDraft = {
  key: string
  zone: string
  city: string
  transport_charges: string
  default: boolean
}

function newQuickZoneDraft(partial?: Partial<QuickZoneDraft>): QuickZoneDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    zone: '',
    city: '',
    transport_charges: '',
    default: false,
    ...partial,
  }
}

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
  const { user } = useAuth()
  const canMarkDelivered = Boolean(
    user?.roles?.some((role) => MANAGER_DELIVERY_ROLES.includes(role))
  )
  const [docstatusFilter, setDocstatusFilter] = useState('')
  const [customer, setCustomer] = useState('')
  const [deliveryStatus, setDeliveryStatus] = useState('')
  const { data, isLoading, mutate } = useSWR(['transport-orders', docstatusFilter], () =>
    getTransportOrders(docstatusFilter)
  )
  const { data: drivers } = useSWR('drivers-active', () => getDrivers(false))
  const { data: vehicles } = useSWR('vehicles-list', getVehicles)
  const [editing, setEditing] = useState<TransportOrderRow | null>(null)
  const [qty, setQty] = useState('1')
  const [rate, setRate] = useState('0')
  const [driver, setDriver] = useState('')
  const [vehicleNo, setVehicleNo] = useState('')
  const [addressZone, setAddressZone] = useState('')
  const [lastCustomerInvoice, setLastCustomerInvoice] = useState('')
  const [lastCustomerInvoiceDate, setLastCustomerInvoiceDate] = useState('')
  const [lastCustomerDn, setLastCustomerDn] = useState('')
  const [lastCustomerDnDate, setLastCustomerDnDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState<string | null>(null)
  const [invoicing, setInvoicing] = useState<string | null>(null)
  const [regeneratingOtp, setRegeneratingOtp] = useState<string | null>(null)
  const [approveOrder, setApproveOrder] = useState<TransportOrderRow | null>(null)
  const [approveSendOtp, setApproveSendOtp] = useState(true)
  const [markingDelivered, setMarkingDelivered] = useState<string | null>(null)
  const [invoiceOrder, setInvoiceOrder] = useState<TransportOrderRow | null>(null)
  const [invoiceNote, setInvoiceNote] = useState('')
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [rescheduleOrder, setRescheduleOrder] = useState<TransportOrderRow | null>(null)
  const [rescheduleReason, setRescheduleReason] = useState('')
  const [rescheduling, setRescheduling] = useState<string | null>(null)
  const [cancelOrder, setCancelOrder] = useState<TransportOrderRow | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createCustomer, setCreateCustomer] = useState('')
  const [createRate, setCreateRate] = useState('')
  const [createQty, setCreateQty] = useState('1')
  const [createDeliveryNoteMode, setCreateDeliveryNoteMode] = useState<'system' | 'reference'>('system')
  const [createDeliveryNoteSearch, setCreateDeliveryNoteSearch] = useState('')
  const [createExternalDeliveryNote, setCreateExternalDeliveryNote] = useState('')
  const [createTransportCustomer, setCreateTransportCustomer] = useState('')
  const [createFinalCustomerName, setCreateFinalCustomerName] = useState('')
  const [createFinalPhone, setCreateFinalPhone] = useState('')
  const [createFinalEmail, setCreateFinalEmail] = useState('')
  const [createFinalAddress, setCreateFinalAddress] = useState('')
  const [createNote, setCreateNote] = useState('')
  const [creating, setCreating] = useState(false)
  const [customerSuggestions, setCustomerSuggestions] = useState<BillingCustomerOption[]>([])
  const [deliveryNoteSuggestions, setDeliveryNoteSuggestions] = useState<LinkableDeliveryNoteOption[]>([])
  const [transportCustomerSuggestions, setTransportCustomerSuggestions] = useState<TransportCustomerOption[]>([])
  const [editFinalCustomerName, setEditFinalCustomerName] = useState('')
  const [editFinalPhone, setEditFinalPhone] = useState('')
  const [editFinalEmail, setEditFinalEmail] = useState('')
  const [editFinalAddress, setEditFinalAddress] = useState('')
  const [editTransportCustomer, setEditTransportCustomer] = useState('')
  const [quickBillingOpen, setQuickBillingOpen] = useState(false)
  const [quickBillingName, setQuickBillingName] = useState('')
  const [savingQuickBilling, setSavingQuickBilling] = useState(false)
  const [quickTransportOpen, setQuickTransportOpen] = useState(false)
  const [quickTransportForm, setQuickTransportForm] = useState({
    customer_name: '',
    phone_number: '',
    email: '',
    delivery_address: '',
    city: '',
    send_otp: true,
  })
  const [quickTransportZones, setQuickTransportZones] = useState<QuickZoneDraft[]>([])
  const [quickZoneQuery, setQuickZoneQuery] = useState('')
  const [zoneCatalog, setZoneCatalog] = useState<MasterAddressZoneRow[]>([])
  const [savingQuickTransport, setSavingQuickTransport] = useState(false)
  const { data: createDefaults } = useSWR(createOpen ? 'transport-order-defaults' : null, getTransportOrderDefaults)

  const quickZoneOptions = useMemo(() => {
    const q = quickZoneQuery.trim().toLowerCase()
    return zoneCatalog
      .filter((z) => {
        if (!q) return true
        return (
          z.name.toLowerCase().includes(q) ||
          (z.zone_city || '').toLowerCase().includes(q) ||
          (z.zone_name || '').toLowerCase().includes(q)
        )
      })
      .map((z) => ({
        value: z.name,
        label: z.zone_name || z.name,
        description: [z.zone_city, z.transport_charges != null ? String(z.transport_charges) : '']
          .filter(Boolean)
          .join(' · '),
      }))
  }, [zoneCatalog, quickZoneQuery])

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

  function vehicleLabel(name?: string) {
    if (!name) return 'Not assigned'
    const match = (vehicles || []).find((v) => v.name === name || v.license_plate === name)
    if (!match) return name
    const plate = match.license_plate || match.name
    const detail = [match.make, match.model].filter(Boolean).join(' ')
    return detail ? `${plate} · ${detail}` : plate
  }

  function onDriverChange(driverName: string) {
    setDriver(driverName)
    const match = (drivers || []).find((d) => d.name === driverName)
    const preferred = (match?.vehicle_number || '').trim()
    if (!preferred) return
    const vehicleMatch = (vehicles || []).find(
      (v) => v.name === preferred || v.license_plate === preferred
    )
    if (vehicleMatch) setVehicleNo(vehicleMatch.name)
  }

  function openEdit(order: TransportOrderRow) {
    const item = order.items?.[0]
    const zones = order.zones || []
    const defaultZone =
      order.custom_address_zone ||
      zones.find((z) => Number(z.default) === 1)?.zone ||
      (zones.length === 1 ? zones[0].zone : '')
    const zoneRow = zones.find((z) => z.zone === defaultZone)
    setEditing(order)
    setQty(String(item?.qty ?? 1))
    setRate(String(zoneRow?.transport_charges ?? item?.rate ?? 0))
    setDriver(order.driver || '')
    setVehicleNo(order.vehicle_no || '')
    setAddressZone(defaultZone || '')
    setEditTransportCustomer(order.transport_customer || '')
    setEditFinalCustomerName(order.transport_customer_name || '')
    setEditFinalPhone(order.transport_phone || '')
    setEditFinalEmail(order.transport_email || '')
    setEditFinalAddress(order.transport_address || '')
    setLastCustomerInvoice(order.custom_last_customer_invoice || '')
    setLastCustomerInvoiceDate(order.custom_last_customer_invoice_date || '')
    setLastCustomerDn(order.custom_last_customer_delivery_note || '')
    setLastCustomerDnDate(order.custom_last_customer_delivery_note_date || '')
  }

  function onZoneChange(zoneName: string) {
    setAddressZone(zoneName)
    const zoneRow = (editing?.zones || []).find((z) => z.zone === zoneName)
    if (zoneRow && Number(zoneRow.transport_charges || 0) > 0) {
      setRate(String(zoneRow.transport_charges))
    }
  }

  async function openCreateStandalone() {
    setCreateCustomer('')
    setCreateDeliveryNoteMode('system')
    setCreateDeliveryNoteSearch('')
    setCreateExternalDeliveryNote('')
    setCreateTransportCustomer('')
    setCreateFinalCustomerName('')
    setCreateFinalPhone('')
    setCreateFinalEmail('')
    setCreateFinalAddress('')
    setCreateNote('')
    setCreateQty('1')
    setDeliveryNoteSuggestions([])
    setTransportCustomerSuggestions([])
    setCreateOpen(true)
    try {
      const [defaults, customers, deliveryNotes, transportCustomers] = await Promise.all([
        getTransportOrderDefaults(),
        searchBillingCustomers(''),
        searchLinkableDeliveryNotes(''),
        searchTransportCustomers(''),
      ])
      setCreateRate(String(defaults.default_transport_charges ?? ''))
      setCustomerSuggestions(customers)
      setDeliveryNoteSuggestions(deliveryNotes)
      setTransportCustomerSuggestions(transportCustomers)
    } catch {
      setCreateRate('')
      setCustomerSuggestions([])
      setDeliveryNoteSuggestions([])
      setTransportCustomerSuggestions([])
    }
  }

  async function refreshCustomerSuggestions(search: string) {
    try {
      const customers = await searchBillingCustomers(search)
      setCustomerSuggestions(customers)
    } catch {
      setCustomerSuggestions([])
    }
  }

  async function refreshDeliveryNoteSuggestions(search: string) {
    try {
      const deliveryNotes = await searchLinkableDeliveryNotes(search)
      setDeliveryNoteSuggestions(deliveryNotes)
      const exact = deliveryNotes.find((row) => row.name === search.trim())
      if (exact && !exact.already_linked) {
        applyDeliveryNoteFinalCustomer(exact)
      }
    } catch {
      setDeliveryNoteSuggestions([])
    }
  }

  async function refreshTransportCustomerSuggestions(search: string) {
    try {
      const rows = await searchTransportCustomers(search)
      setTransportCustomerSuggestions(rows)
    } catch {
      setTransportCustomerSuggestions([])
    }
  }

  function applyDeliveryNoteFinalCustomer(row: LinkableDeliveryNoteOption) {
    if (row.transport_customer) setCreateTransportCustomer(row.transport_customer)
    if (row.transport_customer_name) setCreateFinalCustomerName(row.transport_customer_name)
    if (row.transport_phone) setCreateFinalPhone(row.transport_phone)
    if (row.transport_email) setCreateFinalEmail(row.transport_email || '')
    if (row.transport_address) setCreateFinalAddress(row.transport_address || '')
  }

  function applyTransportCustomerSelection(value: string, target: 'create' | 'edit' = 'create') {
    const match = transportCustomerSuggestions.find(
      (row) => row.name === value || row.customer_name === value
    )
    if (!match) {
      if (target === 'create') {
        setCreateTransportCustomer('')
        setCreateFinalCustomerName(value)
      } else {
        setEditTransportCustomer('')
        setEditFinalCustomerName(value)
      }
      return
    }
    if (target === 'create') {
      setCreateTransportCustomer(match.name)
      setCreateFinalCustomerName(match.customer_name || match.name)
      setCreateFinalPhone(match.phone_number || '')
      setCreateFinalEmail(match.email || '')
      setCreateFinalAddress(match.delivery_address || '')
    } else {
      setEditTransportCustomer(match.name)
      setEditFinalCustomerName(match.customer_name || match.name)
      setEditFinalPhone(match.phone_number || '')
      setEditFinalEmail(match.email || '')
      setEditFinalAddress(match.delivery_address || '')
    }
  }

  async function handleQuickCreateBilling(e: React.FormEvent) {
    e.preventDefault()
    if (!quickBillingName.trim()) {
      toast.error('Enter a customer name')
      return
    }
    setSavingQuickBilling(true)
    try {
      const created = await createBillingCustomer({ customer_name: quickBillingName.trim() })
      setCreateCustomer(created.name)
      setCustomerSuggestions((prev) => {
        if (prev.some((row) => row.name === created.name)) return prev
        return [{ name: created.name, customer_name: created.customer_name }, ...prev]
      })
      toast.success(
        created.already_existed
          ? `Using existing customer ${created.name}`
          : `Billing customer ${created.name} created`
      )
      setQuickBillingOpen(false)
      setQuickBillingName('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create billing customer')
    } finally {
      setSavingQuickBilling(false)
    }
  }

  async function handleQuickCreateTransportCustomer(e: React.FormEvent) {
    e.preventDefault()
    if (!quickTransportForm.customer_name.trim() || !quickTransportForm.phone_number.trim()) {
      toast.error('Name and phone are required')
      return
    }
    const zonePayload: MasterZoneRow[] = quickTransportZones
      .filter((row) => row.zone.trim())
      .map((row) => ({
        zone: row.zone.trim(),
        city: row.city.trim() || undefined,
        transport_charges: row.transport_charges.trim() ? Number(row.transport_charges) : undefined,
        default: row.default ? 1 : 0,
      }))
    setSavingQuickTransport(true)
    try {
      const created = await createPortalTransportCustomer({
        customer_name: quickTransportForm.customer_name.trim(),
        phone_number: quickTransportForm.phone_number.trim(),
        email: quickTransportForm.email.trim() || undefined,
        delivery_address: quickTransportForm.delivery_address.trim() || undefined,
        city: quickTransportForm.city.trim() || undefined,
        send_otp: quickTransportForm.send_otp ? 1 : 0,
        zones: zonePayload,
      })
      setCreateTransportCustomer(created.name)
      setCreateFinalCustomerName(created.customer_name || created.name)
      setCreateFinalPhone(created.phone_number || '')
      setCreateFinalEmail(created.email || '')
      setCreateFinalAddress(created.delivery_address || '')
      setTransportCustomerSuggestions((prev) => {
        if (prev.some((row) => row.name === created.name)) return prev
        return [
          {
            name: created.name,
            customer_name: created.customer_name,
            phone_number: created.phone_number,
            email: created.email,
            delivery_address: created.delivery_address,
          },
          ...prev,
        ]
      })
      toast.success(`Transport customer ${created.name} created`)
      setQuickTransportOpen(false)
      setQuickTransportForm({
        customer_name: '',
        phone_number: '',
        email: '',
        delivery_address: '',
        city: '',
        send_otp: true,
      })
      setQuickTransportZones([])
      setQuickZoneQuery('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create transport customer')
    } finally {
      setSavingQuickTransport(false)
    }
  }

  function addQuickZoneRow() {
    setQuickTransportZones((prev) => [...prev, newQuickZoneDraft({ default: prev.length === 0 })])
  }

  function updateQuickZoneRow(key: string, patch: Partial<QuickZoneDraft>) {
    setQuickTransportZones((prev) =>
      prev.map((row) => {
        if (row.key !== key) {
          if (patch.default) return { ...row, default: false }
          return row
        }
        return { ...row, ...patch }
      })
    )
  }

  function applyQuickZoneSelection(key: string, zoneName: string) {
    const match = zoneCatalog.find((z) => z.name === zoneName)
    updateQuickZoneRow(key, {
      zone: zoneName,
      city: match?.zone_city || '',
      transport_charges:
        match?.transport_charges != null && match.transport_charges !== undefined
          ? String(match.transport_charges)
          : '',
    })
  }

  function removeQuickZoneRow(key: string) {
    setQuickTransportZones((prev) => {
      const next = prev.filter((row) => row.key !== key)
      if (next.length && !next.some((row) => row.default)) {
        next[0] = { ...next[0], default: true }
      }
      return next
    })
  }

  async function loadZoneCatalog(search = '') {
    try {
      const rows = await searchAddressZones(search)
      setZoneCatalog(rows || [])
    } catch {
      // Keep previous catalog on search failure
    }
  }

  function openQuickTransportCreate() {
    setQuickTransportForm({
      customer_name: createFinalCustomerName.trim(),
      phone_number: createFinalPhone.trim(),
      email: createFinalEmail.trim(),
      delivery_address: createFinalAddress.trim(),
      city: '',
      send_otp: true,
    })
    setQuickTransportZones([])
    setQuickZoneQuery('')
    setQuickTransportOpen(true)
    void loadZoneCatalog('')
  }

  async function handleCreateStandalone(e: React.FormEvent) {
    e.preventDefault()
    if (!createCustomer.trim()) {
      toast.error('Select a billing customer')
      return
    }
    if (createFinalCustomerName.trim() && !createFinalPhone.trim()) {
      toast.error('Final transport customer phone is required when a name is set')
      return
    }
    if (createFinalPhone.trim() && !createFinalCustomerName.trim()) {
      toast.error('Final transport customer name is required when a phone is set')
      return
    }
    setCreating(true)
    try {
      const result = await createStandaloneTransportOrder({
        customer: createCustomer.trim(),
        rate: createRate.trim() ? Number(createRate) : undefined,
        qty: Number(createQty) || 1,
        delivery_note:
          createDeliveryNoteMode === 'system'
            ? createDeliveryNoteSearch.trim() || undefined
            : undefined,
        external_delivery_note:
          createDeliveryNoteMode === 'reference'
            ? createExternalDeliveryNote.trim() || undefined
            : undefined,
        note: createNote.trim() || undefined,
        transport_customer: createTransportCustomer.trim() || undefined,
        transport_customer_name: createFinalCustomerName.trim() || undefined,
        transport_phone: createFinalPhone.trim() || undefined,
        transport_email: createFinalEmail.trim() || undefined,
        transport_address: createFinalAddress.trim() || undefined,
      })
      toast.success(`Draft transport order ${result.name} created`)
      setCreateOpen(false)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create transport order')
    } finally {
      setCreating(false)
    }
  }

  function openApprove(order: TransportOrderRow) {
    const linkedDn = Boolean(order.custom_delivery_note_to_be_transported)
    if (linkedDn && !order.driver) {
      toast.error('Choose a driver before approving — use Edit to assign a driver.')
      openEdit(order)
      return
    }
    if (linkedDn && (order.zones || []).length > 0 && !order.custom_address_zone) {
      toast.error('Choose an address zone before approving.')
      openEdit(order)
      return
    }
    setApproveSendOtp(Number(order.send_otp ?? 1) === 1)
    setApproveOrder(order)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    if ((editing.zones || []).length > 0 && !addressZone) {
      toast.error('Select an address zone')
      return
    }
    if (editing.custom_delivery_note_to_be_transported && !driver) {
      toast.error('Select a driver')
      return
    }
    if (editFinalCustomerName.trim() && !editFinalPhone.trim()) {
      toast.error('Final transport customer phone is required when a name is set')
      return
    }
    setSaving(true)
    try {
      await updateTransportOrder(editing.name, {
        qty: Number(qty),
        rate: Number(rate),
        custom_address_zone: addressZone || undefined,
        custom_last_customer_invoice: lastCustomerInvoice,
        custom_last_customer_invoice_date: lastCustomerInvoiceDate,
        custom_last_customer_delivery_note: lastCustomerDn,
        custom_last_customer_delivery_note_date: lastCustomerDnDate,
        transport_customer: editTransportCustomer.trim() || undefined,
        transport_customer_name: editFinalCustomerName.trim() || undefined,
        transport_phone: editFinalPhone.trim() || undefined,
        transport_email: editFinalEmail.trim() || undefined,
        transport_address: editFinalAddress.trim() || undefined,
      })
      const dn = editing.custom_delivery_note_to_be_transported
      if (dn && driver) {
        await assignDispatchDriver(dn, driver, vehicleNo)
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
    if (approveOrder?.custom_delivery_note_to_be_transported && !approveOrder?.driver) {
      toast.error('Choose a driver before approving.')
      return
    }
    setApproving(approveOrder!.name)
    try {
      await submitTransportOrder(approveOrder!.name, approveSendOtp)
      toast.success(
        approveOrder!.custom_delivery_note_to_be_transported
          ? approveSendOtp
            ? 'Order approved — OTP generated and delivery is In Transit'
            : 'Order approved — delivery is In Transit (OTP skipped)'
          : 'Standalone transport order submitted'
      )
      setApproveOrder(null)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not approve order')
    } finally {
      setApproving(null)
    }
  }

  async function handleMarkDelivered(order: TransportOrderRow) {
    setMarkingDelivered(order.name)
    try {
      await markTransportOrderDelivered(order.name)
      toast.success('Marked as delivered — pending invoicing')
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not mark as delivered')
    } finally {
      setMarkingDelivered(null)
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

  function openReschedule(order: TransportOrderRow) {
    setRescheduleOrder(order)
    setRescheduleReason(order.custom_reason_for_reschedule || '')
  }

  async function handleReschedule() {
    if (!rescheduleOrder) return
    if (!rescheduleReason.trim()) {
      toast.error('Enter a reschedule reason')
      return
    }
    setRescheduling(rescheduleOrder.name)
    try {
      await rescheduleTransportOrder(rescheduleOrder.name, rescheduleReason.trim())
      toast.success('Transport order marked as rescheduled')
      setRescheduleOrder(null)
      setRescheduleReason('')
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reschedule order')
    } finally {
      setRescheduling(null)
    }
  }

  function openCancel(order: TransportOrderRow) {
    setCancelOrder(order)
    setCancelReason('')
  }

  async function handleCancel() {
    if (!cancelOrder) return
    setCancelling(cancelOrder.name)
    try {
      const result = await cancelTransportOrder(cancelOrder.name, cancelReason.trim() || undefined)
      toast.success(
        result.new_transport_order
          ? `Order cancelled. New draft ${result.new_transport_order} created.`
          : 'Transport order cancelled'
      )
      setCancelOrder(null)
      setCancelReason('')
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not cancel order')
    } finally {
      setCancelling(null)
    }
  }

  const exportColumns: ListExportColumn[] = [
    { key: 'name', label: 'Sales Order' },
    { key: 'custom_delivery_note_to_be_transported', label: 'Delivery Note' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'custom_address_zone', label: 'Zone', value: (row) => String(row.custom_address_zone || '') },
    {
      key: 'docstatus',
      label: 'Order Status',
      value: (row) => (Number(row.docstatus) === 1 ? 'Submitted' : 'Draft'),
    },
    { key: 'delivery_status', label: 'Delivery Status' },
    {
      key: 'driver',
      label: 'Driver',
      value: (row) => driverLabel(String(row.driver || '')),
    },
    {
      key: 'vehicle_no',
      label: 'Truck',
      value: (row) => (row.vehicle_no ? vehicleLabel(String(row.vehicle_no)) : ''),
    },
    {
      key: 'grand_total',
      label: 'Amount',
      value: (row) => formatMoney(Number(row.grand_total || 0), String(row.currency || '')),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Transport Orders"
        description="Assign driver and customer invoice refs, approve to dispatch, then create the transport invoice after delivery"
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={openCreateStandalone}
              className="h-10 w-10 px-0"
              title="New transport order"
              aria-label="New transport order"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <ListExportActions
              title="Transport Orders"
              columns={exportColumns}
              rows={rows as unknown as Record<string, unknown>[]}
            />
          </div>
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
              key: 'custom_address_zone',
              label: 'Zone',
              render: (row) => String(row.custom_address_zone || '—'),
            },
            {
              key: 'docstatus',
              label: 'Order Status',
              render: (row) => (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={Number(row.docstatus) === 1 ? 'success' : 'warning'}>
                    {Number(row.docstatus) === 1 ? 'Submitted' : 'Draft'}
                  </Badge>
                  {Number(row.custom_reschedule_transport_order) === 1 ? (
                    <Badge variant="warning">Rescheduled</Badge>
                  ) : null}
                </div>
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
              label: 'Driver / Truck',
              render: (row) => {
                const driverName = String(row.driver || 'Not assigned')
                const truck = row.vehicle_no ? vehicleLabel(row.vehicle_no) : null
                return truck && row.driver ? `${driverLabel(row.driver)} · ${truck}` : driverName
              },
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
                  regeneratingOtp === order.name ||
                  rescheduling === order.name ||
                  cancelling === order.name ||
                  markingDelivered === order.name

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
                  menuItems.push({
                    key: 'reschedule',
                    label: rescheduling === order.name ? 'Rescheduling…' : 'Reschedule',
                    icon:
                      rescheduling === order.name ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CalendarClock className="h-4 w-4" />
                      ),
                    disabled: rescheduling === order.name,
                    onClick: () => openReschedule(order),
                  })
                }

                if (
                  canMarkDelivered &&
                  isSubmitted &&
                  order.delivery_status === 'In Transit' &&
                  !completed
                ) {
                  menuItems.push({
                    key: 'mark-delivered',
                    label:
                      markingDelivered === order.name ? 'Marking delivered…' : 'Mark as delivered',
                    icon:
                      markingDelivered === order.name ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PackageCheck className="h-4 w-4" />
                      ),
                    disabled: markingDelivered === order.name,
                    onClick: () => handleMarkDelivered(order),
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

                if (isSubmitted && order.delivery_status === 'In Transit') {
                  menuItems.push({
                    key: 'cancel',
                    label: cancelling === order.name ? 'Cancelling…' : 'Cancel order',
                    icon:
                      cancelling === order.name ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Ban className="h-4 w-4" />
                      ),
                    destructive: true,
                    disabled: cancelling === order.name,
                    onClick: () => openCancel(order),
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
                      title={
                        order.transport_sales_invoice
                          ? 'Print transport invoice'
                          : 'Print transport order'
                      }
                      aria-label={
                        order.transport_sales_invoice
                          ? 'Print transport invoice'
                          : 'Print transport order'
                      }
                      disabled={busy}
                      onClick={() =>
                        order.transport_sales_invoice
                          ? openPrintView('Sales Invoice', order.transport_sales_invoice!)
                          : openPrintView('Sales Order', order.name)
                      }
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
        open={!!editing}
        title={editing?.name || 'Transport Order'}
        onClose={() => setEditing(null)}
        className="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {editing?.custom_delivery_note_to_be_transported
              ? `Delivery Note: ${editing.custom_delivery_note_to_be_transported}`
              : 'Standalone order — link a delivery note when creating to assign a driver.'}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {editing?.custom_delivery_note_to_be_transported ? (
              <>
                <div>
                  <Label>Driver</Label>
                  <Select value={driver} onChange={(e) => onDriverChange(e.target.value)} required>
                    <option value="">Select driver</option>
                    {(drivers || []).map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.full_name}
                      </option>
                    ))}
                  </Select>
                  {!(drivers || []).length ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      No active drivers found for your transport company.
                    </p>
                  ) : null}
                </div>
                <div>
                  <Label>Truck (optional)</Label>
                  <Select value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)}>
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
                      No vehicles found — you can still save with a driver only.
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}

            <div className="sm:col-span-2 rounded-xl border border-border p-3 space-y-3">
              <div>
                <p className="text-sm font-medium">Final transport customer</p>
                <p className="text-xs text-muted-foreground">
                  {editing?.custom_delivery_note_to_be_transported
                    ? 'Updates the linked delivery note final customer details.'
                    : 'Stored on this standalone transport order.'}
                </p>
              </div>
              <div>
                <Label>Customer name</Label>
                <SearchCombobox
                  value={editFinalCustomerName}
                  onChange={(value) => {
                    setEditFinalCustomerName(value)
                    setEditTransportCustomer('')
                    void refreshTransportCustomerSuggestions(value)
                  }}
                  onSearch={(value) => void refreshTransportCustomerSuggestions(value)}
                  onSelect={(option) => applyTransportCustomerSelection(option.value, 'edit')}
                  options={transportCustomerSuggestions.map((row) => ({
                    value: row.name,
                    label: row.customer_name || row.name,
                    description: [row.phone_number, row.name].filter(Boolean).join(' · '),
                  }))}
                  placeholder="Search or type final customer name"
                  emptyText="No transport customers — type a new name"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Phone</Label>
                  <Input value={editFinalPhone} onChange={(e) => setEditFinalPhone(e.target.value)} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editFinalEmail}
                    onChange={(e) => setEditFinalEmail(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Delivery address</Label>
                <Textarea
                  value={editFinalAddress}
                  onChange={(e) => setEditFinalAddress(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            {(editing?.zones || []).length > 0 ? (
              <div className="sm:col-span-2">
                <Label>Address Zone</Label>
                <Select value={addressZone} onChange={(e) => onZoneChange(e.target.value)} required>
                  <option value="">Select zone</option>
                  {(editing?.zones || []).map((z) => (
                    <option key={z.zone} value={z.zone}>
                      {z.zone}
                      {z.city ? ` · ${z.city}` : ''}
                      {Number(z.default) === 1 ? ' (default)' : ''}
                      {Number(z.transport_charges || 0) > 0 ? ` · ${z.transport_charges}` : ''}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Charge comes from the zone; if the zone has no charge, Transport Settings is used.
                </p>
              </div>
            ) : (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
                No zones on this transport customer — using Transport Settings charge.
              </p>
            )}

            <div>
              <Label>Quantity</Label>
              <Input type="number" min="0.001" step="any" value={qty} onChange={(e) => setQty(e.target.value)} required />
            </div>
            <div>
              <Label>Rate / Amount per unit</Label>
              <Input type="number" min="0" step="any" value={rate} onChange={(e) => setRate(e.target.value)} required />
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
            Estimated total: {formatMoney(Number(qty || 0) * Number(rate || 0), editing?.currency)}
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-3 text-sm font-medium">Customer & company references</p>
            <div className="space-y-3">
              <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm sm:grid-cols-2">
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
              <div className="grid gap-3 sm:grid-cols-2">
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
                <span className="text-muted-foreground">Truck</span>
                <span className="font-medium">{vehicleLabel(approveOrder.vehicle_no)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Address zone</span>
                <span className="font-medium">{approveOrder.custom_address_zone || 'Not set'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Transport charge</span>
                <span className="font-medium">{formatMoney(Number(approveOrder.grand_total || 0), approveOrder.currency)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-muted/30 p-4">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-border"
                  checked={approveSendOtp}
                  onChange={(e) => setApproveSendOtp(e.target.checked)}
                  disabled={!!approving}
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">Send OTP</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    Uncheck if this transport customer does not need OTP confirmation.
                  </span>
                </span>
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">What happens next</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {approveSendOtp ? (
                  <>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                      OTP is generated for driver confirmation
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                      Driver and customer are notified by SMS
                    </li>
                  </>
                ) : (
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                    OTP is skipped — confirm delivery later from this portal
                  </li>
                )}
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

      <Modal
        open={!!rescheduleOrder}
        title="Reschedule Transport Order"
        onClose={() => {
          if (rescheduling) return
          setRescheduleOrder(null)
          setRescheduleReason('')
        }}
      >
        {rescheduleOrder ? (
          <div className="space-y-5">
            <div className="flex items-start gap-4 rounded-2xl bg-secondary/10 p-4 ring-1 ring-secondary/20">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-foreground">Push this draft order forward?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Mark {rescheduleOrder.name} as rescheduled. A reason is required.
                </p>
              </div>
            </div>
            <div>
              <Label>Reason for reschedule</Label>
              <Textarea
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                placeholder="Why is this order being rescheduled?"
                rows={3}
                required
                disabled={!!rescheduling}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRescheduleOrder(null)
                  setRescheduleReason('')
                }}
                disabled={!!rescheduling}
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={handleReschedule}
                disabled={!!rescheduling || !rescheduleReason.trim()}
              >
                {rescheduling === rescheduleOrder.name ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CalendarClock className="mr-2 h-4 w-4" />
                    Reschedule
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!cancelOrder}
        title="Cancel Transport Order"
        onClose={() => {
          if (cancelling) return
          setCancelOrder(null)
          setCancelReason('')
        }}
      >
        {cancelOrder ? (
          <div className="space-y-5">
            <div className="flex items-start gap-4 rounded-2xl bg-destructive/10 p-4 ring-1 ring-destructive/20">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                <Ban className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-foreground">Cancel {cancelOrder.name}?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  This cancels the submitted transport order, reopens the delivery as Open, and creates a new draft order.
                  If an invoice already exists, create a credit note instead.
                </p>
              </div>
            </div>
            <div>
              <Label>Cancel reason (optional)</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Why is this order being cancelled?"
                rows={3}
                disabled={!!cancelling}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCancelOrder(null)
                  setCancelReason('')
                }}
                disabled={!!cancelling}
              >
                Keep order
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleCancel}
                disabled={!!cancelling}
              >
                {cancelling === cancelOrder.name ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Ban className="mr-2 h-4 w-4" />
                    Cancel order
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={createOpen}
        title="New Transport Order"
        onClose={() => {
          if (creating) return
          setCreateOpen(false)
        }}
      >
        <form className="space-y-4" onSubmit={handleCreateStandalone}>
          <p className="text-sm text-muted-foreground">
            Create a standalone draft transport sales order under{' '}
            <strong>{createDefaults?.transport_company || 'your transport company'}</strong>.
            Link a delivery note optionally; leave it blank for billing-only orders.
          </p>
          <div>
            <Label>Billing customer *</Label>
            <SearchCombobox
              value={createCustomer}
              onChange={(value) => {
                setCreateCustomer(value)
                void refreshCustomerSuggestions(value)
              }}
              onSearch={(value) => void refreshCustomerSuggestions(value)}
              onSelect={(option) => setCreateCustomer(option.value)}
              options={customerSuggestions.map((row) => ({
                value: row.name,
                label: row.customer_name || row.name,
                description: row.customer_name && row.customer_name !== row.name ? row.name : undefined,
              }))}
              placeholder="Search billing customer…"
              required
              disabled={creating}
              emptyText="No customers found"
              endAction={
                <button
                  type="button"
                  title="New billing customer"
                  aria-label="New billing customer"
                  disabled={creating}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-45"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQuickBillingName(createCustomer.trim())
                    setQuickBillingOpen(true)
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              }
            />
          </div>
          <div className="rounded-xl border border-border p-3 space-y-3">
            <div>
              <p className="text-sm font-medium">Final transport customer</p>
              <p className="mb-3 text-xs text-muted-foreground">
                The end customer receiving the goods. Pick an existing Transport Customer or create one.
              </p>
            </div>
            <div>
              <Label>Customer name</Label>
              <SearchCombobox
                value={createFinalCustomerName}
                onChange={(value) => {
                  setCreateFinalCustomerName(value)
                  setCreateTransportCustomer('')
                  void refreshTransportCustomerSuggestions(value)
                }}
                onSearch={(value) => void refreshTransportCustomerSuggestions(value)}
                onSelect={(option) => applyTransportCustomerSelection(option.value, 'create')}
                options={transportCustomerSuggestions.map((row) => ({
                  value: row.name,
                  label: row.customer_name || row.name,
                  description: [row.phone_number, row.name].filter(Boolean).join(' · '),
                }))}
                placeholder="Search or type final customer name"
                disabled={creating}
                emptyText="No transport customers — use + to create"
                endAction={
                  <button
                    type="button"
                    title="New transport customer"
                    aria-label="New transport customer"
                    disabled={creating}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-45"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={openQuickTransportCreate}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                }
              />
              {createTransportCustomer ? (
                <p className="mt-1 text-xs text-muted-foreground">Linked: {createTransportCustomer}</p>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Phone</Label>
                <Input
                  value={createFinalPhone}
                  onChange={(e) => setCreateFinalPhone(e.target.value)}
                  placeholder="07…"
                  disabled={creating}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={createFinalEmail}
                  onChange={(e) => setCreateFinalEmail(e.target.value)}
                  placeholder="optional"
                  disabled={creating}
                />
              </div>
            </div>
            <div>
              <Label>Delivery address</Label>
              <Textarea
                value={createFinalAddress}
                onChange={(e) => setCreateFinalAddress(e.target.value)}
                placeholder="Delivery address"
                rows={2}
                disabled={creating}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Rate</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={createRate}
                onChange={(e) => setCreateRate(e.target.value)}
                placeholder={String(createDefaults?.default_transport_charges ?? '0')}
                disabled={creating}
              />
            </div>
            <div>
              <Label>Qty</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={createQty}
                onChange={(e) => setCreateQty(e.target.value)}
                disabled={creating}
              />
            </div>
          </div>
          <div>
            <Label>Delivery Note (optional)</Label>
            <div className="mb-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant={createDeliveryNoteMode === 'system' ? 'default' : 'outline'}
                onClick={() => setCreateDeliveryNoteMode('system')}
                disabled={creating}
                className="px-3 py-1.5 text-xs"
              >
                From system
              </Button>
              <Button
                type="button"
                variant={createDeliveryNoteMode === 'reference' ? 'default' : 'outline'}
                onClick={() => setCreateDeliveryNoteMode('reference')}
                disabled={creating}
                className="px-3 py-1.5 text-xs"
              >
                Enter reference
              </Button>
            </div>
            {createDeliveryNoteMode === 'system' ? (
              <>
                <p className="mb-2 text-xs text-muted-foreground">
                  Pick from suggestions or type a delivery note name / number from ERPNext.
                </p>
                <SearchCombobox
                  value={createDeliveryNoteSearch}
                  onChange={(value) => {
                    setCreateDeliveryNoteSearch(value)
                    void refreshDeliveryNoteSuggestions(value)
                  }}
                  onSearch={(value) => void refreshDeliveryNoteSuggestions(value)}
                  onSelect={(option) => {
                    setCreateDeliveryNoteSearch(option.value)
                    const match = deliveryNoteSuggestions.find((row) => row.name === option.value)
                    if (match) applyDeliveryNoteFinalCustomer(match)
                  }}
                  options={deliveryNoteSuggestions
                    .filter((row) => !row.already_linked)
                    .map((row) => ({
                      value: row.name,
                      label: row.name,
                      description: row.label || row.customer_name || undefined,
                    }))}
                  placeholder="DN-000123 or search by customer…"
                  disabled={creating}
                  emptyText="No linkable delivery notes"
                />
              </>
            ) : (
              <>
                <p className="mb-2 text-xs text-muted-foreground">
                  Store an external delivery note reference only. This does not link an ERPNext delivery note, so driver assignment is not available until you link one later.
                </p>
                <Input
                  value={createExternalDeliveryNote}
                  onChange={(e) => setCreateExternalDeliveryNote(e.target.value)}
                  placeholder="External delivery note number"
                  disabled={creating}
                />
              </>
            )}
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Textarea
              value={createNote}
              onChange={(e) => setCreateNote(e.target.value)}
              placeholder="Standalone transport charge details"
              rows={3}
              disabled={creating}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create draft order'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={quickBillingOpen}
        title="New Billing Customer"
        onClose={() => {
          if (savingQuickBilling) return
          setQuickBillingOpen(false)
        }}
      >
        <form className="space-y-4" onSubmit={handleQuickCreateBilling}>
          <p className="text-sm text-muted-foreground">
            Creates an ERPNext Customer used as the billing party on the transport sales order.
          </p>
          <div>
            <Label>Customer name *</Label>
            <Input
              value={quickBillingName}
              onChange={(e) => setQuickBillingName(e.target.value)}
              required
              disabled={savingQuickBilling}
              placeholder="e.g. Acme Traders Ltd"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setQuickBillingOpen(false)}
              disabled={savingQuickBilling}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={savingQuickBilling}>
              {savingQuickBilling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={quickTransportOpen}
        title="New Transport Customer"
        onClose={() => {
          if (savingQuickTransport) return
          setQuickTransportOpen(false)
        }}
        className="max-w-2xl"
      >
        <form className="space-y-4" onSubmit={handleQuickCreateTransportCustomer}>
          <p className="text-sm text-muted-foreground">
            Creates the final transport customer (end recipient) and fills the fields on this order.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Customer name *</Label>
              <Input
                value={quickTransportForm.customer_name}
                onChange={(e) =>
                  setQuickTransportForm({ ...quickTransportForm, customer_name: e.target.value })
                }
                required
                disabled={savingQuickTransport}
                autoFocus
              />
            </div>
            <div>
              <Label>Phone *</Label>
              <Input
                value={quickTransportForm.phone_number}
                onChange={(e) =>
                  setQuickTransportForm({ ...quickTransportForm, phone_number: e.target.value })
                }
                required
                disabled={savingQuickTransport}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={quickTransportForm.email}
                onChange={(e) => setQuickTransportForm({ ...quickTransportForm, email: e.target.value })}
                disabled={savingQuickTransport}
              />
            </div>
            <div>
              <Label>City</Label>
              <Input
                value={quickTransportForm.city}
                onChange={(e) => setQuickTransportForm({ ...quickTransportForm, city: e.target.value })}
                disabled={savingQuickTransport}
              />
            </div>
          </div>
          <div>
            <Label>Delivery address</Label>
            <Textarea
              value={quickTransportForm.delivery_address}
              onChange={(e) =>
                setQuickTransportForm({ ...quickTransportForm, delivery_address: e.target.value })
              }
              rows={2}
              disabled={savingQuickTransport}
            />
          </div>
          <div className="rounded-xl border border-border p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Zones</p>
                <p className="text-xs text-muted-foreground">
                  Assign address zones and optional charge overrides.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-9 w-9 px-0"
                onClick={addQuickZoneRow}
                disabled={savingQuickTransport}
                aria-label="Add zone"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {!quickTransportZones.length ? (
              <p className="text-xs text-muted-foreground">No zones assigned yet.</p>
            ) : (
              <div className="space-y-3">
                {quickTransportZones.map((row) => (
                  <div key={row.key} className="grid gap-2 rounded-xl bg-muted/30 p-3 sm:grid-cols-12">
                    <div className="sm:col-span-4">
                      <Label>Zone</Label>
                      <SearchCombobox
                        value={row.zone}
                        onChange={(value) => {
                          setQuickZoneQuery(value)
                          updateQuickZoneRow(row.key, { zone: value })
                        }}
                        onSearch={(value) => {
                          setQuickZoneQuery(value)
                          void loadZoneCatalog(value)
                        }}
                        onSelect={(option) => applyQuickZoneSelection(row.key, option.value)}
                        options={quickZoneOptions}
                        placeholder="Search zone…"
                        disabled={savingQuickTransport}
                        emptyText="No zones — create under Master → Zones"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <Label>City</Label>
                      <Input
                        value={row.city}
                        onChange={(e) => updateQuickZoneRow(row.key, { city: e.target.value })}
                        disabled={savingQuickTransport}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Charge</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.transport_charges}
                        onChange={(e) =>
                          updateQuickZoneRow(row.key, { transport_charges: e.target.value })
                        }
                        disabled={savingQuickTransport}
                      />
                    </div>
                    <div className="flex items-end justify-between gap-2 sm:col-span-2">
                      <label className="flex items-center gap-2 pb-2 text-xs">
                        <input
                          type="checkbox"
                          checked={row.default}
                          onChange={(e) =>
                            updateQuickZoneRow(row.key, { default: e.target.checked })
                          }
                          disabled={savingQuickTransport}
                        />
                        Default
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 w-9 px-0"
                        onClick={() => removeQuickZoneRow(row.key)}
                        disabled={savingQuickTransport}
                        aria-label="Remove zone"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={quickTransportForm.send_otp}
              onChange={(e) =>
                setQuickTransportForm({ ...quickTransportForm, send_otp: e.target.checked })
              }
              disabled={savingQuickTransport}
            />
            Send OTP on dispatch
          </label>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setQuickTransportOpen(false)}
              disabled={savingQuickTransport}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={savingQuickTransport}>
              {savingQuickTransport ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
