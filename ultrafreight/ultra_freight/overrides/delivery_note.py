import frappe
from frappe import _
from frappe.utils import get_url

from erpnext.stock.doctype.delivery_note.delivery_note import DeliveryNote

from ultrafreight.ultra_freight.api.transport_dispatch import (
	create_transport_sales_order,
	notify_transport_company_pending_dispatch,
)
from ultrafreight.ultra_freight.utils.delivery_status import normalize_delivery_status
from ultrafreight.ultra_freight.utils.transport_settings import get_transport_settings


class UltraFreightDeliveryNote(DeliveryNote):
	def validate(self):
		super().validate()
		# if self.get("require_direct_delivery") and not self.get("driver"):
		# 	frappe.throw(_("Assign a Driver before submitting a direct delivery"))
		if self.get("require_direct_delivery"):
			self.delivery_status = normalize_delivery_status(self.delivery_status)

	def on_submit(self):
		super().on_submit()
		self.maybe_setup_transport_dispatch(from_submit=True)

	def on_update(self):
		# Draft → draft workflow transitions (no submit)
		if self.docstatus == 0:
			self.maybe_setup_transport_dispatch(from_submit=False)

	def on_update_after_submit(self):
		# Submitted → submitted workflow transitions
		self.maybe_setup_transport_dispatch(from_submit=False)

	def maybe_setup_transport_dispatch(self, *, from_submit: bool):
		if not self.get("require_direct_delivery"):
			return

		from ultrafreight.ultra_freight.api.transport_dispatch import _is_valid_transport_sales_order

		existing = self.get("transport_sales_order")
		if existing:
			goods_order = self.get_linked_sales_order()
			if _is_valid_transport_sales_order(existing, goods_order, self.name):
				return
			# Stale/wrong link (e.g. goods SO) — clear so we can create the real transport order
			frappe.db.set_value(
				"Delivery Note", self.name, "transport_sales_order", None, update_modified=False
			)
			self.transport_sales_order = None

		settings = get_transport_settings()
		create_on_submit = cint_setting(settings.get("create_transport_order_on_dnote_submission"))

		if create_on_submit:
			if from_submit:
				self.setup_dispatch()
			return

		# Fallback: create when the configured Delivery Note workflow action is applied
		if self._matched_configured_workflow_action(settings):
			self.setup_dispatch()

	def _matched_configured_workflow_action(self, settings: dict | None = None) -> bool:
		settings = settings or get_transport_settings()
		configured_action = (settings.get("delivery_note_workflow_action_to_create_order") or "").strip()
		if not configured_action:
			return False

		from frappe.model.workflow import get_workflow, get_workflow_name

		if not get_workflow_name(self.doctype):
			return False

		workflow = get_workflow(self.doctype)
		state_field = workflow.workflow_state_field
		before = self.get_doc_before_save()
		if not before:
			return False

		prev_state = before.get(state_field)
		curr_state = self.get(state_field)
		if not prev_state or not curr_state or prev_state == curr_state:
			return False

		for transition in workflow.transitions:
			if (
				transition.state == prev_state
				and transition.next_state == curr_state
				and transition.action == configured_action
			):
				return True
		return False

	def setup_dispatch(self):
		original_goods_order = self.get_linked_sales_order()
		transport_sales_order = create_transport_sales_order(self.name)
		frappe.db.commit()

		notify_transport_company_pending_dispatch(self.name, transport_sales_order)

		self.transport_sales_order = transport_sales_order
		self.delivery_status = "Open"

		transport_company = frappe.db.get_single_value("Transport Settings", "ultra_transport_company")
		so_link = get_url(f"/app/sales-order/{transport_sales_order}")
		frappe.msgprint(
			_(
				"<b>New Transport Sales Order (Draft):</b> <a href='{0}' target='_blank'>{1}</a><br>"
				"<b>Transport Company:</b> {2}<br>"
				"<b>Goods Sales Order:</b> {3}<br>"
				"<b>Status:</b> Open"
			).format(
				so_link,
				transport_sales_order,
				transport_company or "",
				original_goods_order or _("N/A"),
			),
			title=_("Ultra Dispatch — Draft Transport Order Created"),
			indicator="blue",
		)

	def get_linked_sales_order(self):
		for item in self.items:
			if item.against_sales_order:
				return item.against_sales_order
		return None


def cint_setting(value) -> bool:
	return bool(frappe.utils.cint(value))
