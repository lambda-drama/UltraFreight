'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { getActiveOtps, regenerateTransportOtp } from '@/services/transport'
import { Badge, Button, DataTable, PageHeader } from '@/components/ui/primitives'
import { formatDate } from '@/lib/utils'
import { KeyRound, Loader2 } from 'lucide-react'

export default function OtpsPage() {
  const { data, isLoading, mutate } = useSWR('active-otps', getActiveOtps)
  const [regenerating, setRegenerating] = useState<string | null>(null)

  async function handleRegenerate(row: Record<string, unknown>) {
    const salesOrder = String(row.transport_sales_order || '')
    if (!salesOrder) {
      toast.error('No transport order linked to this delivery')
      return
    }
    setRegenerating(String(row.name))
    try {
      const result = await regenerateTransportOtp(salesOrder)
      toast.success(`New OTP: ${result.otp}`)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not regenerate OTP')
    } finally {
      setRegenerating(null)
    }
  }

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
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <Button
                  variant={row.is_expired ? 'default' : 'outline'}
                  disabled={regenerating === String(row.name) || !row.transport_sales_order}
                  onClick={() => handleRegenerate(row)}
                  title="Regenerate OTP"
                >
                  {regenerating === String(row.name) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <KeyRound className="mr-2 h-4 w-4" />
                      Regenerate
                    </>
                  )}
                </Button>
              ),
            },
          ]}
        />
      )}
    </div>
  )
}
