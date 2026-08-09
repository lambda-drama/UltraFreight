'use client'

import { cn } from '@/lib/utils'
import { APP_TITLE } from '@/lib/branding'
import { useNavigation } from '@/contexts/navigation-context'
import {
  LayoutDashboard,
  Truck,
  FileText,
  Users,
  MapPin,
  KeyRound,
  Receipt,
  MessageSquare,
  Mail,
} from 'lucide-react'

const navSections = [
  {
    label: 'Overview',
    items: [{ name: 'Dashboard', view: 'dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Operations',
    items: [
      { name: 'Transport Orders', view: 'transport-orders', icon: FileText },
      { name: 'Delivery Orders', view: 'dispatches', icon: Truck },
      { name: 'Drivers', view: 'drivers', icon: Users },
      { name: 'Tracker', view: 'tracker', icon: MapPin },
    ],
  },
  {
    label: 'Tracking',
    items: [
      { name: 'OTPs', view: 'otps', icon: KeyRound },
      { name: 'Invoices', view: 'invoices', icon: Receipt },
      { name: 'Confirmation Logs', view: 'confirmation-logs', icon: MessageSquare },
      { name: 'SMS Log', view: 'sms-logs', icon: MessageSquare },
      { name: 'Email Log', view: 'email-logs', icon: Mail },
    ],
  },
]

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { activeView, navigate } = useNavigation()

  return (
    <div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/15 ring-1 ring-secondary/30">
            <Truck className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <div className="font-serif-display text-lg font-semibold leading-tight">{APP_TITLE}</div>
            <div className="text-xs text-sidebar-muted">Transport Portal</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {navSections.map((section) => (
          <div key={section.label}>
            <div className="section-label mb-2 px-3">{section.label}</div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                const active = activeView === item.view
                return (
                  <button
                    key={item.view}
                    onClick={() => {
                      navigate(item.view)
                      onNavigate?.()
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                      active
                        ? 'border-l-2 border-secondary bg-sidebar-accent text-sidebar-accent-foreground pl-[10px]'
                        : 'border-l-2 border-transparent text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-secondary' : 'opacity-70')} />
                    {item.name}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  )
}
