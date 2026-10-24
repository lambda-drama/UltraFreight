'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/primitives'

export type SearchComboboxOption = {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

type SearchComboboxProps = {
  value: string
  onChange: (value: string) => void
  onSelect?: (option: SearchComboboxOption) => void
  options: SearchComboboxOption[]
  onSearch?: (query: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  emptyText?: string
  className?: string
  /** Rendered inside the field on the right (e.g. + create button). */
  endAction?: ReactNode
}

/**
 * Healthcare-style searchable dropdown: panel stays aligned under the input
 * (same width), not the browser datalist which floats oddly outside modals.
 */
export function SearchCombobox({
  value,
  onChange,
  onSelect,
  options,
  onSearch,
  placeholder,
  disabled,
  required,
  emptyText = 'No matches',
  className,
  endAction,
}: SearchComboboxProps) {
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null)

  function updatePanelPosition() {
    const el = inputRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const gap = 6
    const maxHeight = 224
    const spaceBelow = window.innerHeight - rect.bottom - 12
    const spaceAbove = rect.top - 12
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow
    const height = Math.min(maxHeight, openUp ? spaceAbove : spaceBelow)
    setPanelStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      top: openUp ? undefined : rect.bottom + gap,
      bottom: openUp ? window.innerHeight - rect.top + gap : undefined,
      maxHeight: Math.max(120, height),
      zIndex: 80,
    })
  }

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null)
      return
    }
    updatePanelPosition()
    const onReposition = () => updatePanelPosition()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, options.length, value])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (wrapRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  function handleSelect(option: SearchComboboxOption) {
    if (option.disabled) return
    onChange(option.value)
    onSelect?.(option)
    setOpen(false)
  }

  const panel =
    open && panelStyle ? (
      <div
        ref={panelRef}
        id={listId}
        role="listbox"
        style={panelStyle}
        className="overflow-y-auto rounded-xl border border-border bg-card py-1 text-foreground shadow-[0_12px_40px_rgba(11,45,77,0.16)] ring-1 ring-primary/15"
      >
        {options.length === 0 ? (
          <div className="px-3 py-2.5 text-xs text-muted-foreground">{emptyText}</div>
        ) : (
          options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              disabled={option.disabled}
              aria-selected={option.value === value}
              className={cn(
                'flex w-full flex-col items-start gap-0.5 border-b border-border/60 px-3 py-2.5 text-left text-sm transition last:border-0',
                option.disabled
                  ? 'cursor-not-allowed opacity-45'
                  : 'hover:bg-muted/80 focus:bg-muted/80 focus:outline-none',
                option.value === value && !option.disabled && 'bg-accent/60'
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(option)}
            >
              <span className="font-medium text-foreground">{option.label}</span>
              {option.description ? (
                <span className="text-xs text-muted-foreground">{option.description}</span>
              ) : null}
            </button>
          ))
        )}
      </div>
    ) : null

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <Input
        ref={inputRef}
        value={value}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className={cn(endAction && 'pr-11')}
        onChange={(e) => {
          const next = e.target.value
          onChange(next)
          onSearch?.(next)
          setOpen(true)
        }}
        onFocus={() => {
          setOpen(true)
          onSearch?.(value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
          }
        }}
      />
      {endAction ? (
        <div className="absolute inset-y-0 right-1.5 z-[1] flex items-center">{endAction}</div>
      ) : null}
      {typeof document !== 'undefined' && panel ? createPortal(panel, document.body) : null}
    </div>
  )
}
