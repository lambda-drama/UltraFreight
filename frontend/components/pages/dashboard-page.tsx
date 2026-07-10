'use client'

import useSWR from 'swr'
import { getDashboardStats } from '@/services/transport'
import { Card, CardContent, CardHeader, CardTitle, TextLink } from '@/components/ui/primitives'
import { CustomerInvoiceBars, DonutSummary, MonthlyInvoiceChart } from '@/components/dashboard/mini-charts'
import { useNavigation } from '@/contexts/navigation-context'
import { formatMoney } from '@/lib/utils'
import { Loader2, Truck, KeyRound, FileText, Receipt, Users, CheckCircle2, AlertCircle, DollarSign } from 'lucide-react'

const primaryCards = [
  { key: 'needs_action', label: 'Needs action', sub: 'Open orders & draft transport SOs', icon: AlertCircle, accent: 'text-warning' },
  { key: 'in_transit', label: 'In transit', sub: 'Active deliveries on the road', icon: Truck, accent: 'text-primary' },
  { key: 'completed', label: 'Completed', sub: 'Delivered this period', icon: CheckCircle2, accent: 'text-success' },
] as const

const secondaryCards = [
  { key: 'open_dispatches', label: 'Open dispatches', view: 'dispatches', icon: Truck },
  { key: 'active_otps', label: 'Active OTPs', view: 'otps', icon: KeyRound },
  { key: 'transport_orders', label: 'Draft transport orders', view: 'transport-orders', icon: FileText },
  { key: 'transport_invoices', label: 'Transport invoices', view: 'invoices', icon: Receipt },
  { key: 'drivers', label: 'Active drivers', view: 'drivers', icon: Users },
] as const

export default function DashboardPage() {
  const { data, isLoading } = useSWR('dashboard-stats', getDashboardStats)
  const { navigate } = useNavigation()
  const currency = data?.currency

  const revenueSegments = [
    { label: 'Invoiced', value: data?.total_invoiced_amount || 0, color: 'var(--primary)' },
    { label: 'Draft pipeline', value: data?.draft_order_amount || 0, color: 'var(--secondary)' },
    { label: 'Submitted SOs', value: data?.submitted_order_amount || 0, color: 'var(--success)' },
  ].filter((seg) => seg.value > 0)

  return (
    <div>
      <div className="mb-8">
        <p className="section-label mb-2">Overview</p>
        <h1 className="font-serif-display text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">Shipment tracking, revenue, and transport customer insights</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <p className="section-label mb-3 px-1">Revenue</p>
            <div className="grid gap-4 lg:grid-cols-4">
              {[
                { label: 'Total invoiced', value: formatMoney(data?.total_invoiced_amount, currency), sub: `${data?.transport_invoices ?? 0} invoices` },
                { label: 'Draft pipeline', value: formatMoney(data?.draft_order_amount, currency), sub: `${data?.transport_orders ?? 0} draft orders` },
                { label: 'Submitted orders', value: formatMoney(data?.submitted_order_amount, currency), sub: 'Transport SO value' },
                { label: 'Avg invoice', value: formatMoney(data?.avg_invoice_amount, currency), sub: 'Per transport invoice' },
              ].map((item) => (
                <Card key={item.label}>
                  <CardContent className="py-5">
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" />
                      {item.label}
                    </div>
                    <div className="font-serif-display text-3xl font-semibold tracking-tight">{item.value}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle>Top transport customers</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">By total transport invoice value supplied</p>
                </div>
                <TextLink onClick={() => navigate('invoices')}>Open</TextLink>
              </CardHeader>
              <CardContent>
                <CustomerInvoiceBars rows={data?.top_transport_customers || []} currency={currency} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Revenue mix</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Invoiced vs pipeline</p>
              </CardHeader>
              <CardContent>
                {revenueSegments.length ? (
                  <DonutSummary
                    segments={revenueSegments}
                    centerLabel="Invoiced"
                    centerValue={formatMoney(data?.total_invoiced_amount, currency)}
                  />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">No revenue data yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Invoice trend</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Transport invoices over the last 6 months</p>
              </div>
              <TextLink onClick={() => navigate('invoices')}>Open</TextLink>
            </CardHeader>
            <CardContent>
              <MonthlyInvoiceChart rows={data?.monthly_invoice_trend || []} currency={currency} />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            {primaryCards.map(({ key, label, sub, icon: Icon, accent }) => (
              <Card key={key}>
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div>
                    <CardTitle className="text-base font-semibold">{label}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
                  </div>
                  <TextLink
                    onClick={() =>
                      navigate('dispatches', {
                        filter: key === 'needs_action' ? 'needs_action' : key === 'in_transit' ? 'in_transit' : 'completed',
                      })
                    }
                  >
                    Open
                  </TextLink>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <div className={`font-serif-display text-4xl font-semibold tracking-tight ${accent}`}>
                      {data?.[key] ?? 0}
                    </div>
                    <Icon className={`h-5 w-5 opacity-40 ${accent}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div>
            <p className="section-label mb-3 px-1">Pipeline</p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {secondaryCards.map(({ key, label, view, icon: Icon }) => (
                <Card key={key} className="transition-transform hover:scale-[1.01]">
                  <CardHeader className="flex flex-row items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <CardTitle className="text-sm font-medium">{label}</CardTitle>
                    </div>
                    <TextLink onClick={() => navigate(view)}>Open</TextLink>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="font-serif-display text-3xl font-semibold">{data?.[key] ?? 0}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {(data?.needs_action ?? 0) > 0 ? (
            <Card className="border-none bg-warning-soft/60">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="flex items-center gap-2 text-sm text-warning">
                  <AlertCircle className="h-4 w-4" />
                  <span>
                    <strong>{data?.needs_action}</strong> items need your attention — review delivery orders or submit draft transport orders.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('dispatches', { filter: 'needs_action' })}
                  className="rounded-full bg-card px-4 py-2 text-sm font-medium text-warning ring-1 ring-warning/25 transition hover:bg-muted"
                >
                  Review now
                </button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  )
}
