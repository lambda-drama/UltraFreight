'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  createVehicle,
  deleteVehicle,
  getVehicles,
  updateVehicle,
  type VehicleRow,
} from '@/services/transport'
import { useAuth } from '@/contexts/auth-context'
import { useNavigation } from '@/contexts/navigation-context'
import {
  Button,
  ConfirmModal,
  DataTable,
  Input,
  Label,
  Modal,
  PageHeader,
  Select,
} from '@/components/ui/primitives'
import { FilterToolbar, matchesText } from '@/components/layout/filter-toolbar'
import { Loader2, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react'

const MASTER_ROLES = ['System Manager', 'Administrator']

const emptyForm = {
  license_plate: '',
  make: '',
  model: '',
  fuel_type: 'Diesel',
  last_odometer: '0',
  color: '',
  location: '',
  chassis_no: '',
}

export default function TrucksMasterPage() {
  const { user } = useAuth()
  const { navigate } = useNavigation()
  const canManage = Boolean(
    user?.name === 'Administrator' || user?.roles?.some((role) => MASTER_ROLES.includes(role))
  )
  const [search, setSearch] = useState('')
  const { data, isLoading, mutate } = useSWR(canManage ? 'master-trucks' : null, getVehicles)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<VehicleRow | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<VehicleRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const rows = useMemo(() => {
    return (data || []).filter(
      (row) =>
        matchesText(row.license_plate || row.name || '', search) ||
        matchesText(row.make || '', search) ||
        matchesText(row.model || '', search)
    )
  }, [data, search])

  if (!canManage) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-warning" />
        <h2 className="font-serif-display text-xl font-semibold">Access restricted</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Trucks under Master are only available to System Manager or Administrator.
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
    setModalOpen(true)
  }

  function openEdit(row: VehicleRow) {
    setEditing(row)
    setForm({
      license_plate: row.license_plate || row.name,
      make: row.make || '',
      model: row.model || '',
      fuel_type: row.fuel_type || 'Diesel',
      last_odometer: row.last_odometer != null ? String(row.last_odometer) : '0',
      color: row.color || '',
      location: row.location || '',
      chassis_no: row.chassis_no || '',
    })
    setModalOpen(true)
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await deleteVehicle(deleting.name)
      toast.success('Truck deleted')
      if (editing?.name === deleting.name) setModalOpen(false)
      setDeleting(null)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete truck')
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editing && !form.license_plate.trim()) {
      toast.error('License plate is required')
      return
    }
    if (!form.make.trim() || !form.model.trim()) {
      toast.error('Make and model are required')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateVehicle(editing.name, {
          make: form.make.trim(),
          model: form.model.trim(),
          fuel_type: form.fuel_type,
          color: form.color.trim() || undefined,
          location: form.location.trim() || undefined,
          chassis_no: form.chassis_no.trim() || undefined,
        })
        toast.success('Truck updated')
      } else {
        await createVehicle({
          license_plate: form.license_plate.trim(),
          make: form.make.trim(),
          model: form.model.trim(),
          fuel_type: form.fuel_type,
          last_odometer: form.last_odometer.trim() ? Number(form.last_odometer) : 0,
          color: form.color.trim() || undefined,
          location: form.location.trim() || undefined,
          chassis_no: form.chassis_no.trim() || undefined,
        })
        toast.success('Truck created')
      }
      setModalOpen(false)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save truck')
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
        title="Trucks"
        description="Fleet vehicles used when assigning drivers on transport orders"
        action={
          <Button
            type="button"
            onClick={openCreate}
            className="h-10 w-10 px-0"
            title="New truck"
            aria-label="New truck"
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
            placeholder: 'Plate, make, or model…',
          },
        ]}
        defaultOpen
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <DataTable
          rows={rows as unknown as Record<string, unknown>[]}
          emptyText="No trucks yet."
          onRowClick={(row) => openEdit(row as unknown as VehicleRow)}
          columns={[
            {
              key: 'license_plate',
              label: 'Plate',
              render: (row) => (
                <div>
                  <div className="font-medium">{String(row.license_plate || row.name || '')}</div>
                  {row.company ? (
                    <div className="text-xs text-muted-foreground">{String(row.company)}</div>
                  ) : null}
                </div>
              ),
            },
            { key: 'make', label: 'Make' },
            { key: 'model', label: 'Model' },
            { key: 'fuel_type', label: 'Fuel' },
            { key: 'color', label: 'Color' },
            {
              key: 'actions',
              label: '',
              render: (row) => {
                const truck = row as unknown as VehicleRow
                return (
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 w-9 px-0"
                      title="Edit"
                      aria-label={`Edit ${truck.license_plate || truck.name}`}
                      onClick={() => openEdit(truck)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 w-9 px-0 text-destructive hover:text-destructive"
                      title="Delete"
                      aria-label={`Delete ${truck.license_plate || truck.name}`}
                      onClick={() => setDeleting(truck)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              },
            },
          ]}
        />
      )}

      <Modal
        open={modalOpen}
        title={editing ? editing.name : 'New Truck'}
        onClose={() => {
          if (saving) return
          setModalOpen(false)
        }}
        className="max-w-xl"
      >
        <form className="space-y-4" onSubmit={handleSave}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>License plate *</Label>
              <Input
                value={form.license_plate}
                onChange={(e) => setForm({ ...form, license_plate: e.target.value })}
                required={!editing}
                disabled={saving || Boolean(editing)}
                placeholder="e.g. KDA 123A"
              />
              {editing ? (
                <p className="mt-1 text-xs text-muted-foreground">Plate cannot be renamed here.</p>
              ) : null}
            </div>
            <div>
              <Label>Fuel type *</Label>
              <Select
                value={form.fuel_type}
                onChange={(e) => setForm({ ...form, fuel_type: e.target.value })}
                disabled={saving}
              >
                <option value="Diesel">Diesel</option>
                <option value="Petrol">Petrol</option>
                <option value="Natural Gas">Natural Gas</option>
                <option value="Electric">Electric</option>
              </Select>
            </div>
            <div>
              <Label>Make *</Label>
              <Input
                value={form.make}
                onChange={(e) => setForm({ ...form, make: e.target.value })}
                required
                disabled={saving}
                placeholder="e.g. Isuzu"
              />
            </div>
            <div>
              <Label>Model *</Label>
              <Input
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                required
                disabled={saving}
                placeholder="e.g. NPR"
              />
            </div>
            {!editing ? (
              <div>
                <Label>Odometer</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.last_odometer}
                  onChange={(e) => setForm({ ...form, last_odometer: e.target.value })}
                  disabled={saving}
                />
              </div>
            ) : null}
            <div>
              <Label>Color</Label>
              <Input
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                disabled={saving}
              />
            </div>
            <div>
              <Label>Location</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                disabled={saving}
              />
            </div>
            <div>
              <Label>Chassis no</Label>
              <Input
                value={form.chassis_no}
                onChange={(e) => setForm({ ...form, chassis_no: e.target.value })}
                disabled={saving}
              />
            </div>
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
        open={Boolean(deleting)}
        title="Delete truck?"
        description={
          deleting ? (
            <>
              This will permanently remove{' '}
              <span className="font-medium text-foreground">
                {deleting.license_plate || deleting.name}
              </span>
              . Trucks linked to delivery notes or drivers cannot be deleted.
            </>
          ) : null
        }
        confirmLabel="Delete truck"
        loading={deleteLoading}
        onConfirm={() => void confirmDelete()}
        onClose={() => {
          if (deleteLoading) return
          setDeleting(null)
        }}
      />
    </div>
  )
}
