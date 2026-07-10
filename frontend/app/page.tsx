'use client'

import { Loader2 } from 'lucide-react'
import { AuthProvider, useAuth } from '@/contexts/auth-context'
import { NavigationProvider, useNavigation } from '@/contexts/navigation-context'
import { ThemeProvider } from '@/contexts/theme-context'
import LoginPage from '@/components/login-page'
import DashboardShell from '@/components/dashboard-shell'
import DashboardPage from '@/components/pages/dashboard-page'
import DispatchesPage from '@/components/pages/dispatches-page'
import TransportOrdersPage from '@/components/pages/transport-orders-page'
import DriversPage from '@/components/pages/drivers-page'
import TrackerPage from '@/components/pages/tracker-page'
import OtpsPage from '@/components/pages/otps-page'
import InvoicesPage from '@/components/pages/invoices-page'
import ConfirmationLogsPage from '@/components/pages/confirmation-logs-page'
import SmsPage from '@/components/pages/sms-page'
import DriverPortalPage from '@/components/pages/driver-portal-page'

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth()
  const { activeView, isDriverRoute } = useNavigation()

  if (isDriverRoute || activeView === 'driver') {
    return <DriverPortalPage />
  }

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <LoginPage />

  const renderView = () => {
    switch (activeView) {
      case 'dispatches':
        return <DispatchesPage />
      case 'transport-orders':
        return <TransportOrdersPage />
      case 'drivers':
        return <DriversPage />
      case 'tracker':
        return <TrackerPage />
      case 'otps':
        return <OtpsPage />
      case 'invoices':
        return <InvoicesPage />
      case 'confirmation-logs':
        return <ConfirmationLogsPage />
      case 'sms-logs':
        return <SmsPage />
      default:
        return <DashboardPage />
    }
  }

  return <DashboardShell>{renderView()}</DashboardShell>
}

export default function HomePage() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationProvider>
          <AppContent />
        </NavigationProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
