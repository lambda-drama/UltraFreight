import frappe
from frappe import _
from frappe.utils import add_to_date, format_datetime, now_datetime

from erpnext.stock.doctype.delivery_note.delivery_note import DeliveryNote

from ultrafreight.ultra_freight.api.notifications import create_transport_sales_invoice
from ultrafreight.ultra_freight.utils.otp_generator import generate_otp, get_otp_expiry_minutes


class UltraFreightDeliveryNote(DeliveryNote):
	def validate(self):
		super().validate()
		if self.get("require_direct_delivery") and not self.get("driver"):
			frappe.throw(_("Assign a Driver before submitting a direct delivery"))

	def on_submit(self):
		super().on_submit()
		if self.get("require_direct_delivery"):
			self.setup_dispatch()

	def setup_dispatch(self):
		otp = generate_otp()
		generated_at = now_datetime()
		expiry_minutes = get_otp_expiry_minutes()
		expires_at = add_to_date(generated_at, minutes=expiry_minutes)
		sales_order = self.get_linked_sales_order()

		invoice_name = create_transport_sales_invoice(self.name, sales_order)

		frappe.db.set_value(
			"Delivery Note",
			self.name,
			{
				"otp": otp,
				"otp_generated_at": generated_at,
				"otp_expires_at": expires_at,
				"delivery_status": "Pending",
				"transport_sales_invoice": invoice_name,
			},
			update_modified=False,
		)
		self.otp = otp
		self.otp_generated_at = generated_at
		self.otp_expires_at = expires_at
		self.delivery_status = "Pending"
		self.transport_sales_invoice = invoice_name

		portal_url = frappe.utils.get_url(
			frappe.db.get_single_value("Transport Settings", "driver_portal_url") or "/driver-confirmation"
		)
		frappe.msgprint(
			_(
				"<b>OTP:</b> {0}<br>"
				"<b>Expires:</b> {1}<br>"
				"<b>Transport Invoice:</b> {2}<br><br>"
				"Share the OTP with the driver. They confirm delivery at "
				"<a href='{3}' target='_blank'>{3}</a>"
			).format(otp, format_datetime(expires_at), invoice_name, portal_url),
			title=_("Ultra Dispatch — Delivery Started"),
			indicator="green",
		)

	def get_linked_sales_order(self):
		for item in self.items:
			if item.against_sales_order:
				return item.against_sales_order
		return None
