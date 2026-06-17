import frappe
from frappe import _
from frappe.utils import flt, get_url, now_datetime

from erpnext.controllers.accounts_controller import get_taxes_and_charges

from ultrafreight.ultra_freight.utils.email_handler import format_delivery_note_email, send_transport_email
from ultrafreight.ultra_freight.utils.sms_handler import send_transport_sms
from ultrafreight.ultra_freight.utils.transport_settings import get_transport_settings


def notify_goods_ready(delivery_note_name: str):
	doc = frappe.get_doc("Delivery Note", delivery_note_name)
	if not doc.get("require_direct_delivery"):
		return

	settings = get_transport_settings()
	email = settings.get("ultra_transport_email")
	subject = _("Goods ready for dispatch - {0}").format(doc.name)
	message = format_delivery_note_email(
		doc, _("Goods are ready for dispatch. Please arrange pickup.")
	)
	if email:
		send_transport_email([email], subject, message, "Delivery Note", doc.name)

	sms_message = _("Goods ready for dispatch. DN: {0}. Please arrange pickup.").format(doc.name)
	if email:
		send_transport_sms([email], sms_message)


def notify_on_the_way(delivery_note_name: str):
	doc = frappe.get_doc("Delivery Note", delivery_note_name)
	driver = frappe.get_doc("Driver", doc.driver) if doc.driver else None
	driver_name = driver.full_name if driver else ""
	vehicle_no = doc.get("vehicle_no") or (driver.get("vehicle_number") if driver else "")

	sms_message = _(
		"Your goods are on the way! OTP: {0}. Driver: {1}, Vehicle: {2}"
	).format(doc.otp, driver_name, vehicle_no)
	send_transport_sms([doc.get("transport_phone")], sms_message)

	portal_path = get_transport_settings().get("driver_portal_url") or "/driver-confirmation"
	portal_link = get_url(portal_path)
	email_body = format_delivery_note_email(
		doc,
		_(
			"Your goods are on the way!<br>OTP: <strong>{0}</strong><br>"
			"Driver: {1}<br>Vehicle: {2}<br>Portal: <a href='{3}'>{3}</a>"
		).format(doc.otp, driver_name, vehicle_no, portal_link),
	)
	if doc.get("transport_email"):
		send_transport_email(
			[doc.transport_email],
			_("Your delivery is on the way - {0}").format(doc.name),
			email_body,
			"Delivery Note",
			doc.name,
		)


def notify_driver_arrival(delivery_note_name: str):
	doc = frappe.get_doc("Delivery Note", delivery_note_name)
	if not doc.driver:
		return

	driver = frappe.get_doc("Driver", doc.driver)
	portal_path = get_transport_settings().get("driver_portal_url") or "/driver-confirmation"
	portal_link = get_url(f"{portal_path}?driver={driver.name}&key={driver.unique_key}")
	sms_message = _("Confirm your delivery here: {0}").format(portal_link)
	send_transport_sms([driver.cell_number], sms_message)


def notify_delivery_confirmed(delivery_note_name: str, sales_order_name: str | None = None):
	doc = frappe.get_doc("Delivery Note", delivery_note_name)
	settings = get_transport_settings()

	driver_phone = frappe.db.get_value("Driver", doc.driver, "cell_number") if doc.driver else None
	crown_customer = None
	if sales_order_name:
		crown_customer = frappe.db.get_value("Sales Order", sales_order_name, "customer")

	crown_email = frappe.db.get_value("Customer", crown_customer, "email_id") if crown_customer else None
	crown_phone = frappe.db.get_value("Customer", crown_customer, "mobile_no") if crown_customer else None

	messages = [
		(driver_phone, _("Delivery confirmed! Thank you for your service.")),
		(settings.get("ultra_transport_email"), _("Delivery confirmed for DN: {0}").format(doc.name)),
		(crown_phone or crown_email, _("Delivery confirmed for your order: {0}").format(sales_order_name or doc.name)),
		(doc.get("transport_phone"), _("Goods delivered successfully! Thank you for your business.")),
	]

	for recipient, message in messages:
		if recipient:
			if "@" in str(recipient):
				send_transport_email([recipient], _("Delivery Confirmed"), message, "Delivery Note", doc.name)
			else:
				send_transport_sms([recipient], message)


