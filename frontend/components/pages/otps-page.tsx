'use client'

import useSWR from 'swr'
import { getActiveOtps } from '@/services/transport'
import { Badge, DataTable, PageHeader } from '@/components/ui/primitives'
import { formatDate } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

export default function OtpsPage() {
  const { data, isLoading } = useSWR('active-otps', getActiveOtps)

  return (
    <div>
      <PageHeader title="OTPs" description="Active delivery OTPs for driver confirmation" />
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <DataTable
          rows={(data || []) as Record<string, unknown>[]}
          columns={[
            { key: 'name', label: 'Delivery Note' },
            { key: 'transport_customer_name', label: 'Transport Customer' },
            { key: 'driver', label: 'Driver' },
            { key: 'otp', label: 'OTP' },
            { key: 'otp_generated_at', label: 'Generated', render: (row) => formatDate(String(row.otp_generated_at || '')) },
            { key: 'otp_expires_at', label: 'Expires', render: (row) => formatDate(String(row.otp_expires_at || '')) },
            {
              key: 'is_expired',
              label: 'Valid',
              render: (row) => (
                <Badge variant={row.is_expired ? 'muted' : 'success'}>
                  {row.is_expired ? 'Expired' : 'Active'}
                </Badge>
              ),
            },
            { key: 'delivery_status', label: 'Status' },
          ]}
        />
      )}
    </div>
  )
}
