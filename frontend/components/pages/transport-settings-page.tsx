'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  getPortalTransportSettings,
  searchSettingsLinkOptions,
  updatePortalTransportSettings,
  type TransportSettingsPayload,
} from '@/services/transport'
import { useAuth } from '@/contexts/auth-context'
import { useNavigation } from '@/contexts/navigation-context'
import { Button, Input, Label, Select } from '@/components/ui/primitives'
import { SearchCombobox } from '@/components/ui/search-combobox'
import { Loader2, Save, ShieldAlert } from 'lucide-react'

const MASTER_ROLES = ['System Manager', 'Administrator']

const SMS_PROVIDERS = ['', "Frappe SMS Settings", "Africa's Talking", 'Twilio', 'Other']

function LinkField({
  label,
  doctype,
  value,
  onChange,
  disabled,
  hint,
}: {
  label: string
  doctype: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  hint?: string
}) {
  const [options, setOptions] = useState<{ name: string; label: string }[]>([])

  async function refresh(search: string) {
    try {
      setOptions(await searchSettingsLinkOptions(doctype, search))
    } catch {
      setOptions([])
    }
  }

  return (
    <div>
      <Label>{label}</Label>
      <SearchCombobox
        value={value}
        onChange={(next) => {
          onChange(next)
          void refresh(next)
        }}
        onSearch={(next) => void refresh(next)}
        onSelect={(option) => onChange(option.value)}
        options={options.map((row) => ({
          value: row.name,
          label: row.label || row.name,
          description: row.label !== row.name ? row.name : undefined,
        }))}
        placeholder={`Search ${doctype}…`}
        disabled={disabled}
        emptyText={`No ${doctype} found`}
      />
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

const emptyForm: TransportSettingsPayload = {
  otp_expiry_minutes: 60,
  ultra_transport_company: '',
  ultra_transport_email: '',
  default_transport_item: '',
  default_sales_taxes_template: '',
  default_transport_charges: 0,
  default_country_code: '+254',
  branch: '',
  cost_center: '',
  default_print_format: '',
  default_letter_head: '',
  enable_email: 0,
  create_transport_order_on_dnote_submission: 0,
  delivery_note_workflow_action_to_create_order: '',
  enable_sms: 0,
  sms_provider: '',
  sms_sender_id: '',
  sms_api_url: '',
  sms_api_key: '',
  sms_api_key_set: false,
}

export default function TransportSettingsPage() {
  const { user } = useAuth()
  const { navigate } = useNavigation()
  const canManage = Boolean(
    user?.name === 'Administrator' || user?.roles?.some((role) => MASTER_ROLES.includes(role))
  )
  const { data, isLoading, mutate } = useSWR(
    canManage ? 'portal-transport-settings' : null,
    getPortalTransportSettings
  )
  const [form, setForm] = useState<TransportSettingsPayload>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data) {
      setForm({
        ...emptyForm,
        ...data,
        sms_api_key: '',
      })
    }
  }, [data])

  if (!canManage) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-warning" />
        <h2 className="font-serif-display text-xl font-semibold">Access restricted</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Transport Settings under Master are only available to System Manager or Administrator.
        </p>
        <Button className="mt-5" variant="outline" onClick={() => navigate('dashboard')}>
          Back to dashboard
        </Button>
      </div>
    )
  }

  function setField<K extends keyof TransportSettingsPayload>(key: K, value: TransportSettingsPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload: Record<string, string | number> = {
        otp_expiry_minutes: Number(form.otp_expiry_minutes || 0),
        ultra_transport_company: form.ultra_transport_company || '',
        ultra_transport_email: form.ultra_transport_email || '',
        default_transport_item: form.default_transport_item || '',
        default_sales_taxes_template: form.default_sales_taxes_template || '',
        default_transport_charges: Number(form.default_transport_charges || 0),
        default_country_code: form.default_country_code || '',
        branch: form.branch || '',
        cost_center: form.cost_center || '',
        default_print_format: form.default_print_format || '',
        default_letter_head: form.default_letter_head || '',
        enable_email: form.enable_email ? 1 : 0,
        create_transport_order_on_dnote_submission: form.create_transport_order_on_dnote_submission ? 1 : 0,
        delivery_note_workflow_action_to_create_order:
          form.delivery_note_workflow_action_to_create_order || '',
        enable_sms: form.enable_sms ? 1 : 0,
        sms_provider: form.sms_provider || '',
        sms_sender_id: form.sms_sender_id || '',
        sms_api_url: form.sms_api_url || '',
      }
      if ((form.sms_api_key || '').trim()) {
        payload.sms_api_key = form.sms_api_key!.trim()
      }
      const updated = await updatePortalTransportSettings(payload)
      setForm({ ...emptyForm, ...updated, sms_api_key: '' })
      await mutate(updated, false)
      toast.success('Transport settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <p className="section-label mb-2">Master</p>
        <h1 className="font-serif-display text-3xl font-semibold tracking-tight">Transport Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Company defaults used for standalone transport orders, OTP, SMS, email, and print.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Company & billing</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <LinkField
                label="Ultra Transport Company"
                doctype="Company"
                value={form.ultra_transport_company || ''}
                onChange={(v) => setField('ultra_transport_company', v)}
                disabled={saving}
              />
              <div>
                <Label>Ultra Transport Contact Email</Label>
                <Input
                  type="email"
                  value={form.ultra_transport_email || ''}
                  onChange={(e) => setField('ultra_transport_email', e.target.value)}
                  disabled={saving}
                />
              </div>
              <LinkField
                label="Default Transport Service Item"
                doctype="Item"
                value={form.default_transport_item || ''}
                onChange={(v) => setField('default_transport_item', v)}
                disabled={saving}
              />
              <LinkField
                label="Default Sales Taxes Template"
                doctype="Sales Taxes and Charges Template"
                value={form.default_sales_taxes_template || ''}
                onChange={(v) => setField('default_sales_taxes_template', v)}
                disabled={saving}
              />
              <div>
                <Label>Default Transport Charges</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={String(form.default_transport_charges ?? '')}
                  onChange={(e) => setField('default_transport_charges', Number(e.target.value))}
                  disabled={saving}
                />
              </div>
              <div>
                <Label>Default Country Code</Label>
                <Input
                  value={form.default_country_code || ''}
                  onChange={(e) => setField('default_country_code', e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">OTP & actions</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>OTP Expiry Minutes</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={String(form.otp_expiry_minutes ?? '')}
                  onChange={(e) => setField('otp_expiry_minutes', Number(e.target.value))}
                  disabled={saving}
                />
              </div>
              <div className="flex items-end gap-3 pb-1">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(form.create_transport_order_on_dnote_submission)}
                    onChange={(e) =>
                      setField('create_transport_order_on_dnote_submission', e.target.checked ? 1 : 0)
                    }
                    disabled={saving}
                  />
                  Create transport order on DNote submission
                </label>
              </div>
              {!form.create_transport_order_on_dnote_submission ? (
                <div className="sm:col-span-2">
                  <LinkField
                    label="Delivery Note Workflow Action To Create Order"
                    doctype="Workflow Action Master"
                    value={form.delivery_note_workflow_action_to_create_order || ''}
                    onChange={(v) => setField('delivery_note_workflow_action_to_create_order', v)}
                    disabled={saving}
                    hint="Used when auto-create on submission is off (e.g. Initiate Delivery)."
                  />
                </div>
              ) : null}
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Accounting & print</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <LinkField
                label="Branch"
                doctype="Branch"
                value={form.branch || ''}
                onChange={(v) => setField('branch', v)}
                disabled={saving}
              />
              <LinkField
                label="Cost Center"
                doctype="Cost Center"
                value={form.cost_center || ''}
                onChange={(v) => setField('cost_center', v)}
                disabled={saving}
              />
              <LinkField
                label="Default Print Format"
                doctype="Print Format"
                value={form.default_print_format || ''}
                onChange={(v) => setField('default_print_format', v)}
                disabled={saving}
              />
              <LinkField
                label="Default Letter Head"
                doctype="Letter Head"
                value={form.default_letter_head || ''}
                onChange={(v) => setField('default_letter_head', v)}
                disabled={saving}
              />
              <div className="flex items-end gap-3 pb-1 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(form.enable_email)}
                    onChange={(e) => setField('enable_email', e.target.checked ? 1 : 0)}
                    disabled={saving}
                  />
                  Enable email notifications
                </label>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">SMS</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-end gap-3 pb-1 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(form.enable_sms)}
                    onChange={(e) => setField('enable_sms', e.target.checked ? 1 : 0)}
                    disabled={saving}
                  />
                  Enable SMS
                </label>
              </div>
              <div>
                <Label>SMS Provider</Label>
                <Select
                  value={form.sms_provider || ''}
                  onChange={(e) => setField('sms_provider', e.target.value)}
                  disabled={saving}
                >
                  {SMS_PROVIDERS.map((provider) => (
                    <option key={provider || 'blank'} value={provider}>
                      {provider || 'Select provider'}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>SMS Sender ID</Label>
                <Input
                  value={form.sms_sender_id || ''}
                  onChange={(e) => setField('sms_sender_id', e.target.value)}
                  disabled={saving}
                />
              </div>
              <div>
                <Label>SMS API URL</Label>
                <Input
                  value={form.sms_api_url || ''}
                  onChange={(e) => setField('sms_api_url', e.target.value)}
                  disabled={saving}
                />
              </div>
              <div>
                <Label>SMS API Key</Label>
                <Input
                  type="password"
                  value={form.sms_api_key || ''}
                  onChange={(e) => setField('sms_api_key', e.target.value)}
                  placeholder={form.sms_api_key_set ? '•••••••• (leave blank to keep)' : 'Optional'}
                  disabled={saving}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save settings
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
