import { apiRequest } from './apiClient'

const API = '/api/method/ultrafreight.ultra_freight.api.transport_portal'

export interface DashboardStats {
  open_dispatches?: number
  needs_action?: number
  pending_dispatches: number
  in_transit: number
  pending_invoicing?: number
  completed?: number
  active_otps: number
  transport_orders: number
  transport_invoices: number
  drivers: number
  currency?: string
  total_invoiced_amount?: number
  draft_order_amount?: number
  submitted_order_amount?: number
  avg_invoice_amount?: number
  top_transport_customers?: {
    customer: string
    invoice_count: number
    total_amount: number
  }[]
  monthly_invoice_trend?: {
    month: string
    label: string
    amount: number
    count: number
  }[]
}

export interface ItemStatus {
  item_code: string
  item_name: string
  qty_ordered: number
  qty_delivered?: number | null
  uom?: string
  status: string
}

export interface DispatchRow {
  name: string
  customer: string
  customer_name?: string
  posting_date?: string
  delivery_status?: string
  driver?: string
  transport_customer_name?: string
  transport_phone?: string
  transport_email?: string
  transport_address?: string
  otp?: string
  otp_expires_at?: string
  transport_sales_order?: string
  transport_sales_invoice?: string
  confirmation_log?: string
  sms_status?: string
  transport_order_submitted?: boolean
  needs_action?: boolean
  items?: DeliveryItem[]
  item_status?: ItemStatus[]
}

export interface DeliveryItem {
  item_code: string
  item_name: string
  qty: number
  uom?: string
}

export interface TransportOrderRow {
  name: string
  customer_name?: string
  custom_delivery_note_to_be_transported?: string
  docstatus: number
  grand_total?: number
  currency?: string
  delivery_status?: string
  driver?: string
  transport_sales_invoice?: string
  custom_main_company_invoice?: string
  custom_main_company_invoice_date?: string
  custom_last_customer_invoice?: string
  custom_last_customer_invoice_date?: string
  custom_last_customer_delivery_note?: string
  custom_last_customer_delivery_note_date?: string
  custom_final_customer_feedback_document?: string
  custom_note?: string
  items?: {
    name?: string
    item_code: string
    item_name: string
    qty: number
    rate: number
    amount: number
    uom?: string
  }[]
}

export interface DriverRow {
  name: string
  full_name: string
  cell_number?: string
  vehicle_number?: string
  transport_company?: string
  unique_key?: string
  status?: string
}

export interface ConfirmationLogRow {
  name: string
  delivery_note: string
  sales_order?: string
  driver?: string
  transport_customer?: string
  otp?: string
  confirmation_time?: string
  status: string
  completion_type?: string
  partial_reason?: string
  items?: {
    item_code: string
    item_name: string
    qty_ordered: number
    qty_delivered: number
    uom?: string
  }[]
}

export function getDashboardStats() {
  return apiRequest<DashboardStats>(`${API}.get_dashboard_stats`)
}

export function getDispatches(params?: { status?: string; filter?: string; search?: string }) {
  return apiRequest<DispatchRow[]>(`${API}.get_dispatches`, {
    method: 'POST',
    body: JSON.stringify({
      status: params?.status || '',
      filter: params?.filter || '',
      search: params?.search || '',
    }),
  })
}

export function getDispatchDetail(deliveryNote: string) {
  return apiRequest<Record<string, unknown>>(`${API}.get_dispatch_detail`, {
    method: 'POST',
    body: JSON.stringify({ delivery_note: deliveryNote }),
  })
}

export function assignDispatchDriver(deliveryNote: string, driver: string) {
  return apiRequest(`${API}.assign_dispatch_driver`, {
    method: 'POST',
    body: JSON.stringify({ delivery_note: deliveryNote, driver }),
  })
}

export function updateDispatchTransportCustomer(
  deliveryNote: string,
  payload: {
    transport_customer_name?: string
    transport_phone?: string
    transport_email?: string
    transport_address?: string
  }
) {
  return apiRequest(`${API}.update_dispatch_transport_customer`, {
    method: 'POST',
    body: JSON.stringify({ delivery_note: deliveryNote, ...payload }),
  })
}

export function getTransportOrders(docstatus?: string) {
  return apiRequest<TransportOrderRow[]>(`${API}.get_transport_orders`, {
    method: 'POST',
    body: JSON.stringify({ docstatus: docstatus || '' }),
  })
}

