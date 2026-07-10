'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Bell } from 'lucide-react'
import { getDashboardStats } from '@/services/transport'
import { useNavigation } from '@/contexts/navigation-context'

export function NotificationsMenu() {
  const { navigate } = useNavigation()
  const { data } = useSWR('dashboard-stats', getDashboardStats, { refreshInterval: 60000 })
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const count = data?.needs_action ?? 0
  const items = [
    {
      label: 'Items needing action',
      detail: `${count} open deliveries or draft transport orders`,
      show: count > 0,
      onClick: () => navigate('dispatches', { filter: 'needs_action' }),
    },
    {
      label: 'Draft transport orders',
      detail: `${data?.transport_orders ?? 0} awaiting submit`,
      show: (data?.transport_orders ?? 0) > 0,
      onClick: () => navigate('transport-orders'),
    },
    {
      label: 'Active OTPs',
      detail: `${data?.active_otps ?? 0} in transit`,
      show: (data?.active_otps ?? 0) > 0,
      onClick: () => navigate('otps'),
    },
  ].filter((item) => item.show)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-secondary-foreground">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_16px_40px_rgba(0,0,0,0.15)]">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">Transport alerts and pending actions</p>
          </div>
          <div className="max-h-72 overflow-y-auto p-2">
            {items.length ? (
              items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    item.onClick()
                  }}
                  className="flex w-full flex-col rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted"
                >
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.detail}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No new notifications</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
