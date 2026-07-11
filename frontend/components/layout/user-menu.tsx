'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'

function initials(name?: string) {
  if (!name) return 'U'
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function UserMenu() {
  const { user, logout, isLoading } = useAuth()
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-3">
        <span className="h-8 w-8 animate-pulse rounded-full bg-muted" />
        <span className="hidden h-3 w-20 animate-pulse rounded bg-muted sm:block" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-3 text-sm transition-colors hover:bg-muted"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
          {initials(user.full_name)}
        </span>
        <span className="hidden max-w-[140px] truncate font-medium sm:inline">{user.full_name}</span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_16px_40px_rgba(0,0,0,0.12)]">
          <div className="border-b border-border px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                {initials(user.full_name)}
              </span>
              <div className="min-w-0">
                <div className="truncate font-medium">{user.full_name}</div>
                <div className="truncate text-xs text-muted-foreground">{user.email}</div>
              </div>
            </div>
          </div>

          <div className="p-2">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Appearance</div>
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                theme === 'light' ? 'bg-secondary-soft text-foreground' : 'hover:bg-muted'
              )}
            >
              <Sun className="h-4 w-4 text-secondary" />
              Light mode
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                theme === 'dark' ? 'bg-secondary-soft text-foreground' : 'hover:bg-muted'
              )}
            >
              <Moon className="h-4 w-4 text-secondary" />
              Dark mode
            </button>
          </div>

          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                logout()
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
