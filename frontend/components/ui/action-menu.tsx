'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/primitives'

export type ActionMenuItem = {
  key: string
  label: string
  icon?: React.ReactNode
  disabled?: boolean
  destructive?: boolean
  onClick: () => void
}

export function ActionMenu({
  items,
  label = 'Actions',
}: {
  items: ActionMenuItem[]
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const menuWidth = 220
    const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8)
    const top = Math.min(rect.bottom + 8, window.innerHeight - 8)
    setCoords({ top, left })
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function handleScroll() {
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleScroll)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
    }
  }, [open])

  const visible = items.filter(Boolean)
  if (!visible.length) return null

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        className="h-9 w-9 p-0"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && coords ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          style={{ top: coords.top, left: coords.left }}
          className="fixed z-[80] min-w-[220px] overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.12)]"
        >
          {visible.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return
                setOpen(false)
                item.onClick()
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors disabled:pointer-events-none disabled:opacity-45',
                item.destructive
                  ? 'text-destructive hover:bg-destructive/10'
                  : 'text-foreground hover:bg-muted'
              )}
            >
              {item.icon ? <span className="text-muted-foreground">{item.icon}</span> : null}
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </>
  )
}
