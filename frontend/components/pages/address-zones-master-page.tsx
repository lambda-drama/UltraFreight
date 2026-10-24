'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  createMasterAddressZone,
  deleteMasterAddressZone,
  listMasterAddressZones,
  updateMasterAddressZone,
  type MasterAddressZoneRow,
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
  Textarea,
} from '@/components/ui/primitives'
import { FilterToolbar, matchesText } from '@/components/layout/filter-toolbar'
import { formatMoney } from '@/lib/utils'
import { Loader2, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react'

const MASTER_ROLES = ['System Manager', 'Administrator']

const emptyForm = {
  zone_name: '',
  zone_city: '',
  transport_charges: '',
  more_information: '',
}

export default function AddressZonesMasterPage() {
  const { user } = useAuth()
  const { navigate } = useNavigation()
  const canManage = Boolean(
    user?.name === 'Administrator' || user?.roles?.some((role) => MASTER_ROLES.includes(role))
  )
  const [search, setSearch] = useState('')
  const { data, isLoading, mutate } = useSWR(canManage ? 'master-address-zones' : null, () =>
    listMasterAddressZones('')
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MasterAddressZoneRow | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<MasterAddressZoneRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const rows = useMemo(() => {
    return (data || []).filter(
      (row) =>
        matchesText(row.zone_name || row.name || '', search) ||
        matchesText(row.zone_city || '', search)
    )
  }, [data, search])

  if (!canManage) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-warning" />
        <h2 className="font-serif-display text-xl font-semibold">Access restricted</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Zones under Master are only available to System Manager or Administrator.
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

  function openEdit(row: MasterAddressZoneRow) {
    setEditing(row)
    setForm({
      zone_name: row.zone_name || row.name,
      zone_city: row.zone_city || '',
      transport_charges: row.transport_charges != null ? String(row.transport_charges) : '',
      more_information: row.more_information || '',
    })
    setModalOpen(true)
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await deleteMasterAddressZone(deleting.name)
      toast.success('Zone deleted')
      if (editing?.name === deleting.name) setModalOpen(false)
      setDeleting(null)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete zone')
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editing && !form.zone_name.trim()) {
      toast.error('Zone name is required')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateMasterAddressZone(editing.name, {
          zone_city: form.zone_city.trim() || undefined,
          transport_charges: form.transport_charges.trim() ? Number(form.transport_charges) : 0,
          more_information: form.more_information.trim() || undefined,
        })
        toast.success('Zone updated')
      } else {
        await createMasterAddressZone({
          zone_name: form.zone_name.trim(),
          zone_city: form.zone_city.trim() || undefined,
          transport_charges: form.transport_charges.trim() ? Number(form.transport_charges) : 0,
          more_information: form.more_information.trim() || undefined,
        })
        toast.success('Zone created')
      }
      setModalOpen(false)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save zone')
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
        title="Zones"
        description="Define address zones and default transport charges used on transport customers"
        action={
          <Button
            type="button"
            onClick={openCreate}
            className="h-10 w-10 px-0"
            title="New zone"
            aria-label="New zone"
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
            placeholder: 'Zone or city…',
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
          emptyText="No address zones yet."
          onRowClick={(row) => openEdit(row as unknown as MasterAddressZoneRow)}
          columns={[
            {
              key: 'zone_name',
              label: 'Zone',
              render: (row) => (
                <div>
                  <div className="font-medium">{String(row.zone_name || row.name || '')}</div>
                  <div className="text-xs text-muted-foreground">{String(row.name || '')}</div>
                </div>
              ),
            },
            { key: 'zone_city', label: 'City' },
            {
              key: 'transport_charges',
              label: 'Default charge',
              render: (row) => formatMoney(Number(row.transport_charges || 0)),
            },
            {
              key: 'actions',
              label: '',
              render: (row) => {
                const zone = row as unknown as MasterAddressZoneRow
                return (
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 w-9 px-0"
                      title="Edit"
                      aria-label={`Edit ${zone.zone_name || zone.name}`}
                      onClick={() => openEdit(zone)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 w-9 px-0 text-destructive hover:text-destructive"
                      title="Delete"
                      aria-label={`Delete ${zone.zone_name || zone.name}`}
                      onClick={() => setDeleting(zone)}
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
        title={editing ? editing.name : 'New Zone'}
        onClose={() => {
          if (saving) return
          setModalOpen(false)
        }}
      >
        <form className="space-y-4" onSubmit={handleSave}>
          <div>
            <Label>Zone name *</Label>
            <Input
              value={form.zone_name}
              onChange={(e) => setForm({ ...form, zone_name: e.target.value })}
              required={!editing}
              disabled={saving || Boolean(editing)}
              placeholder="e.g. Westlands"
            />
            {editing ? (
              <p className="mt-1 text-xs text-muted-foreground">Zone name cannot be renamed here.</p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>City</Label>
              <Input
                value={form.zone_city}
                onChange={(e) => setForm({ ...form, zone_city: e.target.value })}
                disabled={saving}
              />
            </div>
            <div>
              <Label>Default transport charge</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.transport_charges}
                onChange={(e) => setForm({ ...form, transport_charges: e.target.value })}
                disabled={saving}
              />
            </div>
          </div>
          <div>
            <Label>More information</Label>
            <Textarea
              value={form.more_information}
              onChange={(e) => setForm({ ...form, more_information: e.target.value })}
              rows={3}
              disabled={saving}
            />
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
        title="Delete zone?"
        description={
          deleting ? (
            <>
              This will permanently remove{' '}
              <span className="font-medium text-foreground">{deleting.zone_name || deleting.name}</span>
              . Zones assigned to transport customers cannot be deleted until they are unassigned.
            </>
          ) : null
        }
        confirmLabel="Delete zone"
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
