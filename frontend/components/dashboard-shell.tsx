'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-background">
      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-dvh w-[17.5rem] shrink-0 transform border-r border-sidebar-border bg-sidebar transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setSidebarOpen((v) => !v)} />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
