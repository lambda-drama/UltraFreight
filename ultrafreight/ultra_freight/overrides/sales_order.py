import frappe
from frappe import _

from erpnext.selling.doctype.sales_order.sales_order import SalesOrder

from ultrafreight.ultra_freight.utils.transport_customer import (
	find_or_create_transport_customer,
	sync_transport_customer_fields,
)


class UltraFreightSalesOrder(SalesOrder):
	def validate(self):
		super().validate()
		self.validate_direct_delivery()

	def before_save(self):
		self.handle_transport_customer()

	def validate_direct_delivery(self):
		if not self.get("require_direct_delivery"):
			return
		if not self.get("transport_customer_name") or not self.get("transport_phone"):
			frappe.throw(_("Transport Customer Name and Phone are required when direct delivery is enabled"))
		if not self.get("driver"):
			frappe.throw(_("Driver is required when direct delivery is enabled"))

	def handle_transport_customer(self):
		if not self.get("require_direct_delivery"):
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