export function getTransportOrder(name: string) {
  return apiRequest<TransportOrderRow>(`${API}.get_transport_order`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function updateTransportOrder(
  name: string,
  payload: {
    qty: number
    rate: number
    custom_last_customer_invoice?: string
    custom_last_customer_invoice_date?: string
    custom_last_customer_delivery_note?: string
    custom_last_customer_delivery_note_date?: string
  }
) {
  return apiRequest(`${API}.update_transport_order`, {
    method: 'POST',
    body: JSON.stringify({ name, ...payload }),
  })
}

export function submitTransportOrder(name: string) {
  return apiRequest(`${API}.submit_transport_order`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function createTransportInvoice(
  name: string,
  payload?: {
    custom_note?: string
    custom_final_customer_feedback_document?: string
  }
) {
  return apiRequest<{ sales_invoice: string; delivery_status: string }>(`${API}.create_transport_invoice`, {
    method: 'POST',
    body: JSON.stringify({ name, ...payload }),
  })
}

export async function uploadAttachedFile(file: File, doctype: string, docname: string, fieldname: string) {
  const { clearCSRF, ensureCSRF } = await import('./apiClient')
  const run = async (forceRefresh: boolean) => {
    const csrf = await ensureCSRF(forceRefresh)
    const form = new FormData()
    form.append('file', file)
    form.append('is_private', '1')
    form.append('doctype', doctype)
    form.append('docname', docname)
    form.append('fieldname', fieldname)
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (csrf) headers['X-Frappe-CSRF-Token'] = csrf
    const response = await fetch('/api/method/upload_file', {
      method: 'POST',
      body: form,
      headers,
      credentials: 'include',
    })
    const resData = (await response.json().catch(() => ({}))) as Record<string, unknown>
    return { response, resData }
  }

  let { response, resData } = await run(false)
  if (!response.ok && (response.status === 403 || response.status === 400)) {
    clearCSRF()
    ;({ response, resData } = await run(true))
  }
  if (!response.ok) {
    const message =
      typeof resData.message === 'string'
        ? resData.message
        : (resData.exc_type as string) || 'Upload failed'
    throw new Error(message)
  }
  const message = resData.message as { file_url?: string } | string | undefined
  if (message && typeof message === 'object' && message.file_url) return message.file_url
  if (typeof message === 'string') return message
  throw new Error('Upload succeeded but no file URL was returned')
}

export function getDrivers(includeInactive = false) {
  return apiRequest<DriverRow[]>(`${API}.get_drivers`, {
    method: 'POST',
    body: JSON.stringify({ include_inactive: includeInactive ? 1 : 0 }),
  })
}

export function createDriver(payload: { full_name: string; cell_number: string; vehicle_number?: string }) {
  return apiRequest<DriverRow>(`${API}.create_driver`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateDriver(
  name: string,
  payload: Partial<{ full_name: string; cell_number: string; vehicle_number: string; status: string }>
) {
  return apiRequest<DriverRow>(`${API}.update_driver`, {
    method: 'POST',
    body: JSON.stringify({ name, ...payload }),
  })
}

export function deactivateDriver(name: string) {
  return apiRequest(`${API}.deactivate_driver`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function regenerateDriverKey(name: string) {
  return apiRequest<{ name: string; unique_key: string }>(`${API}.regenerate_driver_key`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function getActiveOtps() {
  return apiRequest<Record<string, unknown>[]>(`${API}.get_active_otps`)
}

export function getTransportInvoices() {
  return apiRequest<Record<string, unknown>[]>(`${API}.get_transport_invoices`)
}

export function getConfirmationLogs(deliveryNote?: string) {
  return apiRequest<ConfirmationLogRow[]>(`${API}.get_confirmation_logs`, {
    method: 'POST',
    body: JSON.stringify({ delivery_note: deliveryNote || '' }),
  })
}

export interface SmsLogRow {
  name: string
  delivery_note: string
  party: string
  event: string
  recipient: string
  recipient_label?: string
  message: string
  status: string
  sent_at?: string
  error?: string
  creation?: string
}

export function getSmsLogs(deliveryNote?: string) {
  return apiRequest<SmsLogRow[]>(`${API}.get_sms_logs`, {
    method: 'POST',
    body: JSON.stringify({ delivery_note: deliveryNote || '' }),
  })
}

export interface TrackerMovement {
  status: string
  confirmation_time?: string | null
  completion_type?: string | null
  partial_reason?: string | null
  driver?: string | null
}

export interface TrackerRow {
  name: string
  delivery_status: string
  transport_customer_name?: string
  customer_name?: string
  driver?: string
  transport_phone?: string
  transport_address?: string
  otp?: string
  otp_expires_at?: string
  posting_date?: string
  transport_sales_order?: string
  movements: TrackerMovement[]
}

export function trackDeliveries(query?: string, status = 'In Transit') {
  return apiRequest<TrackerRow[]>(`${API}.track_deliveries`, {
    method: 'POST',
    body: JSON.stringify({ query: query || '', status: status || 'In Transit' }),
  })
}
