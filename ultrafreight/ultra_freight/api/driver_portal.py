import frappe
from frappe import _
from frappe.utils import now_datetime

from ultrafreight.ultra_freight.api.notifications import (
	create_confirmation_log,
	notify_delivery_confirmed,
	notify_driver_arrival,
	notify_on_the_way,
)


@frappe.whitelist()
def mark_in_transit(delivery_note: str):
	doc = frappe.get_doc("Delivery Note", delivery_note)
	if not doc.get("require_direct_delivery"):
		frappe.throw(_("This Delivery Note is not a direct delivery order"))
	if doc.docstatus != 1:
		frappe.throw(_("Delivery Note must be submitted"))
	if not doc.get("driver"):
		frappe.throw(_("Assign a driver before marking as In Transit"))
	if doc.get("delivery_status") not in (None, "", "Pending"):
		frappe.throw(_("Delivery is already {0}").format(doc.delivery_status))

	frappe.db.set_value("Delivery Note", doc.name, "delivery_status", "In Transit", update_modified=True)
	notify_on_the_way(doc.name)
	return {"status": "In Transit"}


@frappe.whitelist()
def mark_arrived(delivery_note: str):
	doc = frappe.get_doc("Delivery Note", delivery_note)
	if not doc.get("require_direct_delivery"):
		frappe.throw(_("This Delivery Note is not a direct delivery order"))
	if doc.docstatus != 1:
		frappe.throw(_("Delivery Note must be submitted"))
	if doc.get("delivery_status") != "In Transit":
		frappe.throw(_("Delivery must be In Transit before marking as Arrived"))

	frappe.db.set_value("Delivery Note", doc.name, "delivery_status", "Arrived", update_modified=True)
	notify_driver_arrival(doc.name)
	return {"status": "Arrived"}


@frappe.whitelist(allow_guest=True)
def get_active_drivers():
	return frappe.get_all(
		"Driver",
		filters={"status": "Active"},
		fields=["name", "full_name", "cell_number", "vehicle_number"],
		order_by="full_name asc",
	)


def _get_verified_driver(driver: str, unique_key: str) -> dict:
	driver_doc = frappe.db.get_value(
		"Driver",
		{"name": driver, "status": "Active"},
		["name", "full_name", "unique_key"],
		as_dict=True,
	)
	if not driver_doc:
		frappe.throw(_("Invalid driver selected"), frappe.AuthenticationError)
	if driver_doc.unique_key != unique_key:
		frappe.throw(_("Driver key does not match the selected driver"), frappe.AuthenticationError)
	return driver_doc


@frappe.whitelist(allow_guest=True)
def verify_driver_otp(driver: str, unique_key: str, otp: str):
	driver_doc = _get_verified_driver(driver, unique_key)

	delivery_note = frappe.db.get_value(
		"Delivery Note",
		{
			"otp": otp,
			"driver": driver_doc.name,
			"docstatus": 1,
			"delivery_status": ("in", ["In Transit", "Arrived", "Pending"]),
		},
		[
			"name",
			"otp_expires_at",
			"transport_customer_name",
			"transport_address",
			"delivery_status",
		],
		as_dict=True,
	)
	if not delivery_note:
		delivery_note = frappe.db.get_value(
			"Delivery Note",
			{"otp": otp, "docstatus": 1, "require_direct_delivery": 1},
			[
				"name",
				"otp_expires_at",
				"transport_customer_name",
				"transport_address",
				"delivery_status",
				"driver",
			],
			as_dict=True,
		)

	if not delivery_note:
		frappe.throw(_("Invalid OTP or no matching delivery found"), frappe.AuthenticationError)

	if delivery_note.otp_expires_at and now_datetime() > delivery_note.otp_expires_at:
		frappe.throw(_("OTP has expired"), frappe.AuthenticationError)

	items = frappe.get_all(
		"Delivery Note Item",
		filters={"parent": delivery_note.name},
		fields=["item_name", "item_code", "qty", "uom"],
	)

	return {
		"delivery_note": delivery_note.name,
		"customer_name": delivery_note.transport_customer_name,
		"address": delivery_note.transport_address,
		"delivery_status": delivery_note.delivery_status,
		"items": items,
		"driver_name": driver_doc.full_name,
	}


@frappe.whitelist(allow_guest=True)
def confirm_delivery(
	driver: str,
	unique_key: str,
	otp: str,
	delivery_note: str,
	gps_location: str | None = None,
):
	verification = verify_driver_otp(driver, unique_key, otp)
	if verification.get("delivery_note") != delivery_note:
		frappe.throw(_("Delivery Note mismatch"), frappe.AuthenticationError)

	doc = frappe.get_doc("Delivery Note", delivery_note)
	if doc.delivery_status == "Confirmed":
		frappe.throw(_("Delivery already confirmed"))

	driver_doc = _get_verified_driver(driver, unique_key)
	sales_order = None
	for item in doc.items:
		if item.against_sales_order:
			sales_order = item.against_sales_order
			break

	log_name = create_confirmation_log(
		delivery_note_name=doc.name,
		sales_order_name=sales_order,
		driver_name=driver_doc.name,
		transport_customer=doc.get("transport_customer"),
		otp=otp,
		ip_address=frappe.local.request_ip if frappe.request else None,
		gps_location=gps_location,
	)

	frappe.db.set_value(
		"Delivery Note",
		doc.name,
		{
			"delivery_status": "Confirmed",
			"confirmation_log": log_name,
		},
		update_modified=True,
	)

	notify_delivery_confirmed(doc.name, sales_order)

	return {
		"status": "Confirmed",
		"confirmation_log": log_name,
		"sales_invoice": doc.get("transport_sales_invoice"),
	}
