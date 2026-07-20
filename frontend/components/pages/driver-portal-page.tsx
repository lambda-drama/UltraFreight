'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Loader2, Package, Truck } from 'lucide-react'
import { confirmDelivery, getActiveDrivers, verifyDriverOtp, type VerifiedDelivery } from '@/services/driver'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui/primitives'
import { APP_TITLE } from '@/lib/branding'
import { useNavigation } from '@/contexts/navigation-context'

type Step = 'login' | 'verify' | 'complete' | 'success'

function statusVariant(status?: string) {
  if (status === 'Completed') return 'success'
  if (status === 'Pending Invoicing') return 'warning'
  if (status === 'Partially Delivered') return 'warning'
  if (status === 'In Transit') return 'warning'
  return 'muted'
}

export default function DriverPortalPage() {
  const { viewParams } = useNavigation()
  const { data: drivers, isLoading: loadingDrivers } = useSWR('active-drivers', getActiveDrivers)
  const [step, setStep] = useState<Step>('login')
  const [driver, setDriver] = useState('')
  const [uniqueKey, setUniqueKey] = useState('')
  const [otp, setOtp] = useState('')
  const [completionType, setCompletionType] = useState<'Full' | 'Partial'>('Full')
  const [partialReason, setPartialReason] = useState('')
  const [verified, setVerified] = useState<VerifiedDelivery | null>(null)
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [resultStatus, setResultStatus] = useState('')

  useEffect(() => {
    const key = viewParams.get('key')
    const driverParam = viewParams.get('driver')
    if (key) setUniqueKey(key)
    if (driverParam) setDriver(driverParam)
  }, [viewParams])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!driver || !uniqueKey || otp.length < 4) {
      toast.error('Select driver, enter your key, and OTP')
      return
    }
    setSubmitting(true)
    try {
      const data = await verifyDriverOtp(driver, uniqueKey, otp)
      setVerified(data)
      const initial: Record<string, number> = {}
      data.items.forEach((item) => {
        initial[item.item_code] = item.qty
      })
      setQtyMap(initial)
      setStep('complete')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    if (!verified) return
    if (completionType === 'Partial' && !partialReason.trim()) {
      toast.error('Please enter a reason for partial delivery')
      return
    }
    setSubmitting(true)
    try {
      const items =
        completionType === 'Partial'
          ? verified.items.map((item) => ({
              item_code: item.item_code,
              qty_delivered: qtyMap[item.item_code] ?? 0,
            }))
          : undefined
      const result = (await confirmDelivery({
        driver,
        uniqueKey,
        otp,
        deliveryNote: verified.delivery_note,
        completionType,
        partialReason,
        items,
      })) as { status?: string }
      setResultStatus(result.status || completionType)
      setStep('success')
      toast.success('Delivery recorded successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Confirmation failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-dvh">
      <div className="mx-auto max-w-lg px-4 py-10">
        <div className="mb-10 flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/15 ring-1 ring-secondary/30">
            <Truck className="h-7 w-7 text-secondary" />
          </div>
          <div>
            <div className="font-serif-display text-2xl font-semibold">{APP_TITLE}</div>
            <div className="text-sm text-muted-foreground">Driver Delivery Portal</div>
          </div>
        </div>

        {step === 'login' || step === 'verify' ? (
          <Card>
            <CardHeader>
              <CardTitle>Verify Delivery</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Driver</label>
                  {loadingDrivers ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <select
                      className="flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
                      value={driver}
                      onChange={(e) => setDriver(e.target.value)}
                      required
                    >
                      <option value="">Select driver</option>
                      {(drivers || []).map((d) => (
                        <option key={d.name} value={d.name}>
                          {d.full_name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">PIN</label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={uniqueKey}
                    onChange={(e) => setUniqueKey(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="4-digit PIN"
                    maxLength={4}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">OTP</label>
                  <Input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit OTP"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Continue'}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {step === 'complete' && verified ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>{verified.delivery_note}</span>
                  <Badge variant={statusVariant(verified.delivery_status)}>{verified.delivery_status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Customer:</span> {verified.customer_name}</div>
                <div><span className="text-muted-foreground">Address:</span> {verified.address || '—'}</div>
              </CardContent>
            </Card>

            <form onSubmit={handleConfirm} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Products
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {verified.items.map((item) => (
                    <div key={item.item_code} className="rounded-lg border border-border p-3">
                      <div className="font-medium">{item.item_name}</div>
                      <div className="text-xs text-muted-foreground">
                        Ordered: {item.qty} {item.uom || ''}
                      </div>
                      {completionType === 'Partial' ? (
                        <div className="mt-2">
                          <label className="text-xs font-medium">Qty Delivered</label>
                          <Input
                            type="number"
                            min={0}
                            max={item.qty}
                            step="any"
                            value={qtyMap[item.item_code] ?? 0}
                            onChange={(e) =>
                              setQtyMap((prev) => ({
                                ...prev,
                                [item.item_code]: Number(e.target.value),
                              }))
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Completion</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={completionType === 'Full' ? 'default' : 'outline'}
                      onClick={() => setCompletionType('Full')}
                    >
                      Full Delivery
                    </Button>
                    <Button
                      type="button"
                      variant={completionType === 'Partial' ? 'default' : 'outline'}
                      onClick={() => setCompletionType('Partial')}
                    >
                      Partial Delivery
                    </Button>
                  </div>
                  {completionType === 'Partial' ? (
                    <div>
                      <label className="mb-1 block text-sm font-medium">Reason for partial delivery</label>
                      <textarea
                        className="min-h-24 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                        value={partialReason}
                        onChange={(e) => setPartialReason(e.target.value)}
                        required
                      />
                    </div>
                  ) : null}
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : completionType === 'Full' ? (
                      'Confirm Full Delivery'
                    ) : (
                      'Confirm Partial Delivery'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </form>
          </div>
        ) : null}

        {step === 'success' ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Badge variant="success" className="mb-4 text-sm">
                {resultStatus}
              </Badge>
              <p className="text-lg font-semibold">Delivery recorded</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Status is Pending Invoicing. The transport company will create the invoice next.
              </p>
              <Button className="mt-6" onClick={() => window.location.reload()}>
                Confirm Another Delivery
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
