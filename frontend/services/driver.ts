import { apiRequest } from './apiClient'

const API = '/api/method/ultrafreight.ultra_freight.api.driver_portal'

export interface DriverOption {
  name: string
  full_name: string
  cell_number?: string
  vehicle_number?: string
}

export interface DeliveryItem {
  item_code: string
  item_name: string
  qty: number
  uom?: string
}

export interface VerifiedDelivery {
  delivery_note: string
  customer_name?: string
  address?: string
  delivery_status?: string
  items: DeliveryItem[]
  driver_name: string
  requires_otp?: boolean
}

export interface DriverAssignment {
  name: string
  transport_customer_name?: string
  transport_address?: string
  transport_phone?: string
  delivery_status?: string
  requires_otp?: boolean
  items: DeliveryItem[]
}

export function getActiveDrivers() {
  return apiRequest<DriverOption[]>(`${API}.get_active_drivers`)
}

export function getDriverAssignments(driver: string, uniqueKey: string) {
  return apiRequest<{ driver_name: string; assignments: DriverAssignment[] }>(
    `${API}.get_driver_assignments`,
    {
      method: 'POST',
      body: JSON.stringify({ driver, unique_key: uniqueKey }),
    }
  )
}

export function getDriverAssignmentsWithoutOtp(driver: string, uniqueKey: string) {
  return apiRequest<{ driver_name: string; assignments: DriverAssignment[] }>(
    `${API}.get_driver_assignments_without_otp`,
    {
      method: 'POST',
      body: JSON.stringify({ driver, unique_key: uniqueKey }),
    }
  )
}

export function verifyDriverOtp(driver: string, uniqueKey: string, otp: string) {
  return apiRequest<VerifiedDelivery>(`${API}.verify_driver_otp`, {
    method: 'POST',
    body: JSON.stringify({ driver, unique_key: uniqueKey, otp }),
  })
}

export function confirmDelivery(payload: {
  driver: string
  uniqueKey: string
  otp: string
  deliveryNote: string
  completionType: 'Full' | 'Partial'
  partialReason?: string
  items?: { item_code: string; qty_delivered: number }[]
  gpsLocation?: string
}) {
  return apiRequest(`${API}.confirm_delivery`, {
    method: 'POST',
    body: JSON.stringify({
      driver: payload.driver,
      unique_key: payload.uniqueKey,
      otp: payload.otp,
      delivery_note: payload.deliveryNote,
      completion_type: payload.completionType,
      partial_reason: payload.partialReason || '',
      items: payload.items,
      gps_location: payload.gpsLocation || '',
    }),
  })
}

export function confirmDeliveryWithoutOtp(payload: {
  driver: string
  uniqueKey: string
  deliveryNote: string
  gpsLocation?: string
}) {
  return apiRequest(`${API}.confirm_delivery_without_otp`, {
    method: 'POST',
    body: JSON.stringify({
      driver: payload.driver,
      unique_key: payload.uniqueKey,
      delivery_note: payload.deliveryNote,
      gps_location: payload.gpsLocation || '',
    }),
  })
}
