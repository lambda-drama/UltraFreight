import frappe
from frappe import _
from frappe.utils import format_datetime, get_url

from erpnext.selling.doctype.sales_order.sales_order import SalesOrder

from ultrafreight.ultra_freight.api.transport_dispatch import (
	initiate_transport_on_sales_order_submit,
	validate_transport_order_items,
)
from ultrafreight.ultra_freight.utils.transport_customer import (
	find_or_create_transport_customer,
	sync_transport_customer_fields,
)
from ultrafreight.ultra_freight.utils.transport_settings import get_transport_settings


class UltraFreightSalesOrder(SalesOrder):
	def validate(self):
		super().validate()
		self.validate_direct_delivery()
		self.validate_transport_order()

	def before_save(self):
		self.clear_transport_fields_from_goods_orders()
		self.handle_transport_customer()

	def clear_transport_fields_from_goods_orders(self):
		settings = get_transport_settings()
		transport_company = settings.get("ultra_transport_company")

		if self.get("custom_is_transport_order"):
			if transport_company and self.company != transport_company:
				self.custom_is_transport_order = 0
				self.custom_delivery_note_to_be_transported = None
			return

		if self.get("custom_delivery_note_to_be_transported"):
			self.custom_delivery_note_to_be_transported = None

	def on_submit(self):
		super().on_submit()
		if self.get("custom_is_transport_order"):
			initiate_transport_on_sales_order_submit(self.name)
			self.show_transport_initiated_message()

	def validate_transport_order(self):
		if not self.get("custom_is_transport_order"):
			return
		if not self.get("custom_delivery_note_to_be_transported"):
			frappe.throw(_("Delivery Note To Be Transported is required when Is Transport Order is checked"))

		settings = get_transport_settings()
		transport_company = settings.get("ultra_transport_company")
		if transport_company and self.company != transport_company:
			frappe.throw(
				_("Transport orders must belong to the transport company {0}, not {1}").format(
					transport_company, self.company
				)
			)

		transport_item = settings.get("default_transport_item")
		if transport_item:
			validate_transport_order_items(self, transport_item)

	def validate_direct_delivery(self):
		if self.get("custom_is_transport_order"):
			return
		if not self.get("require_direct_delivery"):
			return
		if not self.get("transport_customer_name") or not self.get("transport_phone"):
			frappe.throw(_("Transport Customer Name and Phone are required when direct delivery is enabled"))
		if not self.get("driver"):
			frappe.throw(_("Driver is required when direct delivery is enabled"))

	def handle_transport_customer(self):
		if self.get("custom_is_transport_order") or not self.get("require_direct_delivery"):
			return

		if self.get("transport_customer"):
			sync_transport_customer_fields(self)
			return

		if self.get("transport_customer_name") and self.get("transport_phone"):
			self.transport_customer = find_or_create_transport_customer(
				customer_name=self.transport_customer_name,
				phone_number=self.transport_phone,
				email=self.get("transport_email"),
				delivery_address=self.get("transport_address"),
			)
			sync_transport_customer_fields(self)

	def show_transport_initiated_message(self):
		dn_name = self.custom_delivery_note_to_be_transported
		if not dn_name:
			return

		otp = frappe.db.get_value("Delivery Note", dn_name, "otp")
		portal_url = get_url(
			frappe.db.get_single_value("Transport Settings", "driver_portal_url") or "/driver"
		)
		expires_at = frappe.db.get_value("Delivery Note", dn_name, "otp_expires_at")

		frappe.msgprint(
			_(
				"<b>Delivery Note:</b> {0}<br>"
				"<b>OTP:</b> {1}<br>"
				"<b>Expires:</b> {2}<br><br>"
				"Dispatch is In Transit. Create the transport invoice later from the Transport Portal "
				"after delivery is confirmed. Share the OTP with the driver at "
				"<a href='{3}' target='_blank'>{3}</a>"
			).format(
				dn_name,
				otp or "",
				format_datetime(expires_at) if expires_at else "",
				portal_url,
			),
			title=_("Ultra Dispatch — Transport Initiated"),
			indicator="green",
		)
