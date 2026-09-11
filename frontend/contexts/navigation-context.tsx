'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { isDriverPortalPath } from '@/lib/driver-portal'

const ALL_VIEWS = [
  'dashboard',
  'dispatches',
  'transport-orders',
  'drivers',
  'tracker',
  'otps',
  'invoices',
  'confirmation-logs',
  'sms-logs',
  'email-logs',
  'transport-settings',
  'transport-customers',
  'master-drivers',
  'master-trucks',
  'address-zones',
  'driver',
]

interface NavigationContextType {
  activeView: string
  viewParams: URLSearchParams
  isDriverRoute: boolean
  navigate: (view: string, params?: Record<string, string>) => void
}

function parseHash(): { view: string; params: URLSearchParams } {
  if (typeof window === 'undefined') return { view: '', params: new URLSearchParams() }
  const raw = window.location.hash.replace('#', '').trim()
  const qIdx = raw.indexOf('?')
  const view = (qIdx >= 0 ? raw.slice(0, qIdx) : raw).trim().toLowerCase()
  const search = qIdx >= 0 ? raw.slice(qIdx) : ''
  const params = new URLSearchParams(search)
  if (typeof window !== 'undefined' && window.location.search) {
    const query = new URLSearchParams(window.location.search)
    query.forEach((value, key) => {
      if (!params.has(key)) params.set(key, value)
    })
  }
  return {
    view: ALL_VIEWS.includes(view) ? view : '',
    params,
  }
}

function getInitialNavigation() {
  if (typeof window === 'undefined') {
    return { view: 'dashboard', params: new URLSearchParams(), isDriverRoute: false }
  }
  if (isDriverPortalPath()) {
    const { params } = parseHash()
    return { view: 'driver', params, isDriverRoute: true }
  }
  const { view, params } = parseHash()
  return { view: view || 'dashboard', params, isDriverRoute: false }
}

const NavigationContext = createContext<NavigationContextType>({
  activeView: 'dashboard',
  viewParams: new URLSearchParams(),
  isDriverRoute: false,
  navigate: () => {},
})

export function NavigationProvider({ children }: { children: ReactNode }) {
  const initial = getInitialNavigation()
  const [activeView, setActiveView] = useState(initial.view)
  const [viewParams, setViewParams] = useState(initial.params)
  const [isDriverRoute, setIsDriverRoute] = useState(initial.isDriverRoute)

  const navigate = useCallback((view: string, params?: Record<string, string>) => {
    let hash = `#${view}`
    if (params && Object.keys(params).length > 0) {
      hash += `?${new URLSearchParams(params).toString()}`
    }
    setActiveView(view)
    setViewParams(new URLSearchParams(params || {}))
    window.location.hash = hash
  }, [])

  useEffect(() => {
    const update = () => {
      const driverRoute = isDriverPortalPath()
      setIsDriverRoute(driverRoute)
      if (driverRoute) {
        const { params } = parseHash()
        setActiveView('driver')
        setViewParams(params)
        return
      }
      const { view, params } = parseHash()
      setActiveView(view || 'dashboard')
      setViewParams(params)
    }
    update()
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  return (
    <NavigationContext.Provider value={{ activeView, viewParams, isDriverRoute, navigate }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  return useContext(NavigationContext)
}
