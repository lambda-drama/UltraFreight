import frappe
from frappe import _
from frappe.utils import get_url

from erpnext.stock.doctype.delivery_note.delivery_note import DeliveryNote

from ultrafreight.ultra_freight.api.transport_dispatch import (
	create_transport_sales_order,
	notify_transport_company_pending_dispatch,
)
from ultrafreight.ultra_freight.utils.delivery_status import normalize_delivery_status


class UltraFreightDeliveryNote(DeliveryNote):
	def validate(self):
		super().validate()
		# if self.get("require_direct_delivery") and not self.get("driver"):
		# 	frappe.throw(_("Assign a Driver before submitting a direct delivery"))
		if self.get("require_direct_delivery"):
			self.delivery_status = normalize_delivery_status(self.delivery_status)

	def on_submit(self):
		super().on_submit()
		if self.get("require_direct_delivery"):
			self.setup_dispatch()

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