def _resolve_taxes_and_charges(doc, sales_order_name: str | None, settings: dict) -> str:
	taxes_and_charges = doc.get("taxes_and_charges")
	if not taxes_and_charges and sales_order_name:
		taxes_and_charges = frappe.db.get_value("Sales Order", sales_order_name, "taxes_and_charges")
	if not taxes_and_charges:
		taxes_and_charges = settings.get("default_sales_taxes_template")
	if not taxes_and_charges:
		frappe.throw(
			_(
				"Sales Taxes and Charges Template is required. Set it on the Delivery Note, "
				"linked Sales Order, or Transport Settings."
			)
		)
	return taxes_and_charges


def _get_item_tax_template(sales_order_name: str | None) -> str | None:
	if not sales_order_name:
		return None
	return frappe.db.get_value(
		"Sales Order Item",
		{"parent": sales_order_name, "parenttype": "Sales Order"},
		"item_tax_template",
		order_by="idx asc",
	)


def _resolve_transport_charge(sales_order_name: str | None, settings: dict) -> float:
	transport_charge = 0
	if sales_order_name:
		transport_charge = flt(
			frappe.db.get_value("Sales Order", sales_order_name, "transport_charge")
		)
	if not transport_charge:
		transport_charge = flt(settings.get("default_transport_charges"))
	return transport_charge


def create_transport_sales_invoice(delivery_note_name: str, sales_order_name: str | None = None) -> str:
	doc = frappe.get_doc("Delivery Note", delivery_note_name)
	settings = get_transport_settings()

	company = settings.get("ultra_transport_company")
	item_code = settings.get("default_transport_item")
	if not company:
		frappe.throw(_("Set Ultra Transport Company in Transport Settings"))
	if not item_code:
		frappe.throw(_("Set Default Transport Service Item in Transport Settings"))

	if doc.get("transport_sales_invoice"):
		return doc.transport_sales_invoice

	customer = doc.customer
	transport_charge = _resolve_transport_charge(sales_order_name, settings)

	if not customer:
		frappe.throw(_("Delivery Note customer is required to create transport invoice"))

	taxes_and_charges = _resolve_taxes_and_charges(doc, sales_order_name, settings)
	item_tax_template = _get_item_tax_template(sales_order_name)

	si = frappe.new_doc("Sales Invoice")
	si.company = company
	si.customer = customer
	si.posting_date = frappe.utils.today()
	si.due_date = frappe.utils.today()
	si.currency = doc.currency or frappe.db.get_value("Company", company, "default_currency")
	si.conversion_rate = doc.conversion_rate or 1
	si.selling_price_list = doc.selling_price_list
	si.taxes_and_charges = taxes_and_charges
	si.customer_address = doc.customer_address
	si.address_display = doc.address_display
	si.tax_category = doc.tax_category

	item_row = {
		"item_code": item_code,
		"qty": 1,
		"rate": transport_charge,
		"description": _("Transport service for Delivery Note {0}").format(doc.name),
		"delivery_note": doc.name,
	}
	if item_tax_template:
		item_row["item_tax_template"] = item_tax_template
	si.append("items", item_row)

	for tax in get_taxes_and_charges("Sales Taxes and Charges Template", taxes_and_charges):
		si.append("taxes", tax)

	si.run_method("set_missing_values")
	si.run_method("calculate_taxes_and_totals")
	si.insert(ignore_permissions=True)
	si.submit()

	frappe.db.set_value("Delivery Note", doc.name, "transport_sales_invoice", si.name, update_modified=False)
	return si.name


def create_confirmation_log(
	delivery_note_name: str,
	sales_order_name: str | None,
	driver_name: str | None,
	transport_customer: str | None,
	otp: str,
	status: str = "Confirmed",
	ip_address: str | None = None,
	gps_location: str | None = None,
) -> str:
	log = frappe.get_doc(
		{
			"doctype": "Delivery Confirmation Log",
			"delivery_note": delivery_note_name,
			"sales_order": sales_order_name,
			"driver": driver_name,
			"transport_customer": transport_customer,
			"otp": otp,
			"confirmation_time": now_datetime(),
			"status": status,
			"ip_address": ip_address,
			"gps_location": gps_location,
		}
	)
	log.insert(ignore_permissions=True)
	return log.name
