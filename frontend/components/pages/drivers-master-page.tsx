'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  createDriver,
  deactivateDriver,
  getDrivers,
  getVehicles,
  regenerateDriverKey,
  updateDriver,
  type DriverRow,
} from '@/services/transport'
import { useAuth } from '@/contexts/auth-context'
import { useNavigation } from '@/contexts/navigation-context'
import {
  Badge,
  Button,
  ConfirmModal,
  DataTable,
  Input,
  Label,
  Modal,
  PageHeader,
  Select,
} from '@/components/ui/primitives'
import { SearchCombobox } from '@/components/ui/search-combobox'
import { FilterToolbar, matchesText } from '@/components/layout/filter-toolbar'
import { Loader2, Pencil, Plus, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react'

const MASTER_ROLES = ['System Manager', 'Administrator']

const emptyForm = {
  full_name: '',
  cell_number: '',
  vehicle_number: '',
  status: 'Active',
}

export default function DriversMasterPage() {
  const { user } = useAuth()
  const { navigate } = useNavigation()
  const canManage = Boolean(
    user?.name === 'Administrator' || user?.roles?.some((role) => MASTER_ROLES.includes(role))
  )
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(true)
  const { data, isLoading, mutate } = useSWR(canManage ? ['master-drivers', showInactive] : null, () =>
    getDrivers(showInactive)
  )
  const { data: trucks } = useSWR(canManage ? 'master-drivers-trucks' : null, getVehicles)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DriverRow | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [truckQuery, setTruckQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [deactivating, setDeactivating] = useState<DriverRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const rows = useMemo(() => {
    return (data || []).filter(
      (row) =>
        matchesText(row.full_name || '', search) ||
        matchesText(row.cell_number || '', search) ||
        matchesText(row.vehicle_number || '', search) ||
        matchesText(row.name || '', search)
    )
  }, [data, search])

  const truckOptions = useMemo(() => {
    const q = truckQuery.trim().toLowerCase()
    return (trucks || [])
      .filter((t) => {
        if (!q) return true
        return (
          (t.license_plate || t.name || '').toLowerCase().includes(q) ||
          (t.make || '').toLowerCase().includes(q) ||
          (t.model || '').toLowerCase().includes(q)
        )
      })
      .map((t) => ({
        value: t.license_plate || t.name,
        label: t.license_plate || t.name,
        description: [t.make, t.model].filter(Boolean).join(' · '),
      }))
  }, [trucks, truckQuery])

  if (!canManage) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-warning" />
        <h2 className="font-serif-display text-xl font-semibold">Access restricted</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Drivers under Master are only available to System Manager or Administrator.
        </p>
        <Button className="mt-5" variant="outline" onClick={() => navigate('dashboard')}>
          Back to dashboard
        </Button>
      </div>
    )
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setTruckQuery('')
    setModalOpen(true)
  }

  function openEdit(driver: DriverRow) {
    setEditing(driver)
    setForm({
      full_name: driver.full_name || '',
      cell_number: driver.cell_number || '',
      vehicle_number: driver.vehicle_number || '',
      status: driver.status || 'Active',
    })
    setTruckQuery(driver.vehicle_number || '')
    setModalOpen(true)
  }

  async function confirmDeactivate() {
    if (!deactivating) return
    setDeleteLoading(true)
    try {
      await deactivateDriver(deactivating.name)
      toast.success('Driver deactivated')
      if (editing?.name === deactivating.name) setModalOpen(false)
      setDeactivating(null)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not deactivate driver')
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleRegenerateKey(name: string) {
    try {
      const result = await regenerateDriverKey(name)
      toast.success(`New PIN: ${result.unique_key}`)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not regenerate PIN')
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim() || !form.cell_number.trim()) {
      toast.error('Name and phone are required')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateDriver(editing.name, {
          full_name: form.full_name.trim(),
          cell_number: form.cell_number.trim(),
          vehicle_number: form.vehicle_number.trim(),
          status: form.status,
        })
        toast.success('Driver updated')
      } else {
        await createDriver({
          full_name: form.full_name.trim(),
          cell_number: form.cell_number.trim(),
          vehicle_number: form.vehicle_number.trim() || undefined,
        })
        toast.success('Driver created')
      }
      setModalOpen(false)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save driver')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-2">
        <p className="section-label">Master</p>
      </div>
      <PageHeader
        title="Drivers"
        description="Create and manage drivers for dispatch — assign an optional truck"
        action={
          <Button
            type="button"
            onClick={openCreate}
            className="h-10 w-10 px-0"
            title="New driver"
            aria-label="New driver"
          >
            <Plus className="h-4 w-4" />
          </Button>
        }
      />

      <FilterToolbar
        fields={[
          {
            key: 'search',
            label: 'Search',
            type: 'text',
            value: search,
            onChange: setSearch,
            placeholder: 'Name, phone, or truck…',
          },
        ]}
        defaultOpen
      />

      <label className="mb-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
        />
        Include inactive drivers
      </label>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <DataTable
          rows={rows as unknown as Record<string, unknown>[]}
          emptyText="No drivers yet."
          onRowClick={(row) => openEdit(row as unknown as DriverRow)}
          columns={[
            {
              key: 'full_name',
              label: 'Driver',
              render: (row) => (
                <div>
                  <div className="font-medium">{String(row.full_name || '')}</div>
                  <div className="text-xs text-muted-foreground">{String(row.name || '')}</div>
                </div>
              ),
            },
            { key: 'cell_number', label: 'Phone' },
            { key: 'vehicle_number', label: 'Truck' },
            {
              key: 'unique_key',
              label: 'PIN',
              render: (row) => (
                <span className="font-mono text-sm">{String(row.unique_key || '—')}</span>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (row) => (
                <Badge variant={row.status === 'Active' ? 'success' : 'muted'}>
                  {String(row.status || '—')}
                </Badge>
              ),
            },
            {
              key: 'actions',
              label: '',
              render: (row) => {
                const driver = row as unknown as DriverRow
                return (
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 w-9 px-0"
                      title="Edit"
                      aria-label={`Edit ${driver.full_name}`}
                      onClick={() => openEdit(driver)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 w-9 px-0"
                      title="New PIN"
                      aria-label={`Regenerate PIN for ${driver.full_name}`}
                      onClick={() => void handleRegenerateKey(driver.name)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    {driver.status === 'Active' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 w-9 px-0 text-destructive hover:text-destructive"
                        title="Deactivate"
                        aria-label={`Deactivate ${driver.full_name}`}
                        onClick={() => setDeactivating(driver)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                )
              },
            },
          ]}
        />
      )}

      <Modal
        open={modalOpen}
        title={editing ? editing.name : 'New Driver'}
        onClose={() => {
          if (saving) return
          setModalOpen(false)
        }}
        className="max-w-xl"
      >
        <form className="space-y-4" onSubmit={handleSave}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Full name *</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
                disabled={saving}
              />
            </div>
            <div>
              <Label>Phone *</Label>
              <Input
                value={form.cell_number}
                onChange={(e) => setForm({ ...form, cell_number: e.target.value })}
                required
                disabled={saving}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Truck</Label>
              <SearchCombobox
                value={form.vehicle_number}
                onChange={(value) => {
                  setTruckQuery(value)
                  setForm({ ...form, vehicle_number: value })
                }}
                onSearch={setTruckQuery}
                onSelect={(option) => {
                  setTruckQuery(option.value)
                  setForm({ ...form, vehicle_number: option.value })
                }}
                options={truckOptions}
                placeholder="Search truck plate…"
                disabled={saving}
                emptyText="No trucks — create under Master → Trucks"
              />
            </div>
            {editing ? (
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  disabled={saving}
                >
                  <option value="Active">Active</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Left">Left</option>
                </Select>
              </div>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deactivating)}
        title="Deactivate driver?"
        description={
          deactivating ? (
            <>
              <span className="font-medium text-foreground">{deactivating.full_name}</span> will be
              marked as Left and removed from active dispatch.
            </>
          ) : null
        }
        confirmLabel="Deactivate"
        loading={deleteLoading}
        onConfirm={() => void confirmDeactivate()}
        onClose={() => {
          if (deleteLoading) return
          setDeactivating(null)
        }}
      />
    </div>
  )
}
