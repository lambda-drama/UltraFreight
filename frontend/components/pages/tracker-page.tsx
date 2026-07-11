'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Search, MapPin, Loader2 } from 'lucide-react'
import { trackDeliveries, type TrackerRow } from '@/services/transport'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
  Select,
} from '@/components/ui/primitives'
import { formatDate } from '@/lib/utils'

const STATUS_OPTIONS = [
  { value: 'In Transit', label: 'In Transit' },
  { value: 'Open', label: 'Open' },
  { value: 'Pending Invoicing', label: 'Pending Invoicing' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All statuses' },
]

function statusVariant(status?: string) {
  if (status === 'Completed') return 'success'
  if (status === 'Pending Invoicing') return 'warning'
  if (status === 'Partially Delivered') return 'warning'
  if (status === 'In Transit') return 'warning'
  if (status === 'Open') return 'muted'
  return 'default'
}

function MovementTimeline({ movements }: { movements: TrackerRow['movements'] }) {
  if (!movements?.length) return null
  return (
    <div className="mt-4 space-y-0">
      {movements.map((step, idx) => (
        <div key={`${step.status}-${idx}`} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-secondary ring-2 ring-secondary/30" />
            {idx < movements.length - 1 ? <span className="my-1 w-px flex-1 bg-border" /> : null}
          </div>
          <div className="pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(step.status)}>{step.status}</Badge>
              {step.driver ? <span className="text-xs text-muted-foreground">Driver: {step.driver}</span> : null}
            </div>
            {step.confirmation_time ? (
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(step.confirmation_time)}</p>
            ) : null}
            {step.partial_reason ? (
              <p className="mt-1 text-xs text-warning">Reason: {step.partial_reason}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TrackerPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('In Transit')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('In Transit')

  const swrKey = ['tracker', searchTerm, statusFilter]
  const { data, isLoading, mutate } = useSWR(swrKey, () =>
    trackDeliveries(searchTerm || undefined, statusFilter)
  )

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearchTerm(query.trim())
    setStatusFilter(status)
    mutate()
  }

  return (
    <div>
      <PageHeader
        title="Tracker"
        description="Search by delivery ID, OTP, or transport customer to see current status and movement history"
      />

      <Card className="mb-6">
        <CardContent className="py-5">
          <form onSubmit={handleSearch} className="grid gap-4 lg:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-11"
                placeholder="Delivery note, OTP, transport customer..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
            <Button type="submit">Track</Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          {(data || []).map((row) => (
            <Card key={row.name}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                <div>
                  <CardTitle className="text-base">{row.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {row.transport_customer_name || row.customer_name}
                  </p>
                </div>
                <Badge variant={statusVariant(row.delivery_status)}>{row.delivery_status}</Badge>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>Driver: {row.driver || '—'}</div>
                  <div>OTP: {row.otp || '—'}</div>
                  <div className="flex items-start gap-1 sm:col-span-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                    <span>{row.transport_address || '—'}</span>
                  </div>
                </div>
                <MovementTimeline movements={row.movements} />
              </CardContent>
            </Card>
          ))}
          {!data?.length ? (
            <div className="rounded-[1.25rem] bg-muted/50 p-10 text-center text-sm text-muted-foreground ring-1 ring-border">
              No deliveries found for this search or status filter.
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
