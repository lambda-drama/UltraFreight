'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/primitives'
import { UserMenu } from '@/components/layout/user-menu'
import { NotificationsMenu } from '@/components/layout/notifications-menu'
import { useNavigation } from '@/contexts/navigation-context'

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  dispatches: 'Delivery Orders',
  'transport-orders': 'Transport Orders',
  drivers: 'Drivers',
  tracker: 'Tracker',
  otps: 'OTPs',
  invoices: 'Invoices',
  'confirmation-logs': 'Confirmation Logs',
  'sms-logs': 'SMS Log',
}

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { activeView } = useNavigation()
  const pageTitle = VIEW_TITLES[activeView] || 'Dashboard'

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-navbar px-4 backdrop-blur-md lg:px-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="font-serif-display text-lg font-semibold text-foreground">{pageTitle}</h1>
      </div>
      <div className="flex items-center gap-2">
        <UserMenu />
        <NotificationsMenu />
      </div>
    </header>
  )
}
