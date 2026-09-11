'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  createMasterTransportCustomer,
  deleteMasterTransportCustomer,
  getMasterTransportCustomer,
  listMasterAddressZones,
  listMasterTransportCustomers,
  updateMasterTransportCustomer,
  type MasterTransportCustomerDetail,
  type MasterZoneRow,
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
  Textarea,
} from '@/components/ui/primitives'
import { SearchCombobox } from '@/components/ui/search-combobox'
import { FilterToolbar, matchesText } from '@/components/layout/filter-toolbar'
import { Loader2, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react'

const MASTER_ROLES = ['System Manager', 'Administrator']

type ZoneDraft = {
  key: string
  zone: string
  city: string
  transport_charges: string
  default: boolean
}

const emptyForm = {
  customer_name: '',
  phone_number: '',
  email: '',
  contact_person: '',
  contact_phone: '',
  send_otp: true,
  delivery_address: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
  notes: '',
}

function newZoneDraft(partial?: Partial<ZoneDraft>): ZoneDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    zone: '',
    city: '',
    transport_charges: '',
    default: false,
    ...partial,
  }
}

export default function TransportCustomersMasterPage() {
  const { user } = useAuth()
  const { navigate } = useNavigation()
  const canManage = Boolean(
    user?.name === 'Administrator' || user?.roles?.some((role) => MASTER_ROLES.includes(role))
  )
  const [search, setSearch] = useState('')
  const { data, isLoading, mutate } = useSWR(canManage ? 'master-transport-customers' : null, () =>
    listMasterTransportCustomers('')
  )
  const { data: zoneCatalog } = useSWR(canManage ? 'master-address-zones-catalog' : null, () =>
    listMasterAddressZones('')
  )

  const [modalOpen, setModalOpen] = useState(false)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [zones, setZones] = useState<ZoneDraft[]>([])
  const [zoneQuery, setZoneQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<{ name: string; label: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const rows = useMemo(() => {
    return (data || []).filter(
      (row) =>
        matchesText(row.customer_name || '', search) ||
        matchesText(row.phone_number || '', search) ||
        matchesText(row.name || '', search)
    )
  }, [data, search])

  const zoneOptions = useMemo(() => {
    const q = zoneQuery.trim().toLowerCase()
    return (zoneCatalog || [])
      .filter((z) => {
        if (!q) return true
        return (
          z.name.toLowerCase().includes(q) ||
          (z.zone_city || '').toLowerCase().includes(q) ||
          (z.zone_name || '').toLowerCase().includes(q)
        )
      })
      .map((z) => ({
        value: z.name,
        label: z.zone_name || z.name,
        description: [z.zone_city, z.transport_charges != null ? String(z.transport_charges) : '']
          .filter(Boolean)
          .join(' · '),
      }))
  }, [zoneCatalog, zoneQuery])

  if (!canManage) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-warning" />
        <h2 className="font-serif-display text-xl font-semibold">Access restricted</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Transport Customers under Master are only available to System Manager or Administrator.
        </p>
        <Button className="mt-5" variant="outline" onClick={() => navigate('dashboard')}>
          Back to dashboard
        </Button>
      </div>
    )
  }

  function openCreate() {
    setEditingName(null)
    setForm(emptyForm)
    setZones([])
    setModalOpen(true)
  }

  async function openEdit(name: string) {
    try {
      const detail = await getMasterTransportCustomer(name)
      applyDetail(detail)
      setModalOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load customer')
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await deleteMasterTransportCustomer(deleting.name)
      toast.success('Transport customer deleted')
      if (editingName === deleting.name) setModalOpen(false)
      setDeleting(null)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete customer')
    } finally {
      setDeleteLoading(false)
    }
  }

  function applyDetail(detail: MasterTransportCustomerDetail) {
    setEditingName(detail.name)
    setForm({
      customer_name: detail.customer_name || '',
      phone_number: detail.phone_number || '',
      email: detail.email || '',
      contact_person: detail.contact_person || '',
      contact_phone: detail.contact_phone || '',
      send_otp: Number(detail.send_otp ?? 1) === 1,
      delivery_address: detail.delivery_address || '',
      city: detail.city || '',
      state: detail.state || '',
      postal_code: detail.postal_code || '',
      country: detail.country || '',
      notes: detail.notes || '',
    })
    setZones(
      (detail.zones || []).map((z) =>
        newZoneDraft({
          zone: z.zone,
          city: z.city || '',
          transport_charges: z.transport_charges != null ? String(z.transport_charges) : '',
          default: Number(z.default) === 1,
        })
      )
    )
  }

  function addZoneRow() {
    setZones((prev) => [...prev, newZoneDraft({ default: prev.length === 0 })])
  }

  function updateZoneRow(key: string, patch: Partial<ZoneDraft>) {
    setZones((prev) =>
      prev.map((row) => {
        if (row.key !== key) {
          if (patch.default) return { ...row, default: false }
          return row
        }
        return { ...row, ...patch }
      })
    )
  }

  function applyZoneSelection(key: string, zoneName: string) {
    const match = (zoneCatalog || []).find((z) => z.name === zoneName)
    updateZoneRow(key, {
      zone: zoneName,
      city: match?.zone_city || '',
      transport_charges:
        match?.transport_charges != null && match.transport_charges !== undefined
          ? String(match.transport_charges)
          : '',
    })
  }

  function removeZoneRow(key: string) {
    setZones((prev) => {
      const next = prev.filter((row) => row.key !== key)
      if (next.length && !next.some((row) => row.default)) {
        next[0] = { ...next[0], default: true }
      }
      return next
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customer_name.trim() || !form.phone_number.trim()) {
      toast.error('Customer name and phone are required')
      return
    }
    const zonePayload: MasterZoneRow[] = zones
      .filter((row) => row.zone.trim())
      .map((row) => ({
        zone: row.zone.trim(),
        city: row.city.trim() || undefined,
        transport_charges: row.transport_charges.trim() ? Number(row.transport_charges) : undefined,
        default: row.default ? 1 : 0,
      }))

    setSaving(true)
    try {
      const payload = {
        customer_name: form.customer_name.trim(),
        phone_number: form.phone_number.trim(),
        email: form.email.trim() || undefined,
        contact_person: form.contact_person.trim() || undefined,
        contact_phone: form.contact_phone.trim() || undefined,
        send_otp: form.send_otp ? 1 : 0,
        delivery_address: form.delivery_address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        postal_code: form.postal_code.trim() || undefined,
        country: form.country.trim() || undefined,
        notes: form.notes.trim() || undefined,
        zones: zonePayload,
      }
      if (editingName) {
        await updateMasterTransportCustomer(editingName, payload)
        toast.success('Transport customer updated')
      } else {
        await createMasterTransportCustomer(payload)
        toast.success('Transport customer created')
      }
      setModalOpen(false)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save customer')
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
        title="Transport Customers"
        description="Final customers for delivery — create records and assign address zones with charges"
        action={
          <Button
            type="button"
            onClick={openCreate}
            className="h-10 w-10 px-0"
            title="New transport customer"
            aria-label="New transport customer"
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
            placeholder: 'Name or phone…',
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
          emptyText="No transport customers yet."
          onRowClick={(row) => void openEdit(String(row.name))}
          columns={[
            {
              key: 'customer_name',
              label: 'Customer',
              render: (row) => (
                <div>
                  <div className="font-medium">{String(row.customer_name || '')}</div>
                  <div className="text-xs text-muted-foreground">{String(row.name || '')}</div>
                </div>
              ),
            },
            { key: 'phone_number', label: 'Phone' },
            { key: 'email', label: 'Email' },
            { key: 'city', label: 'City' },
            {
              key: 'zones',
              label: 'Zones',
              render: (row) => (
                <div className="space-y-1">
                  <Badge variant="muted">{Number(row.zone_count || 0)} zones</Badge>
                  {row.default_zone ? (
                    <div className="text-xs text-muted-foreground">Default: {String(row.default_zone)}</div>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'send_otp',
              label: 'OTP',
              render: (row) => (
                <Badge variant={Number(row.send_otp) === 1 ? 'success' : 'muted'}>
                  {Number(row.send_otp) === 1 ? 'On' : 'Off'}
                </Badge>
              ),
            },
            {
              key: 'actions',
              label: '',
              render: (row) => (
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 w-9 px-0"
                    title="Edit"
                    aria-label={`Edit ${String(row.customer_name || row.name)}`}
                    onClick={() => void openEdit(String(row.name))}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 w-9 px-0 text-destructive hover:text-destructive"
                    title="Delete"
                    aria-label={`Delete ${String(row.customer_name || row.name)}`}
                    onClick={() =>
                      setDeleting({
                        name: String(row.name),
                        label: String(row.customer_name || row.name),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={modalOpen}
        title={editingName || 'New Transport Customer'}
        onClose={() => {
          if (saving) return
          setModalOpen(false)
        }}
        className="max-w-2xl"
      >
        <form className="space-y-4" onSubmit={handleSave}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Customer name *</Label>
              <Input
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                required
                disabled={saving}
              />
            </div>
            <div>
              <Label>Phone *</Label>
              <Input
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                required
                disabled={saving}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={saving}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.send_otp}
                  onChange={(e) => setForm({ ...form, send_otp: e.target.checked })}
                  disabled={saving}
                />
                Send OTP on dispatch
              </label>
            </div>
            <div>
              <Label>Contact person</Label>
              <Input
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                disabled={saving}
              />
            </div>
            <div>
              <Label>Contact phone</Label>
              <Input
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                disabled={saving}
              />
            </div>
          </div>

          <div>
            <Label>Delivery address</Label>
            <Textarea
              value={form.delivery_address}
              onChange={(e) => setForm({ ...form, delivery_address: e.target.value })}
              rows={2}
              disabled={saving}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} disabled={saving} />
            </div>
            <div>
              <Label>State</Label>
              <Input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                disabled={saving}
              />
            </div>
            <div>
              <Label>Postal code</Label>
              <Input
                value={form.postal_code}
                onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                disabled={saving}
              />
            </div>
            <div>
              <Label>Country</Label>
              <Input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                disabled={saving}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Zones</p>
                <p className="text-xs text-muted-foreground">
                  Assign address zones and optional charge overrides. Create zones under Master → Zones first.
                </p>
              </div>
              <Button type="button" variant="outline" className="h-9 w-9 px-0" onClick={addZoneRow} disabled={saving}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {!zones.length ? (
              <p className="text-xs text-muted-foreground">No zones assigned yet.</p>
            ) : (
              <div className="space-y-3">
                {zones.map((row) => (
                  <div key={row.key} className="grid gap-2 rounded-xl bg-muted/30 p-3 sm:grid-cols-12">
                    <div className="sm:col-span-5">
                      <Label>Zone</Label>
                      <SearchCombobox
                        value={row.zone}
                        onChange={(value) => {
                          setZoneQuery(value)
                          updateZoneRow(row.key, { zone: value })
                        }}
                        onSearch={setZoneQuery}
                        onSelect={(option) => applyZoneSelection(row.key, option.value)}
                        options={zoneOptions}
                        placeholder="Search zone…"
                        disabled={saving}
                        emptyText="No zones — create under Master → Zones"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Label>City</Label>
                      <Input
                        value={row.city}
                        onChange={(e) => updateZoneRow(row.key, { city: e.target.value })}
                        disabled={saving}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Charge</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.transport_charges}
                        onChange={(e) => updateZoneRow(row.key, { transport_charges: e.target.value })}
                        disabled={saving}
                      />
                    </div>
                    <div className="flex items-end justify-between gap-2 sm:col-span-2">
                      <label className="flex items-center gap-2 pb-2 text-xs">
                        <input
                          type="checkbox"
                          checked={row.default}
                          onChange={(e) => updateZoneRow(row.key, { default: e.target.checked })}
                          disabled={saving}
                        />
                        Default
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 w-9 px-0"
                        onClick={() => removeZoneRow(row.key)}
                        disabled={saving}
                        aria-label="Remove zone"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
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
        title="Delete transport customer?"
        description={
          deleting ? (
            <>
              This will permanently remove{' '}
              <span className="font-medium text-foreground">{deleting.label}</span>
              . Customers linked to sales orders or delivery notes cannot be deleted.
            </>
          ) : null
        }
        confirmLabel="Delete customer"
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
