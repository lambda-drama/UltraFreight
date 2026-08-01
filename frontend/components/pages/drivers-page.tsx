'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  createDriver,
  deactivateDriver,
  getDrivers,
  regenerateDriverKey,
  updateDriver,
  type DriverRow,
} from '@/services/transport'
import {
  Badge,
  Button,
  DataTable,
  Input,
  Label,
  Modal,
  PageHeader,
  Select,
} from '@/components/ui/primitives'
import { Loader2, Plus, RefreshCw, ExternalLink, Copy } from 'lucide-react'
import { DRIVER_PORTAL_PATH, getDriverPortalUrl } from '@/lib/driver-portal'
import { ListExportActions } from '@/components/ui/list-export-actions'
import type { ListExportColumn } from '@/lib/list-export'

const emptyForm = { full_name: '', cell_number: '', vehicle_number: '', status: 'Active' }

const EXPORT_COLUMNS: ListExportColumn[] = [
  { key: 'full_name', label: 'Name' },
  { key: 'cell_number', label: 'Phone' },
  { key: 'vehicle_number', label: 'Vehicle' },
  { key: 'unique_key', label: 'PIN' },
  { key: 'status', label: 'Status' },
]

export default function DriversPage() {
  const [showInactive, setShowInactive] = useState(false)
  const { data, isLoading, mutate } = useSWR(['drivers', showInactive], () => getDrivers(showInactive))
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DriverRow | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
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
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await updateDriver(editing.name, form)
        toast.success('Driver updated')
      } else {
        await createDriver(form)
        toast.success('Driver added')
      }
      setModalOpen(false)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(name: string) {
    if (!confirm('Remove this driver from active dispatch?')) return
    try {
      await deactivateDriver(name)
      toast.success('Driver deactivated')
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    }
  }

  async function handleRegenerateKey(name: string) {
    try {
      const result = await regenerateDriverKey(name)
      toast.success(`New PIN: ${result.unique_key}`)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    }
  }

  const driverPortalUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${DRIVER_PORTAL_PATH}` : DRIVER_PORTAL_PATH

  async function copyDriverPortalLink(driver?: DriverRow) {
    const url = driver?.name && driver.unique_key
      ? getDriverPortalUrl(driver.name, driver.unique_key)
      : driverPortalUrl
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Driver portal link copied')
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <div>
      <PageHeader
        title="Drivers"
        description="Add, edit, and manage drivers for your transport company"
        action={
          <div className="flex flex-wrap gap-2">
            <ListExportActions
              title="Drivers"
              columns={EXPORT_COLUMNS}
              rows={(data || []) as unknown as Record<string, unknown>[]}
            />
            <Button variant="outline" onClick={() => copyDriverPortalLink()}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Driver Portal Link
            </Button>
            <Button variant="outline" onClick={() => setShowInactive((v) => !v)}>
              {showInactive ? 'Hide Inactive' : 'Show Inactive'}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Driver
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm">
        <div>
          <p className="font-medium text-foreground">Driver portal</p>
          <p className="text-muted-foreground">Drivers use this link with their 4-digit PIN and OTP to confirm deliveries.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-lg bg-card px-3 py-1.5 text-xs">{driverPortalUrl}</code>
          <Button variant="outline" onClick={() => window.open(driverPortalUrl, '_blank')}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <DataTable
          rows={(data || []) as Record<string, unknown>[]}
          columns={[
            { key: 'full_name', label: 'Name' },
            { key: 'cell_number', label: 'Phone' },
            { key: 'vehicle_number', label: 'Vehicle' },
            {
              key: 'status',
              label: 'Status',
              render: (row) => (
                <Badge variant={row.status === 'Active' ? 'success' : 'muted'}>{String(row.status || '—')}</Badge>
              ),
            },
            { key: 'unique_key', label: 'PIN' },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => openEdit(row as DriverRow)}>Edit</Button>
                  <Button
                    variant="outline"
                    title="Copy personal driver portal link"
                    onClick={() => copyDriverPortalLink(row as DriverRow)}
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Portal Link
                  </Button>
                  <Button variant="outline" onClick={() => handleRegenerateKey(String(row.name))}>
                    <RefreshCw className="mr-1 h-3 w-3" />
                    New PIN
                  </Button>
                  {row.status === 'Active' ? (
                    <Button variant="destructive" onClick={() => handleDeactivate(String(row.name))}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal open={modalOpen} title={editing ? 'Edit Driver' : 'Add Driver'} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label>Full Name</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.cell_number} onChange={(e) => setForm({ ...form, cell_number: e.target.value })} required />
          </div>
          <div>
            <Label>Vehicle Number</Label>
            <Input value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} />
          </div>
          {editing ? (
            <div>
              <Label>Status</Label>
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Left">Left</option>
              </Select>
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Save Changes' : 'Add Driver'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
